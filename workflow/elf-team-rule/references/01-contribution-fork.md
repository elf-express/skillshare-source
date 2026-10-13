# 第 1 種：貢獻型 fork

fork 原作者的開源專案，自己使用，同時把改動整理成 PR 回饋給作者。這種 repo 還有第二個角色：用 `release` 分支提供穩定版給下游的第 2 種私有 fork 同步。

## 遠端

| 遠端         | 指向                               |
| ------------ | ---------------------------------- |
| `origin`   | 我們的 fork `elf-express/<repo>` |
| `upstream` | 原作者的 repo `<作者>/<repo>`    |

## 分支

| 分支                      | 用途                              | 可否提交               | 從哪裡更新         | 更新方式      |
| ------------------------- | --------------------------------- | ---------------------- | ------------------ | ------------- |
| `main`                  | 原作者 `main` 的鏡像            | **否**           | `upstream/main`  | `--ff-only` |
| `dev`                   | 自己使用、整合測試                | 只經由開發分支         | `main`、開發分支 | merge         |
| `feat/`、`fix/`、`docs/`、`chore/`、`test/` | 開發                              | 是                     | 從 `dev` 開出    | —            |
| `pr/xxx`                | 送給原作者的 PR，一個分支一個主題 | 是（只放 cherry-pick） | 從 `main` 開出   | —            |
| `release`               | 唯一的穩定版，給第 2 種同步       | **否**           | `dev`（緊急修正時 `hotfix/`） | `--ff-only` |
| `hotfix/xxx`            | 緊急修正正式版                    | 是                     | 從 `origin/release` 開出 | —            |

> 如果原作者的主線不叫 `main`（例如 `master`），同步指令裡的 `upstream/main` 改成實際名稱，我們這邊的分支仍叫 `main`。這個差異要寫進 `BRANCHING.md`，格式固定為單獨一行 ``上游主線：`master` ``（範本已有這一行），git-guard 依它檢查 `main` 的來源。

---

## A. 初次建立

1. 在 GitHub 上用 Fork 按鈕 fork 原作者的 repo 到 `elf-express`。
2. Clone 並設定 upstream：

```
git clone https://github.com/elf-express/<repo>.git
cd <repo>
git remote add upstream https://github.com/<作者>/<repo>.git
git fetch upstream
```

3. 確認 `main` 和上游一致，再建立 `dev` 和 `release`：

```
git switch main
git merge --ff-only upstream/main
git push origin main

git switch -c dev main
git push -u origin dev

git switch -c release main
git push -u origin release
```

4. 複製 `assets/BRANCHING-type1-contribution-fork.md` 為 `BRANCHING.md`，填好資訊，經由 `docs/branching-doc` 合進 `dev`。
5. 建議使用者依 SKILL.md 規則 20、21 設定分支保護：`main`、`release` 禁止 force push、禁止刪除、只允許維護者 push，不要設「必須經過 PR」。

---

## B. 日常流程

### B1. 同步原作者（`upstream/main` → `main`）

```
git fetch upstream
git log --oneline origin/main..upstream/main    # 先列出這次會帶進來的提交
git switch main
git merge --ff-only upstream/main
git push origin main
```

* `--ff-only` 失敗 → **停下來回報**。可能原因：有人在我們的 `main` 上提交過，或原作者改寫了歷史（force push）。兩種都需要使用者決定，不要改用一般 merge、`reset --hard` 或 force push。

### B2. 更新 dev（`main` → `dev`）

```
git switch dev
git merge main
git push origin dev
```

* 有衝突 → **停下來回報**，列出衝突檔案（`git diff --name-only --diff-filter=U`），不要自行解。使用者同意在獨立分支處理時，先 `git merge --abort`，再從 `dev` 開 `merge/conflict-<YYYYMMDD>`，合併 `main`、解衝突、測試後經 PR 合回 `dev`（MUST 用「Create a merge commit」，不可 squash 或 rebase）。
* 建議每次 B1 之後都接著做 B2，讓 `dev` 不要落後上游太多。

### B3. 開發（`dev` → `feat/e-<編號>-<短名>` → 合回 `dev`）

```
git fetch origin
git switch -c feat/e-<編號>-<短名> origin/dev
```

開發、提交、測試。合回 `dev` 之前：

```
git fetch origin
git merge origin/dev        # 在開發分支上先吸收最新 dev，衝突在這裡處理（有衝突先回報）
# 跑測試
git push -u origin feat/e-<編號>-<短名>
```

然後開 PR：`feat/e-<編號>-<短名>` → 我們自己 repo 的 `dev`（**不是**原作者的 repo）：

```
gh pr create --repo elf-express/<repo> --base dev --head feat/e-<編號>-<短名>
```

合併後刪除 `feat/e-<編號>-<短名>`（本地與遠端）。

### B4. 發佈給下游（`dev` → `release`）

`dev` 測試通過、使用者同意發佈時：

```
git fetch origin
git log --oneline origin/release..origin/dev    # 先列出這次會帶給下游的提交，給使用者確認

git switch release
git merge --ff-only origin/release   # 先把本機 release 更新到最新
git merge --ff-only origin/dev
git push origin release
```

* `release` 只從 `dev` 快轉，正常情況一定成功。失敗代表有人直接動過 `release` → **停下來回報**。
* `release` **絕對不能 force push**。下游第 2 種的 `main` 是用 `--ff-only` 從我們的 `release` 同步，一旦改寫歷史，下游會全部同步失敗。
* 發佈後提醒使用者：下游的第 2 種 repo 可以執行同步了。
* 發佈後依 `references/04-release-ci-check.md` 核對 `release` 指向的提交在 GitHub 上的 check runs 與部署結果，依 `references/05-alignment-check.md` 確認分支對齊。

### 緊急修正（hotfix）

正式版（`release`）出問題、而 `dev` 上有未測完的內容時（規則 25–27）：

```
git fetch origin
git switch -c hotfix/e-<編號>-<短名> origin/release    # 從我們的 release 開出，不是 dev
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
* 發佈後提醒使用者：下游的第 2 種 repo 可以執行同步了。
* 修正如果也適用原作者，另依 B5 用 `pr/` 送 PR。
* 最後刪除 `hotfix/e-<編號>-<短名>`（本地與遠端）。

### B5. 送 PR 給原作者（`main` → `pr/xxx`）

前提：這個功能已經在 `feat/e-<編號>-<短名>` 開發完成，並在 `dev` 測試過。

1. 先做一次 B1，讓 `main` 是原作者最新的版本。
2. 從 `main` 開出 `pr/` 分支，只 cherry-pick 這個主題的提交：

```
git switch main
git switch -c pr/xxx
git cherry-pick -x <提交1> <提交2> ...
```

* 用 `git log --oneline main..dev` 找出這個主題的提交，**把要 cherry-pick 的清單給使用者確認**。
* 不要 cherry-pick 合併提交（merge commit），也不要帶入其他主題的提交。
* cherry-pick 有衝突 → **停下來回報**。
* **衝突處理標準路徑**：若需手動解決衝突，建議回到原始開發分支（如 `feat/e-<編號>-<短名>`）解決衝突並提交新的 commit，然後重新在 `pr/xxx` 分支進行 cherry-pick，或重新基於 `main` 建立新的 `pr/xxx` 分支。確保 `dev` 與 `pr/xxx` 的實質改動邏輯完全一致，不要讓兩邊內容分歧。

3. 推到我們的 fork，對原作者開 PR：

```
git push -u origin pr/xxx
gh pr create --repo <作者>/<repo> --base main --head elf-express:pr/xxx
```

* PR 標題、描述、提交格式依原作者的 `CONTRIBUTING`。不知道時先讀上游 repo 的 `CONTRIBUTING.md`。
* PR 內容先給使用者過目再送出。送出 PR 屬於對外發布，**一定要使用者明確同意**。

4. 原作者要求修改時，在同一個 `pr/xxx` 上提交修正並推送。同樣的修正也要經由 `feat/` 分支進 `dev`，不要讓兩邊內容分歧。

### B6. 原作者處理完 PR 之後

| 結果         | 怎麼做                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 作者合併了   | 做 B1 同步上游、B2 更新 dev。內容和 dev 上已有的改動相同，通常不會衝突；若作者有改動過再合併，可能有衝突 → 回報。完成後刪除 `pr/xxx`。 |
| 作者拒絕     | 刪除 `pr/xxx`。改動仍留在 `dev`，我們自己繼續使用。記錄到 Linear 對應的 issue。                                                       |
| 作者要求拆分 | 從 `main` 另開多個 `pr/` 分支，各自 cherry-pick 對應的提交，舊的 `pr/xxx` 關閉後刪除。                                              |

---

## C. 常見問題

**為什麼不直接從 dev 開 PR 給作者？**
`dev` 上混了所有自用改動和合併 `main` 留下的合併提交，作者要審一堆無關的東西。從 `main` 開 `pr/xxx` 再 cherry-pick，PR 裡只有這個主題。

**為什麼要有 release？**
第 2 種要從我們這裡同步。同步 `dev` 會拿到還在測試中的東西；同步 `main` 又拿不到我們自己的改動。`release` 是「測過、可以給下游」的固定出口，而且只快轉，所以下游的 `main` 也永遠只需要快轉。

**可以把 main 拿來部署嗎？**
不行。`main` 只是原作者的鏡像，沒有我們的改動，也不是我們測過的版本。部署一律用 `release`。

**上游有 bug，作者還沒修，我們急著要？**
照一般流程在 `fix/e-<編號>-<短名>` 修好、合進 `dev`、測過後發佈到 `release`。之後依 B5 把修正送給作者。
`dev` 上有未測完的內容、不能整包發佈時，改走上面的「緊急修正（hotfix）」。

## D. 禁止事項

* 不在 `main`、`release` 上提交，也不 force push。緊急修正一律走 hotfix，不直接改 `release`／`main`。
* 不把 `main` 當穩定版或部署來源。
* 不直接在 `dev` 上開發。
* 不在 check runs 未全部通過、或沒有 CI 且使用者未明確同意例外時快轉 `release`。
* 不從 `dev` 或 `feat/` 分支直接對原作者開 PR。
* 一個 `pr/` 分支只放一個主題，只放 cherry-pick 的提交。
* 未經使用者明確同意，不對原作者的 repo 開 PR、留言或推送任何東西。
* `--ff-only` 失敗、合併或 cherry-pick 有衝突時，停下來回報。
