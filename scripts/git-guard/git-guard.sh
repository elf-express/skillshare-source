#!/bin/sh
# git-guard: pre-push checks for the ELF branching rules (workflow/elf-team-rule).
# Args: <remote name> <url>. Stdin: "<local ref> <local sha> <remote ref> <remote sha>" per line.
set -u

ZERO=0000000000000000000000000000000000000000
STATUS=0

# Only pushes to origin are checked; drain stdin so git does not see a broken pipe.
if [ "${1:-}" != origin ]; then
	cat > /dev/null
	exit 0
fi

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
	[ "$_br" = dev ] && continue
	_type=$(repo_type)
	if [ -z "$_type" ]; then
		block "$_rref" \
			"找不到 BRANCHING.md，或第一行沒有寫「本 repo 為【第 N 種…】」，無法判斷 repo 類型（規則 4、5）。" \
			"先依 elf-team-rule 的 assets/BRANCHING-type*.md 補上 BRANCHING.md，經 PR 合進 dev。"
		continue
	fi
	case "$_br" in
		release) check_release "$_rref" "$_lsha" ;;
		main) check_main "$_rref" "$_lsha" "$_type" ;;
	esac
done

exit ${STATUS}
