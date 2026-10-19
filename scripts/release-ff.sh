#!/usr/bin/env bash
# release-ff.sh — 依 elf-team-rule 發版：快轉 release（來源 origin/dev），再把 main 快轉到 release。
#
# 適用：第 3 種自有專案（skillshare-source、mcp-library、bob…）。
#       第 1、2 種（fork）的 main 是上游鏡像，請加 --no-main，只快轉 release。
#
# 依據（elf-team-rule）：
#   規則 24  快轉前依 references/05 確認關係，git log --oneline 列出要帶進去的提交給使用者看
#   規則 28  快轉 release 前查要發佈那個提交的 check runs（filter=latest），判斷方式見 references/04 第 0 節
#   規則 27  不在 release、main 上直接提交；只用 --ff-only
#   規則 30  git-guard 擋下時照訊息改正，不繞過（本腳本不會用 --no-verify）
#   references/03 B2、B3、skillshare-source AGENTS.md 的發版指令
#
# 用法（在要發版的 repo 裡用 Git Bash 執行；腳本會先切到該 repo 的根目錄，
#       對別的 repo 發版時改用這支的完整路徑）：
#   bash scripts/release-ff.sh                 # 檢查 → 列清單 → 輸入確認碼 → 快轉 release → 快轉 main
#   bash scripts/release-ff.sh --dry-run       # 只做檢查與列清單，不切分支、不推送
#   bash scripts/release-ff.sh --no-main       # 只快轉 release（第 1、2 種 repo）
#
# 需要：git、gh（已登入，能讀 check runs）。
# 每一步都會停下來要你輸入要發佈提交的前 8 碼才繼續；不提供跳過確認的參數。

set -euo pipefail

# 整支包在 main() 裡：bash 先讀完整個函式才開始執行，執行中切換分支時
# scripts/release-ff.sh 被換掉或刪掉也不影響已讀入的內容（檔尾呼叫 main 後直接 exit）。
main() {

DRY_RUN=0
DO_MAIN=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-main) DO_MAIN=0 ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    *) echo "不認得的參數：$arg（可用 --dry-run、--no-main）" >&2; exit 2 ;;
  esac
done

say()  { printf '\n== %s\n' "$*"; }
stop() { printf '\n[停止] %s\n' "$*" >&2; exit 1; }

confirm_sha() {
  # $1 = 提示文字，$2 = 期望輸入的 8 碼
  local answer
  printf '\n%s\n請輸入 %s 繼續（其他任何輸入都會停止）：' "$1" "$2"
  read -r answer
  [ "$answer" = "$2" ] || stop "沒有確認，未做任何變更。"
}

# ---------- 0. 環境 ----------
git rev-parse --show-toplevel >/dev/null 2>&1 || stop "這裡不是 git repo。"
TOP=$(git rev-parse --show-toplevel)
cd "$TOP"
command -v gh >/dev/null 2>&1 || stop "找不到 gh，無法查 check runs（規則 28）。"

[ -z "$(git status --porcelain)" ] || stop "工作目錄有未提交的變更，先處理乾淨再發版。"

ORIGIN_URL=$(git config --get remote.origin.url) || stop "沒有 origin。"
R=$(printf '%s' "$ORIGIN_URL" | sed -E 's#^(https?://[^/]+/|git@[^:]+:|ssh://git@[^/]+/)##; s#\.git$##')
printf '%s' "$R" | grep -Eq '^[^/]+/[^/]+$' || stop "無法從 origin 解析 owner/repo：$ORIGIN_URL"

START_REF=$(git symbolic-ref -q --short HEAD || git rev-parse HEAD)

# git-guard（規則 30）：skillshare-source 內有 install.sh 時順便檢查
if [ -f scripts/git-guard/install.sh ]; then
  say "git-guard 檢查"
  sh scripts/git-guard/install.sh --check . || stop "git-guard 檢查沒過，先修好再發版（規則 30）。"
fi

# release／main 不能被其他 worktree 簽出（切不過去，也代表有人在用）
for b in release main; do
  if git worktree list --porcelain | grep -qx "branch refs/heads/$b"; then
    # 和 git 自己印的路徑比（Git Bash 的 pwd 是 /e/…，git 是 E:/…）；路徑可能含空白
    wt=$(git worktree list --porcelain | awk -v b="refs/heads/$b" '/^worktree /{p=substr($0, 10)} $0=="branch "b{print p}')
    [ "$wt" = "$TOP" ] || stop "分支 $b 正在 worktree「$wt」簽出中，先在那裡切走再發版。"
  fi
done

say "git fetch --all --prune"
git fetch --all --prune

for b in dev release; do
  git rev-parse -q --verify "origin/$b" >/dev/null || stop "遠端沒有 origin/$b。"
done
[ "$DO_MAIN" = 1 ] && { git rev-parse -q --verify origin/main >/dev/null || stop "遠端沒有 origin/main。"; }

# ---------- 1. 本機分支不能超前遠端（references/05「三種共通」） ----------
for b in release main; do
  [ "$b" = main ] && [ "$DO_MAIN" = 0 ] && continue
  if git rev-parse -q --verify "refs/heads/$b" >/dev/null; then
    read -r ahead behind < <(git rev-list --left-right --count "$b...origin/$b")
    if [ "$ahead" != 0 ]; then
      # 本機已快轉但還沒推：超前的提交都在 origin/dev 上就不是本機提交，可以繼續
      if git merge-base --is-ancestor "$b" origin/dev; then
        echo "本機 $b 比 origin/$b 多 $ahead 個提交，但都已在 origin/dev 上（先前在本機快轉過、還沒推），繼續。"
      else
        stop "本機 $b 有 $ahead 個不在 origin/dev 上的提交（$b 上不能有本機提交，規則 27）。先回報，不要繼續。"
      fi
    fi
  fi
done

# ---------- 2. release 能不能快轉到 dev（規則 24、references/05） ----------
DEV_SHA=$(git rev-parse origin/dev)
DEV8=${DEV_SHA:0:8}
REL_SHA=$(git rev-parse origin/release)

say "origin/release...origin/dev（應為 0 y）"
read -r x y < <(git rev-list --left-right --count origin/release...origin/dev)
echo "$x $y"
[ "$y" != 0 ] || stop "origin/dev 沒有比 origin/release 新的提交，沒有東西要發。"
if [ "$x" != 0 ]; then
  echo "origin/release 有 $x 個 dev 沒有的提交："
  git log --oneline origin/dev..origin/release
  stop "release 不能快轉到 dev。若是 hotfix 發佈後尚未合回 dev（規則 26），先完成合回；其他情況回報，不要強制。"
fi
git merge-base --is-ancestor origin/release origin/dev || stop "origin/release 不是 origin/dev 的祖先，不能快轉。"

say "這次要發佈的提交（git log --oneline origin/release..origin/dev）"
git log --oneline origin/release..origin/dev

# ---------- 3. check runs（規則 28、references/04 第 0 節） ----------
say "origin/dev $DEV8 的 check runs（filter=latest）"
CHECKS=$(gh api "repos/$R/commits/$DEV_SHA/check-runs?filter=latest&per_page=100" \
  --jq '.check_runs[] | "\(.status) \(.conclusion) \(.name)"') || stop "gh api 查詢失敗，無法判斷 check runs。"

CI_EXCEPTION=0
if [ -z "$CHECKS" ]; then
  if [ -d .github/workflows ] && [ -n "$(ls -A .github/workflows 2>/dev/null)" ]; then
    stop "這個提交一個 check run 都沒有，但 repo 有 workflow：代表 CI 沒被觸發，不是沒有 CI（references/04 第 0 節）。先查原因，不發版。"
  fi
  echo "（一個 check run 都沒有，repo 也沒有任何 workflow）"
  echo "判斷：專案沒有 CI → 發佈內容未經自動測試。只有你明確同意這次例外才繼續，並建議開 Linear 單依 elf-cicd-* 補 CI。"
  CI_EXCEPTION=1
else
  echo "$CHECKS"
  BAD=$(printf '%s\n' "$CHECKS" | awk '$1!="completed" || ($2!="success" && $2!="neutral" && $2!="skipped")')
  if [ -n "$BAD" ]; then
    echo
    echo "未通過或還在跑的項目："
    echo "$BAD"
    stop "check runs 沒有全部通過，不發版（失敗原因依 references/04 第 3 節讀原文）。"
  fi
  echo "判斷：全部通過。"
fi

if [ "$DRY_RUN" = 1 ]; then
  say "--dry-run：檢查完成，沒有切分支、沒有推送。"
  exit 0
fi

if [ "$CI_EXCEPTION" = 1 ]; then
  confirm_sha "【例外】確認要在沒有 CI 的情況下把 release 快轉到 $DEV8？" "$DEV8"
  echo "提醒：git-guard 若擋下推送，依規則 30 只能對這一個提交用 ELF_ALLOW=$DEV8，並在回報寫明原因。"
else
  confirm_sha "確認把 release 快轉到 origin/dev（$DEV8）並推送？" "$DEV8"
fi

# ---------- 4. 快轉 release（references/03 B2） ----------
restore_branch() { git switch -q "$START_REF" 2>/dev/null || git switch -q --detach "$START_REF" 2>/dev/null || true; }
trap restore_branch EXIT

say "快轉 release"
if git rev-parse -q --verify refs/heads/release >/dev/null; then
  git switch release
else
  git switch -c release --track origin/release
fi
git merge --ff-only origin/release
git merge --ff-only origin/dev || stop "release 無法快轉到 origin/dev（--ff-only 拒絕），沒有推送。回報，不要強制。"
git push origin release

git fetch origin
[ "$(git rev-parse origin/release)" = "$DEV_SHA" ] || stop "推送後 origin/release 不是 $DEV8，請檢查。"
echo "origin/release → $DEV8"

if [ "$DO_MAIN" = 0 ]; then
  say "--no-main：只快轉 release。"
else
  # ---------- 5. 快轉 main（references/03 B3） ----------
  say "origin/main...origin/release（應為 0 y）"
  read -r mx my < <(git rev-list --left-right --count origin/main...origin/release)
  echo "$mx $my"
  if [ "$mx" != 0 ]; then
    git log --oneline origin/release..origin/main
    stop "origin/main 有 release 沒有的提交（main 上不能有直接提交，規則 27）。release 已發，main 未動；回報。"
  fi
  if [ "$my" = 0 ]; then
    echo "main 已經跟 release 對齊。"
  else
    say "要帶進 main 的提交（git log --oneline origin/main..origin/release）"
    git log --oneline origin/main..origin/release
    confirm_sha "確認把 main 快轉到 origin/release（$DEV8）並推送？" "$DEV8"
    if git rev-parse -q --verify refs/heads/main >/dev/null; then
      git switch main
    else
      git switch -c main --track origin/main
    fi
    git merge --ff-only origin/main
    git merge --ff-only origin/release || stop "main 無法快轉到 origin/release，沒有推送。回報。"
    git push origin main
    git fetch origin
  fi
fi

# ---------- 6. 對齊結果（references/05） ----------
say "對齊結果"
printf 'origin/release...origin/dev  → %s\n' "$(git rev-list --left-right --count origin/release...origin/dev | tr '\t' ' ')"
[ "$DO_MAIN" = 1 ] && printf 'origin/main...origin/release → %s\n' "$(git rev-list --left-right --count origin/main...origin/release | tr '\t' ' ')"
printf 'release=%s  dev=%s' "$(git rev-parse --short=8 origin/release)" "$(git rev-parse --short=8 origin/dev)"
[ "$DO_MAIN" = 1 ] && printf '  main=%s' "$(git rev-parse --short=8 origin/main)"
echo

say "接下來（本腳本不做）"
echo "1. 依 references/04 第 1–5 節核對 release 指向的提交上的 check runs 與部署結果。"
echo "2. 有派發步驟的 repo 照做，例如 skillshare-source：skillshare sync、bash scripts/sync-agents.sh。"
echo "3. 通知負責驗證的 session 做發版後驗證與結單。"

}

main "$@"
exit
