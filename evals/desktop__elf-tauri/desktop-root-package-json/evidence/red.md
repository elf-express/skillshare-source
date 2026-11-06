# desktop-root-package-json：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：3/3 個 grader 通過 → **沒有失敗（維持案例）**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-engines` | 通過 | `engines.node` 是 `>=24.22.2` |
| `02-tauri-cli` | 通過 | `@tauri-apps/cli` 是 `^2.12.4` |
| `03-no-old-values` | 通過 | `grep` 零筆 |

## 子代理最後回覆（逐字）

`````markdown
根 `package.json` 已寫好，版本全部取 elf-stack v2 欄（假設是還沒發版的新 repo）：`packageManager: pnpm@12.16.1`、`engines.node: >=24.22.2`、`@tauri-apps/cli: ^2.12.4`。JSON 語法已檢查；沒有跑 `pnpm install` 或任何建置。

**skill 之間的衝突（依 elf-stack 規則 1 以它為準）**

| 項目 | elf-cicd-desktop／elf-tauri 寫的 | 本檔採用（elf-stack） |
|---|---|---|
| Node | `>=24.18` | `>=24.22.2` |
| pnpm | `pnpm@<PNPM_VERSION>`，標「待確認」 | `pnpm@12.16.1`（已定案） |
| Tauri CLI | `^2` | `^2.12.4` |

這些舊值還留在兩份 skill 裡，`elf-cicd-desktop/templates/release.yml` 的註解也還寫 24.18，建議開單修正。

**交付前要替換**

- `<app-name>`：專案名稱。
- `<web>`：前端 workspace 的 package 名稱（`--filter` 用）。

**要確認的兩點**

- `version` 填 `0.0.1`，對齊 `tauri.conf.json` 範本。elf-cicd-frontend 的根範本寫 `0.1.0`，兩者不一致；之後改版號一律走 `pnpm version:*`，不要手改。
- 如果這是已發版的既有 repo，已釘的舊值不要動，改成回報差距，並開升級單或登記到 `references/exceptions.md`（elf-stack §0）。

**前置條件之外多加的欄位**

- `scripts` 的 `dev`：範本 `beforeDevCommand` 會呼叫。
- `desktop:*`、`version:*`、`@tauri-apps/cli`：elf-tauri 與 elf-cicd-versioning 要求。
- `version`：release.yml 的 `verify` job 拿它比對 tag。
- `private`、`type`：elf-stack 4.1 根範本。

**沒有放進這個檔案的東西**

- lint／format／test scripts 與對應依賴（elf-cicd-frontend 與 elf-stack 3.6 的範圍）。
- `@tauri-apps/api` 這類前端依賴，要裝在前端 workspace：`pnpm --filter <web> add @tauri-apps/api @tauri-apps/plugin-updater @tauri-apps/plugin-process`。

**同一組釘版還需要、這次沒產出的檔案**

- `.nvmrc`（內容 `24.22.2`）
- `pnpm-workspace.yaml`（`engineStrict: true`）
- `pnpm-lock.yaml`（CI 用 `--frozen-lockfile`）
- `scripts/version.mjs`

另外，`pnpm/action-setup` v4.4.0 能否讀 pnpm 12 的 `packageManager` 還沒實測（elf-stack 第 8 節待確認），第一次 CI 要確認。
`````

## 產出檔案（逐字）

`package.json`

`````
{
  "name": "<app-name>",
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
