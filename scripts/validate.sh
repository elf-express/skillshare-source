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

# A tracked entry without a subdir pulls its whole upstream repo on update —
# that is how ui-ux-pro-max became 1,925 files of oh-my-claudecode. Only the
# entries listed here are meant to track a whole repo.
WHOLE_REPO_ALLOWED=("_superpowers")
# Any shape it cannot read fails the check — a guard that passes on a parse
# error is no guard.
whole_repo=$("$PY" - "${WHOLE_REPO_ALLOWED[@]}" <<'EOF' 2>&1
import json, sys
allowed = set(sys.argv[1:])
entries = json.load(open('.metadata.json')).get('entries')
if not isinstance(entries, dict) or not all(isinstance(e, dict) for e in entries.values()):
    sys.exit("'entries' is missing or not a mapping of objects")
for name, e in sorted(entries.items()):
    if not e.get('subdir') and name not in allowed:
        print(f"{name} ({e.get('source', '?')})")
EOF
)
if [ $? -ne 0 ]; then
  err "could not check tracked entries in .metadata.json: ${whole_repo##*$'\n'}"
elif [ -n "$whole_repo" ]; then
  while IFS= read -r line; do
    err "tracked entry pulls a whole repo without a subdir: $line — reinstall from the skill's subdirectory, or add it to WHOLE_REPO_ALLOWED"
  done <<< "$whole_repo"
else
  pass "every tracked entry has a subdir or is allowlisted"
fi

section ".gitignore enforcement"
if git ls-files _superpowers/ 2>/dev/null | grep -q .; then
  err "_superpowers/ has tracked files — must stay gitignored (it's a separate repo)"
else
  pass "_superpowers/ is properly gitignored"
fi

section "build output"
# skillshare sync copies every file in a skill folder to every target, gitignored
# or not, so a dotnet restore inside templates/ lands obj/ in each AI's skills.
mapfile -t build_dirs < <(
  find . \( -path ./.git -o -path ./node_modules \) -prune -o \
    -type d \( -name bin -o -name obj \) -print | sort
)
if [ "${#build_dirs[@]}" -gt 0 ]; then
  for d in "${build_dirs[@]}"; do
    err "build output '$d' — delete it; skillshare sync would copy it into every target"
  done
else
  pass "no bin/ or obj/ build output in the tree"
fi

section "action pins"
# Every `uses:` line in an elf-* skill must pin the action to a 40-char commit SHA
# with a trailing '# <version>' comment that matches the pin table in stack/elf-stack/SKILL.md.
mapfile -t pin_dirs < <(for d in "${skill_dirs[@]}"; do [[ "$(basename "$d")" == elf-* ]] && echo "$d"; done)
pin_out=$("$PY" - stack/elf-stack/SKILL.md "${pin_dirs[@]}" <<'PY' 2>&1
"""Check `uses:` pins in elf-* skills against the elf-stack pin table.

Decisions:
- Table key is the full string before '@' (subpath actions such as
  github/codeql-action/init keep their subpath).
- Version is the first token after '#' in the trailing comment.
- Lookup is by the (action, sha) pair, so one action may have several rows.
- Files are read with open(path, encoding="utf-8") in text mode (CRLF safe).
"""
import os, re, sys

sys.stdout.reconfigure(encoding="utf-8")  # messages contain an em dash
table_path, dirs = sys.argv[1], sys.argv[2:]
row_re = re.compile(r"^\|\s*`([^`\s]+/[^`\s]+)`\s*\|\s*([^|]+?)\s*\|\s*`([0-9a-f]{40})`\s*\|")
uses_re = re.compile(r"""^\s*(?:-\s+)?uses:\s*["']?([^\s@'"]+)@([^\s'"]+)["']?(.*)$""")
any_uses_re = re.compile(r"^\s*(?:-\s+)?uses:\s*(\S+)")
sha_re = re.compile(r"^[0-9a-f]{40}$")
comment_re = re.compile(r"^\s+#\s*(\S+)")

table = {}
try:
    with open(table_path, encoding="utf-8") as f:
        for line in f:
            m = row_re.match(line)
            if m:
                table[(m.group(1), m.group(3))] = m.group(2)
except OSError:
    pass
if not table:
    print(f"ERR\taction pin table not found in {table_path}")

used = set()
count = 0
for d in dirs:
    for root, subdirs, files in os.walk(d):
        subdirs.sort()
        for name in sorted(files):
            if not name.endswith((".md", ".yml", ".yaml")):
                continue
            path = os.path.join(root, name).replace(os.sep, "/")
            if path.startswith("./"):
                path = path[2:]
            with open(path, encoding="utf-8") as f:
                for n, line in enumerate(f, 1):
                    text = line.rstrip("\r\n")
                    m = uses_re.match(text)
                    if not m:
                        a = any_uses_re.match(text)
                        if a and not a.group(1).strip("'\"").startswith(("./", "docker://")):
                            print(f"ERR\t{path}:{n} uses: line could not be parsed — expected <action>@<40-char sha> # <version>")
                        continue
                    action, ref, rest = m.groups()
                    if action.startswith(("./", "docker://")):
                        continue
                    count += 1
                    loc = f"{path}:{n}"
                    if not sha_re.match(ref):
                        print(f"ERR\t{loc} uses {action}@{ref} — not a 40-char commit SHA")
                        continue
                    c = comment_re.match(rest)
                    if not c:
                        print(f"ERR\t{loc} uses {action}@{ref} — missing '# <version>' comment")
                        continue
                    if not table:
                        continue
                    tv = table.get((action, ref))
                    if tv is None:
                        print(f"ERR\t{loc} {action}@{ref} — not in the elf-stack pin table")
                        continue
                    used.add((action, ref))
                    if c.group(1) != tv:
                        print(f"ERR\t{loc} {action} comment '{c.group(1)}' != pin table version '{tv}'")
for (action, ref), tv in sorted(table.items()):
    if (action, ref) not in used:
        print(f"WARN\t{action} {tv} is in the pin table but no elf-* file uses it")
print(f"COUNT\t{count}")
PY
)
pin_bad=0; pin_count=0
while IFS=$'\t' read -r kind msg; do
  case "$kind" in
    ERR)   err "$msg"; pin_bad=1 ;;
    WARN)  warn "$msg" ;;
    COUNT) pin_count=$msg ;;
    *)     err "action pin check crashed: $kind $msg"; pin_bad=1 ;;
  esac
done <<< "$pin_out"
[ "$pin_bad" -eq 0 ] && pass "all elf-* uses: are pinned to the elf-stack table ($pin_count lines)"

section "skillshare CLI checks"
if command -v skillshare >/dev/null; then
  if skillshare sync --dry-run >/dev/null 2>&1; then
    pass "skillshare sync --dry-run succeeded"
  else
    err "skillshare sync --dry-run failed — run 'skillshare sync --dry-run' to inspect"
  fi
  if skillshare audit --yes --no-tui --quiet >/dev/null 2>&1; then
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
