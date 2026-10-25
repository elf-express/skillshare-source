<#
release-cleanup.ps1 - after a release: delete the worktrees, local branches and remote branches of the given tickets
that are already in origin/release.
(Same flow and same rules as release-cleanup.sh; runs on Windows PowerShell 5.1 and PowerShell 7.)

Only deletes what is provably safe; everything else is skipped with a reason (when in doubt, keep it):
  worktree       HEAD is an ancestor of origin/release, git status is clean (untracked files included), not locked,
                 the directory exists, and it contains no other worktree
  local branch   tip is an ancestor of origin/release, and no kept worktree uses it
  remote branch  origin/<branch> tip is an ancestor of origin/release
  A local and a remote branch with the same name are one pair: if either tip is not in origin/release, both are
  skipped; if only one side exists, only that side is checked.
Never touches dev, release, main, master, the main worktree, or the worktree this script runs in. Only looks at origin.

Matching: the last segment of a branch name starts with e-<number> followed by the end or "-" (case-insensitive).
          A detached worktree matches by a standalone e-<number> in its directory name; a directory name with two or
          more different ticket numbers is skipped.
Deleting: worktree (git worktree remove) -> local branch (git update-ref -d, with the SHA seen at check time) ->
          remote branch (git push origin --delete). No force delete, no hook bypass.

Usage (run anywhere inside the repo, ideally in the main directory):
  powershell -ExecutionPolicy Bypass -File .\scripts\release-cleanup.ps1 E-391 [E-392 ...]   # fetch -> list -> type yes -> delete
  powershell -ExecutionPolicy Bypass -File .\scripts\release-cleanup.ps1 -DryRun E-391       # fetch and list only; deletes nothing
  -Help prints this text.

Exit codes: usage error 2; stopped, confirmation not given, or any deletion failed 1; everything else 0.
The answer is trimmed (a trailing \r included) and must equal yes (lower case) to delete; there is no option to skip it.
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Help,
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$Tickets
)

$ErrorActionPreference = 'Stop'
# git output (paths, branch names) is UTF-8
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

function Show-Usage {
    Write-Host 'Usage:'
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\release-cleanup.ps1 [-DryRun] E-<n> [E-<n> ...]'
    Write-Host '  -DryRun   fetch and list only; deletes nothing'
    Write-Host '  -Help     print this usage'
    Write-Host 'Ticket numbers are E-<digits> or e-<digits>. Exit codes: usage error 2; stopped, cancelled or any failure 1; else 0.'
}

function Say([string]$msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

function Stop-Cleanup([string]$msg) {
    Write-Host ""
    Write-Host "[STOP] $msg" -ForegroundColor Red
    exit 1
}

# ---------- arguments ----------
if ($Help) { Show-Usage; exit 0 }
$nums = New-Object System.Collections.Generic.List[string]
$dry = [bool]$DryRun
foreach ($arg in @($Tickets)) {
    if ($null -eq $arg) { continue }
    if ($arg -ceq '-h' -or $arg -ceq '--help') { Show-Usage; exit 0 }
    if ($arg -ceq '--dry-run') { $dry = $true; continue }
    if ($arg -cmatch '^[Ee]-([0-9]+)\z') {
        $num = $Matches[1]
        if (-not $nums.Contains($num)) { $nums.Add($num) }
    }
    else {
        Write-Host "Unrecognized argument: $arg (ticket numbers are E-<digits>; the only option is -DryRun)"
        Write-Host ""
        Show-Usage
        exit 2
    }
}
if ($nums.Count -eq 0) {
    Write-Host "Give at least one ticket number, e.g. E-391"
    Write-Host ""
    Show-Usage
    exit 2
}

# ---------- git helper ----------
# Runs git through System.Diagnostics.Process instead of the & operator. With & , Windows PowerShell 5.1 turns
# redirected stderr into ErrorRecords (terminating under $ErrorActionPreference = 'Stop') and PowerShell 7.3+ may turn a
# non-zero exit into an error ($PSNativeCommandUseErrorActionPreference). Here stdout, stderr and the exit code are
# captured as plain values on both, an expected non-zero exit never throws, and stdin is closed so git can never wait
# for a prompt (e.g. "Should I try again? (y/n)" from git worktree remove).
function ConvertTo-ArgString([string]$a) {
    if ($a.Length -eq 0) { return '""' }
    if ($a -notmatch '[\s"]') { return $a }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append([char]34)
    $bs = 0
    foreach ($ch in $a.ToCharArray()) {
        if ($ch -eq [char]92) { $bs++ }
        elseif ($ch -eq [char]34) {
            [void]$sb.Append([char]92, $bs * 2 + 1)
            [void]$sb.Append([char]34)
            $bs = 0
        }
        else {
            if ($bs -gt 0) { [void]$sb.Append([char]92, $bs); $bs = 0 }
            [void]$sb.Append($ch)
        }
    }
    if ($bs -gt 0) { [void]$sb.Append([char]92, $bs * 2) }
    [void]$sb.Append([char]34)
    return $sb.ToString()
}

function Invoke-Git([string[]]$GitArgs) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:GitExe
    $psi.Arguments = (@($GitArgs | ForEach-Object { ConvertTo-ArgString $_ })) -join ' '
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $psi.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
    $psi.WorkingDirectory = $script:StartDir
    $proc = [System.Diagnostics.Process]::Start($psi)
    try {
        $proc.StandardInput.Close()
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
        $proc.WaitForExit()
        $result = New-Object psobject -Property @{
            Code = $proc.ExitCode
            Out  = $outTask.Result
            Err  = $errTask.Result
        }
    }
    finally {
        $proc.Dispose()
    }
    return $result
}

function Test-Prefix([string]$s, [string]$prefix) { return $s.StartsWith($prefix, [System.StringComparison]::Ordinal) }

function Get-Combined($r) { return (("$($r.Out)" + "$($r.Err)").Trim()) }

# Path comparison always uses the strings git itself prints (never the PowerShell location):
# backslashes become /, trailing / is dropped, case is ignored (better to treat two paths as the same than to miss it
# and delete the worktree the script is running in)
function Test-SamePath([string]$a, [string]$b) {
    $x = ($a -replace '\\', '/').TrimEnd('/')
    $y = ($b -replace '\\', '/').TrimEnd('/')
    return [string]::Equals($x, $y, [System.StringComparison]::OrdinalIgnoreCase)
}

try {

# ---------- 0. Environment ----------
$gitCmd = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $gitCmd) { Stop-Cleanup "git not found." }
$script:GitExe = $gitCmd.Source
$script:StartDir = [Environment]::CurrentDirectory
try {
    $loc = Get-Location
    if ($loc.Provider.Name -eq 'FileSystem') { $script:StartDir = $loc.ProviderPath }
}
catch { }

$r = Invoke-Git @('rev-parse', '--show-toplevel')
if ($r.Code -ne 0) { Stop-Cleanup "This is not inside a git worktree." }
$cur = $r.Out.Trim()

# git worktree list --porcelain -z: every field ends with NUL and records are separated by one more NUL
# (a path containing spaces is never split)
$r = Invoke-Git @('worktree', 'list', '--porcelain', '-z')
if ($r.Code -ne 0) { Stop-Cleanup "Cannot read the worktree list." }
$wts = New-Object System.Collections.Generic.List[object]
foreach ($line in ($r.Out -split "`0")) {
    if ((Test-Prefix $line 'worktree ')) {
        $wts.Add((New-Object psobject -Property @{ Path = $line.Substring(9); Head = ''; Branch = ''; Locked = $false; Prunable = $false }))
    }
    elseif ($wts.Count -eq 0) { continue }
    elseif ((Test-Prefix $line 'HEAD ')) { $wts[$wts.Count - 1].Head = $line.Substring(5) }
    elseif ((Test-Prefix $line 'branch ')) {
        $b = $line.Substring(7)
        if ((Test-Prefix $b 'refs/heads/')) { $b = $b.Substring(11) }
        $wts[$wts.Count - 1].Branch = $b
    }
    elseif ((Test-Prefix $line 'locked')) { $wts[$wts.Count - 1].Locked = $true }
    elseif ((Test-Prefix $line 'prunable')) { $wts[$wts.Count - 1].Prunable = $true }
}
if ($wts.Count -eq 0) { Stop-Cleanup "Cannot read the worktree list." }
$main = $wts[0].Path

$r = Invoke-Git @('-C', $main, 'remote', 'get-url', 'origin')
if ($r.Code -ne 0) { Stop-Cleanup "No origin remote." }

Say "git fetch origin --prune"
$r = Invoke-Git @('-C', $main, 'fetch', 'origin', '--prune')
$fetchText = Get-Combined $r
if ($fetchText) { Write-Host $fetchText }
if ($r.Code -ne 0) { Stop-Cleanup "git fetch origin failed." }
$rel = 'refs/remotes/origin/release'
$r = Invoke-Git @('-C', $main, 'rev-parse', '-q', '--verify', "$rel^{commit}")
if ($r.Code -ne 0) { Stop-Cleanup "origin/release does not exist." }

# ---------- 1. Collect ----------
# Ordinal comparers: git ref names are case-sensitive (a plain PowerShell hashtable is not)
$local = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$remote = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$r = Invoke-Git @('-C', $main, 'for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin')
if ($r.Code -ne 0) { Stop-Cleanup "Cannot read the branch list: $(Get-Combined $r)" }
foreach ($line in ($r.Out -split "`n")) {
    $line = $line.TrimEnd("`r")
    $sp = $line.IndexOf(' ')
    if ($sp -le 0) { continue }
    $sha = $line.Substring(0, $sp)
    $ref = $line.Substring($sp + 1)
    if ((Test-Prefix $ref 'refs/heads/')) { $local[$ref.Substring(11)] = $sha }
    elseif ((Test-Prefix $ref 'refs/remotes/origin/')) {
        $nm = $ref.Substring(20)
        if ($nm -cne 'HEAD') { $remote[$nm] = $sha }
    }
}

# Does the last segment of the branch name start with e-<number> (then the end or "-"), case-insensitive?
# Returns the matched number, or $null
function Get-BranchTicket([string]$name) {
    $l = $name.Substring($name.LastIndexOf('/') + 1).ToLowerInvariant()
    foreach ($n in $script:nums) {
        if ($l -ceq "e-$n" -or $l.StartsWith("e-$n-", [System.StringComparison]::Ordinal)) { return $n }
    }
    return $null
}

# The distinct standalone e-<digits> in a directory name (neighbors are the start, the end or "-")
function Get-DirIds([string]$dirName) {
    $parts = $dirName.ToLowerInvariant().Split('-')
    $ids = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i + 1 -lt $parts.Length; $i++) {
        if ($parts[$i] -ceq 'e' -and [regex]::IsMatch($parts[$i + 1], '^[0-9]+\z')) {
            if (-not $ids.Contains($parts[$i + 1])) { $ids.Add($parts[$i + 1]) }
        }
    }
    return , $ids
}

# 0 = ancestor of origin/release, 1 = not an ancestor, anything else = cannot tell
function Get-InRelease([string]$sha) {
    $r = Invoke-Git @('-C', $script:main, 'merge-base', '--is-ancestor', $sha, $script:rel)
    return $r.Code
}

# Can this worktree be deleted? Returns the reason it cannot, or '' when it can
function Get-WtVerdict([int]$i) {
    $w = $script:wts[$i]
    $p = $w.Path
    if (Test-SamePath $p $script:main) { return 'main worktree, never touched' }
    if (Test-SamePath $p $script:cur) { return 'the worktree this script runs in, not touched' }
    if ($w.Prunable -or -not (Test-Path -LiteralPath $p -PathType Container)) { return 'directory is gone (git marks it prunable)' }
    if ($w.Locked) { return 'worktree is locked' }
    # The directory holds another registered worktree (or the main worktree, or the one we run in): such a worktree can
    # sit under an ignored path where git status cannot see it, yet git worktree remove would delete it too
    # (uncommitted files included)
    $inner = (($p -replace '\\', '/').TrimEnd('/')) + '/'
    $others = @($script:wts | ForEach-Object { $_.Path }) + @($script:main, $script:cur)
    foreach ($o in $others) {
        $other = (($o -replace '\\', '/').TrimEnd('/')) + '/'
        if ($other -cne $inner -and $other.StartsWith($inner, [System.StringComparison]::OrdinalIgnoreCase)) {
            return 'directory contains other worktrees'
        }
    }
    $rc = Get-InRelease $w.Head
    if ($rc -eq 1) { return 'HEAD is not in origin/release' }
    if ($rc -ne 0) { return 'cannot tell whether HEAD is in origin/release' }
    $r = Invoke-Git @('-C', $p, 'status', '--porcelain', '--untracked-files=all')
    $text = (("$($r.Out)" + "$($r.Err)").TrimEnd("`r", "`n"))
    if ($r.Code -ne 0) { return "git status failed: $text" }
    if ($text.Length -gt 0) { return 'uncommitted changes or untracked files' }
    return ''
}

# result lists
$plan = New-Object System.Collections.Generic.List[object]    # to delete: one entry per group
$skips = New-Object System.Collections.Generic.List[object]   # skipped
$found = @{}
$wtWhy = @{}
$handled = @{}
$cand = @{}
$wtOf = New-Object 'System.Collections.Generic.Dictionary[string,int]' ([StringComparer]::Ordinal)

function Add-Skip([string]$kind, [string]$label, [string]$why) {
    $script:skips.Add((New-Object psobject -Property @{ Kind = $kind; Label = $label; Why = $why }))
}

for ($i = 0; $i -lt $wts.Count; $i++) {
    if ($wts[$i].Branch) { $wtOf[$wts[$i].Branch] = $i }
}

# First decide every candidate worktree (matched by branch, or detached and matched by directory name)
for ($i = 0; $i -lt $wts.Count; $i++) {
    if ($wts[$i].Branch) {
        $m = Get-BranchTicket $wts[$i].Branch
        if ($null -ne $m) {
            $cand[$i] = $true
            $found[$m] = $true
            $wtWhy[$i] = Get-WtVerdict $i
        }
    }
    else {
        $base = ($wts[$i].Path -replace '\\', '/').TrimEnd('/')
        $base = $base.Substring($base.LastIndexOf('/') + 1)
        $ids = Get-DirIds $base
        $hit = $false
        foreach ($n in $nums) {
            foreach ($x in $ids) {
                if ($x -ceq $n) { $found[$n] = $true; $hit = $true }
            }
        }
        if ($hit) {
            $cand[$i] = $true
            if ($ids.Count -ge 2) { $wtWhy[$i] = 'directory name has several ticket numbers' }
            else { $wtWhy[$i] = Get-WtVerdict $i }
        }
    }
}

# Branch groups: a local and a remote branch with the same name form one pair, judged together with their worktree
$gt = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$allNames = @($local.Keys) + @($remote.Keys)
foreach ($nm in $allNames) {
    if (-not $gt.ContainsKey($nm)) {
        $m = Get-BranchTicket $nm
        if ($null -ne $m) { $gt[$nm] = $m }
    }
}
$sorted = @($gt.Keys)
[Array]::Sort($sorted, [StringComparer]::Ordinal)

foreach ($nm in $sorted) {
    $found[$gt[$nm]] = $true
    $l = ''; if ($local.ContainsKey($nm)) { $l = $local[$nm] }
    $rr = ''; if ($remote.ContainsKey($nm)) { $rr = $remote[$nm] }
    $wi = -1
    if ($wtOf.ContainsKey($nm)) { $wi = $wtOf[$nm]; $handled[$wi] = $true }

    # A worktree is judged by its own conditions ($wtWhy); the branch pair has its own result (lwhy / rwhy).
    # One-way coupling: worktree skipped -> its local and remote branches are skipped too; a skipped branch does not
    # change whether the worktree is deleted.
    $lwhy = ''; $rwhy = ''; $wwhy = ''
    if ($wi -ge 0 -and $wtWhy.ContainsKey($wi)) { $wwhy = [string]$wtWhy[$wi] }
    if (@('dev', 'release', 'main', 'master') -ccontains $nm) {
        $lwhy = 'protected branch, never touched'; $rwhy = $lwhy; $wwhy = $lwhy
    }

    if (-not $lwhy -and $wwhy) {
        $lwhy = 'worktree is skipped, so the branch is kept too'; $rwhy = $lwhy
    }

    if (-not $lwhy) {
        $lstat = ''; $rstat = ''
        if ($l) {
            $c = Get-InRelease $l
            if ($c -eq 0) { $lstat = 'ok' } elseif ($c -eq 1) { $lstat = 'no' } else { $lstat = 'err' }
        }
        if ($rr) {
            $c = Get-InRelease $rr
            if ($c -eq 0) { $rstat = 'ok' } elseif ($c -eq 1) { $rstat = 'no' } else { $rstat = 'err' }
        }
        if ($lstat -eq 'no' -or $lstat -eq 'err') { $lwhy = 'local branch tip is not in origin/release' }
        if ($rstat -eq 'no' -or $rstat -eq 'err') { $rwhy = 'remote branch tip is not in origin/release' }
        # pairing: if either side fails, both are skipped
        if ($lwhy -and -not $rwhy -and $rr) { $rwhy = 'the local branch of the same name is not in origin/release, so both are kept' }
        if ($rwhy -and -not $lwhy -and $l) { $lwhy = 'the remote branch of the same name is not in origin/release, so both are kept' }
    }

    if ($wi -ge 0 -and $wwhy) { Add-Skip 'worktree' "$($wts[$wi].Path) (branch $nm)" $wwhy }
    if ($l -and $lwhy) { Add-Skip 'local branch' $nm $lwhy }
    if ($rr -and $rwhy) { Add-Skip 'remote branch' "origin/$nm" $rwhy }

    # To delete: a worktree with no reason to skip is deleted; the branches only if neither side has a reason
    # (at delete time the worktree removal must also have succeeded)
    $wtpath = ''; $dl = ''; $dr = ''
    if ($wi -ge 0 -and -not $wwhy) { $wtpath = $wts[$wi].Path }
    if (-not $lwhy -and -not $rwhy) { $dl = $l; $dr = $rr }
    if ($wtpath -or $dl -or $dr) {
        $plan.Add((New-Object psobject -Property @{ Wt = $wtpath; Name = $nm; L = $dl; R = $dr }))
    }
}

# Remaining candidate worktrees: detached ones, or ones whose branch has no commit yet (no such local ref)
for ($i = 0; $i -lt $wts.Count; $i++) {
    if (-not $cand.ContainsKey($i) -or $handled.ContainsKey($i)) { continue }
    if ($wts[$i].Branch) {
        Add-Skip 'worktree' "$($wts[$i].Path) (branch $($wts[$i].Branch))" 'branch has no commits yet or cannot be found'
    }
    elseif ($wtWhy[$i]) {
        Add-Skip 'worktree' "$($wts[$i].Path) (detached)" ([string]$wtWhy[$i])
    }
    else {
        $plan.Add((New-Object psobject -Property @{ Wt = $wts[$i].Path; Name = ''; L = ''; R = '' }))
    }
}

function Get-Short([string]$sha) {
    if ($sha.Length -gt 8) { return $sha.Substring(0, 8) }
    return $sha
}

# ---------- 2. List ----------
$nDel = 0
Say "To delete"
foreach ($e in $plan) {
    if ($e.Wt) { Write-Host "  worktree       $($e.Wt)"; $nDel++ }
    if ($e.L) { Write-Host "  local branch   $($e.Name) ($(Get-Short $e.L))"; $nDel++ }
    if ($e.R) { Write-Host "  remote branch  origin/$($e.Name) ($(Get-Short $e.R))"; $nDel++ }
}
if ($nDel -eq 0) { Write-Host "  (none)" }

Say "Skipped"
foreach ($s in $skips) { Write-Host "  $($s.Kind)  $($s.Label): $($s.Why)" }
if ($skips.Count -eq 0) { Write-Host "  (none)" }

foreach ($n in $nums) {
    if (-not $found.ContainsKey($n)) { Write-Host ""; Write-Host "E-$n has no matching branch or worktree" }
}

if ($nDel -eq 0) {
    Say "Nothing to delete. No changes made."
    exit 0
}
if ($dry) {
    Say "-DryRun: listed only, nothing was deleted."
    exit 0
}

# ---------- 3. Confirm ----------
Write-Host ""
Write-Host "$nDel item(s) to delete above. Type yes to delete (anything else cancels): " -NoNewline
$answer = [Console]::In.ReadLine()
if ($null -eq $answer) { $answer = '' }
$answer = $answer.Trim()
if ($answer -cne 'yes') {
    Write-Host ""
    Stop-Cleanup "Not confirmed. No changes made."
}

# ---------- 4. Delete ----------
$done = New-Object System.Collections.Generic.List[object]
$fails = New-Object System.Collections.Generic.List[string]
$skippedNow = 0

Say "Deleting"
foreach ($e in $plan) {
    $wt = $e.Wt; $nm = $e.Name; $l = $e.L; $rr = $e.R
    $ok = $true
    if ($wt) {
        $r = Invoke-Git @('-C', $main, 'worktree', 'remove', $wt)
        $gitMsg = Get-Combined $r
        if ($r.Code -eq 0 -and -not (Test-Path -LiteralPath $wt)) {
            $done.Add((New-Object psobject -Property @{ Kind = 'worktree'; Text = "worktree $wt" }))
            Write-Host "  deleted worktree $wt"
        }
        else {
            $ok = $false
            if (Test-Path -LiteralPath $wt) {
                $extra = ''; if ($gitMsg) { $extra = " (git: $gitMsg)" }
                $fails.Add("worktree ${wt}: directory is in use, close whatever holds it and delete it by hand$extra")
            }
            else {
                $fails.Add("worktree ${wt}: git worktree remove failed ($gitMsg)")
            }
            Write-Host "  FAILED: worktree $wt"
        }
    }
    if (-not $ok) {
        if ($l) { $skippedNow++; Write-Host "  skipped local branch ${nm}: the worktree was not removed, so the branch is kept" }
        if ($rr) { $skippedNow++; Write-Host "  skipped remote branch origin/${nm}: the worktree was not removed, so the branch is kept" }
        continue
    }
    if ($l) {
        $r = Invoke-Git @('-C', $main, 'update-ref', '-d', "refs/heads/$nm", $l)
        if ($r.Code -eq 0) {
            $done.Add((New-Object psobject -Property @{ Kind = 'branch'; Text = "local branch $nm $l" }))
            Write-Host "  deleted local branch $nm"
        }
        else {
            $ok = $false
            $fails.Add("local branch ${nm}: git update-ref failed ($(Get-Combined $r))")
            Write-Host "  FAILED: local branch $nm"
        }
    }
    if ($rr) {
        if (-not $ok) {
            $skippedNow++
            Write-Host "  skipped remote branch origin/${nm}: the local branch was not removed, so both are kept"
        }
        else {
            $r = Invoke-Git @('-C', $main, 'push', 'origin', '--delete', $nm)
            if ($r.Code -eq 0) {
                $done.Add((New-Object psobject -Property @{ Kind = 'branch'; Text = "remote branch origin/$nm $rr" }))
                Write-Host "  deleted remote branch origin/$nm"
            }
            else {
                $fails.Add("remote branch origin/${nm}: git push origin --delete failed ($(Get-Combined $r))")
                Write-Host "  FAILED: remote branch origin/$nm"
            }
        }
    }
}

# ---------- 5. Summary ----------
Say "Summary"
Write-Host "Deleted $($done.Count), skipped $($skips.Count + $skippedNow), failed $($fails.Count)"
$recover = $false
foreach ($d in $done) {
    if ($d.Kind -eq 'branch') { $recover = $true; Write-Host "  $($d.Text)" }
}
if ($recover) {
    Write-Host "To get a branch back: git branch <name> <full SHA printed above> (the deleted commits are all in origin/release, so nothing is lost)."
}
if ($fails.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed items:"
    foreach ($f in $fails) { Write-Host "  $f" }
    exit 1
}
exit 0

}
catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "$($_.ScriptStackTrace)"
    exit 1
}
