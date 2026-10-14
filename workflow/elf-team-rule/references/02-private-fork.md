# 第 2 種：私有 fork

以我們的第 1 種 repo 為基底，發展成我們私有的版本。只單向從第 1 種的 `release` 拉更新，**不回饋上游，也不對原作者開 PR**。

## 遠端

| 遠端 | 指向 |
| -- | -- |
| `origin` | 我們的私有 repo `elf-express/<私有repo>` |
| `upstream` | 我們的第 1 種 repo `elf-express/<第1種repo>` |

注意：這裡的 `upstream` 是**我們自己的第 1 種 repo**，不是原作者。第 2 種不直接接觸原作者的 repo。

## 分支

| 分支 | 用途 | 可否提交 | 從哪裡更新 | 更新方式 |
| -- | -- | -- | -- | -- |
| `main` | 第 1 種 `release` 的鏡像 | **否** | `upstream/release` | `--ff-only` |
| `dev` | 私有版本的整合測試 | 只經由開發分支 | `main`、開發分支 | merge |
| `feat/`、`fix/`、`docs/`、`chore/`、`test/` | 開發 | 是 | 從 `dev` 開出 | — |
| `release` | 唯一的穩定版，部署用 | **否** | `dev`（緊急修正時 `hotfix/`） | `--ff-only` |
| `hotfix/xxx` | 緊急修正正式版 | 是 | 從 `origin/release` 開出 | — |

第 2 種**沒有** `pr/` 分支。

---

## A. 初次建立

GitHub 上用 Fork 按鈕 fork 一個公開 repo，得到的 fork 必須是公開的，而且同一個帳號或組織對同一個來源只能有一個 fork。所以私有 fork **不要用 Fork 按鈕**，改為：

1. 請使用者在 GitHub 的 `elf-express` 組織建立一個新的**私有**空 repo（不要勾選 README、.gitignore、License）。建立 repo 屬於帳號層級的操作，由使用者自己做。
2. 建立空的本地 repo，接上兩個 remote：

```
git init <私有repo>
cd <私有repo>
git remote add upstream https://github.com/elf-express/<第1種repo>.git
git remote add origin https://github.com/elf-express/<私有repo>.git
git fetch upstream
```

不要用 `git clone` 第 1 種再改 remote：clone 會先建立本地的預設分支（通常就是 `main`），下一步的 `git switch -c main upstream/release` 會失敗（`fatal: a branch named 'main' already exists`），而且那條 `main` 追蹤的是第 1 種的 `main`，不是 `release`。

3. 以第 1 種的 `release` 為起點建立三條分支：

```
git switch -c main upstream/release
git switch -c dev main
git switch -c release main
git push -u origin main dev release
```

4. 確認三條分支都追蹤 `origin`（`git branch -vv`），並把 GitHub 上的預設分支設為 `dev` 或 `main`（問使用者）。
5. 複製 `assets/BRANCHING-type2-private-fork.md` 為 `BRANCHING.md`，填好資訊，經由 `docs/branching-doc` 合進 `dev`。
6. 建議使用者依 SKILL.md 規則 20、21 設定分支保護：`main`、`release` 禁止 force push、禁止刪除、只允許維護者 push，不要設「必須經過 PR」。

---

## B. 日常流程

### B1. 同步第 1 種（`upstream/release` → `main`）

```
git fetch upstream
git log --oneline main..upstream/release    # 看這次會帶進哪些更新
git switch main
git merge --ff-only upstream/release
git push origin main
```

* 來源是 `upstream/release`，**不是** `upstream/main`，也不是 `upstream/dev`。
  * `upstream/main` 只有原作者的版本，沒有我們在第 1 種做的改動。
  * `upstream/dev` 是還在測試中的東西。
* `--ff-only` 失敗 → **停下來回報**。可能原因：有人在我們的 `main` 上提交過，或第 1 種的 `release` 被 force push 過。後者違反第 1 種的規範，要回報使用者去第 1 種處理。

### B2. 更新 dev（`main` → `dev`）

```
git switch dev
git merge main
git push origin dev
```

* 這是整條鏈上**唯一可能出現衝突的地方**：上游的改動和我們私有的改動在這裡相遇。
* 有衝突 → **停下來回報**，列出衝突檔案（`git diff --name-only --diff-filter=U`），說明每個檔案兩邊各改了什麼，不要自行解。
* 使用者可能會要求在獨立分支上處理衝突，做法是先放棄 `dev` 上這次合併，再開衝突處理分支：

```
git merge --abort
git switch -c merge/conflict-<YYYYMMDD> dev
git merge main
# 解衝突、測試
# 經 PR 合回 dev，MUST 用「Create a merge commit」（不可 squash 或 rebase，否則 main 的歷史沒有進 dev，下次同步又會衝突）
```

### B3. 開發（`dev` → `feat/e-<編號>-<短名>` → 合回 `dev`）

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
gh pr create --repo elf-express/<私有repo> --base dev --head feat/e-<編號>-<短名>
```

合併後刪除 `feat/e-<編號>-<短名>`。

### B4. 發佈（`dev` → `release`）

`dev` 測試通過、使用者同意發佈時：

```
git fetch origin
git log --oneline origin/release..origin/dev    # 列出這次發佈的內容，給使用者確認

git switch release
git merge --ff-only origin/release   # 先把本機 release 更新到最新
git merge --ff-only origin/dev
git push origin release
```

* 部署一律使用 `release`。
* 發佈後依 `references/04-release-ci-check.md` 核對 `release` 指向的提交在 GitHub 上的 check runs 與部署結果，依 `references/05-alignment-check.md` 確認分支對齊。
* `release` 不 force push。

### 緊急修正（hotfix）

正式版（`release`）出問題、而 `dev` 上有未測完的內容時（規則 25–27）。hotfix 從**我們自己的** `origin/release` 開出，不是 `upstream/release`：

```
git fetch origin
git switch -c hotfix/e-<編號>-<短名> origin/release
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

使用者同意後發佈，**立刻**把 `release` 合回 `dev`（規則 26）：

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
```

* 快轉 hotfix 失敗代表開出 hotfix 後 `release` 又被更新 → **停下來回報**；使用者同意後在 hotfix 分支上 `git merge --no-edit origin/release`、測試、`git push`（draft PR 會跟著更新，CI 在新提交上重新執行，不是在舊提交上重跑），再從頭判斷 check runs 後發佈。
* `git merge --ff-only origin/dev` 失敗或 `git log origin/dev..dev` 有輸出，代表本機 `dev` 有沒推的提交（違反規則 9）→ **停下來回報**。使用者決定先保留那些提交時，可以改用不依賴本機 `dev` 的做法合回：`git switch --detach origin/dev && git merge --no-edit origin/release && git push origin HEAD:dev`。
* 合回 `dev` 有衝突 → `git merge --abort`，**停下來回報**；使用者同意後從 `origin/dev` 開出 `merge/conflict-<YYYYMMDD>`（同一天已有就加 `-2`），合併 `origin/release`、解衝突、測試後經 PR 合回 `dev`，**MUST 用「Create a merge commit」合併**，不可 squash 或 rebase，否則 `release` 不再是 `dev` 的祖先，下次發佈無法快轉。
* CI 已有 `hotfix/**` 推送觸發時（`elf-cicd-*` 現行範本），推送後就會有 check run，不用開 draft PR。draft PR 只用來觸發 CI：`release` 快轉後 GitHub 會自動把它標成已合併；放棄發佈時關閉它。repo 沒有任何 workflow 時不用開。開了卻沒有任何 check run（例如 workflow 的 `pull_request` 只篩 `main`、`dev`）→ 依規則 28、29 處理，不要一直等。
* 只在本 repo 修，不回饋第 1 種或原作者。問題如果出在上游，另外跟使用者確認是否到第 1 種修正（見 C 節第一題）。
* 最後刪除 `hotfix/e-<編號>-<短名>`（本地與遠端）。

---

## C. 常見問題

**私有版本裡的某個改動，其實也適合貢獻給原作者，怎麼辦？**
不要從第 2 種直接送。正確的路徑是：到第 1 種 repo 用 `feat/` 分支重新實作或 cherry-pick 過去 → 合進第 1 種的 `dev` 測試 → 依第 1 種的流程開 `pr/` 送給作者 → 發佈到第 1 種的 `release` → 第 2 種照 B1、B2 同步回來。這樣改動只有一個來源，同步時不會重複。這個操作會跨兩個 repo，先跟使用者確認。

**第 1 種的 release 很久沒更新，可以直接同步原作者嗎？**
不行。第 2 種的同步來源只能是第 1 種的 `release`。需要上游的新東西，請使用者先在第 1 種做同步上游、測試、發佈 release。

**可以把 main 拿來部署嗎？**
不行。`main` 只是第 1 種 `release` 的鏡像，沒有我們私有的改動。部署一律用 `release`。

**為什麼 main 要獨立出來，不直接把 upstream/release 合進 dev？**
`main` 是乾淨的對照點。任何時候執行 `git diff main dev`，就能看到「我們私有版本跟上游差在哪裡」，排查問題和同步衝突時很有用。

## D. 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。緊急修正一律走 hotfix，不直接改 `release`／`main`。
* 不把 `main` 當穩定版或部署來源；部署一律用 `release`。
* 同步來源只能是第 1 種的 `release`，不是它的 `main` 或 `dev`，也不是原作者的 repo。
* 不直接在 `dev` 上開發。
* 不在 check runs 未全部通過、或沒有 CI 且使用者未明確同意例外時快轉 `release`。
* 不對第 1 種或原作者的 repo 開 PR、推送任何東西。
* `--ff-only` 失敗或合併有衝突時，停下來回報。
