# 分支規範：本 repo 為【第 1 種：貢獻型 fork】

> 完整規範：[分支規範：三種 repo 類型](https://linear.app/elf-express/document/分支規範三種-repo-類型貢獻型-fork私有-fork自有專案-128bf6e5e1f9)（Linear）
> 本檔只記錄這個 repo 的設定。人與 AI 動手前請先讀完本檔。

## 本 repo 資訊

| 項目                        | 值                                                |
| --------------------------- | ------------------------------------------------- |
| 類型                        | 第 1 種：貢獻型 fork（fork 原作者，會送 PR 回饋） |
| 原作者 repo（`upstream`） | `{{作者帳號}}/{{repo 名稱}}`                    |
| 我們的 fork（`origin`）   | `elf-express/{{repo 名稱}}`                     |
| 下游私有 fork               | `{{下游 repo，沒有就寫「無」}}`                 |
| 上游貢獻規範                | `{{CONTRIBUTING 連結，沒有就寫「無」}}`         |

## 遠端設定

```
git remote add upstream https://github.com/{{作者帳號}}/{{repo 名稱}}.git
git remote -v
```

## 分支用途

| 分支                      | 用途                               | 可否提交                 | 從哪裡更新        |
| ------------------------- | ---------------------------------- | ------------------------ | ----------------- |
| `main`                  | 原作者 `main` 的鏡像，只用來同步 | **不提交，只快轉** | `upstream/main` |
| `dev`                   | 整合測試                           | 只能經由開發分支合併     | `main`          |
| `feat/xxx`、`fix/xxx` | 開發                               | 可以                     | 從 `dev` 開出   |
| `pr/xxx`                | 送給原作者的 PR，一個分支一個主題  | 可以                     | 從 `main` 開出  |
| `release`               | 唯一的穩定版，給下游私有 fork 同步 | **不提交，只快轉** | 測過的 `dev`    |

## 常用指令

同步原作者：

```
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

更新 dev：

```
git switch dev
git merge main
git push origin dev
```

開發：

```
git switch -c feat/xxx dev
```

發佈給下游（`dev` 測試通過後）：

```
git switch release
git merge --ff-only dev
git push origin release
```

送 PR 給原作者：

```
git switch -c pr/xxx main
git cherry-pick <該主題的提交>
gh pr create --repo {{作者帳號}}/{{repo 名稱}} --base main
```

## 分支保護與 CI/CD 設定建議

建議在 GitHub 設定分支保護規則（Branch Protection Rules）：

* **`main` 與 `release`**：禁止直接 push 與 force push；必須經過 Pull Request，且至少需要 1 位 reviewer 批准，CI/CD 狀態必須為成功（Status checks must pass）才能合併。
* **`dev`**：禁止直接 push；必須由開發分支（`feat/*`、`fix/*` 或 `merge/*`）建立 PR 才能合併。

## 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。
* 不把 `main` 當穩定版或部署來源。
* 不直接在 `dev` 上開發。
* 不從 `dev` 或開發分支直接對原作者開 PR；一個 `pr/` 分支只放一個主題。
* `--ff-only` 失敗、合併或 cherry-pick 有衝突時，停下來回報，不要自行處理。
