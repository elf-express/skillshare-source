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
| `feat/`、`fix/`、`docs/`、`chore/`、`test/` | 開發 | 是 | 從 `dev` 開出 | — |
| `release` | 唯一的穩定版，部署用 | **否** | `dev`（緊急修正時 `hotfix/`） | `--ff-only` |
| `hotfix/xxx` | 緊急修正正式版 | 是 | 從 `origin/release` 開出 | — |

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

複製 `assets/BRANCHING-type3-own-project.md` 為 `BRANCHING.md`，填好資訊，經由 `docs/branching-doc` 合進 `dev`。建議使用者依 SKILL.md 規則 20、21 設定分支保護：`main`、`release` 禁止 force push、禁止刪除、只允許維護者 push，不要設「必須經過 PR」。

---

## B. 日常流程

### B1. 開發（`dev` → `feat/e-<編號>-<短名>` → 合回 `dev`）

```
git fetch origin
git switch -c feat/e-<編號>-<短名> origin/dev
```

開發、提交、測試。合回 `dev` 之前先吸收最新 `dev`：

```
git fetch origin
git merge origin/dev
# 跑測試
git push -u origin feat/e-<編號>-<短名>
gh pr create --repo elf-express/<repo> --base dev --head feat/e-<編號>-<短名>
```

經 PR 合回 `dev`，用 merge commit（規則 37），不可 squash 或 rebase。

合進 `dev` 後不刪除 `feat/e-<編號>-<短名>`（本地、遠端與它的 worktree）：發版完成、Plan 與 Spec 已完成後，由清理實作者依規則 19 用 `release-cleanup` 刪除；實作者不刪。

### B2. 發佈（`dev` → `release`）

`dev` 測試通過、使用者同意（及 Eddie 在 Linear 的「允許發版」，規則 39）後，由規則 39 決定的執行者快轉：

```
git fetch origin
git log --oneline origin/release..origin/dev    # 列出這次發佈的內容，給使用者確認

git switch release
git merge --ff-only origin/release   # 先把本機 release 更新到最新
git merge --ff-only origin/dev
git push origin release
```

也可以用 skillshare-source 的 `scripts/release-ff.sh`（Git Bash）／`scripts/release-ff.ps1`（PowerShell）執行 B2 與 B3：腳本含規則 24、28 的檢查（列提交、查 check runs），每次推送前要輸入發佈提交的前 8 碼確認，`--dry-run`／`-DryRun` 只檢查不推送。

部署一律使用 `release`。

* 發佈後依 `references/04-release-ci-check.md` 核對 `release` 指向的提交在 GitHub 上的 check runs 與部署結果，依 `references/05-alignment-check.md` 確認分支對齊。

### B3. 更新主庫（`release` → `main`）

每次發佈後，由規則 39 決定的執行者接著做：

```
git fetch origin
git log --oneline origin/main..origin/release    # 先列出會帶進去的提交
git switch main
git merge --ff-only origin/main   # 先把本機 main 更新到最新
git merge --ff-only origin/release
git push origin main
```

用 `scripts/release-ff.sh`／`release-ff.ps1` 時，腳本在 B2 推送 `release` 後接著做這一步。

### 緊急修正（hotfix）

正式版（`release`）出問題、而 `dev` 上有未測完的內容時（規則 25–27）：

```
git fetch origin
git switch -c hotfix/e-<編號>-<短名> origin/release    # 從 release 開出，不是 dev
# 修改、測試、提交
git push -u origin hotfix/e-<編號>-<短名>
gh pr create --repo elf-express/<repo> --draft --base release --head hotfix/e-<編號>-<短名> \
  --title "hotfix(E-<編號>): <說明>（僅觸發 CI，不要合併）" --body "E-<編號>"   # 規則 25：CI 沒有 hotfix/** 觸發時才需要
```

發佈前**停下**，給使用者看會帶進去的提交，並依 `references/04-release-ci-check.md` 第 0 節判斷 check runs（規則 28）：

```
git log --oneline origin/release..origin/hotfix/e-<編號>-<短名>
gh api "repos/elf-express/<repo>/commits/$(git rev-parse origin/hotfix/e-<編號>-<短名>)/check-runs?filter=latest&per_page=100" --jq '.check_runs[]|"\(.status) \(.conclusion) \(.name)"'
```

使用者同意（及 Eddie 在 Linear 的「允許發版」，規則 39）後，由規則 39 決定的執行者發佈，並**立刻**把 `release` 合回 `dev`（規則 26；其中 `git push origin dev` 由發版審計員執行，是第 3 種任何 AI 角色唯一可推 `dev` 的情形；規則 18 的上游同步只用於第 1、2 種，規則 39），再依 B3 更新主庫（`main` 只依賴 `release`，合回卡在衝突走 PR 時也可以先快轉 `main`）：

```
git fetch origin                 # 等待同意期間 release／dev 可能被更新
git switch release
git merge --ff-only origin/release   # 先把本機 release 更新到最新
git merge --ff-only origin/hotfix/e-<編號>-<短名>   # 失敗 → 停下來回報
git push origin release

git fetch origin
git switch dev
git merge --ff-only origin/dev   # 先把本機 dev 更新到最新；失敗 → 停下來回報
git log --oneline origin/dev..dev   # 必須是空的；有輸出 → 本機 dev 有沒推的提交，停下來回報
git merge --no-edit origin/release   # 有衝突 → git merge --abort，停下來回報
git push origin dev              # 被拒 → 停下來回報，不要 pull --rebase 或 force push

git switch main
git merge --ff-only origin/main   # 先把本機 main 更新到最新
git merge --ff-only origin/release
git push origin main
```

* 快轉 hotfix 失敗代表開出 hotfix 後 `release` 又被更新 → **停下來回報**；使用者同意後在 hotfix 分支上 `git merge --no-edit origin/release`、測試、`git push`（draft PR 會跟著更新，CI 在新提交上重新執行，不是在舊提交上重跑），再從頭判斷 check runs 後發佈。
* `git merge --ff-only origin/dev` 失敗或 `git log origin/dev..dev` 有輸出，代表本機 `dev` 有沒推的提交（違反規則 9）→ **停下來回報**。使用者決定先保留那些提交時，可以改用不依賴本機 `dev` 的做法合回：`git switch --detach origin/dev && git merge --no-edit origin/release && git push origin HEAD:dev`。
* 合回 `dev` 有衝突 → `git merge --abort`，**停下來回報**；使用者同意後從 `origin/dev` 開出 `merge/conflict-<YYYYMMDD>`（同一天已有就加 `-2`），合併 `origin/release`、解衝突、測試後經 PR 合回 `dev`，**MUST 用「Create a merge commit」合併**，不可 squash 或 rebase，否則 `release` 不再是 `dev` 的祖先，下次發佈無法快轉。
* CI 已有 `hotfix/**` 推送觸發時（`elf-cicd-*` 現行範本），推送後就會有 check run，不用開 draft PR。draft PR 只用來觸發 CI：`release` 快轉後 GitHub 會自動把它標成已合併；放棄發佈時關閉它。repo 沒有任何 workflow 時不用開。開了卻沒有任何 check run（例如 workflow 的 `pull_request` 只篩 `main`、`dev`）→ 依規則 28、29 處理，不要一直等。
* 發佈後不由實作者刪除 `hotfix/e-<編號>-<短名>`（本地與遠端）：該單已完成、發版證據齊全後，由清理實作者依規則 19 用 `release-cleanup` 刪除。

---

## C. 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。緊急修正一律走 hotfix，不直接改 `release`／`main`。
* 不把 `main` 當穩定版或部署來源；部署一律用 `release`。
* 不直接在 `dev` 上開發。
* 不在 check runs 未全部通過、或沒有 CI 且使用者未明確同意例外時快轉 `release`。
* `--ff-only` 失敗或合併有衝突時，停下來回報。
