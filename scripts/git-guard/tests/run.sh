#!/bin/sh
# git-guard tests. Usage: sh scripts/git-guard/tests/run.sh [test-name ...]
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
GG_DIR=$(cd "$HERE/.." && pwd)
GUARD="$GG_DIR/git-guard.sh"
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/git-guard-test.XXXXXX")
trap 'rm -rf "$ROOT"' EXIT

PASS=0
FAIL=0
FAILED=""

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_NOSYSTEM=1
unset ELF_ALLOW

# Fake gh: prints $FAKE_CHECKS (one "status conclusion name" per line), records args, exits $FAKE_GH_EXIT.
FAKEGH="$ROOT/fakegh"
cat > "$FAKEGH" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" > "$FAKE_GH_ARGS"
[ -n "${FAKE_CHECKS:-}" ] && printf '%s\n' "$FAKE_CHECKS"
exit "${FAKE_GH_EXIT:-0}"
EOF
chmod +x "$FAKEGH"
export GIT_GUARD_GH="$FAKEGH"
export FAKE_GH_ARGS="$ROOT/gh.args"
export FAKE_CHECKS="completed success ci"
export FAKE_GH_EXIT=0

# Hook dir used by the Task 1–2 tests: pre-push runs git-guard.sh directly.
HOOKS="$ROOT/hooks"
mkdir -p "$HOOKS"
printf '#!/bin/sh\nexec sh "%s" "$@"\n' "$GUARD" > "$HOOKS/pre-push"
chmod +x "$HOOKS/pre-push"

commit() { # commit <file> <msg>
	echo "$2" >> "$1" && git add "$1" && git commit -q -m "$2"
}

# mkrepo <type 1|2|3> [upstream-main-name]: creates $W (work clone) with origin (and upstream) remotes.
mkrepo() {
	_t=$1
	_um=${2:-main}
	D="$ROOT/$CASE"
	rm -rf "$D" && mkdir -p "$D"
	git init -q --bare "$D/origin.git"
	git init -q "$D/seed"
	(
		cd "$D/seed" || exit 1
		git symbolic-ref HEAD refs/heads/main
		printf '# 分支規範：本 repo 為【第 %s 種：測試】\n' "$_t" > BRANCHING.md
		[ "$_um" != main ] && printf '\n上游主線：`%s`\n' "$_um" >> BRANCHING.md
		mkdir -p .github/workflows && echo "name: ci" > .github/workflows/ci.yml
		git add -A && git commit -q -m init
	)
	if [ "$_t" != 3 ]; then
		git init -q --bare "$D/upstream.git"
		if [ "$_t" = 1 ]; then _ub=$_um; else _ub=release; fi
		git -C "$D/seed" push -q "$D/upstream.git" "main:refs/heads/$_ub"
	fi
	git -C "$D/seed" push -q "$D/origin.git" main:main main:dev main:release
	git clone -q "$D/origin.git" "$D/work" 2>/dev/null
	W="$D/work"
	cd "$W" || exit 1
	git remote set-url origin https://github.com/o/r.git
	git config url."$D/origin.git".insteadOf https://github.com/o/r.git
	if [ "$_t" != 3 ]; then
		git remote add upstream "$D/upstream.git"
		git fetch -q upstream
	fi
	git config core.hooksPath "$HOOKS"
	git branch -q dev origin/dev 2>/dev/null
	git branch -q release origin/release 2>/dev/null
}

# push_expect <allow|block> <message fragment or -> -- <git push args...>
push_expect() {
	_want=$1
	_frag=$2
	shift 3
	_out=$(git push "$@" 2>&1)
	_rc=$?
	if [ "$_want" = allow ] && [ $_rc -ne 0 ]; then
		echo "    expected allow, got rc=$_rc: $_out" >&2
		return 1
	fi
	if [ "$_want" = block ] && [ $_rc -eq 0 ]; then
		echo "    expected block, push succeeded: $_out" >&2
		return 1
	fi
	if [ "$_frag" != - ]; then
		case "$_out" in
			*"$_frag"*) ;;
			*)
				echo "    output lacks '$_frag': $_out" >&2
				return 1
				;;
		esac
	fi
	return 0
}

# --- Task 1 ---------------------------------------------------------------

t_release_ff_dev() {
	mkrepo 3
	git switch -q dev && commit f dev1 && git -c core.hooksPath=/dev/null push -q origin dev
	git fetch -q origin
	push_expect allow - -- origin origin/dev:release
}

t_release_ff_hotfix() {
	mkrepo 3
	git switch -q -c hotfix/e-1-x origin/release && commit h fix && git push -q origin hotfix/e-1-x
	git fetch -q origin
	push_expect allow - -- origin hotfix/e-1-x:release
}

t_release_merge_commit() {
	mkrepo 3
	git switch -q dev && commit f dev1 && git -c core.hooksPath=/dev/null push -q origin dev
	git switch -q release && git merge -q --no-ff --no-edit origin/dev
	push_expect block "只能快轉到 origin/dev" -- origin release
}

t_release_direct_commit() {
	mkrepo 3
	git switch -q release && commit f direct
	push_expect block "git-guard: 擋下推送 refs/heads/release" -- origin release
}

t_release_stale_hint() {
	mkrepo 3
	# Another clone moves dev; this clone pushes release to that SHA without fetching.
	git clone -q "$D/origin.git" "$D/other" 2>/dev/null
	(cd "$D/other" && git switch -q dev && commit f other && git push -q origin dev)
	git fetch -q "$D/origin.git" dev
	_sha=$(git rev-parse FETCH_HEAD)
	push_expect block "git fetch origin" -- origin "$_sha:refs/heads/release"
}

t_main_type3() {
	mkrepo 3
	git switch -q dev && commit f d1 && git -c core.hooksPath=/dev/null push -q origin dev
	git fetch -q origin
	push_expect allow - -- origin origin/dev:release || return 1
	git fetch -q origin
	push_expect allow - -- origin origin/release:main || return 1
	git switch -q dev && commit f d2 && git -c core.hooksPath=/dev/null push -q origin dev
	git fetch -q origin
	push_expect block "origin/release" -- origin origin/dev:main
}

t_main_type1() {
	mkrepo 1
	(cd "$D/seed" && commit u up1 && git push -q "$D/upstream.git" main:main)
	git fetch -q upstream
	push_expect allow - -- origin upstream/main:main || return 1
	git switch -q -c wrong origin/main && commit f direct
	push_expect block "upstream/main" -- origin wrong:main
}

t_main_type1_master() {
	mkrepo 1 master
	(cd "$D/seed" && commit u up1 && git push -q "$D/upstream.git" main:master)
	git fetch -q upstream
	push_expect allow - -- origin upstream/master:main
}

t_main_type2() {
	mkrepo 2
	(cd "$D/seed" && commit u up1 && git push -q "$D/upstream.git" main:release)
	git fetch -q upstream
	push_expect allow - -- origin upstream/release:main || return 1
	git switch -q -c wrong origin/main && commit f direct
	push_expect block "upstream/release" -- origin wrong:main
}

t_delete_protected() {
	mkrepo 3
	ELF_ALLOW=0000000000000000000000000000000000000000 push_expect block "規則 19" -- origin :release
}

t_no_branching_md() {
	mkrepo 3
	git switch -q dev && git rm -q BRANCHING.md && git commit -q -m rm && git -c core.hooksPath=/dev/null push -q origin dev
	git fetch -q origin
	push_expect block "BRANCHING.md" -- origin origin/dev:release
}

t_create_branch() {
	mkrepo 3
	git -c core.hooksPath=/dev/null push -q origin :release
	git fetch -q --prune origin
	push_expect allow - -- origin dev:release
}

t_other_branch() {
	mkrepo 3
	git rm -q BRANCHING.md && git commit -q -m rm
	git switch -q -c feat/e-1-x && commit f feat
	push_expect allow - -- origin feat/e-1-x
}

t_allow_value() {
	mkrepo 3
	git switch -q release && commit f direct
	_sha=$(git rev-parse HEAD)
	_short=$(printf '%s' "$_sha" | cut -c1-8)
	_seven=$(printf '%s' "$_sha" | cut -c1-7)
	ELF_ALLOW=deadbeef push_expect block - -- origin release || return 1
	ELF_ALLOW=$_seven push_expect block - -- origin release || return 1
	ELF_ALLOW=$_short push_expect allow "已使用 ELF_ALLOW 放行" -- origin release
}

# --- runner ---------------------------------------------------------------

ALL=$(grep -o '^t_[a-z0-9_]*()' "$0" | tr -d '()')
SEL=${*:-$ALL}
for CASE in $SEL; do
	if (cd "$ROOT" && "$CASE") > "$ROOT/$CASE.log" 2>&1; then
		PASS=$((PASS + 1))
		echo "ok   $CASE"
	else
		FAIL=$((FAIL + 1))
		FAILED="$FAILED $CASE"
		echo "FAIL $CASE"
		sed 's/^/    /' "$ROOT/$CASE.log"
	fi
	cd "$ROOT" || exit 1
done
echo "PASS $PASS / FAIL $FAIL"
[ $FAIL -eq 0 ]
