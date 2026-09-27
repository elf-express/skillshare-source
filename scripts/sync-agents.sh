#!/usr/bin/env bash
# Copy the team agents in agents/ into Claude Code's agent folder.
#
# Why a copy and not skillshare's symlinks: Claude Code does not load agent
# files that are symlinks (verified 2026-09-27 on Windows — a fresh session
# listed none of them). skillshare's agent "copy" mode is not used either,
# because it treats every agent it does not manage (plugin agents such as
# VoltAgent) as orphans and prunes them.
#
# This script only ever writes the files that exist in agents/ (except
# README.md). It never deletes anything in the destination.
#
# Usage:  bash scripts/sync-agents.sh            # copy
#         bash scripts/sync-agents.sh --dry-run  # show what would change

set -euo pipefail

SRC="$(cd "$(dirname "$0")/../agents" && pwd)"
DEST="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

mkdir -p "$DEST"
changed=0
for f in "$SRC"/*.md; do
  name="$(basename "$f")"
  [ "$name" = "README.md" ] && continue
  target="$DEST/$name"

  # A leftover symlink from skillshare is removed first; it is our own file.
  if [ -L "$target" ]; then
    [ "$DRY" = 1 ] && echo "replace symlink  $name" || rm "$target"
  elif [ -f "$target" ] && cmp -s "$f" "$target"; then
    continue
  fi

  if [ "$DRY" = 1 ]; then
    echo "copy             $name"
  else
    cp "$f" "$target"
    echo "copied           $name"
  fi
  changed=$((changed + 1))
done

echo "done: $changed file(s) $( [ "$DRY" = 1 ] && echo 'would change' || echo 'updated' ) in $DEST"
[ "$DRY" = 1 ] || echo "open a new Claude Code session (or run /agents) to pick them up"
