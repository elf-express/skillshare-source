# 第 3 種：自有專案

我們自己建立的專案，沒有上游。分支結構和前兩種一致：穩定版在 `release`，`main` 不當穩定版。

## 遠端

| 遠端 | 指向 |
| -- | -- |
| `origin` | `elf-express/<repo>` |

沒有 `upstream`。

## 分支

| 分支 | 用途 | 可否提交 | 從哪裡更新 | 更新方式 |
| -- | -- | -- | -- | -- |
| `main` | 主庫，只用來同步 | **否** | `release` | `--ff-only` |
| `dev` | 整合測試 | 只經由開發分支 | 開發分支 | merge |
| `feat/xxx`、`fix/xxx` | 開發 | 是 | 從 `dev` 開出 | — |
| `release` | 唯一的穩定版，部署用 | **否** | `dev` | `--ff-only` |

`main` 除了從 `release` 快轉之外沒有其他用途。

---

## A. 初次建立

新 repo 建好、第一次提交在 `main` 之後：

```
git switch main
git push -u origin main

git switch -c dev main
git push -u origin dev

git switch -c release main
git push -u origin release
```

複製 `assets/BRANCHING-type3-own-project.md` 為 `BRANCHING.md`，填好資訊，經由 `feat/branching-doc` 合進 `dev`。建議使用者在 GitHub 設定分支保護：`main`、`release` 禁止直接 push 和 force push。

---

## B. 日常流程

### B1. 開發（`dev` → `feat/xxx` → 合回 `dev`）

```
git switch dev
git pull origin dev
git switch -c feat/xxx
```

開發、提交、測試。合回 `dev` 之前先吸收最新 `dev`：

```
git fetch origin
git merge origin/dev
# 跑測試
git push -u origin feat/xxx
gh pr create --repo elf-express/<repo> --base dev --head feat/xxx
```

合併後刪除 `feat/xxx`。

### B2. 發佈（`dev` → `release`）

`dev` 測試通過、使用者同意發佈時：

```
git fetch origin
git log --oneline origin/release..origin/dev    # 列出這次發佈的內容，給使用者確認

git switch release
git merge --ff-only origin/dev
git push origin release
```

部署一律使用 `release`。

### B3. 更新主庫（`release` → `main`）

每次發佈後接著做：

```
git switch main
git merge --ff-only release
git push origin main
```

---

## C. 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。
* 不把 `main` 當穩定版或部署來源；部署一律用 `release`。
* 不直接在 `dev` 上開發。
* `--ff-only` 失敗或合併有衝突時，停下來回報。
