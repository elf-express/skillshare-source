# skillshare-source

Elf Express team source for **personal** AI CLI skills, managed and synced with
[**skillshare**](https://github.com/runkids/skillshare).

For **team-wide standards**, see
[elf-express/org-skills](https://github.com/elf-express/org-skills) — already
tracked in this repo as `_elf-dev/` (auto-cloned on `skillshare pull`).

## Install

```bash
# 1. Install the skillshare CLI
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/runkids/skillshare/main/install.sh | sh
# Windows
irm https://raw.githubusercontent.com/runkids/skillshare/main/install.ps1 | iex

# 2. Wire this repo as your source
skillshare init -g --remote https://github.com/elf-express/skillshare-source.git

# 3. Sync to every AI CLI target you have
skillshare sync
```

## How It Works

### Folder organization

Skills are grouped into category folders. On `skillshare sync`, nested paths
**auto-flatten** into each target — no manual mapping needed.

```text
skillshare-source/
├── frontend/
│   ├── react/
│   │   ├── shadcn/
│   │   └── vercel-composition-patterns/
│   ├── vue/
│   │   ├── shadcn-vue/
│   │   └── vuejs-typescript-best-practices/
│   ├── design/
│   │   ├── ui-ux-pro-max/
│   │   └── web-design-guidelines/
│   └── typescript-advanced-types/
├── backend/
│   └── supabase/
├── desktop/
│   └── tauri-v2/
├── web-dev/
│   ├── i18n-localization/
│   └── audit-website/
├── utils/
│   ├── agent-browser/
│   ├── find-skills/
│   ├── project-planner/
│   └── requesting-code-review/
├── skillshare/        # meta tool — ignored via .skillignore
└── _elf-dev/          # tracked repo: elf-express/org-skills (dev branch)

           ↓ skillshare sync

├→ Claude Code   (~/.claude/skills/)
├→ Cursor        (~/.cursor/skills/)
├→ Codex         (~/.codex/skills/)
└→ 60+ more targets...
```

### .skillignore

Like `.gitignore`, but for skill sync. Folders listed here are kept in the repo
but never synced to targets.

```text
# .skillignore
skillshare       # meta tool — not a skill
```

### Tracked repositories

`_elf-dev/` is a tracked external repo (Elf Express team standards). On a fresh
clone, `skillshare pull` reads `.metadata.json` and auto-clones it back — no
manual `git clone` step required.

## Daily commands

| Command | What it does |
|---|---|
| `skillshare status` | Show source / targets / tracked-repo state |
| `skillshare sync` | Sync skills to all targets |
| `skillshare ui` | Launch web dashboard at `http://127.0.0.1:19420` |
| `skillshare push -m "msg"` | Commit + push source to GitHub |
| `skillshare pull` | Pull from GitHub + auto-sync to targets |
| `skillshare update --all` | Update all tracked repos (`_elf-dev/` etc.) |
| `skillshare audit` | Security audit (prompt injection / exfiltration scan) |

## License

MIT
