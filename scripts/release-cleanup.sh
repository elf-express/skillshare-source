#!/usr/bin/env bash
# release-cleanup.sh — 發版後收尾：刪除已進 origin/release 的單號所對應的 worktree、本機分支與遠端分支。
#
# 只刪「可證明安全」的項目，其餘一律跳過並列出原因（寧可少刪）：
#   worktree  HEAD 是 origin/release 的祖先、git status 乾淨（含未追蹤檔）、沒被 lock、目錄還在、目錄內沒有其他 worktree
#   本機分支  末端是 origin/release 的祖先，且沒有被保留下來的 worktree 使用
#   遠端分支  origin/<分支> 末端是 origin/release 的祖先
#   同名的本機與遠端分支視為一組：任一端末端不在 origin/release，兩端都跳過；只有一端存在時只看那一端
# 一律不碰 dev、release、main、master、主 worktree、腳本執行所在的 worktree。只看 origin。
#
# 比對：分支名稱最後一段以 e-<編號> 開頭、後面是結尾或 -（大小寫不分）；detached 的 worktree 依目錄名稱裡
#       獨立的 e-<編號> 比對，目錄名稱有兩個以上不同單號就跳過。
# 刪除順序：worktree（git worktree remove）→ 本機分支（git update-ref -d，帶檢查時的 SHA）→ 遠端分支
#           （git push origin --delete）。不用強制刪除、不跳過 hook。
#
# 用法（在 repo 任一位置用 Git Bash 執行，建議在主目錄）：
#   bash scripts/release-cleanup.sh E-391 [E-392 …]             # fetch → 列「要刪／跳過」清單 → 輸入 yes → 刪除
#   bash scripts/release-cleanup.sh --dry-run E-391             # 只 fetch 並列清單，什麼都不刪
#
# 結束碼：用法錯誤 2；停下、取消確認、任一項刪除失敗 1；其餘 0。
# 確認輸入去掉前後空白（含 \r）後等於 yes 才刪；不提供跳過確認的參數。

set -euo pipefail

# 整支包在 main() 裡：bash 先讀完整個函式才開始執行，執行中 scripts/release-cleanup.sh 被換掉或刪掉
# 也不影響已讀入的內容（檔尾呼叫 main 後直接 exit）。
main() {

usage() {
  sed -n '2,21p' "$0"
}

DRY_RUN=0
NUMS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ $arg =~ ^[Ee]-([0-9]+)$ ]]; then
        num=${BASH_REMATCH[1]}
        case " ${NUMS[*]-} " in
          *" $num "*) ;;
          *) NUMS+=("$num") ;;
        esac
      else
        printf '不認得的參數：%s（單號只接受 E-<數字>，其他可用 --dry-run）\n\n' "$arg" >&2
        usage >&2
        exit 2
      fi
      ;;
  esac
done
if [ "${#NUMS[@]}" -eq 0 ]; then
  printf '請給至少一個單號，例：E-391\n\n' >&2
  usage >&2
  exit 2
fi

say()  { printf '\n== %s\n' "$*"; }
stop() { printf '\n[停止] %s\n' "$*" >&2; exit 1; }

# 路徑比對一律用 git 自己印的字串（Git Bash 的 $PWD 是 /e/…，git 是 E:/…）；
# 去掉結尾斜線、不分大小寫（寫成寧可多判成同一個，也不能漏判而刪到自己所在的 worktree）
same_path() {
  local a=${1%/} b=${2%/}
  [ "${a,,}" = "${b,,}" ]
}

# ---------- 0. 環境 ----------
git rev-parse --show-toplevel >/dev/null 2>&1 || stop "這裡不是 git repo 的工作區。"
CUR=$(git rev-parse --show-toplevel)

# git worktree list --porcelain -z：欄位以 NUL 結尾、每筆之間多一個 NUL（路徑含空白也不會被切壞）
WP=(); WH=(); WB=(); WLOCK=(); WPRUN=()
nwt=0
while IFS= read -r -d '' line; do
  case "$line" in
    "worktree "*)
      WP[nwt]=${line#worktree }; WH[nwt]=""; WB[nwt]=""; WLOCK[nwt]=0; WPRUN[nwt]=0
      nwt=$((nwt + 1))
      ;;
    "HEAD "*) WH[nwt - 1]=${line#HEAD } ;;
    "branch "*) b=${line#branch }; WB[nwt - 1]=${b#refs/heads/} ;;
    locked*) WLOCK[nwt - 1]=1 ;;
    prunable*) WPRUN[nwt - 1]=1 ;;
  esac
done < <(git worktree list --porcelain -z)
[ "$nwt" -gt 0 ] || stop "讀不到 worktree 清單。"
MAIN=${WP[0]}

git -C "$MAIN" remote get-url origin >/dev/null 2>&1 || stop "沒有 origin 遠端。"

say "git fetch origin --prune"
git -C "$MAIN" fetch origin --prune </dev/null || stop "git fetch origin 失敗。"
REL=refs/remotes/origin/release
git -C "$MAIN" rev-parse -q --verify "$REL^{commit}" >/dev/null || stop "遠端沒有 origin/release。"

# ---------- 1. 收集 ----------
declare -A LOCAL=() REMOTE=()
while read -r sha ref; do
  case "$ref" in
    refs/heads/*) LOCAL["${ref#refs/heads/}"]=$sha ;;
    refs/remotes/origin/*)
      nm=${ref#refs/remotes/origin/}
      if [ "$nm" != HEAD ]; then REMOTE["$nm"]=$sha; fi
      ;;
  esac
done < <(git -C "$MAIN" for-each-ref --format='%(objectname) %(refname)' refs/heads refs/remotes/origin)

# 分支名稱最後一段是否以 e-<編號> 開頭（後面是結尾或 -，大小寫不分）；符合時設 MATCHED
MATCHED=""
branch_ticket() {
  local l=${1##*/} n
  l=${l,,}
  for n in "${NUMS[@]}"; do
    if [[ $l == "e-$n" || $l == "e-$n-"* ]]; then MATCHED=$n; return 0; fi
  done
  return 1
}

# 目錄名稱裡獨立的 e-<數字>（前後是開頭／結尾／-）：把不同的數字放進 DIR_IDS
DIR_IDS=()
dir_ids() {
  local parts=() i id seen x
  local IFS=-
  read -ra parts <<< "${1,,}"
  DIR_IDS=()
  for ((i = 0; i + 1 < ${#parts[@]}; i++)); do
    if [ "${parts[i]}" = e ] && [[ ${parts[i + 1]} =~ ^[0-9]+$ ]]; then
      id=${parts[i + 1]}
      seen=0
      for x in "${DIR_IDS[@]}"; do
        if [ "$x" = "$id" ]; then seen=1; fi
      done
      if [ "$seen" = 0 ]; then DIR_IDS+=("$id"); fi
    fi
  done
}

in_release() {  # $1 = SHA；0＝是祖先、1＝不是、其他＝無法判斷
  local rc=0
  git -C "$MAIN" merge-base --is-ancestor "$1" "$REL" >/dev/null 2>&1 || rc=$?
  return $rc
}

# 檢查一個 worktree 能不能刪；結果放 WHY（空字串＝可刪）
WHY=""
wt_verdict() {
  local i=$1 p=${WP[$1]} rc out inner other
  WHY=""
  if same_path "$p" "$MAIN"; then WHY="主 worktree，一律不動"; return 0; fi
  if same_path "$p" "$CUR"; then WHY="腳本執行所在的 worktree，不動"; return 0; fi
  if [ "${WPRUN[i]}" = 1 ] || [ ! -d "$p" ]; then WHY="目錄已不存在（git 標為 prunable）"; return 0; fi
  if [ "${WLOCK[i]}" = 1 ]; then WHY="worktree 被 lock"; return 0; fi
  # 目錄內含其他已登記的 worktree（或主 worktree、所在 worktree）：它們可能放在被忽略的路徑下，
  # git status 看不到，git worktree remove 卻會連它們（含未提交的檔案）一起刪掉
  inner=${p%/}/
  for other in "${WP[@]}" "$MAIN" "$CUR"; do
    other=${other%/}/
    if [ "$other" != "$inner" ] && [[ ${other,,} == "${inner,,}"* ]]; then
      WHY="目錄內含其他工作區"
      return 0
    fi
  done
  rc=0
  in_release "${WH[i]}" || rc=$?
  case $rc in
    0) ;;
    1) WHY="HEAD 未達 origin/release"; return 0 ;;
    *) WHY="無法判斷 HEAD 是否已進 origin/release"; return 0 ;;
  esac
  if ! out=$(git -C "$p" status --porcelain --untracked-files=all 2>&1 </dev/null); then
    WHY="git status 失敗：$out"
    return 0
  fi
  if [ -n "$out" ]; then WHY="有未提交的變更或未追蹤檔"; return 0; fi
}

# 結果清單
P_WT=(); P_NAME=(); P_L=(); P_R=()   # 要刪：每一組一筆（worktree 路徑、分支名、本機 SHA、遠端 SHA；沒有的欄位為空）
S_KIND=(); S_LABEL=(); S_WHY=()      # 跳過
declare -A FOUND=() WT_WHY=() WT_HANDLED=() WT_OF=()

add_skip() { S_KIND+=("$1"); S_LABEL+=("$2"); S_WHY+=("$3"); }

for ((i = 0; i < nwt; i++)); do
  if [ -n "${WB[i]}" ]; then WT_OF["${WB[i]}"]=$i; fi
done

# 先判斷所有候選 worktree 的結果（分支比對成功的、detached 且目錄名稱比對成功的）
declare -A WT_CAND=()
for ((i = 0; i < nwt; i++)); do
  if [ -n "${WB[i]}" ]; then
    if branch_ticket "${WB[i]}"; then
      WT_CAND[$i]=1
      FOUND["$MATCHED"]=1
      wt_verdict "$i"
      WT_WHY[$i]=$WHY
    fi
  else
    base=${WP[i]%/}
    base=${base##*/}
    dir_ids "$base"
    hit=0
    for n in "${NUMS[@]}"; do
      for x in "${DIR_IDS[@]}"; do
        if [ "$x" = "$n" ]; then FOUND["$n"]=1; hit=1; fi
      done
    done
    if [ "$hit" = 1 ]; then
      WT_CAND[$i]=1
      if [ "${#DIR_IDS[@]}" -ge 2 ]; then
        WT_WHY[$i]="目錄名稱有多個單號"
      else
        wt_verdict "$i"
        WT_WHY[$i]=$WHY
      fi
    fi
  fi
done

# 分支組：同名的本機與遠端分支配成一組，連同它的 worktree 一起判斷
GROUPS_NAMES=()
declare -A GT=()
for nm in "${!LOCAL[@]}" "${!REMOTE[@]}"; do
  if [ -z "${GT[$nm]-}" ] && branch_ticket "$nm"; then
    GT["$nm"]=$MATCHED
    GROUPS_NAMES+=("$nm")
  fi
done
SORTED=()
if [ "${#GROUPS_NAMES[@]}" -gt 0 ]; then
  while IFS= read -r nm; do SORTED+=("$nm"); done < <(printf '%s\n' "${GROUPS_NAMES[@]}" | LC_ALL=C sort)
fi

for nm in "${SORTED[@]+"${SORTED[@]}"}"; do
  FOUND["${GT[$nm]}"]=1
  l=${LOCAL[$nm]-}
  r=${REMOTE[$nm]-}
  wi=${WT_OF[$nm]-}
  if [ -n "$wi" ]; then WT_HANDLED[$wi]=1; fi

  # worktree 只看它自己的條件（WT_WHY）；分支這一組另有自己的結果（lwhy／rwhy）。
  # 單向連動：worktree 被跳過 → 它的本機與遠端分支一併跳過；分支被跳過不影響 worktree 要不要刪。
  lwhy=""; rwhy=""; wwhy=""
  if [ -n "$wi" ]; then wwhy=${WT_WHY[$wi]-}; fi
  case "$nm" in
    dev|release|main|master) lwhy="受保護分支，一律不動"; rwhy=$lwhy; wwhy=$lwhy ;;
  esac

  if [ -z "$lwhy" ] && [ -n "$wwhy" ]; then
    lwhy="工作區被跳過，分支一併保留"; rwhy=$lwhy
  fi

  if [ -z "$lwhy" ]; then
    lstat=""; rstat=""
    rc=0
    if [ -n "$l" ]; then
      in_release "$l" || rc=$?
      case $rc in 0) lstat=ok ;; 1) lstat=no ;; *) lstat=err ;; esac
    fi
    rc=0
    if [ -n "$r" ]; then
      in_release "$r" || rc=$?
      case $rc in 0) rstat=ok ;; 1) rstat=no ;; *) rstat=err ;; esac
    fi
    if [ "$lstat" = no ] || [ "$lstat" = err ]; then lwhy="本機分支末端未達 origin/release"; fi
    if [ "$rstat" = no ] || [ "$rstat" = err ]; then rwhy="遠端分支末端未達 origin/release"; fi
    # 配對：任一端不行，兩端都跳過
    if [ -n "$lwhy" ] && [ -z "$rwhy" ] && [ -n "$r" ]; then rwhy="同名的本機分支未達 origin/release，兩端一併保留"; fi
    if [ -n "$rwhy" ] && [ -z "$lwhy" ] && [ -n "$l" ]; then lwhy="同名的遠端分支未達 origin/release，兩端一併保留"; fi
  fi

  if [ -n "$wi" ] && [ -n "$wwhy" ]; then
    add_skip "工作區" "${WP[wi]}（分支 $nm）" "$wwhy"
  fi
  if [ -n "$l" ] && [ -n "$lwhy" ]; then add_skip "本機分支" "$nm" "$lwhy"; fi
  if [ -n "$r" ] && [ -n "$rwhy" ]; then add_skip "遠端分支" "origin/$nm" "$rwhy"; fi

  # 要刪：worktree 自己沒有跳過理由就刪；分支兩端都沒有跳過理由才刪（刪除時還要 worktree 移除成功）
  wtpath=""; dl=""; dr=""
  if [ -n "$wi" ] && [ -z "$wwhy" ]; then wtpath=${WP[wi]}; fi
  if [ -z "$lwhy" ] && [ -z "$rwhy" ]; then dl=$l; dr=$r; fi
  if [ -n "$wtpath" ] || [ -n "$dl" ] || [ -n "$dr" ]; then
    P_WT+=("$wtpath"); P_NAME+=("$nm"); P_L+=("$dl"); P_R+=("$dr")
  fi
done

# 剩下的候選 worktree：detached 的，或分支還沒有任何提交（本機沒有這條 ref）的
for ((i = 0; i < nwt; i++)); do
  if [ -z "${WT_CAND[$i]-}" ] || [ -n "${WT_HANDLED[$i]-}" ]; then continue; fi
  if [ -n "${WB[i]}" ]; then
    add_skip "工作區" "${WP[i]}（分支 ${WB[i]}）" "分支尚無提交或找不到這條分支"
  elif [ -n "${WT_WHY[$i]-}" ]; then
    add_skip "工作區" "${WP[i]}（detached）" "${WT_WHY[$i]}"
  else
    P_WT+=("${WP[i]}"); P_NAME+=(""); P_L+=(""); P_R+=("")
  fi
done

# ---------- 2. 列清單 ----------
n_del=0
say "要刪"
for ((k = 0; k < ${#P_NAME[@]}; k++)); do
  if [ -n "${P_WT[k]}" ]; then
    printf '  工作區    %s\n' "${P_WT[k]}"
    n_del=$((n_del + 1))
  fi
  if [ -n "${P_L[k]}" ]; then
    printf '  本機分支  %s（%s）\n' "${P_NAME[k]}" "${P_L[k]:0:8}"
    n_del=$((n_del + 1))
  fi
  if [ -n "${P_R[k]}" ]; then
    printf '  遠端分支  origin/%s（%s）\n' "${P_NAME[k]}" "${P_R[k]:0:8}"
    n_del=$((n_del + 1))
  fi
done
if [ "$n_del" -eq 0 ]; then echo "  （沒有）"; fi

say "跳過"
for ((k = 0; k < ${#S_KIND[@]}; k++)); do
  printf '  %s  %s：%s\n' "${S_KIND[k]}" "${S_LABEL[k]}" "${S_WHY[k]}"
done
if [ "${#S_KIND[@]}" -eq 0 ]; then echo "  （沒有）"; fi

for n in "${NUMS[@]}"; do
  if [ -z "${FOUND[$n]-}" ]; then printf '\nE-%s 找不到符合的分支或工作區\n' "$n"; fi
done

if [ "$n_del" -eq 0 ]; then
  say "沒有可刪的項目，未做任何變更。"
  exit 0
fi
if [ "$DRY_RUN" = 1 ]; then
  say "--dry-run：只列清單，沒有刪除任何東西。"
  exit 0
fi

# ---------- 3. 確認 ----------
printf '\n以上「要刪」共 %d 項。輸入 yes 才會刪除（其他任何輸入都會取消）：' "$n_del"
answer=""
IFS= read -r answer || true
answer=$(printf '%s' "$answer" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
if [ "$answer" != yes ]; then
  printf '\n'
  stop "沒有確認，未做任何變更。"
fi

# ---------- 4. 刪除 ----------
DONE=(); FAILS=(); SKIPPED_NOW=0
OUT=""
run_git() {
  OUT=$("$@" </dev/null 2>&1) && return 0
  return 1
}
fail_item() { FAILS+=("$1"); }

say "刪除"
for ((k = 0; k < ${#P_NAME[@]}; k++)); do
  wt=${P_WT[k]}; nm=${P_NAME[k]}; l=${P_L[k]}; r=${P_R[k]}
  ok=1
  if [ -n "$wt" ]; then
    gitok=1
    run_git git -C "$MAIN" worktree remove "$wt" || gitok=0
    gitmsg=$OUT
    if [ "$gitok" = 1 ] && [ ! -e "$wt" ]; then
      DONE+=("工作區 $wt")
      echo "  已刪除工作區 $wt"
    else
      ok=0
      if [ -e "$wt" ]; then
        fail_item "工作區 $wt：目錄被占用，請關閉後手動刪除${gitmsg:+（git：$gitmsg）}"
      else
        fail_item "工作區 $wt：git worktree remove 失敗（$gitmsg）"
      fi
      echo "  失敗：工作區 $wt"
    fi
  fi
  if [ "$ok" = 0 ]; then
    if [ -n "$l" ]; then SKIPPED_NOW=$((SKIPPED_NOW + 1)); echo "  跳過本機分支 $nm：工作區沒刪成，分支一併保留"; fi
    if [ -n "$r" ]; then SKIPPED_NOW=$((SKIPPED_NOW + 1)); echo "  跳過遠端分支 origin/$nm：工作區沒刪成，分支一併保留"; fi
    continue
  fi
  if [ -n "$l" ]; then
    if run_git git -C "$MAIN" update-ref -d "refs/heads/$nm" "$l"; then
      DONE+=("本機分支 $nm $l")
      echo "  已刪除本機分支 $nm"
    else
      ok=0
      fail_item "本機分支 $nm：git update-ref 失敗（$OUT）"
      echo "  失敗：本機分支 $nm"
    fi
  fi
  if [ -n "$r" ]; then
    if [ "$ok" = 0 ]; then
      SKIPPED_NOW=$((SKIPPED_NOW + 1))
      echo "  跳過遠端分支 origin/$nm：本機分支沒刪成，兩端一併保留"
    elif run_git git -C "$MAIN" push origin --delete "$nm"; then
      DONE+=("遠端分支 origin/$nm $r")
      echo "  已刪除遠端分支 origin/$nm"
    else
      fail_item "遠端分支 origin/$nm：git push origin --delete 失敗（$OUT）"
      echo "  失敗：遠端分支 origin/$nm"
    fi
  fi
done

# ---------- 5. 總結 ----------
say "總結"
printf '已刪 %d 項、跳過 %d 項、失敗 %d 項\n' "${#DONE[@]}" "$((${#S_KIND[@]} + SKIPPED_NOW))" "${#FAILS[@]}"
recover=0
for item in "${DONE[@]+"${DONE[@]}"}"; do
  case "$item" in
    本機分支*|遠端分支*) recover=1; printf '  %s\n' "$item" ;;
  esac
done
if [ "$recover" = 1 ]; then
  echo "要找回分支：git branch <名稱> <上面印的完整 SHA>（刪掉的提交都已在 origin/release 裡，不會遺失）。"
fi
if [ "${#FAILS[@]}" -gt 0 ]; then
  echo
  echo "失敗的項目："
  for item in "${FAILS[@]}"; do printf '  %s\n' "$item"; done
  exit 1
fi
exit 0

}

main "$@"; exit
