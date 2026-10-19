<#
release-ff.ps1 — 依 elf-team-rule 發版：快轉 release（來源 origin/dev），再把 main 快轉到 release。
（與 release-ff.sh 同一套流程；Windows PowerShell 5.1 與 PowerShell 7 都能跑）

適用：第 3 種自有專案（skillshare-source、mcp-library、bob…）。
      第 1、2 種（fork）的 main 是上游鏡像，請加 -NoMain，只快轉 release。

依據（elf-team-rule）：
  規則 24  快轉前依 references/05 確認關係，git log --oneline 列出要帶進去的提交給使用者看
  規則 28  快轉 release 前查要發佈那個提交的 check runs（filter=latest），判斷方式見 references/04 第 0 節
  規則 27  不在 release、main 上直接提交；只用 --ff-only
  規則 30  git-guard 擋下時照訊息改正，不繞過（本腳本不會用 --no-verify）
  references/03 B2、B3、skillshare-source AGENTS.md 的發版指令

用法（在要發版的 repo 裡執行；腳本會先切到該 repo 的根目錄，
      對別的 repo 發版時改用這支的完整路徑）：
  .\scripts\release-ff.ps1             # 檢查 → 列清單 → 輸入確認碼 → 快轉 release → 快轉 main
  .\scripts\release-ff.ps1 -DryRun     # 只做檢查與列清單，不切分支、不推送
  .\scripts\release-ff.ps1 -NoMain     # 只快轉 release（第 1、2 種 repo）

需要：git、gh（已登入，能讀 check runs）。
每次推送前都要輸入要發佈提交的前 8 碼；不提供跳過確認的參數。
執行原則擋下時：powershell -ExecutionPolicy Bypass -File .\scripts\release-ff.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$NoMain
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

function Say([string]$msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

function Stop-Release([string]$msg) {
    Write-Host ""
    Write-Host "[停止] $msg" -ForegroundColor Red
    exit 1
}

# 執行 git，失敗就停；回傳去掉頭尾空白的 stdout
function G {
    $out = & git @args 2>&1
    $code = $LASTEXITCODE
    $text = ($out | ForEach-Object { "$_" }) -join "`n"
    if ($code -ne 0) { Stop-Release "git $($args -join ' ') 失敗（exit $code）：`n$text" }
    return $text.Trim()
}

# 執行 git 並把輸出直接印出（給使用者看的清單、推送過程）
function GShow {
    & git @args
    if ($LASTEXITCODE -ne 0) { Stop-Release "git $($args -join ' ') 失敗（exit $LASTEXITCODE）" }
}

# git 指令只看成功與否（例如 --verify、--is-ancestor）
function GTest {
    & git @args 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-Counts([string]$range) {
    $parts = (G rev-list --left-right --count $range) -split '\s+'
    return @([int]$parts[0], [int]$parts[1])
}

function Confirm-Sha([string]$prompt, [string]$sha8) {
    Write-Host ""
    Write-Host $prompt -ForegroundColor Yellow
    $answer = Read-Host "請輸入 $sha8 繼續（其他任何輸入都會停止）"
    if ($answer -ne $sha8) { Stop-Release "沒有確認，未做任何變更。" }
}

# ---------- 0. 環境 ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Release "找不到 git。" }
if (-not (GTest rev-parse --show-toplevel)) { Stop-Release "這裡不是 git repo。" }
Set-Location (G rev-parse --show-toplevel)
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Release "找不到 gh，無法查 check runs（規則 28）。" }

if (G status --porcelain) { Stop-Release "工作目錄有未提交的變更，先處理乾淨再發版。" }

$originUrl = & git config --get remote.origin.url
if ($LASTEXITCODE -ne 0 -or -not $originUrl) { Stop-Release "沒有 origin。" }
$R = ($originUrl.Trim() -replace '^(https?://[^/]+/|git@[^:]+:|ssh://git@[^/]+/)', '') -replace '\.git$', ''
if ($R -notmatch '^[^/]+/[^/]+$') { Stop-Release "無法從 origin 解析 owner/repo：$originUrl" }

$startRef = & git symbolic-ref -q --short HEAD
if ($LASTEXITCODE -ne 0 -or -not $startRef) { $startRef = G rev-parse HEAD }
$startRef = "$startRef".Trim()

# git-guard（規則 30）：skillshare-source 內有 install.sh 時順便檢查（需要 Git for Windows 的 sh）
if (Test-Path 'scripts/git-guard/install.sh') {
    Say "git-guard 檢查"
    if (-not (Get-Command sh -ErrorAction SilentlyContinue)) {
        Stop-Release "找不到 sh，無法執行 git-guard 檢查。把 Git for Windows 的 usr\bin 或 bin 加進 PATH 後再跑（規則 30）。"
    }
    & sh scripts/git-guard/install.sh --check .
    if ($LASTEXITCODE -ne 0) { Stop-Release "git-guard 檢查沒過，先修好再發版（規則 30）。" }
}

# release／main 不能被其他 worktree 簽出
$here = (G rev-parse --show-toplevel) -replace '\\', '/'
$wtLines = (G worktree list --porcelain) -split "`n"
$currentWt = $null
foreach ($line in $wtLines) {
    if ($line -like 'worktree *') { $currentWt = ($line.Substring(9)).Trim() -replace '\\', '/' }
    foreach ($b in @('release', 'main')) {
        if ($line.Trim() -eq "branch refs/heads/$b" -and $currentWt -ne $here) {
            Stop-Release "分支 $b 正在 worktree「$currentWt」簽出中，先在那裡切走再發版。"
        }
    }
}

Say "git fetch --all --prune"
GShow fetch --all --prune

foreach ($b in @('dev', 'release')) {
    if (-not (GTest rev-parse -q --verify "origin/$b")) { Stop-Release "遠端沒有 origin/$b。" }
}
if (-not $NoMain -and -not (GTest rev-parse -q --verify origin/main)) { Stop-Release "遠端沒有 origin/main。" }

# ---------- 1. 本機分支不能超前遠端（references/05「三種共通」） ----------
foreach ($b in @('release', 'main')) {
    if ($b -eq 'main' -and $NoMain) { continue }
    if (GTest rev-parse -q --verify "refs/heads/$b") {
        $c = Get-Counts "$b...origin/$b"
        if ($c[0] -ne 0) {
            # 本機已快轉但還沒推：超前的提交都在 origin/dev 上就不是本機提交，可以繼續
            if (GTest merge-base --is-ancestor $b origin/dev) {
                Write-Host "本機 $b 比 origin/$b 多 $($c[0]) 個提交，但都已在 origin/dev 上（先前在本機快轉過、還沒推），繼續。"
            }
            else {
                Stop-Release "本機 $b 有 $($c[0]) 個不在 origin/dev 上的提交（$b 上不能有本機提交，規則 27）。先回報，不要繼續。"
            }
        }
    }
}

# ---------- 2. release 能不能快轉到 dev（規則 24、references/05） ----------
$devSha = G rev-parse origin/dev
$dev8 = $devSha.Substring(0, 8)

Say "origin/release...origin/dev（應為 0 y）"
$c = Get-Counts 'origin/release...origin/dev'
Write-Host "$($c[0]) $($c[1])"
if ($c[1] -eq 0) { Stop-Release "origin/dev 沒有比 origin/release 新的提交，沒有東西要發。" }
if ($c[0] -ne 0) {
    Write-Host "origin/release 有 $($c[0]) 個 dev 沒有的提交："
    GShow log --oneline origin/dev..origin/release
    Stop-Release "release 不能快轉到 dev。若是 hotfix 發佈後尚未合回 dev（規則 26），先完成合回；其他情況回報，不要強制。"
}
if (-not (GTest merge-base --is-ancestor origin/release origin/dev)) { Stop-Release "origin/release 不是 origin/dev 的祖先，不能快轉。" }

Say "這次要發佈的提交（git log --oneline origin/release..origin/dev）"
GShow log --oneline origin/release..origin/dev

# ---------- 3. check runs（規則 28、references/04 第 0 節） ----------
Say "origin/dev $dev8 的 check runs（filter=latest）"
$checksRaw = & gh api "repos/$R/commits/$devSha/check-runs?filter=latest&per_page=100" --jq '.check_runs[] | "\(.status) \(.conclusion) \(.name)"'
if ($LASTEXITCODE -ne 0) { Stop-Release "gh api 查詢失敗，無法判斷 check runs。" }
$checks = @($checksRaw | Where-Object { "$_".Trim() -ne '' } | ForEach-Object { "$_".Trim() })

$ciException = $false
if ($checks.Count -eq 0) {
    $hasWorkflows = (Test-Path '.github/workflows') -and (@(Get-ChildItem '.github/workflows' -Force -ErrorAction SilentlyContinue).Count -gt 0)
    if ($hasWorkflows) {
        Stop-Release "這個提交一個 check run 都沒有，但 repo 有 workflow：代表 CI 沒被觸發，不是沒有 CI（references/04 第 0 節）。先查原因，不發版。"
    }
    Write-Host "（一個 check run 都沒有，repo 也沒有任何 workflow）"
    Write-Host "判斷：專案沒有 CI → 發佈內容未經自動測試。只有你明確同意這次例外才繼續，並建議開 Linear 單依 elf-cicd-* 補 CI。"
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
        Write-Host "未通過或還在跑的項目："
        $bad | ForEach-Object { Write-Host $_ }
        Stop-Release "check runs 沒有全部通過，不發版（失敗原因依 references/04 第 3 節讀原文）。"
    }
    Write-Host "判斷：全部通過。"
}

if ($DryRun) {
    Say "-DryRun：檢查完成，沒有切分支、沒有推送。"
    exit 0
}

if ($ciException) {
    Confirm-Sha "【例外】確認要在沒有 CI 的情況下把 release 快轉到 $dev8？" $dev8
    Write-Host "提醒：git-guard 若擋下推送，依規則 30 只能對這一個提交用 ELF_ALLOW=$dev8，並在回報寫明原因。"
}
else {
    Confirm-Sha "確認把 release 快轉到 origin/dev（$dev8）並推送？" $dev8
}

try {
    # ---------- 4. 快轉 release（references/03 B2） ----------
    Say "快轉 release"
    if (GTest rev-parse -q --verify refs/heads/release) { GShow switch release }
    else { GShow switch -c release --track origin/release }
    GShow merge --ff-only origin/release
    & git merge --ff-only origin/dev
    if ($LASTEXITCODE -ne 0) { Stop-Release "release 無法快轉到 origin/dev（--ff-only 拒絕），沒有推送。回報，不要強制。" }
    GShow push origin release

    GShow fetch origin
    if ((G rev-parse origin/release) -ne $devSha) { Stop-Release "推送後 origin/release 不是 $dev8，請檢查。" }
    Write-Host "origin/release → $dev8"

    if ($NoMain) {
        Say "-NoMain：只快轉 release。"
    }
    else {
        # ---------- 5. 快轉 main（references/03 B3） ----------
        Say "origin/main...origin/release（應為 0 y）"
        $m = Get-Counts 'origin/main...origin/release'
        Write-Host "$($m[0]) $($m[1])"
        if ($m[0] -ne 0) {
            GShow log --oneline origin/release..origin/main
            Stop-Release "origin/main 有 release 沒有的提交（main 上不能有直接提交，規則 27）。release 已發，main 未動；回報。"
        }
        if ($m[1] -eq 0) {
            Write-Host "main 已經跟 release 對齊。"
        }
        else {
            Say "要帶進 main 的提交（git log --oneline origin/main..origin/release）"
            GShow log --oneline origin/main..origin/release
            Confirm-Sha "確認把 main 快轉到 origin/release（$dev8）並推送？" $dev8
            if (GTest rev-parse -q --verify refs/heads/main) { GShow switch main }
            else { GShow switch -c main --track origin/main }
            GShow merge --ff-only origin/main
            & git merge --ff-only origin/release
            if ($LASTEXITCODE -ne 0) { Stop-Release "main 無法快轉到 origin/release，沒有推送。回報。" }
            GShow push origin main
            GShow fetch origin
        }
    }

    # ---------- 6. 對齊結果（references/05） ----------
    Say "對齊結果"
    $a = Get-Counts 'origin/release...origin/dev'
    Write-Host "origin/release...origin/dev  → $($a[0]) $($a[1])"
    $line = "release=$(G rev-parse --short=8 origin/release)  dev=$(G rev-parse --short=8 origin/dev)"
    if (-not $NoMain) {
        $b2 = Get-Counts 'origin/main...origin/release'
        Write-Host "origin/main...origin/release → $($b2[0]) $($b2[1])"
        $line += "  main=$(G rev-parse --short=8 origin/main)"
    }
    Write-Host $line

    Say "接下來（本腳本不做）"
    Write-Host "1. 依 references/04 第 1–5 節核對 release 指向的提交上的 check runs 與部署結果。"
    Write-Host "2. 有派發步驟的 repo 照做，例如 skillshare-source：skillshare sync、bash scripts/sync-agents.sh。"
    Write-Host "3. 通知負責驗證的 session 做發版後驗證與結單。"
}
finally {
    # 切回執行前的分支
    & git switch -q $startRef 2>$null
    if ($LASTEXITCODE -ne 0) { & git switch -q --detach $startRef 2>$null }
}
