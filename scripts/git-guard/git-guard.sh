#!/bin/sh
# git-guard: pre-push checks for the ELF branching rules (workflow/elf-team-rule).
# Args: <remote name> <url>. Stdin: "<local ref> <local sha> <remote ref> <remote sha>" per line.
set -u

ZERO=0000000000000000000000000000000000000000
STATUS=0


block() { # block <remote ref> <line>...
	printf 'git-guard: 擋下推送 %s\n' "$1" >&2
	shift
	for _l in "$@"; do printf '  %s\n' "${_l}" >&2; done
	STATUS=1
}

allowed_by_env() { # allowed_by_env <sha>
	_a=${ELF_ALLOW:-}
	[ ${#_a} -ge 8 ] || return 1
	case "$1" in
		"${_a}"*)
			printf 'git-guard: 已使用 ELF_ALLOW 放行 %s（必須已取得 Eddie 對這個提交的明確同意）\n' "$1" >&2
			return 0
			;;
	esac
	return 1
}

rev() { git rev-parse -q --verify "${1}^{commit}" 2>/dev/null; }

# BRANCHING.md as of the integration branch, falling back to the checked-out commit.
branching() {
	git show refs/remotes/origin/dev:BRANCHING.md 2>/dev/null || git show HEAD:BRANCHING.md 2>/dev/null
}

repo_type() { branching | head -n 1 | sed -n 's/.*第 *\([123]\) *種.*/\1/p'; }

upstream_main() {
	_n=$(branching | sed -n 's/^上游主線：`\{0,1\}\([^`[:space:]]*\)`\{0,1\}.*$/\1/p' | head -n 1)
	printf '%s\n' "${_n:-main}"
}

check_release() { # check_release <remote ref> <sha>
	[ "$2" = "$(rev refs/remotes/origin/dev)" ] && return 0
	for _h in $(git for-each-ref --format='%(objectname)' refs/remotes/origin/hotfix/); do
		[ "$2" = "${_h}" ] && return 0
	done
	block "$1" \
		"release 只能快轉到 origin/dev 或 origin/hotfix/* 目前指向的提交（elf-team-rule 規則 8、25）。" \
		"要推送的 $2 不是它們之一：不要在 release 上提交，也不要用合併代替快轉。" \
		"如果 origin/dev 剛被別人更新，先執行 git fetch origin 再推。"
	return 1
}

check_main() { # check_main <remote ref> <sha> <type>
	case "$3" in
		1) _src="upstream/$(upstream_main)" ;;
		2) _src=upstream/release ;;
		*) _src=origin/release ;;
	esac
	[ "$2" = "$(rev "refs/remotes/${_src}")" ] && return 0
	block "$1" \
		"第 $3 種 repo 的 main 只能快轉到 ${_src}（elf-team-rule 規則 7）。" \
		"要推送的 $2 不是 ${_src} 目前指向的提交；先 git fetch --all，再 git merge --ff-only ${_src}。"
}

check_dev() { # check_dev <remote ref> <new sha> <old sha>
	_um=$(upstream_main)
	_ok=""
	for _r in origin/main origin/release "upstream/${_um}" upstream/main upstream/release; do
		_s=$(rev "refs/remotes/${_r}") && _ok="${_ok} ${_s}"
	done
	# Fast-forward sync: dev had nothing of its own (rules 18, 26).
	for _s in ${_ok}; do
		[ "$2" = "${_s}" ] && git merge-base --is-ancestor "$3" "$2" 2>/dev/null && return 0
	done
	# Sync or hotfix merge-back: one merge commit on top of the remote dev (rules 18, 26).
	set -- "$1" "$2" "$3" $(git rev-list --parents -n 1 "$2" 2>/dev/null)
	if [ $# -eq 6 ] && [ "$5" = "$3" ]; then
		for _s in ${_ok}; do
			[ "$6" = "${_s}" ] && return 0
		done
	fi
	block "$1" \
		"dev 只接受 GitHub 上的 PR 合併（elf-team-rule 規則 9）。本機能直接推的只有兩種：" \
		"規則 18 的 main 同步合併、規則 26 的 hotfix 合回，也就是在 origin/dev 上合併 origin/main、upstream/*、origin/release 產生的單一合併提交。" \
		"不要直接在 dev 提交或在本機合併開發分支：開開發分支、推上去、開 PR 進 dev。" \
		"如果是同步合併被擋，先 git fetch --all 確認 origin/dev、origin/main 是最新的。"
}

repo_slug() { # prints owner/repo for the origin remote, fails otherwise
	_u=$(git config --get remote.origin.url 2>/dev/null) || _u=${1:-}
	slug_of "${_u}"
}

slug_of() { # owner/repo from https, ssh:// (any port) or scp-style URLs, including ssh host aliases
	case "${1:-}" in
		*://*)
			_p=${1#*://}
			_p=${_p#*/}
			;;
		/* | ./* | ../*) return 1 ;;
		*:*) _p=${1#*:} ;;
		*) return 1 ;;
	esac
	_p=${_p%/}
	_p=${_p%.git}
	case "${_p}" in
		*/*/* | /* | */ | "") return 1 ;;
		*/*) printf '%s\n' "${_p}" ;;
		*) return 1 ;;
	esac
}

check_ci() { # check_ci <remote ref> <sha> <url>
	if [ -z "$(git ls-tree --name-only "$2" .github/workflows/ 2>/dev/null)" ]; then
		block "$1" \
			"要發佈的 $2 沒有 .github/workflows/，專案沒有 CI，發佈內容未經自動測試（規則 28）。" \
			"只有 Eddie 明確同意這次例外後，才能用 ELF_ALLOW=<SHA 前 8 碼> git push 放行，並在回報寫明原因。"
		return
	fi
	if ! _slug=$(repo_slug "$3"); then
		block "$1" "無法從 remote.origin.url 判斷 GitHub repo，查不到 check runs（規則 28）。"
		return
	fi
	if ! _out=$("${GIT_GUARD_GH:-gh}" api "repos/${_slug}/commits/$2/check-runs?filter=latest&per_page=100" \
		--jq '.check_runs[]|"\(.status) \(.conclusion) \(.name)"' 2>&1); then
		block "$1" "用 gh 查 check runs 失敗（規則 28）：${_out}" "確認 gh 已登入（gh auth status）後再推。"
		return
	fi
	if [ -z "${_out}" ]; then
		block "$1" \
			"$2 上沒有任何 check run：這個提交沒有觸發 CI，或 CI 還沒開始（規則 28）。" \
			"等 CI 跑完再推；hotfix 確認推送已觸發 CI（規則 25）。"
		return
	fi
	_bad=$(printf '%s\n' "${_out}" | awk '!($1 == "completed" && ($2 == "success" || $2 == "neutral" || $2 == "skipped"))')
	[ -z "${_bad}" ] && return 0
	block "$1" "$2 的 CI 還沒全部通過（規則 28），不能發佈。未通過的 check（status conclusion name）：" ${_bad:+"${_bad}"} \
		"失敗就依 references/04 讀原因；stale 告訴 Eddie 後重跑；執行中就等完成。"
}

# True when the push goes to origin, even by URL or through another remote with the same URL.
target_is_origin() { # target_is_origin <remote name> <url>
	[ "$1" = origin ] && return 0
	_o=$(git ls-remote --get-url origin 2>/dev/null)
	[ -n "${_o}" ] && [ "${_o}" != origin ] && [ "$2" = "${_o}" ] && return 0
	_a=$(slug_of "$2") || return 1
	_b=$(repo_slug "") || return 1
	[ "${_a}" = "${_b}" ]
}

if ! target_is_origin "${1:-}" "${2:-}"; then
	cat > /dev/null
	exit 0
fi

while read -r _lref _lsha _rref _rsha; do
	case "$_rref" in
		refs/heads/release | refs/heads/main | refs/heads/dev) ;;
		*) continue ;;
	esac
	_br=${_rref#refs/heads/}
	if [ "$_lsha" = "${ZERO}" ]; then
		block "$_rref" "受保護分支不能刪除；規則 19 只允許刪除開發分支。"
		continue
	fi
	# First creation of the branch (references 01–03, section A).
	[ "$_rsha" = "${ZERO}" ] && continue
	allowed_by_env "$_lsha" && continue
	if [ "$_br" = dev ]; then
		check_dev "$_rref" "$_lsha" "$_rsha"
		continue
	fi
	_type=$(repo_type)
	if [ -z "$_type" ]; then
		block "$_rref" \
			"找不到 BRANCHING.md，或第一行沒有寫「本 repo 為【第 N 種…】」，無法判斷 repo 類型（規則 4、5）。" \
			"先依 elf-team-rule 的 assets/BRANCHING-type*.md 補上 BRANCHING.md，經 PR 合進 dev。"
		continue
	fi
	case "$_br" in
		release) check_release "$_rref" "$_lsha" && check_ci "$_rref" "$_lsha" "${2:-}" ;;
		main) check_main "$_rref" "$_lsha" "$_type" ;;
	esac
done

exit ${STATUS}
