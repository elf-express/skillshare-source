<#
release-ff.ps1 - release per elf-team-rule: fast-forward release to origin/dev, then fast-forward main to release.
(Same flow as release-ff.sh; runs on Windows PowerShell 5.1 and PowerShell 7.)

For: type 3 own projects (skillshare-source, mcp-library, bob, ...).
     In type 1 and 2 repos (forks) main mirrors upstream: add -NoMain to fast-forward release only.

Rules (elf-team-rule):
  Rule 24  before fast-forwarding, check the relationship per references/05 and list the commits with git log --oneline
  Rule 28  before fast-forwarding release, check the check runs of the commit being released (filter=latest); see references/04 section 0
  Rule 27  never commit on release or main; --ff-only only
  Rule 30  when git-guard blocks, fix what it reports; never bypass it (this script never uses --no-verify)
  references/03 B2, B3 and the release commands in skillshare-source AGENTS.md

Usage (run inside the repo to release; the script first changes to that repo's root.
       To release another repo, call this script by its full path):
  .\scripts\release-ff.ps1             # checks -> list -> type confirmation -> fast-forward release -> fast-forward main
  .\scripts\release-ff.ps1 -DryRun     # checks and list only; no branch switch, no push
  .\scripts\release-ff.ps1 -NoMain     # fast-forward release only (type 1 and 2 repos)

Requires: git, gh (logged in, able to read check runs), and git-guard/install.sh next to this script.
Before every push you must type the first 8 characters of the commit being released; there is no option to skip this.
If the execution policy blocks the script: powershell -ExecutionPolicy Bypass -File .\scripts\release-ff.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$NoMain
)

$ErrorActionPreference = 'Stop'
# git output (commit subjects, check run names) is UTF-8
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

function Say([string]$msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

function Stop-Release([string]$msg) {
    Write-Host ""
    Write-Host "[STOP] $msg" -ForegroundColor Red
    if ($script:callerLocation) { Set-Location $script:callerLocation -ErrorAction SilentlyContinue }
    exit 1
}

# G and GTest set ErrorActionPreference to Continue inside the function:
# under Stop, Windows PowerShell 5.1 turns redirected stderr into an exception

# Runs git and stops on failure; returns trimmed stdout
function G {
    $ErrorActionPreference = 'Continue'
    $out = @(& git @args 2>&1)
    $code = $LASTEXITCODE
    # stderr is only used in the failure message; the return value is stdout only
    $stdout = ($out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" }) -join "`n"
    if ($code -ne 0) {
        $text = ($out | ForEach-Object { "$_" }) -join "`n"
        Stop-Release "git $($args -join ' ') failed (exit $code):`n$text"
    }
    return $stdout.Trim()
}

# Runs git and prints its output directly (lists shown to the user, push progress)
function GShow {
    & git @args
    if ($LASTEXITCODE -ne 0) { Stop-Release "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# Runs git and only reports success (e.g. --verify, --is-ancestor)
function GTest {
    $ErrorActionPreference = 'Continue'
    & git @args 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-Counts([string]$range) {
    $parts = (G rev-list --left-right --count $range) -split '\s+'
    return @([int]$parts[0], [int]$parts[1])
}

# $stopMsg: message used when the confirmation does not match (default: nothing was changed)
function Confirm-Sha([string]$prompt, [string]$sha8, [string]$stopMsg = 'Not confirmed. Nothing was changed.') {
    Write-Host ""
    Write-Host $prompt -ForegroundColor Yellow
    $answer = Read-Host "Type $sha8 to continue (anything else stops)"
    if ("$answer".Trim() -cne $sha8) { Stop-Release $stopMsg }
}

# ---------- 0. Environment ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Release "git not found." }
if (-not (GTest rev-parse --show-toplevel)) { Stop-Release "Not inside a git repo." }
$top = G rev-parse --show-toplevel
$script:callerLocation = Get-Location
Set-Location $top
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Release "gh not found; cannot read check runs (rule 28)." }

if (G status --porcelain) { Stop-Release "The working tree has uncommitted changes. Clean it up before releasing." }

$originUrl = & git config --get remote.origin.url
if ($LASTEXITCODE -ne 0 -or -not $originUrl) { Stop-Release "No origin remote." }
$R = ($originUrl.Trim() -replace '^(https?://[^/]+/|git@[^:]+:|ssh://git@[^/]+/)', '') -replace '\.git$', ''
if ($R -notmatch '^[^/]+/[^/]+$') { Stop-Release "Cannot parse owner/repo from origin: $originUrl" }

$startRef = & git symbolic-ref -q --short HEAD
if ($LASTEXITCODE -ne 0 -or -not $startRef) { $startRef = G rev-parse HEAD }
$startRef = "$startRef".Trim()

# git-guard (rule 30): check the target repo with the install.sh next to this script; stop if it is missing
# (needs the sh from Git for Windows)
Say "git-guard check"
$guardInstall = Join-Path $PSScriptRoot 'git-guard/install.sh'
if (-not (Test-Path $guardInstall)) {
    Stop-Release "$guardInstall not found; cannot run the git-guard check (rule 30). Use this script from skillshare-source."
}
# When sh is not on PATH (Git for Windows only adds Git\cmd by default), use bin\sh.exe in the Git folder that holds git.exe
$shCmd = Get-Command sh -ErrorAction SilentlyContinue
if ($shCmd) { $shPath = $shCmd.Source }
else { $shPath = Join-Path (Split-Path (Split-Path (Get-Command git).Source)) 'bin\sh.exe' }
if (-not (Test-Path $shPath)) {
    Stop-Release "sh not found; cannot run the git-guard check. Add Git for Windows' usr\bin or bin to PATH and run again (rule 30)."
}
& $shPath ($guardInstall -replace '\\', '/') --check .
if ($LASTEXITCODE -ne 0) { Stop-Release "git-guard check failed. Fix it before releasing (rule 30)." }

# release (and main) must not be checked out in another worktree
$here = (G rev-parse --show-toplevel) -replace '\\', '/'
# -z gives the raw, unescaped paths
$wtLines = (G worktree list --porcelain -z) -split "`0"
$guarded = @('release')
if (-not $NoMain) { $guarded += 'main' }
$currentWt = $null
foreach ($line in $wtLines) {
    if ($line -like 'worktree *') { $currentWt = ($line.Substring(9)).Trim() -replace '\\', '/' }
    foreach ($b in $guarded) {
        if ($line.Trim() -eq "branch refs/heads/$b" -and $currentWt -ne $here) {
            Stop-Release "Branch $b is checked out in worktree '$currentWt'. Switch away from it there first."
        }
    }
}

Say "git fetch --all --prune"
GShow fetch --all --prune

foreach ($b in @('dev', 'release')) {
    if (-not (GTest rev-parse -q --verify "origin/$b")) { Stop-Release "origin/$b does not exist." }
}
if (-not $NoMain -and -not (GTest rev-parse -q --verify origin/main)) { Stop-Release "origin/main does not exist." }

# ---------- 1. Local branches must not be ahead of the remote (references/05, all types) ----------
foreach ($b in @('release', 'main')) {
    if ($b -eq 'main' -and $NoMain) { continue }
    if (GTest rev-parse -q --verify "refs/heads/$b") {
        $c = Get-Counts "$b...origin/$b"
        if ($c[0] -ne 0) {
            # Fast-forwarded locally but not pushed: if every extra commit is on origin/dev, none is a local commit
            if (GTest merge-base --is-ancestor $b origin/dev) {
                Write-Host "Local $b is $($c[0]) commit(s) ahead of origin/$b, all already on origin/dev (fast-forwarded locally, not pushed). Continuing."
            }
            else {
                Stop-Release "Local $b has commits that are not on origin/dev (no local commits on $b, rule 27). Report this; do not continue."
            }
        }
    }
}

# ---------- 2. Can release fast-forward to dev (rule 24, references/05) ----------
$devSha = G rev-parse origin/dev
$dev8 = $devSha.Substring(0, 8)

Say "origin/release...origin/dev (expected: 0 y)"
$c = Get-Counts 'origin/release...origin/dev'
Write-Host "$($c[0]) $($c[1])"
if ($c[1] -eq 0) { Stop-Release "origin/dev has no commits newer than origin/release. Nothing to release." }
if ($c[0] -ne 0) {
    Write-Host "origin/release has $($c[0]) commit(s) that dev does not have:"
    GShow log --oneline origin/dev..origin/release
    Stop-Release "release cannot fast-forward to dev. If a hotfix was released and not yet merged back into dev (rule 26), finish that first; otherwise report it and do not force anything."
}
if (-not (GTest merge-base --is-ancestor origin/release origin/dev)) { Stop-Release "origin/release is not an ancestor of origin/dev; cannot fast-forward." }
# main must also fast-forward to this commit, or release would be pushed and main left behind (checked again before the main push in step 5)
if (-not $NoMain -and -not (GTest merge-base --is-ancestor origin/main $devSha)) {
    Stop-Release "origin/main is not an ancestor of origin/dev ($dev8): main has commits release does not (rule 27), so it cannot fast-forward. release and main are untouched; report this."
}

Say "Commits in this release (git log --oneline origin/release..origin/dev)"
GShow log --oneline origin/release..origin/dev

# ---------- 3. Check runs (rule 28, references/04 section 0) ----------
Say "Check runs on origin/dev $dev8 (filter=latest)"
# jq prints @tsv with no double quotes: Windows PowerShell 5.1 does not escape double quotes in arguments passed to gh.exe.
# conclusion is null (still running) -> empty field, treated as not passed below
$checksRaw = & gh api --paginate "repos/$R/commits/$devSha/check-runs?filter=latest&per_page=100" --jq '.check_runs[] | [.status, .conclusion, .name] | @tsv'
if ($LASTEXITCODE -ne 0) { Stop-Release "gh api query failed; cannot evaluate the check runs." }
$checks = @($checksRaw | Where-Object { "$_".Trim() -ne '' } | ForEach-Object { "$_".Trim() -replace "`t", ' ' })

$ciException = $false
if ($checks.Count -eq 0) {
    $hasWorkflows = [bool](G ls-tree --name-only $devSha .github/workflows/)
    if ($hasWorkflows) {
        Stop-Release "This commit has no check runs but does have workflows: CI was not triggered, which is not the same as having no CI (references/04 section 0). Find out why; not releasing."
    }
    Write-Host "(No check runs, and this commit has no workflows.)"
    Write-Host "Verdict: the project has no CI, so this release is untested. Continue only if you explicitly accept this exception, and consider a Linear issue to add CI per elf-cicd-*."
    $ciException = $true
}
else {
    $checks | ForEach-Object { Write-Host $_ }
    $bad = @($checks | Where-Object {
        $f = $_ -split ' ', 3
        -not ($f[0] -eq 'completed' -and @('success', 'neutral', 'skipped') -contains $f[1])
    })
    if ($bad.Count -gt 0) {
        Write-Host ""
        Write-Host "Not passed or still running:"
        $bad | ForEach-Object { Write-Host $_ }
        Stop-Release "Not all check runs passed; not releasing (read the failure per references/04 section 3)."
    }
    Write-Host "Verdict: all passed."
}

if ($DryRun) {
    Say "-DryRun: checks done. No branch switched, nothing pushed."
    Set-Location $script:callerLocation -ErrorAction SilentlyContinue
    exit 0
}

if ($ciException) {
    Confirm-Sha "[EXCEPTION] Fast-forward release to $dev8 with no CI?" $dev8
    Write-Host "Note: if git-guard blocks the push, rule 30 allows ELF_ALLOW=$dev8 for this one commit only, and the reason must be stated in the report."
}
else {
    Confirm-Sha "Fast-forward release to origin/dev ($dev8) and push?" $dev8
}

try {
    # ---------- 4. Fast-forward release (references/03 B2) ----------
    Say "Fast-forward release"
    if (GTest rev-parse -q --verify refs/heads/release) { GShow switch release }
    else { GShow switch -c release --track origin/release }
    GShow merge --ff-only origin/release
    & git merge --ff-only $devSha
    if ($LASTEXITCODE -ne 0) { Stop-Release "release cannot fast-forward to origin/dev (--ff-only refused); nothing pushed. Report this; do not force anything." }
    & git push origin release
    if ($LASTEXITCODE -ne 0) { Stop-Release "Push of release was rejected; origin/release is unchanged. Local release has moved to $dev8 but is not pushed. Fix what git or git-guard reported, then run again." }

    GShow fetch origin
    if ((G rev-parse origin/release) -ne $devSha) { Stop-Release "After the push, origin/release is not $dev8. Check it." }
    Write-Host "origin/release -> $dev8"

    if ($NoMain) {
        Say "-NoMain: release only."
    }
    else {
        # ---------- 5. Fast-forward main (references/03 B3) ----------
        Say "origin/main...origin/release (expected: 0 y)"
        $m = Get-Counts 'origin/main...origin/release'
        Write-Host "$($m[0]) $($m[1])"
        if ($m[0] -ne 0) {
            GShow log --oneline origin/release..origin/main
            Stop-Release "origin/main has commits release does not (no direct commits on main, rule 27). release is released, main untouched; report this."
        }
        if ($m[1] -eq 0) {
            Write-Host "main is already aligned with release."
        }
        else {
            Say "Commits going into main (git log --oneline origin/main..origin/release)"
            GShow log --oneline origin/main..origin/release
            Confirm-Sha "Fast-forward main to origin/release ($dev8) and push?" $dev8 "Not confirmed: release is released at $dev8, main is untouched. Fast-forward main later per references/03 B3."
            if (GTest rev-parse -q --verify refs/heads/main) { GShow switch main }
            else { GShow switch -c main --track origin/main }
            GShow merge --ff-only origin/main
            & git merge --ff-only $devSha
            if ($LASTEXITCODE -ne 0) { Stop-Release "main cannot fast-forward to origin/release; nothing pushed (release is released at $dev8). Report this." }
            & git push origin main
            if ($LASTEXITCODE -ne 0) { Stop-Release "Push of main was rejected: release is released at $dev8, origin/main is unchanged. Fix what git or git-guard reported, then fast-forward main per references/03 B3 (running this script again stops at 'Nothing to release')." }
            GShow fetch origin
            if ((G rev-parse origin/main) -ne $devSha) { Stop-Release "After the push, origin/main is not $dev8. Check it." }
        }
    }

    # ---------- 6. Alignment (references/05) ----------
    Say "Alignment"
    $a = Get-Counts 'origin/release...origin/dev'
    Write-Host "origin/release...origin/dev  -> $($a[0]) $($a[1])"
    $line = "release=$(G rev-parse --short=8 origin/release)  dev=$(G rev-parse --short=8 origin/dev)"
    if (-not $NoMain) {
        $b2 = Get-Counts 'origin/main...origin/release'
        Write-Host "origin/main...origin/release -> $($b2[0]) $($b2[1])"
        $line += "  main=$(G rev-parse --short=8 origin/main)"
    }
    Write-Host $line

    Say "Next (not done by this script)"
    Write-Host "1. Check the check runs and deployment of the commit release points to, per references/04 sections 1-5."
    Write-Host "2. Run the repo's distribution steps, e.g. for skillshare-source: skillshare sync, bash scripts/sync-agents.sh."
    Write-Host "3. Tell the session responsible for verification to do the post-release check and close the issue."
}
finally {
    # Switch back to the starting branch (or the starting commit if HEAD was detached)
    $ErrorActionPreference = 'Continue'
    if ($startRef -match '^[0-9a-f]{40}$') { & git -C $top switch -q --detach $startRef 2>$null }
    else { & git -C $top switch -q $startRef 2>$null }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[NOTE] Could not switch back to $startRef; now on $(& git -C $top branch --show-current 2>$null)." -ForegroundColor Yellow
    }
    Set-Location $script:callerLocation -ErrorAction SilentlyContinue
}
