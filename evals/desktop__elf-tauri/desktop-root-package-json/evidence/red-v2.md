# desktop-root-package-json：RED v2 紀錄（不載入 elf-stack）

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：3/3 個 grader 通過 → **沒有失敗（維持案例）**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示；回覆引用 elf-stack rule 1，並寫明版本來自 elf-stack v2。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制「案例 2、3、4、B1、B2」那一行（`skills` 依 `case.yaml` 展開成路徑），其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-engines` | 通過 | `package.json:8` `engines.node` 是 `>=24.22.2` |
| `02-tauri-cli` | 通過 | `package.json:22` `@tauri-apps/cli` 是 `^2.12.4` |
| `03-no-old-values` | 通過 | `grep -rnE '24\.18|"\^2"'` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
I wrote the root `package.json`, and it parses as valid JSON. I haven't run install or build, because the two placeholders below still need real values.

**Versions come from `elf-stack` v2, not the skills:** `elf-stack` is the only source for versions, and I treated this as a new repo because the work directory was empty. Replace these values if the repo already exists.

| Field | `elf-cicd-desktop` / `elf-tauri` | Written (`elf-stack` v2) |
|---|---|---|
| `packageManager` | `pnpm@<PNPM_VERSION>` (待確認) | `pnpm@12.16.1` |
| `engines.node` | `>=24.18` | `>=24.22.2` |
| `@tauri-apps/cli` | `^2` | `^2.12.4` |

The conflict to report (`elf-stack` rule 1): both skills, plus `elf-cicd-frontend` and its `package.root.json` template, still use the old values. Section 6 of `elf-cicd-desktop` also still lists the pnpm version as undecided, although `elf-stack` has settled on the 12 line.

**Beyond the `elf-cicd-desktop` minimum:**
- **From the `elf-tauri` template:** `dev`, `desktop:dev`, `desktop:build` and `version:*`. `dev` is needed by `beforeDevCommand`, and `version:*` is the only allowed way to change version numbers.
- **`version`:** `0.0.1`, matching the `tauri.conf.json` template. The release workflow's `verify` job compares the tag against this field.
- **`private` and `type`:** taken from the `elf-stack` snippet.

**Before use:**
- **Placeholders:** replace `<appname>` and `<web>`. `<web>` is the frontend's workspace package name, which `pnpm --filter` needs.
- **Not created (outside this request):** `elf-stack` also requires `.nvmrc` containing `24.22.2`, and `pnpm-workspace.yaml` with `engineStrict: true`. `scripts/version.mjs` is also missing, so the `version:*` scripts won't run until it's added.

The file is at `E:/source/e46-scratch/desktop__elf-tauri-workspace/iteration-0-v2/desktop-root-package-json/old_skill/work/package.json`.
`````

## 產出檔案（逐字）

`package.json`

`````
{
  "name": "<appname>",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "engines": {
    "node": ">=24.22.2"
  },
  "scripts": {
    "dev": "pnpm --filter <web> dev",
    "build": "pnpm --filter <web> build",
    "tauri": "tauri",
    "desktop:dev": "tauri dev",
    "desktop:build": "tauri build",
    "version:show": "node scripts/version.mjs",
    "version:patch": "node scripts/version.mjs patch",
    "version:minor": "node scripts/version.mjs minor",
    "version:major": "node scripts/version.mjs major"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.12.4"
  }
}
`````
