#!/bin/sh
# Installs git-guard as the global git hooks dir (Mac and Windows Git Bash).
# Usage: sh install.sh              install or update
#        sh install.sh --check [repo]  verify install, version and (optionally) a repo's hooks
#        sh install.sh --repo <repo>   point a repo that overrides core.hooksPath (husky) at git-guard
set -u

SRC=$(cd "$(dirname "$0")" && pwd)
H=${ELF_GIT_GUARD_HOME:-$HOME/.elf-git-guard}
HOOK_NAMES="applypatch-msg pre-applypatch post-applypatch pre-commit pre-merge-commit prepare-commit-msg commit-msg post-commit pre-rebase post-checkout post-merge pre-push post-rewrite pre-auto-gc reference-transaction push-to-checkout sendemail-validate"
WANT=$(cat "$SRC/VERSION")

# Git for Windows needs a Windows path in config; cygpath exists only there.
cfg_path() { cygpath -m "$1" 2>/dev/null || printf '%s\n' "$1"; }
HOOKS_CFG=$(cfg_path "$H/hooks")

do_install() {
	mkdir -p "$H/hooks" || exit 1
	cp "$SRC/git-guard.sh" "$SRC/VERSION" "$H/" || exit 1
	for _n in $HOOK_NAMES; do
		cp "$SRC/chain" "$H/hooks/$_n" && chmod +x "$H/hooks/$_n" || exit 1
	done
	_prev=$(git config --global --get core.hooksPath)
	if [ -n "${_prev}" ] && [ "${_prev}" != "$HOOKS_CFG" ]; then
		echo "git-guard: 全機 core.hooksPath 原本是 ${_prev}，已改為 git-guard；原值記在 elfguard.previousHooksPath。" >&2
		git config --global elfguard.previousHooksPath "${_prev}"
	fi
	git config --global core.hooksPath "$HOOKS_CFG"
	echo "git-guard ${WANT} 已安裝到 $H"
}

do_check() { # do_check [repo]
	_bad=0
	if [ ! -f "$H/VERSION" ]; then
		echo "git-guard 未安裝：執行 sh <skillshare-source>/scripts/git-guard/install.sh" >&2
		exit 1
	fi
	_have=$(cat "$H/VERSION")
	if [ "${_have}" != "$WANT" ]; then
		echo "git-guard 版本 ${_have} 不是最新的 ${WANT}：重新執行 install.sh" >&2
		_bad=1
	fi
	if [ "$(git config --global --get core.hooksPath)" != "$HOOKS_CFG" ]; then
		echo "全機 core.hooksPath 不是 ${HOOKS_CFG}：重新執行 install.sh" >&2
		_bad=1
	fi
	if [ -n "${1:-}" ]; then
		_local=$(git -C "$1" config --local --get core.hooksPath 2>/dev/null)
		if [ -n "${_local}" ] && [ "${_local}" != "$HOOKS_CFG" ]; then
			echo "$1 的 repo 設定 core.hooksPath=${_local} 蓋過了 git-guard（例如 husky 或 pnpm install 重設）：執行 sh install.sh --repo $1" >&2
			_bad=1
		fi
	fi
	[ "${_bad}" -eq 0 ] && echo "git-guard ${_have} 正常"
	exit "${_bad}"
}

do_repo() { # do_repo <repo>
	_local=$(git -C "$1" config --local --get core.hooksPath 2>/dev/null)
	if [ "${_local}" != "$HOOKS_CFG" ]; then
		[ -n "${_local}" ] && git -C "$1" config elfguard.chainHooksPath "${_local}"
		git -C "$1" config core.hooksPath "$HOOKS_CFG"
	fi
	echo "$1 已改用 git-guard，原本的 hook（${_local:-.git/hooks}）會接在後面執行"
}

case "${1:-}" in
	"") do_install ;;
	--check) do_check "${2:-}" ;;
	--repo)
		[ -n "${2:-}" ] || {
			echo "用法：sh install.sh --repo <repo 路徑>" >&2
			exit 2
		}
		do_repo "$2"
		;;
	*)
		echo "用法：sh install.sh [--check [repo] | --repo <repo>]" >&2
		exit 2
		;;
esac
