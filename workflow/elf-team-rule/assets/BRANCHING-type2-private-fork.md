# 分支規範：本 repo 為【第 2 種：私有 fork】

> 完整規範：[分支規範：三種 repo 類型](https://linear.app/elf-express/document/分支規範三種-repo-類型貢獻型-fork私有-fork自有專案-128bf6e5e1f9)（Linear）
> 本檔只記錄這個 repo 的設定。人與 AI 動手前請先讀完本檔。

## 本 repo 資訊

| 項目                             | 值                                                |
| -------------------------------- | ------------------------------------------------- |
| 類型                             | 第 2 種：私有 fork（以第 1 種為基底，不回饋上游） |
| 上游第 1 種 repo（`upstream`） | `elf-express/{{第 1 種 repo 名稱}}`             |
| 本 repo（`origin`）            | `elf-express/{{repo 名稱}}`（私有）             |
| 部署位置                         | `{{部署到哪裡，例如主機或環境名稱}}`            |

## 遠端設定

```
git remote add upstream https://github.com/elf-express/{{第 1 種 repo 名稱}}.git
git remote -v
```

## 分支用途

| 分支                      | 用途                                   | 可否提交                 | 從哪裡更新           |
| ------------------------- | -------------------------------------- | ------------------------ | -------------------- |
| `main`                  | 第 1 種 `release` 的鏡像，只用來同步 | **不提交，只快轉** | `upstream/release` |
| `dev`                   | 私有版本的整合測試                     | 只能經由開發分支合併     | `main`             |
| `feat/xxx`、`fix/xxx` | 開發                                   | 可以                     | 從 `dev` 開出      |
| `release`               | 唯一的穩定版，部署用                   | **不提交，只快轉** | 測過的 `dev`       |

## 常用指令

同步上游（來源是 `upstream/release`，不是 `upstream/main`）：

```
git fetch upstream
git switch main
git merge --ff-only upstream/release
git push origin main
```

更新 dev（整條鏈唯一可能有衝突的地方）：

```
git switch dev
git merge main
git push origin dev
```

開發：

```
git switch -c feat/xxx dev
```

發佈（`dev` 測試通過後）：

```
git switch release
git merge --ff-only dev
git push origin release
```

## 分支保護與 CI/CD 設定建議

建議在 GitHub 設定分支保護規則（Branch Protection Rules）：

* **`main` 與 `release`**：禁止直接 push 與 force push；必須經過 Pull Request，且至少需要 1 位 reviewer 批准，CI/CD 狀態必須為成功（Status checks must pass）才能合併。
* **`dev`**：禁止直接 push；必須由開發分支（`feat/*`、`fix/*` 或 `merge/*`）建立 PR 才能合併。

## 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。
* 不把 `main` 當穩定版或部署來源；部署一律用 `release`。
* 同步來源只能是第 1 種的 `release`，不是它的 `main` 或 `dev`。
* 不直接在 `dev` 上開發。
* 不對上游或原作者開 PR。
* `--ff-only` 失敗或合併有衝突時，停下來回報，不要自行處理。
