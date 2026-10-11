# 分支規範：本 repo 為【第 3 種：自有專案】

> 完整規範：[分支規範：三種 repo 類型](https://linear.app/elf-express/document/分支規範三種-repo-類型貢獻型-fork私有-fork自有專案-128bf6e5e1f9)（Linear），AI 執行版是 `workflow/elf-team-rule`。
> 本檔只記錄這個 repo 的設定。人與 AI 動手前請先讀完本檔。

## 本 repo 資訊

| 項目                  | 值                                     |
| --------------------- | -------------------------------------- |
| 類型                  | 第 3 種：自有專案（沒有上游）          |
| 本 repo（`origin`） | `elf-express/skillshare-source`      |
| 部署位置              | 每位同事本機的 skillshare source 目錄，停在 `release` 分支，由 `skillshare pull` 更新並同步到各 AI 工具 |
| GitHub 預設分支       | `dev`（PR 預設目標）                   |

`.metadata.json` 與 `_superpowers/`、`frontend/design/ui-ux-pro-max/`、`skillshare/` 由 skillshare 管理，更新方式見 `CLAUDE.md`。

## 分支用途

| 分支                      | 用途                 | 可否提交                 | 從哪裡更新      |
| ------------------------- | -------------------- | ------------------------ | --------------- |
| `main`                  | 主庫，只用來同步     | **不提交，只快轉** | `release`     |
| `dev`                   | 整合測試             | 只能經由開發分支合併     | —              |
| `feat/`、`fix/`、`docs/`、`chore/`、`test/` | 開發 | 可以 | 從 `dev` 開出 |
| `release`               | 唯一的穩定版，同事安裝與更新用 | **不提交，只快轉** | 測過的 `dev`  |

開發分支命名 `<類型>/e-<Linear 編號>-<英文短名>`，例如 `feat/e-235-elf-team-rule`。

## 常用指令

開發：

```
git fetch origin
git switch -c feat/e-<編號>-<短名> origin/dev
```

合回 `dev` 前先 `bash scripts/validate.sh`，經 PR 合併（PR 會跑 Claude AI code review）。

發佈（`dev` 驗證通過後）：

```
git fetch origin
git log --oneline origin/release..origin/dev   # 先列出會帶進去的提交
git switch release
git merge --ff-only origin/dev
git push origin release
```

更新主庫：

```
git fetch origin
git log --oneline origin/main..origin/release   # 先列出會帶進去的提交
git switch main
git merge --ff-only origin/release
git push origin main
```

發佈後提醒同事執行 `skillshare pull`（停在 `release` 的 source 會拿到這次發佈的內容）。

## 分支保護設定建議

建議在 GitHub 設定分支保護規則（Branch Protection Rules 或 Ruleset）：

* **`main` 與 `release`**：禁止 force push、禁止刪除、只允許維護者 push。**不要**設「必須經過 Pull Request」：這兩條分支是在本機 `merge --ff-only` 後直接 push 的，GitHub 的 PR 合併會產生新提交或新 SHA，無法快轉。
* **`dev`**：禁止 force push、禁止刪除；開發分支一律經 PR 合併。

## 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。
* 不把 `main` 當穩定版或安裝來源；同事一律用 `release`。
* 不直接在 `dev` 上開發。
* `--ff-only` 失敗或合併有衝突時，停下來回報，不要自行處理。
