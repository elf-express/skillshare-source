#!/usr/bin/env bash
# release-cleanup.test.sh — release-cleanup.sh（Git Bash 版）與 release-cleanup.ps1（PowerShell 版）共用的沙盒測試。
#
# 用法（在 Git Bash 執行；每個案例各建一組全新的 bare origin + clone + worktree，只斷言 git 狀態與結束碼）：
#   bash scripts/release-cleanup.test.sh                  # 兩版都跑（IMPL=all，預設）
#   IMPL=sh  bash scripts/release-cleanup.test.sh         # 只跑 .sh
#   IMPL=ps1 bash scripts/release-cleanup.test.sh         # 只跑 .ps1（優先 powershell.exe，其次 pwsh，可用 PS_EXE 指定；
#                                                         # 都找不到時整組 SKIP 並印警告；腳本不存在則每個案例 FAIL）
#   bash scripts/release-cleanup.test.sh C01 C16          # 只跑指定案例
#
# 結尾印 "PASS <n> FAIL <n> SKIP <n>"，有 FAIL 時 exit 1。
# 測試沙盒設假 HOME 與 GIT_CONFIG_NOSYSTEM=1，不讀使用者的全域 git 設定（不觸發本機 git-guard），
# 比照 scripts/git-guard/tests/run.sh。不加進 CI。

set -u

HERE=$(cd "$(dirname "$0")" && pwd)
SH_SCRIPT="$HERE/release-cleanup.sh"
PS1_SCRIPT="$HERE/release-cleanup.ps1"
IMPL=${IMPL:-all}
case "$IMPL" in
  sh|ps1|all) ;;
  *) echo "IMPL 只能是 sh、ps1 或 all（目前是 $IMPL）" >&2; exit 2 ;;
esac

ROOT=$(mktemp -d "${TMPDIR:-/tmp}/release-cleanup-test.XXXXXX")
BGPIDS="$ROOT/bgpids"

# 結束背景程序（C16 用來占用目錄的 powershell），不留孤兒行程。
kill_bg() {
  local p
  if [ -f "$BGPIDS" ]; then
    while read -r p; do
      [ -n "$p" ] || continue
      taskkill //F //T //PID "$p" >/dev/null 2>&1 || kill -9 "$p" >/dev/null 2>&1 || true
    done < "$BGPIDS"
    : > "$BGPIDS"
    sleep 1
  fi
}
cleanup() {
  kill_bg
  rm -rf "$ROOT" 2>/dev/null || { sleep 2; rm -rf "$ROOT" 2>/dev/null || true; }
}
trap cleanup EXIT
trap 'exit 130' INT TERM

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_NOSYSTEM=1
# 不讀也不寫使用者真正的全域 git 設定
export HOME="$ROOT/home"
mkdir -p "$HOME"
printf '[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n' > "$HOME/.gitconfig"
export GIT_CONFIG_GLOBAL="$HOME/.gitconfig"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE ELF_ALLOW

TMO=()
if command -v timeout >/dev/null 2>&1; then TMO=(timeout 180); fi

# .ps1 的直譯器：PS_EXE 優先，其次 powershell.exe（5.1），再其次 pwsh；都沒有時 PS_BIN 為空，整組 ps1 SKIP
PS_BIN=""
if [ -n "${PS_EXE:-}" ]; then
  PS_BIN=$PS_EXE
elif command -v powershell.exe >/dev/null 2>&1; then
  PS_BIN=powershell.exe
elif command -v pwsh >/dev/null 2>&1; then
  PS_BIN=pwsh
fi
if { [ "$IMPL" = ps1 ] || [ "$IMPL" = all ]; } && [ -z "$PS_BIN" ]; then
  echo "警告：找不到 powershell.exe 或 pwsh，也沒設 PS_EXE，ps1 版整組 SKIP。" >&2
fi

PASS=0
FAIL=0
SKIP=0

# ---------- 沙盒 ----------

G() { git -C "$W" "$@"; }

NOREL=0

# 全新沙盒：bare origin（main、dev、release、master 四條都有）＋ clone（$W，停在 main，四條本機都有）
mksandbox() {
  D="$ROOT/$IMPL-$CASE"
  W="$D/work"
  NOREL=0
  rm -rf "$D"
  mkdir -p "$D/wt"
  git init -q --bare -b main "$D/origin.git" || return 1
  git init -q -b main "$D/seed" || return 1
  (
    cd "$D/seed" || exit 1
    echo seed > README
    git add README && git commit -q -m init || exit 1
    git push -q "$D/origin.git" main:main main:dev main:release main:master || exit 1
  ) || return 1
  git clone -q "$D/origin.git" "$W" 2>/dev/null || return 1
  local b
  for b in dev release master; do
    G branch -q "$b" "origin/$b" || return 1
  done
  return 0
}

# origin 沒有 release（C13）：直接在 bare origin 上刪掉 release，work clone 沒 fetch，
# refs/remotes/origin/release 與本機 release 都還在，要靠腳本自己的 fetch --prune 才會發現 origin 沒有 release
drop_release() {
  git -C "$D/origin.git" update-ref -d refs/heads/release || return 1
  G rev-parse -q --verify refs/remotes/origin/release >/dev/null || { echo "    前置條件錯誤：過期的 origin/release 追蹤分支不在"; return 1; }
  NOREL=1
}

# 從 main 開分支並做一個提交；分支不簽出
mkbranch() {
  local n=$1 f="f_${1//\//_}"
  G switch -q -c "$n" main || return 1
  echo "$n" > "$W/$f"
  G add "$f" || return 1
  G commit -q -m "work $n" || return 1
  G switch -q main
}
publish() { G push -q origin "$1"; }

# 把指定的提交／分支併進 release 並推上去（--no-ff，之後它們都是 origin/release 的祖先）
release_merge() {
  G switch -q release || return 1
  local r
  for r in "$@"; do
    G merge -q --no-ff -m "release $r" "$r" || { G switch -q main; return 1; }
  done
  G push -q origin release || { G switch -q main; return 1; }
  G switch -q main
}

# add_wt <目錄名（放在 $D/wt 下）> <分支>
add_wt() { G worktree add -q "$D/wt/$1" "$2"; }
add_wt_detached() { G worktree add -q --detach "$D/wt/$1" "$2"; }

# 已進 release 的分支：有提交、推到 origin、併進 release、有同層 worktree
released_wt() { mkbranch "$1" && publish "$1" && release_merge "$1" && add_wt "$2" "$1"; }

# ---------- 執行腳本 ----------

# run_cleanup <工作目錄> <stdin 內容> <參數...> → 設 RC，輸出存 $LOG
run_cleanup() {
  local cwd=$1 input=$2
  shift 2
  LOG="$D/run.log"
  case "$IMPL" in
    sh)
      ( cd "$cwd" && printf '%s' "$input" | "${TMO[@]}" bash "$SH_SCRIPT" "$@" ) > "$LOG" 2>&1
      RC=$?
      ;;
    ps1)
      if [ ! -f "$PS1_SCRIPT" ]; then
        echo "找不到 $PS1_SCRIPT" > "$LOG"
        RC=127
        return 0
      fi
      local args=() a
      for a in "$@"; do
        if [ "$a" = --dry-run ]; then a=-DryRun; fi
        args+=("$a")
      done
      ( cd "$cwd" && printf '%s' "$input" | "${TMO[@]}" "$PS_BIN" -NoProfile -ExecutionPolicy Bypass \
          -File "$(cygpath -w "$PS1_SCRIPT")" "${args[@]}" ) > "$LOG" 2>&1
      RC=$?
      ;;
  esac
  if [ -n "${VERBOSE:-}" ]; then
    echo "--- [$IMPL] rc=$RC: $* ---"
    cat "$LOG"
  fi
}

# ---------- 斷言（失敗時印原因並 return 1） ----------

assert_rc() {
  if [ "$RC" != "$1" ]; then
    echo "    結束碼應為 $1，實際 $RC"
    echo "    --- 腳本輸出 ---"
    sed 's/^/    /' "$LOG"
    return 1
  fi
}

# worktree 清單裡有沒有路徑以 $D/<相對路徑> 結尾的項目（git 印 C:/…，這裡用尾端比對）
wt_listed() {
  local p
  while IFS= read -r p; do
    if [[ $p == */"$1" ]]; then return 0; fi
  done < <(G worktree list --porcelain | sed -n 's/^worktree //p')
  return 1
}
assert_wt_gone() {
  if wt_listed "$1"; then echo "    worktree $1 還在 git worktree list 裡"; return 1; fi
  if [ -e "$D/$1" ]; then echo "    目錄 $1 還在"; return 1; fi
}
assert_wt_kept() {
  if ! wt_listed "$1"; then echo "    worktree $1 不在 git worktree list 裡"; return 1; fi
  if [ ! -d "$D/$1" ]; then echo "    目錄 $1 不見了"; return 1; fi
}
has_local() { G show-ref --verify -q "refs/heads/$1"; }
has_remote() { [ -n "$(G ls-remote --heads origin "refs/heads/$1")" ]; }
assert_local_gone() { if has_local "$1"; then echo "    本機分支 $1 還在"; return 1; fi; }
assert_local_kept() { if ! has_local "$1"; then echo "    本機分支 $1 不見了"; return 1; fi; }
assert_remote_gone() { if has_remote "$1"; then echo "    遠端分支 $1 還在"; return 1; fi; }
assert_remote_kept() { if ! has_remote "$1"; then echo "    遠端分支 $1 不見了"; return 1; fi; }

# dev／release／main／master 本機與遠端都還在（C13 沒有 release），主 worktree 也還在
assert_protected() {
  local b
  for b in dev release main master; do
    if [ "$b" = release ] && [ "$NOREL" = 1 ]; then continue; fi
    if ! has_local "$b"; then echo "    本機 $b 不見了"; return 1; fi
    if ! has_remote "$b"; then echo "    遠端 $b 不見了"; return 1; fi
  done
  if [ ! -d "$W/.git" ]; then echo "    主 worktree 不見了"; return 1; fi
}

# ---------- 案例（回傳 0＝通過、77＝SKIP、其他＝失敗） ----------

case_C01() {
  mksandbox && released_wt feat/e-5-x wt-e5 || return 1
  run_cleanup "$W" $'yes\n' E-5
  assert_rc 0 && assert_wt_gone wt/wt-e5 && assert_local_gone feat/e-5-x && assert_remote_gone feat/e-5-x && assert_protected
}

case_C02() {
  mksandbox || return 1
  echo '.ocrca/' >> "$W/.git/info/exclude"
  G branch -q e-6 main && G worktree add -q "$W/.ocrca/e-6-plan" e-6 || return 1
  run_cleanup "$W" $'yes\n' E-6
  assert_rc 0 && assert_wt_gone work/.ocrca/e-6-plan && assert_local_gone e-6 && assert_remote_gone e-6 && assert_protected
}

case_C03() {
  mksandbox && add_wt_detached wt-e-7-spec main || return 1
  run_cleanup "$W" $'yes\n' E-7
  assert_rc 0 && assert_wt_gone wt/wt-e-7-spec && assert_protected
}

case_C04() {
  mksandbox && released_wt feat/e-8-x wt-e8 || return 1
  echo more >> "$D/wt/wt-e8/f_feat_e-8-x"
  run_cleanup "$W" $'yes\n' E-8
  assert_rc 0 && assert_wt_kept wt/wt-e8 && assert_local_kept feat/e-8-x && assert_remote_kept feat/e-8-x && assert_protected
}

case_C05() {
  mksandbox && released_wt feat/e-9-x wt-e9 || return 1
  echo u > "$D/wt/wt-e9/untracked.txt"
  run_cleanup "$W" $'yes\n' E-9
  assert_rc 0 && assert_wt_kept wt/wt-e9 && assert_local_kept feat/e-9-x && assert_remote_kept feat/e-9-x && assert_protected
}

case_C06() {
  mksandbox && mkbranch feat/e-10-x && publish feat/e-10-x && add_wt wt-e10 feat/e-10-x || return 1
  run_cleanup "$W" $'yes\n' E-10
  assert_rc 0 && assert_wt_kept wt/wt-e10 && assert_local_kept feat/e-10-x && assert_remote_kept feat/e-10-x && assert_protected
}

case_C07() {
  mksandbox && released_wt feat/e-11-x wt-e11 || return 1
  G worktree lock "$D/wt/wt-e11" || return 1
  run_cleanup "$W" $'yes\n' E-11
  assert_rc 0 && assert_wt_kept wt/wt-e11 && assert_local_kept feat/e-11-x && assert_remote_kept feat/e-11-x && assert_protected
}

# 腳本在含空白的 worktree 目錄裡執行：該 worktree 與分支不能被刪
case_C08() {
  mksandbox && released_wt feat/e-12-x "feat e-12-x" || return 1
  run_cleanup "$D/wt/feat e-12-x" $'yes\n' E-12
  assert_rc 0 && assert_wt_kept "wt/feat e-12-x" && assert_local_kept feat/e-12-x && assert_remote_kept feat/e-12-x && assert_protected
}

# E-39 不能配到 e-391
case_C09() {
  mksandbox && mkbranch e-391 && mkbranch feat/e-391-x && publish e-391 && publish feat/e-391-x \
    && release_merge e-391 feat/e-391-x && add_wt wt-e391 e-391 && add_wt wt-e391x feat/e-391-x || return 1
  run_cleanup "$W" $'yes\n' E-39
  assert_rc 0 && assert_wt_kept wt/wt-e391 && assert_wt_kept wt/wt-e391x \
    && assert_local_kept e-391 && assert_local_kept feat/e-391-x && assert_remote_kept e-391 && assert_remote_kept feat/e-391-x \
    && assert_protected
}

case_C10() {
  mksandbox && released_wt feat/e-5-x wt-e5 || return 1
  run_cleanup "$W" $'yes\n' --dry-run E-5
  assert_rc 0 && assert_wt_kept wt/wt-e5 && assert_local_kept feat/e-5-x && assert_remote_kept feat/e-5-x && assert_protected
}

case_C11() {
  mksandbox && released_wt feat/e-5-x wt-e5 || return 1
  run_cleanup "$W" $'no\n' E-5
  assert_rc 1 && assert_wt_kept wt/wt-e5 && assert_local_kept feat/e-5-x && assert_remote_kept feat/e-5-x || return 1
  run_cleanup "$W" '' E-5
  assert_rc 1 && assert_wt_kept wt/wt-e5 && assert_local_kept feat/e-5-x && assert_remote_kept feat/e-5-x && assert_protected
}

case_C12() {
  mksandbox && released_wt feat/e-5-x wt-e5 || return 1
  run_cleanup "$W" $'yes\n'
  assert_rc 2 || return 1
  run_cleanup "$W" $'yes\n' 391
  assert_rc 2 || return 1
  run_cleanup "$W" $'yes\n' E-abc
  assert_rc 2 && assert_wt_kept wt/wt-e5 && assert_local_kept feat/e-5-x && assert_remote_kept feat/e-5-x && assert_protected
}

case_C13() {
  mksandbox && drop_release && mkbranch feat/e-5-x && publish feat/e-5-x && add_wt wt-e5 feat/e-5-x || return 1
  run_cleanup "$W" $'yes\n' E-5
  assert_rc 1 && assert_wt_kept wt/wt-e5 && assert_local_kept feat/e-5-x && assert_remote_kept feat/e-5-x && assert_protected
}

# 目錄名稱有兩個單號的 detached worktree 一律跳過
case_C14() {
  mksandbox && add_wt_detached wt-e-13-x-e-14 main || return 1
  run_cleanup "$W" $'yes\n' E-14
  assert_rc 0 && assert_wt_kept wt/wt-e-13-x-e-14 || return 1
  run_cleanup "$W" $'yes\n' E-13
  assert_rc 0 && assert_wt_kept wt/wt-e-13-x-e-14 && assert_protected
}

# 本機分支沒有 upstream、主 worktree 停在不含該提交的 main，仍照「可刪的條件」刪
case_C15() {
  mksandbox && mkbranch e-15 && release_merge e-15 || return 1
  if G merge-base --is-ancestor e-15 main; then echo "    前置條件錯誤：main 不該含 e-15 的提交"; return 1; fi
  run_cleanup "$W" $'yes\n' E-15
  assert_rc 0 && assert_local_gone e-15 && assert_remote_gone e-15 && assert_protected
}

# worktree 目錄被背景程序占用（只在 Windows 跑）：目錄仍在、exit 1
case_C16() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) ;;
    *) echo "SKIP: 目錄占用只在 Windows 模擬"; return 77 ;;
  esac
  command -v powershell.exe >/dev/null 2>&1 || { echo "SKIP: 找不到 powershell.exe"; return 77; }
  mksandbox && released_wt feat/e-19-x wt-e19 || return 1
  local wt="$D/wt/wt-e19" ww pid wpid i occupied=0
  ww=$(cygpath -w "$wt")
  # PowerShell 的 Set-Location 只改它自己的位置，不會改行程的工作目錄；要再設 CurrentDirectory 才真的占住該目錄
  powershell.exe -NoProfile -Command "Set-Location -LiteralPath '$ww'; [Environment]::CurrentDirectory = (Get-Location).Path; Start-Sleep 60" >/dev/null 2>&1 &
  pid=$!
  wpid=$(cat "/proc/$pid/winpid" 2>/dev/null || echo "$pid")
  echo "$wpid" >> "$BGPIDS"
  # 等到程序真的站在該目錄裡：改名探測失敗（Windows 不能改名別的程序正在使用的目錄）才算占用
  for i in $(seq 1 60); do
    if mv "$wt" "$wt.probe" 2>/dev/null; then
      mv "$wt.probe" "$wt" || { echo "    探測改名後改回失敗"; kill_bg; return 1; }
      sleep 0.25
    else
      occupied=1
      break
    fi
  done
  if [ "$occupied" != 1 ]; then echo "    背景程序一直沒有占用目錄"; kill_bg; return 1; fi
  run_cleanup "$W" $'yes\n' E-19
  local rc_ok=0
  assert_rc 1 && [ -d "$wt" ] && assert_local_kept feat/e-19-x && assert_remote_kept feat/e-19-x && assert_protected || rc_ok=1
  kill_bg
  [ "$rc_ok" = 0 ] || { [ -d "$wt" ] || echo "    目錄不見了"; return 1; }
}

# 分支大小寫和參數不同
case_C17() {
  mksandbox && released_wt feat/E-16-X wt-E16 || return 1
  run_cleanup "$W" $'yes\n' e-16
  assert_rc 0 && assert_wt_gone wt/wt-E16 && assert_local_gone feat/E-16-X && assert_remote_gone feat/E-16-X && assert_protected
}

# 只有遠端分支（別台電腦開的）
case_C18() {
  mksandbox && mkbranch feat/e-17-x && publish feat/e-17-x && release_merge feat/e-17-x || return 1
  G update-ref -d refs/heads/feat/e-17-x || return 1
  G fetch -q origin || return 1
  assert_remote_kept feat/e-17-x || return 1
  run_cleanup "$W" $'yes\n' E-17
  assert_rc 0 && assert_remote_gone feat/e-17-x && assert_local_gone feat/e-17-x && assert_protected
}

# worktree 目錄被手動刪掉（git 標成 prunable）：不報錯、列為跳過，分支保留
case_C19() {
  mksandbox && released_wt feat/e-18-x wt-e18 || return 1
  rm -rf "$D/wt/wt-e18"
  run_cleanup "$W" $'yes\n' E-18
  assert_rc 0 && assert_local_kept feat/e-18-x && assert_remote_kept feat/e-18-x || return 1
  # 腳本不能順手 prune：prunable 的 worktree 項目仍在 git worktree list 裡
  if ! wt_listed wt/wt-e18; then echo "    prunable 的 worktree 項目不見了（被 prune 了）"; return 1; fi
  assert_protected
}

# Windows 終端輸入 yes 會帶 \r
case_C20() {
  mksandbox && released_wt feat/e-5-x wt-e5 || return 1
  run_cleanup "$W" $'yes\r\n' E-5
  assert_rc 0 && assert_wt_gone wt/wt-e5 && assert_local_gone feat/e-5-x && assert_remote_gone feat/e-5-x && assert_protected
}

# 同名本機與遠端分支配成一組：本機多一個沒進 release 的提交，遠端已進 release → 兩端都保留
case_C21() {
  mksandbox && mkbranch feat/e-20-x && publish feat/e-20-x && release_merge feat/e-20-x || return 1
  G switch -q feat/e-20-x || return 1
  echo more >> "$W/f_feat_e-20-x"
  G add f_feat_e-20-x && G commit -q -m "local only" && G switch -q main || return 1
  run_cleanup "$W" $'yes\n' E-20
  assert_rc 0 && assert_local_kept feat/e-20-x && assert_remote_kept feat/e-20-x && assert_protected
}

# 候選 worktree 本身乾淨，但目錄內（被 .gitignore／info/exclude 忽略的路徑下）巢狀著另一個 worktree：
# git status 看不到它，git worktree remove 卻會連它一起刪 → 整個候選跳過，分支一併保留
case_C22() {
  mksandbox && released_wt feat/e-21-x wt-e21 || return 1
  echo '.ocrca/' >> "$W/.git/info/exclude"
  local nested="$D/wt/wt-e21/.ocrca/e-31-plan"
  G worktree add -q --detach "$nested" main || return 1
  echo precious > "$nested/uncommitted.txt"
  run_cleanup "$W" $'yes\n' E-21
  assert_rc 0 && assert_wt_kept wt/wt-e21 && assert_wt_kept wt/wt-e21/.ocrca/e-31-plan \
    && assert_local_kept feat/e-21-x && assert_remote_kept feat/e-21-x || return 1
  if [ ! -f "$nested/uncommitted.txt" ]; then echo "    巢狀 worktree 裡的未提交檔不見了"; return 1; fi
  # 從巢狀的 worktree 裡執行：外層（候選）是所在 worktree 的上層目錄，同樣要保留
  run_cleanup "$nested" $'yes\n' E-21
  assert_rc 0 && assert_wt_kept wt/wt-e21 && assert_wt_kept wt/wt-e21/.ocrca/e-31-plan \
    && assert_local_kept feat/e-21-x && assert_remote_kept feat/e-21-x || return 1
  if [ ! -f "$nested/uncommitted.txt" ]; then echo "    巢狀 worktree 裡的未提交檔不見了"; return 1; fi
  assert_protected
}

# worktree 只看自己的條件：HEAD 已進 release、乾淨 → 照刪；同名遠端分支多一個沒進 release 的提交 → 兩端分支保留
case_C23() {
  mksandbox && released_wt feat/e-22-x wt-e22 || return 1
  local wt="$D/wt/wt-e22"
  echo more >> "$wt/f_feat_e-22-x"
  git -C "$wt" add f_feat_e-22-x && git -C "$wt" commit -q -m "ahead" && git -C "$wt" push -q origin feat/e-22-x || return 1
  git -C "$wt" reset -q --hard HEAD~1 || return 1
  run_cleanup "$W" $'yes\n' E-22
  assert_rc 0 && assert_wt_gone wt/wt-e22 && assert_local_kept feat/e-22-x && assert_remote_kept feat/e-22-x && assert_protected
}

# 候選 worktree 乾淨、已進 release，但被忽略的路徑下有一個巢狀的獨立 git repo（有未提交的檔案與未推的提交）：
# git status 看不到它，git worktree remove 卻會連它一起刪 → 整個候選跳過，worktree 與分支都保留
case_C24() {
  mksandbox && released_wt feat/e-22-x wt-e22 || return 1
  echo 'ign/' >> "$W/.git/info/exclude"
  local wt="$D/wt/wt-e22" inner="$D/wt/wt-e22/ign/inner"
  mkdir -p "$inner" && git -C "$inner" init -q -b main || return 1
  echo kept > "$inner/a.txt"
  git -C "$inner" add a.txt && git -C "$inner" commit -q -m "inner commit" || return 1
  echo precious > "$inner/p.txt"
  if [ -n "$(git -C "$wt" status --porcelain --untracked-files=all)" ]; then echo "    前置條件錯誤：外層 worktree 應該是乾淨的"; return 1; fi
  run_cleanup "$W" $'yes\n' E-22
  assert_rc 0 && assert_wt_kept wt/wt-e22 && assert_local_kept feat/e-22-x && assert_remote_kept feat/e-22-x || return 1
  if [ ! -f "$inner/p.txt" ] || [ ! -f "$inner/a.txt" ]; then echo "    巢狀 repo 裡的檔案不見了"; return 1; fi
  assert_protected
}

# 本機 release 有一個還沒推上去的合併，origin/release 沒有：判斷一律看 origin/release → 全部保留
case_C25() {
  mksandbox && mkbranch feat/e-23-x && publish feat/e-23-x && add_wt wt-e23 feat/e-23-x || return 1
  G switch -q release && G merge -q --no-ff -m "local only merge" feat/e-23-x && G switch -q main || return 1
  if ! G merge-base --is-ancestor feat/e-23-x release; then echo "    前置條件錯誤：本機 release 應含 feat/e-23-x"; return 1; fi
  if G merge-base --is-ancestor feat/e-23-x origin/release; then echo "    前置條件錯誤：origin/release 不該含 feat/e-23-x"; return 1; fi
  run_cleanup "$W" $'yes\n' E-23
  assert_rc 0 && assert_wt_kept wt/wt-e23 && assert_local_kept feat/e-23-x && assert_remote_kept feat/e-23-x && assert_protected
}

# origin/release 是別的 clone 剛推上去的，work clone 事前沒有 fetch：腳本自己的 fetch 要看得到 → 照刪
case_C26() {
  mksandbox && mkbranch feat/e-24-x && publish feat/e-24-x && add_wt wt-e24 feat/e-24-x || return 1
  git clone -q "$D/origin.git" "$D/second" 2>/dev/null || return 1
  git -C "$D/second" switch -q -c release origin/release || return 1
  git -C "$D/second" fetch -q origin || return 1
  git -C "$D/second" merge -q --no-ff -m "release e-24" origin/feat/e-24-x || return 1
  git -C "$D/second" push -q origin release || return 1
  if G merge-base --is-ancestor feat/e-24-x origin/release; then echo "    前置條件錯誤：work clone 的 origin/release 不該已經是新的"; return 1; fi
  run_cleanup "$W" $'yes\n' E-24
  assert_rc 0 && assert_wt_gone wt/wt-e24 && assert_local_gone feat/e-24-x && assert_remote_gone feat/e-24-x && assert_protected
}

# 候選 worktree 正在做 git 操作（這裡用 bisect）：即使乾淨、已進 release 也跳過，分支一併保留
case_C27() {
  mksandbox && released_wt feat/e-25-x wt-e25 || return 1
  git -C "$D/wt/wt-e25" bisect start >/dev/null 2>&1 || return 1
  if [ ! -e "$(git -C "$D/wt/wt-e25" rev-parse --path-format=absolute --git-path BISECT_LOG)" ]; then echo "    前置條件錯誤：bisect 沒有留下 BISECT_LOG"; return 1; fi
  if [ -n "$(git -C "$D/wt/wt-e25" status --porcelain --untracked-files=all)" ]; then echo "    前置條件錯誤：worktree 應該是乾淨的"; return 1; fi
  run_cleanup "$W" $'yes\n' E-25
  assert_rc 0 && assert_wt_kept wt/wt-e25 && assert_local_kept feat/e-25-x && assert_remote_kept feat/e-25-x && assert_protected
}

# 同一條分支被兩個 worktree 簽出（git worktree add -f）：分支與兩個 worktree 都保留
case_C28() {
  mksandbox && released_wt feat/e-26-x wt-e26a || return 1
  G worktree add -q -f "$D/wt/wt-e26b" feat/e-26-x || return 1
  run_cleanup "$W" $'yes\n' E-26
  assert_rc 0 && assert_wt_kept wt/wt-e26a && assert_wt_kept wt/wt-e26b && assert_local_kept feat/e-26-x && assert_remote_kept feat/e-26-x && assert_protected
}

# 目錄名稱和單號無關的 worktree 正在 rebase（HEAD 是 detached）：它正在改寫的分支算使用中 → 分支與 worktree 都保留
case_C29() {
  mksandbox && mkbranch feat/e-27-x && publish feat/e-27-x && release_merge feat/e-27-x || return 1
  G switch -q -c other main || return 1
  echo other > "$W/f_feat_e-27-x"
  G add f_feat_e-27-x && G commit -q -m "conflicting file" && G switch -q main || return 1
  add_wt wt-reb feat/e-27-x || return 1
  git -C "$D/wt/wt-reb" rebase other >/dev/null 2>&1 && { echo "    前置條件錯誤：rebase 應該停在衝突"; return 1; }
  if [ -n "$(git -C "$D/wt/wt-reb" symbolic-ref -q HEAD)" ]; then echo "    前置條件錯誤：HEAD 應該是 detached"; return 1; fi
  run_cleanup "$W" $'yes\n' E-27
  assert_rc 0 && assert_wt_kept wt/wt-reb && assert_local_kept feat/e-27-x && assert_remote_kept feat/e-27-x && assert_protected
}

# ---------- 執行 ----------

ALL_CASES="C01 C02 C03 C04 C05 C06 C07 C08 C09 C10 C11 C12 C13 C14 C15 C16 C17 C18 C19 C20 C21 C22 C23 C24 C25 C26 C27 C28 C29"
if [ $# -gt 0 ]; then SEL="$*"; else SEL="$ALL_CASES"; fi
case "$IMPL" in
  all) IMPLS="sh ps1" ;;
  *) IMPLS="$IMPL" ;;
esac

for impl in $IMPLS; do
  for c in $SEL; do
    if ! declare -F "case_$c" >/dev/null; then
      echo "不認得的案例：$c" >&2
      exit 2
    fi
    if [ "$impl" = ps1 ] && [ -z "$PS_BIN" ]; then
      SKIP=$((SKIP + 1))
      echo "SKIP [ps1] $c（找不到 PowerShell：powershell.exe、pwsh 都沒有，也沒設 PS_EXE）"
      continue
    fi
    CLOG="$ROOT/$impl-$c.log"
    ( IMPL=$impl; CASE=$c; exec </dev/null; "case_$c" ) > "$CLOG" 2>&1
    rc=$?
    case $rc in
      0)
        PASS=$((PASS + 1))
        echo "ok   [$impl] $c"
        if [ -n "${VERBOSE:-}" ]; then sed 's/^/    /' "$CLOG"; fi
        ;;
      77)
        SKIP=$((SKIP + 1))
        echo "SKIP [$impl] $c  $(head -n 1 "$CLOG")"
        ;;
      *)
        FAIL=$((FAIL + 1))
        echo "FAIL [$impl] $c"
        sed 's/^/    /' "$CLOG"
        ;;
    esac
    kill_bg
  done
done

echo "PASS $PASS FAIL $FAIL SKIP $SKIP"
[ "$FAIL" -eq 0 ]
