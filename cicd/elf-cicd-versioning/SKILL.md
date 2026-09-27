---
name: elf-cicd-versioning
description: |
  Elf Express 自動版號與發版觸發規範（合併到 main 自動 bump patch、commit 標題含 [release]
  才打 annotated tag、以 workflow_call + secrets: inherit 呼叫 release.yml）。
  當任務涉及 .github/workflows/version.yml、scripts/version.mjs、升 minor / major 版號、
  打 tag、「為什麼 tag 推了 release 沒跑」、「為什麼沒發版 / 多發了一版」、
  或 version.yml 與 release.yml 之間的呼叫關係時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 版號與發版觸發（elf-cicd-versioning）

> 本 skill 管「版號怎麼變、何時打 tag、如何叫起 release」。
> `release.yml` 的內容：桌面安裝檔見 **elf-cicd-desktop**、容器映像見 **elf-cicd-docker**。
> PR 階段 CI 見 **elf-cicd-frontend** / **elf-cicd-backend**；AI 審查見 **elf-cicd-review**。
>
> **團隊已決定（沿用 TypingTrainer 行為）**：每次合併到 `main` 一律 bump patch；**只有** commit 標題含 `[release]` 才打 annotated tag 並呼叫 `release.yml`。不是每次 bump 都打 tag，這一點不再討論。

## 1. 何時使用

- 新 repo 建立 `version.yml` + `scripts/version.mjs`
- 要升 minor / major
- 要發一個正式版本（`[release]`）
- 「合併了但沒發版」、「沒要發卻多了一個 tag」、「tag 推了 release 沒跑」
- 新增一個帶版號的檔案（新的 csproj、新的 package.json）

## 2. 固定規則

**版號來源**

1. MUST 以根 `package.json` 的 `version` 為唯一來源；所有其他版號檔案由 `scripts/version.mjs` 改寫。
2. MUST NOT 手動編輯任何版號欄位（`package.json`、`apps/package.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock`、API csproj 的 `<Version>`）。
   為什麼：版號分散在四套工具鏈，手改必定漏一處，桌面版、API、前端顯示的版本就對不起來。
3. MUST 在新增帶版號的檔案時，同一個 PR 內把它加進 `version.mjs` 的 `TARGETS`。
4. MUST 讓 API csproj 有 `<Version>0.0.0</Version>`（任意初值）。`version.mjs` 找不到欄位會直接丟錯，這是刻意的。
5. MUST 把 `Cargo.lock` 列為 target（有 `src-tauri/` 時）。為什麼：交給 cargo 更新會落後，`cargo build --locked` 失敗，而且每次發版後工作區都留一個未提交的變更。
6. 版號格式 MUST 是純 `MAJOR.MINOR.PATCH`（無 `-beta`、無 `v` 前綴）；tag 才加 `v`：`v1.2.3`。

**自動 bump（version.yml）**

7. MUST 只在 `push: branches: [main]` 觸發；每次合併自動 +1 patch。
8. 升 minor / major MUST 在 PR 內手動執行 `pnpm version:minor` 或 `pnpm version:major` 並提交；合併後 workflow 會再 +1 patch（例如 `0.3.0` 合併後成為 `0.3.1`），這是預期行為。
9. MUST 保留 job 條件 `if: "!startsWith(github.event.head_commit.message, 'chore(release):')"`，且 bump commit 訊息固定為 `chore(release): v$VERSION [skip ci]`。
   為什麼：bot 自己的 commit 不可以再觸發自己（無限迴圈）；`[skip ci]` 讓 CI 也不必重跑一次只改版號的 commit。
10. MUST 保留「此 commit 已有 tag 就跳過」的 guard（`git describe --exact-match --tags HEAD`）。為什麼：已經刻意發佈的 commit 再 bump，會立刻蓋過剛發佈的版本。
11. MUST `actions/checkout` 用 `fetch-depth: 0`。為什麼：淺 clone 沒有 tag，guard 永遠判斷「未發佈」。
12. MUST 用 `actions/checkout@v5` / `actions/setup-node@v5` 與 `node-version-file: .nvmrc`；`version.mjs` MUST 保持零相依，所以此 job 不跑 `pnpm install`。

**`[release]` 判斷**

13. MUST 只比對 commit **標題（subject，第一行）**：`SUBJECT=${MESSAGE%%$'\n'*}`。MUST NOT 比對整段訊息。
    為什麼：比對整段時，任何只是「提到」`[release]` 的 commit（註解、文件、描述這個機制本身）都會發出一個沒人要的版本——參考專案的 v0.0.5 就是這樣跑出去的。
14. commit 訊息 MUST 經由 `env: MESSAGE:` 傳入 script，MUST NOT 直接 `${{ github.event.head_commit.message }}` 內插到 `run:`。為什麼：訊息裡的引號、反引號、`$()` 會被當成 shell 執行（script injection）。
15. 團隊 PR 合併方式 MUST 用 **Squash and merge**，並把 `[release]` 寫在 **PR 標題**。
    為什麼：squash 的 commit 標題 = PR 標題（+ ` (#123)`）；若用 "Create a merge commit"，標題固定是 `Merge pull request #123 from ...`，`[release]` 只會出現在內文，**永遠不會發版**。

**Tag**

16. MUST 用 annotated tag：`git tag -a "v$VERSION" -m "<AppName> v$VERSION"`，再 `git push --follow-tags`。
    MUST NOT 用 `git tag v1.2.3`（lightweight）。為什麼：`--follow-tags` 只推 annotated tag，lightweight tag 會被靜默留在 runner 上，workflow 顯示成功但 release 從未發生。
17. MUST NOT 在沒有 `[release]` 時打 tag（已決定，不採「每次 bump 都打 tag」）。每個 tag 都代表「有人決定要發佈」。
    為什麼：每次合併都打 tag 會讓每個小改動都跑一次三平台安裝檔建置（約 20 分鐘 CI），並留下一串沒人決定要發佈的 tag。

**呼叫 release.yml**

18. MUST 在 `version.yml` 以 `uses: ./.github/workflows/release.yml` + `with: tag:` **直接呼叫** release，MUST NOT 依賴 tag 的 `push` 事件。
    為什麼：用 `GITHUB_TOKEN` 推的 tag 不會觸發任何 workflow（GitHub 刻意防遞迴），等不到的 `push: tags` 事件就是「tag 在、release 沒跑」。
19. MUST 在呼叫端寫 `secrets: inherit`。
    為什麼：被呼叫的 workflow 只自動拿到 `GITHUB_TOKEN`，其他 secret 全是空字串；簽章金鑰為空時 Tauri 報 "Missing comment in secret key"，看起來像金鑰格式錯，不像沒傳——參考專案因此連掛三次 release。
20. MUST 在呼叫端 job 給 `permissions: contents: write, packages: write`（被呼叫端的權限不能超過呼叫端）。
21. `release.yml` MUST 同時接受三種觸發並統一讀 `inputs.tag || github.ref`（契約見 3.2）。

## 3. 標準範本

| 檔案 | 範本 | 放到 |
|------|------|------|
| 自動版號 workflow | [`templates/version.yml`](templates/version.yml) | `.github/workflows/version.yml`（替換 `<AppName>`） |
| 版號改寫腳本 | [`templates/version.mjs`](templates/version.mjs) | `scripts/version.mjs`（替換 `<AppName>`、`<crate-name>`；沒有 Tauri 就刪那三個 target） |

根 `package.json` 需要的 scripts（已包含在 elf-cicd-frontend 的 `templates/package.root.json`）：

```json
"version:show": "node scripts/version.mjs",
"version:patch": "node scripts/version.mjs patch",
"version:minor": "node scripts/version.mjs minor",
"version:major": "node scripts/version.mjs major"
```

### 3.1 流程總覽

```
PR（squash merge）
  │  標題：feat: 新增訂單匯出 [release]
  ▼
main 上的 commit ──push──► version.yml / bump
  │ guard：此 commit 已有 tag？──是──► 結束
  │ node scripts/version.mjs patch
  │ commit "chore(release): vX.Y.Z [skip ci]"
  │ 標題含 [release]？
  │   否 → git push（只有版號前進）
  │   是 → git tag -a vX.Y.Z → git push --follow-tags
  ▼
version.yml / release ──uses: release.yml, secrets: inherit──► 桌面安裝檔 + 容器映像
```

### 3.2 release.yml 必須遵守的觸發契約

`release.yml` 的 job 內容由 elf-cicd-desktop / elf-cicd-docker 規定，但檔頭 MUST 是：

```yaml
on:
  # A tag pushed by a person.
  push:
    tags: ['v*']
  # Build an existing tag by hand.
  workflow_dispatch:
    inputs:
      tag:
        description: 'Existing tag to build (e.g. v0.0.1)'
        required: true
        type: string
  # How version.yml reaches this workflow (a GITHUB_TOKEN-pushed tag triggers nothing).
  workflow_call:
    inputs:
      tag:
        required: true
        type: string
```

所有 job 的 checkout MUST 用 `ref: ${{ inputs.tag || github.ref }}`，tag 名稱 MUST 用 `${{ inputs.tag || github.ref_name }}`。

需要 secret 的 job MUST 先檢查 secret 非空再開始建置（fail fast）：

```yaml
      - name: Require the signing key
        shell: bash
        env:
          KEY: ${{ secrets.<SECRET_NAME> }}
        run: |
          if [ -z "$KEY" ]; then
            echo "::error::<SECRET_NAME> is empty. A called workflow only receives secrets when the caller passes 'secrets: inherit'."
            exit 1
          fi
```

### 3.3 常用操作

| 目的 | 做法 |
|------|------|
| 一般合併（只前進 patch） | 正常 squash merge，標題不含 `[release]` |
| 發佈正式版 | PR 標題加 `[release]` 後 squash merge |
| 升 minor 並發佈 | PR 內 `pnpm version:minor` 並提交，標題加 `[release]` |
| 重建某個既有 tag | Actions → Release → Run workflow → 輸入 `vX.Y.Z` |
| 查目前版本 | `pnpm version:show` |

## 4. 檢查清單

- [ ] `.github/workflows/version.yml` 與範本一致，`<AppName>` 已替換
- [ ] `scripts/version.mjs` 的 `TARGETS` 涵蓋 repo 內**所有**版號欄位，路徑正確
- [ ] 本機 `node scripts/version.mjs patch` 後 `git diff` 顯示每個版號檔都改到同一個值（驗完 `git checkout .` 還原）
- [ ] API csproj 有 `<Version>` 欄位
- [ ] bump job 條件含 `chore(release):` guard；commit 訊息含 `[skip ci]`
- [ ] checkout `fetch-depth: 0`；`actions/*` 都是 `@v5`
- [ ] `[release]` 只比對 SUBJECT；訊息透過 `env` 傳入
- [ ] tag 用 `git tag -a` + `git push --follow-tags`
- [ ] `release` job 用 `uses:` 呼叫，含 `with: tag:` 與 `secrets: inherit`、`permissions: contents: write, packages: write`
- [ ] `release.yml` 檔頭符合 3.2 的三種觸發
- [ ] repo 設定只允許 Squash merge（或團隊已明確知道 merge commit 不會觸發 `[release]`）
- [ ] `main` 的保護規則允許 bump job 推送（見「待確認」第一項）

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|------|------|------|
| tag 已推上去，Release workflow 沒跑 | tag 是 `GITHUB_TOKEN` 推的，不觸發 `push: tags` | 由 `version.yml` 以 `uses:` 直接呼叫（規則 18） |
| workflow 綠燈，但遠端沒有 tag | 用了 lightweight tag，`--follow-tags` 不推 | `git tag -a`（規則 16） |
| release 裡簽章步驟報 "Missing comment in secret key" | 呼叫端沒寫 `secrets: inherit`，金鑰是空字串 | 加 `secrets: inherit`；release 端加 fail-fast 檢查 |
| docker job 成功、desktop job 失敗 | 同上：`GITHUB_TOKEN` 會自動傳，其他 secret 不會 | 同上 |
| 沒打算發版卻多了一個版本 | 比對整段 commit 訊息，內文提到 `[release]` | 只比對 SUBJECT（規則 13） |
| PR 標題有 `[release]`，合併後卻沒發版 | 使用 "Create a merge commit"，標題變成 `Merge pull request #…` | 改用 Squash and merge（規則 15） |
| bump job 無限觸發 | 移除了 `chore(release):` guard 或 `[skip ci]` | 兩者都保留（規則 9） |
| 剛發佈的版本立刻被 +1 蓋過 | 拿掉了「已有 tag 就跳過」guard | 保留 guard（規則 10） |
| guard 永遠判斷未發佈 | checkout 沒有 `fetch-depth: 0`，沒有 tag 資訊 | 加 `fetch-depth: 0` |
| `version.mjs` 丟 `no version field matched` | 新 csproj 沒有 `<Version>`，或路徑 / crate 名稱錯 | 補 `<Version>`、修正 `TARGETS` |
| `cargo build --locked` 失敗 | `Cargo.lock` 的自身版本沒跟著改 | `Cargo.lock` 列入 `TARGETS`（規則 5） |
| bump job `git push` 被拒 `protected branch` | `main` 保護規則要求 PR，`github-actions[bot]` 不能直接推 | 見「待確認」第一項 |
| 兩個 PR 幾乎同時合併，其中一次 bump 推送失敗 (non-fast-forward) | 第二個 job checkout 的是舊的 commit，main 已被第一個 bump 前進 | 該次 patch 被跳過，下一次合併自然補上；若失敗的那次帶 `[release]`，重跑 job 沒用（仍是舊 commit），要再合併一個標題含 `[release]` 的 PR（見待確認） |

## 6. 待確認

- **`main` 受保護時 bump job 如何推送**：團隊規定 `main` 必須經 PR，但 `version.yml` 以 `GITHUB_TOKEN` 直接推 commit 與 tag。需決定：(a) 在 branch protection / ruleset 允許 GitHub Actions 繞過；或 (b) 改用 GitHub App token（`actions/create-github-app-token`）或 deploy key 並設為 bypass。**注意**：若改用 App token / PAT，推送的 tag **會**觸發 `release.yml` 的 `push: tags`，再加上 `workflow_call` 會**重複發佈兩次**，屆時必須移除其中一條路徑。參考專案未受保護，此處未經實機驗證。
- repo 合併策略是否統一為「只允許 Squash merge、預設訊息 = PR 標題與描述」，待確認。
- 並發合併造成 bump push 被拒的處理（加 `concurrency` 排隊 + push 前 `git pull --rebase`，或接受跳過），參考專案未處理，待確認。
- tag 訊息格式 `<AppName> vX.Y.Z` 與 release 名稱格式，待與 elf-cicd-desktop 統一。
- 是否需要支援 pre-release 版號（`1.2.0-beta.1`）：目前 `version.mjs` 只接受純 `X.Y.Z`，待確認。
