# new-repo-root-files：RED v2 紀錄（不載入 elf-stack）

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：3/3 個 grader 通過 → **沒有失敗（維持案例）**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示；回覆引用 elf-stack §0、規則 1、3.6。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制「案例 2、3、4、B1、B2」那一行（`skills` 依 `case.yaml` 展開成路徑），其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-nvmrc` | 通過 | `.nvmrc` 是 `24.22.2` |
| `02-engines` | 通過 | `package.json:32` `engines.node` 是 `>=24.22.2` |
| `03-no-old-node` | 通過 | `grep -rn '24\.18'` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
已在 `work/` 放好 `package.json` 與 `.nvmrc`：結構照 `templates/package.root.json`，但版本改用 elf-stack v2，沒有照 frontend 範本；JSON 能解析，`.nvmrc` 只有一行，沒跑 `pnpm install`。

**範本與實際不符：** elf-cicd-frontend 的規則 1、2、檢查清單和範本都寫 `24.18`，pnpm 也還是待確認的佔位符；但 elf-stack v2 規定新 repo 用 v2，衝突時以它的表為準（§0、規則 1）。所以寫入的值是：
- `.nvmrc`：`24.22.2`
- `engines.node`：`>=24.22.2`
- `packageManager`：`pnpm@12.16.1`
- `@playwright/test`：`^1.64.1`
- `prettier`：`^3.9.10`，範本的 `format` 腳本要用；elf-stack 3.6 列它為過渡期 CLI，完整 antfu 目標不另跑

**還沒補的：**
- **佔位符：** `<app-name>` 和 `<scope>` 你沒給，我沒有自己取名。補上前 `name` 不是合法套件名，`--filter` 也對不到套件。
- **`pnpm-workspace.yaml`：** 這次不在要求內，所以沒建，但少了 `engineStrict: true`，`engines` 只會是警告（規則 2）。
- **`scripts/version.mjs`、`apps/`：** 空 repo 裡還沒有，對應的 `version:*`、`dev`、`build`、`preview` 腳本現在跑不起來。

檔案路徑：
- `E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-0-v2/new-repo-root-files/old_skill/work/package.json`
- `E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-0-v2/new-repo-root-files/old_skill/work/.nvmrc`
`````

## 產出檔案（逐字）

`.nvmrc`

`````
24.22.2
`````

`package.json`

`````
{
  "name": "<app-name>",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "scripts": {
    "dev": "pnpm --filter @<scope>/web dev",
    "build": "pnpm --filter @<scope>/web build",
    "preview": "pnpm --filter @<scope>/web preview",
    "lint": "pnpm -r --if-present run lint",
    "lint:fix": "pnpm -r --if-present run lint:fix",
    "format": "prettier --write \"**/*.{ts,vue,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,vue,json,md,css}\"",
    "typecheck": "pnpm -r --if-present run typecheck",
    "test": "pnpm -r --if-present run test",
    "test:coverage": "pnpm -r --if-present run test:coverage",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "version:show": "node scripts/version.mjs",
    "version:patch": "node scripts/version.mjs patch",
    "version:minor": "node scripts/version.mjs minor",
    "version:major": "node scripts/version.mjs major"
  },
  "devDependencies": {
    "@playwright/test": "^1.64.1",
    "prettier": "^3.9.10"
  },
  "engines": {
    "node": ">=24.22.2"
  }
}
`````
