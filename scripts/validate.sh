#!/usr/bin/env bash
# Sanity checks for skillshare-source.
# Exits non-zero on failure (suitable for CI / pre-commit / pre-push).
#
# Usage:  bash scripts/validate.sh

set -uo pipefail
cd "$(dirname "$0")/.."

if [ -t 1 ]; then
  red=$'\033[0;31m'; green=$'\033[0;32m'; yellow=$'\033[1;33m'; nc=$'\033[0m'
else
  red=''; green=''; yellow=''; nc=''
fi

fail=0
pass() { printf "%s✓%s %s\n" "$green" "$nc" "$1"; }
err()  { printf "%s✗%s %s\n" "$red"   "$nc" "$1"; fail=1; }
warn() { printf "%s!%s %s\n" "$yellow" "$nc" "$1"; }
section() { printf "\n%s── %s ──%s\n" "$yellow" "$1" "$nc"; }

PY=$(command -v python3 || command -v python || true)
[ -z "$PY" ] && { err "python not found — required for JSON/YAML checks"; exit 1; }

section "discover skill folders"
mapfile -t skill_dirs < <(
  find . -name SKILL.md \
    -not -path './_elf-dev/*' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -exec dirname {} \; | sort
)
if [ "${#skill_dirs[@]}" -eq 0 ]; then
  err "no SKILL.md found anywhere"
  exit 1
fi
pass "discovered ${#skill_dirs[@]} skill folder(s)"

section "SKILL.md frontmatter"
fm_bad=0
for d in "${skill_dirs[@]}"; do
  msg=$("$PY" - "$d/SKILL.md" <<'PY'
import sys, re
path = sys.argv[1]
try:
    text = open(path, encoding="utf-8").read()
except Exception as e:
    print(f"read error: {e}"); sys.exit(1)
m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
if not m:
    print("missing YAML frontmatter"); sys.exit(1)
fm = m.group(1)
if not re.search(r"(?m)^name:\s*\S", fm):
    print("missing 'name' field"); sys.exit(1)
if not re.search(r"(?m)^description:\s*\S", fm):
    print("missing 'description' field"); sys.exit(1)
PY
  ) || { err "$d/SKILL.md — $msg"; fm_bad=1; }
done
[ "$fm_bad" -eq 0 ] && pass "all frontmatter has name + description"

section "skill folder naming"
naming_bad=0
for d in "${skill_dirs[@]}"; do
  name=$(basename "$d")
  if [[ "$name" == *__* ]]; then
    err "'$d' contains '__' — collides with skillshare auto-flatten separator"
    naming_bad=1
  fi
done
[ "$naming_bad" -eq 0 ] && pass "no folder name uses the '__' separator"

section ".metadata.json"
if "$PY" -c "import json,sys; json.load(open('.metadata.json'))" 2>/dev/null; then
  pass ".metadata.json is valid JSON"
else
  err ".metadata.json is malformed"
fi

section ".gitignore enforcement"
if git ls-files _elf-dev/ 2>/dev/null | grep -q .; then
  err "_elf-dev/ has tracked files — must stay gitignored (it's a separate repo)"
else
  pass "_elf-dev/ is properly gitignored"
fi

section "skillshare CLI checks"
if command -v skillshare >/dev/null; then
  if skillshare sync --dry-run >/dev/null 2>&1; then
    pass "skillshare sync --dry-run succeeded"
  else
    err "skillshare sync --dry-run failed — run 'skillshare sync --dry-run' to inspect"
  fi
  if skillshare audit >/dev/null 2>&1; then
    pass "skillshare audit found no blocking issues"
  else
    err "skillshare audit reported issues — run 'skillshare audit' to inspect"
  fi
else
  warn "skillshare CLI not installed — skipping sync/audit checks"
fi

echo
if [ "$fail" -eq 0 ]; then
  printf "%s✓ all checks passed%s\n" "$green" "$nc"
else
  printf "%s✗ validation failed%s\n" "$red" "$nc"
fi
exit "$fail"
