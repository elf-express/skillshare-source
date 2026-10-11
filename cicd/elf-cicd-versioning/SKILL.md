---
name: elf-cicd-versioning
description: |
  Elf Express 版號與發版觸發規範（scripts/version.mjs 統一改寫所有版號、版號經 PR 合進 dev、
  dev 快轉 release 後在 release 上打 annotated tag、tag 觸發 release.yml 並先驗證 tag）。
  當任務涉及 scripts/version.mjs、升 patch / minor / major 版號、打 tag、發一個正式版本、
  「為什麼 tag 推了 release 沒跑」、「為什麼沒發版 / 多發了一版」、release.yml 的觸發條件，
  或舊專案還留著 version.yml 自動 bump 時觸發。
metadata:
  version: 2.0.0
  owner: Elf Express
---

# Elf Express 版號與發版觸發（elf-cicd-versioning）

> 本 skill 管「版號怎麼變、何時打 tag、如何叫起 release」。
> 分支怎麼走（`dev` → `release` → `main`）見 **elf-team-rule**；`release.yml` 的內容：桌面安裝檔見 **elf-cicd-desktop**、容器映像見 **elf-cicd-docker**。
> PR 階段 CI 見 **elf-cicd-frontend** / **elf-cicd-backend**；AI 審查見 **elf-cicd-review**。
>
> **團隊已決定（2026-10-11，E-235，沿用 ELF.Modules v0.8.0 的實際做法）**：版號在 PR 裡改好合進 `dev`；`dev` 測過後快轉到 `release`；由人在 `release` 上打 annotated tag 並推送；tag 觸發 `release.yml`。不再由 bot 自動 bump，也不再用 `[release]` 標記。

## 1. 何時使用

- 新 repo 建立 `scripts/version.mjs` 與 `release.yml` 的觸發
- 要升 patch / minor / major
- 要發一個正式版本
- 「tag 推了 release 沒跑」、「release.yml 的 verify 失敗」、「沒要發卻多了一個 tag」
- 新增一個帶版號的檔案（新的 csproj、新的 package.json）
- 舊專案還有 `.github/workflows/version.yml`（自動 bump）要遷移

## 2. 固定規則

**版號來源**

1. MUST 以根 `package.json` 的 `version` 為唯一來源；所有其他版號檔案由 `scripts/version.mjs` 改寫。
2. MUST NOT 手動編輯任何版號欄位（`package.json`、`apps/package.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock`、API csproj 的 `<Version>`）。
   為什麼：版號分散在四套工具鏈，手改必定漏一處，桌面版、API、前端顯示的版本就對不起來。
3. MUST 在新增帶版號的檔案時，同一個 PR 內把它加進 `version.mjs` 的 `TARGETS`。
4. MUST 讓 API csproj 有 `<Version>0.0.0</Version>`（任意初值）。`version.mjs` 找不到欄位會直接丟錯，這是刻意的。
5. MUST 把 `Cargo.lock` 列為 target（有 `src-tauri/` 時）。為什麼：交給 cargo 更新會落後，`cargo build --locked` 失敗，而且每次發版後工作區都留一個未提交的變更。
6. 版號格式 MUST 是純 `MAJOR.MINOR.PATCH`（無 `-beta`、無 `v` 前綴）；tag 才加 `v`：`v1.2.3`。

**改版號（PR 進 dev）**

7. 要發版時，MUST 在開發分支上執行 `pnpm version:patch`（或 `version:minor` / `version:major`）並提交，提交訊息與 PR 標題用 `chore(release): vX.Y.Z`，經 PR 合進 `dev`。
   為什麼：版號變更和其他改動一樣要經過 CI 與審查；合進 `dev` 的那一刻，就是「決定要發這一版」的紀錄。
8. MUST NOT 讓 bot 或 workflow 提交到 `dev`、`release`、`main`。
   為什麼：`release`、`main` 只能快轉（elf-team-rule 規則 7、8），bot 一提交，下一次 `--ff-only` 就失敗；推到受保護分支也需要另開繞過權限。
9. 一個版號 PR 只改版號；功能改動放在各自的 PR。

**發佈（release 上打 tag）**

10. MUST 先依 elf-team-rule 把 `origin/dev` 快轉到 `release`，並確認 `release` 指向的提交 CI 全綠（elf-team-rule `references/04-release-ci-check.md`）。
11. MUST 在 `release` 指向的提交上打 **annotated** tag，再只推這一個 tag：
    `git tag -a vX.Y.Z -m "<AppName> vX.Y.Z" origin/release` → `git push origin vX.Y.Z`。
    MUST NOT 用 lightweight tag（`git tag vX.Y.Z`）。為什麼：annotated tag 記錄誰、何時、為什麼發版，`git describe` 預設也只認 annotated tag。
12. tag MUST 由人推送，MUST NOT 由 workflow 用 `GITHUB_TOKEN` 推送。
    為什麼：用 `GITHUB_TOKEN` 推的 tag 不會觸發任何 workflow（GitHub 刻意防遞迴），就會出現「tag 在、release 沒跑」。人推的 tag 會觸發 `push: tags`（ELF.Modules v0.8.0 的 tag run 即由此觸發）。
13. tag 名稱 MUST 等於當下 `package.json` 的版號加 `v`。版號沒改就不要打 tag。
14. 發佈後 MUST 依 elf-team-rule 把 `release` 快轉到 `main`（第 3 種）。

**release.yml 的觸發與驗證**

15. `release.yml` MUST 只接受兩種觸發：`push: tags: ['v*']` 與 `workflow_dispatch`（input `tag`，重建既有 tag 用）。MUST NOT 再保留 `workflow_call`。
    為什麼：`workflow_call` 只是給已移除的 `version.yml` 用；留著會讓人以為還有自動發版路徑。
16. `release.yml` MUST 有一個 `verify` job，其他 job 全部 `needs: verify`。`verify` MUST 檢查兩件事：tag 等於 `package.json` 版號；tag 指向的提交在 `origin/release` 上（`git merge-base --is-ancestor`）。範本見 3.2。
    為什麼：tag 打在沒測過的 `dev` 提交上、或版號忘了改，都會發出一個名不符實的版本；在 verify 擋下，比發出去再撤回便宜。
17. `verify` 的 checkout MUST 用 `fetch-depth: 0`。為什麼：淺 clone 沒有 `origin/release` 的歷史，`merge-base --is-ancestor` 會一律失敗。
18. 所有 job 的 checkout MUST 用 `ref: ${{ inputs.tag || github.ref }}`，tag 名稱 MUST 用 `${{ inputs.tag || github.ref_name }}`（兩種觸發共用）。
19. 需要 secret 的 job MUST 在建置前先檢查 secret 非空，空的就 `exit 1`（範例見 elf-cicd-desktop 規則 13）。
    為什麼：空的 secret 常在建置十分鐘後才以看似格式錯誤的訊息失敗，fail fast 才看得出是沒設定。

## 3. 標準範本

| 檔案 | 範本 | 放到 |
|------|------|------|
| 版號改寫腳本 | [`templates/version.mjs`](templates/version.mjs) | `scripts/version.mjs`（替換 `<AppName>`、`<crate-name>`；沒有 Tauri 就刪那三個 target） |
| release 檔頭與 verify job | 3.2 | `.github/workflows/release.yml`（job 內容見 elf-cicd-desktop / elf-cicd-docker） |

根 `package.json` 需要的 scripts（已包含在 elf-cicd-frontend 的 `templates/package.root.json`）：

```json
"version:show": "node scripts/version.mjs",
"version:patch": "node scripts/version.mjs patch",
"version:minor": "node scripts/version.mjs minor",
"version:major": "node scripts/version.mjs major"
```

### 3.1 流程總覽

```
開發分支：pnpm version:minor → 提交 "chore(release): v1.3.0"
  │ PR → dev（CI、AI 審查）
  ▼
dev ──快轉──► release（elf-team-rule；先確認 CI 全綠）
  │
  │ git tag -a v1.3.0 -m "<AppName> v1.3.0" origin/release
  │ git push origin v1.3.0          ← 人推送，才會觸發 workflow
  ▼
release.yml（push: tags）
  verify：tag == package.json 版號？tag 在 origin/release 上？──否──► 失敗，不發佈
  │ 是
  ▼
桌面安裝檔（elf-cicd-desktop）＋ 容器映像（elf-cicd-docker）
  │
release ──快轉──► main
```

### 3.2 release.yml 檔頭與 verify job

`release.yml` 的其他 job 由 elf-cicd-desktop / elf-cicd-docker 規定，但檔頭與 `verify` MUST 是：

```yaml
on:
  # A tag pushed by a person on the release branch.
  push:
    tags: ['v*']
  # Build an existing tag by hand.
  workflow_dispatch:
    inputs:
      tag:
        description: 'Existing tag to build (e.g. v0.0.1)'
        required: true
        type: string

jobs:
  verify:
    name: verify tag
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v5
        with:
          ref: ${{ inputs.tag || github.ref }}
          # Full history, so origin/release is there to compare against.
          fetch-depth: 0

      - name: Tag must match the version and sit on release
        env:
          TAG: ${{ inputs.tag || github.ref_name }}
        run: |
          version=$(node -p "require('./package.json').version")
          if [ "v$version" != "$TAG" ]; then
            echo "::error::tag $TAG does not match package.json version $version"
            exit 1
          fi
          if ! git merge-base --is-ancestor "$(git rev-parse "$TAG^{commit}")" origin/release; then
            echo "::error::$TAG is not on release. Fast-forward release first, then tag the commit it points to."
            exit 1
          fi

  # Every other job: needs: verify
```

### 3.3 常用操作

| 目的 | 做法 |
|------|------|
| 發 patch 版 | 開發分支 `pnpm version:patch` → PR `chore(release): vX.Y.Z` → `dev` → 快轉 `release` → 打 tag 推送 |
| 發 minor / major 版 | 同上，改用 `pnpm version:minor` / `pnpm version:major` |
| 重建某個既有 tag | Actions → Release → Run workflow → 輸入 `vX.Y.Z` |
| 查目前版本 | `pnpm version:show` |
| 查 release 指向哪個版本 | `git show origin/release:package.json \| grep '"version"'` |

### 3.4 從 version.yml（自動 bump）遷移

1. 刪除 `.github/workflows/version.yml`。
2. `release.yml` 拿掉 `workflow_call`，加上 3.2 的 `verify` job，其他 job 加 `needs: verify`。
3. 確認 repo 有 `dev`、`release` 分支（elf-team-rule 第 3 種 A 節）。
4. branch protection 中為 `github-actions[bot]` 開的繞過權限一併移除。

## 4. 禁止簡化

- MUST NOT 拿掉 `verify` job，或讓任何 job 不經 `needs: verify` 就建置、發佈。
- MUST NOT 把 `verify` 的 checkout 改回淺 clone（拿掉 `fetch-depth: 0`）。
- MUST NOT 改用 lightweight tag，或讓 workflow 用 `GITHUB_TOKEN` 推 tag。
- MUST NOT 讓 bot 或 workflow 提交到 `dev`、`release`、`main`（包括「只是改版號」）。
- MUST NOT 手改任何版號欄位而略過 `scripts/version.mjs`。
- MUST NOT 拿掉 secret 的 fail-fast 檢查。

## 5. 檢查清單

- [ ] `scripts/version.mjs` 的 `TARGETS` 涵蓋 repo 內**所有**版號欄位，路徑正確
- [ ] 本機 `node scripts/version.mjs patch` 後 `git diff` 顯示每個版號檔都改到同一個值（驗完 `git checkout .` 還原）
- [ ] API csproj 有 `<Version>` 欄位
- [ ] 沒有 `.github/workflows/version.yml`，也沒有任何 workflow 會提交或推 tag
- [ ] `release.yml` 只有 `push: tags` 與 `workflow_dispatch` 兩種觸發
- [ ] `release.yml` 有 `verify` job（`fetch-depth: 0`），其他 job 都 `needs: verify`
- [ ] 版號 PR 標題為 `chore(release): vX.Y.Z`，只改版號
- [ ] tag 打在 `origin/release` 上、用 `git tag -a`、由人推送

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|------|------|------|
| tag 已推上去，Release workflow 沒跑 | tag 是 workflow 用 `GITHUB_TOKEN` 推的，不觸發 `push: tags` | 由人推送 tag（規則 12） |
| verify 報 `does not match package.json version` | 忘了先合版號 PR，或 tag 打錯版號 | 先回報，同意後刪掉本機與遠端的錯 tag（`git tag -d vX.Y.Z`、`git push origin :refs/tags/vX.Y.Z`），改版號後重來 |
| verify 報 `is not on release` | tag 打在 `dev` 或開發分支上，或 `release` 還沒快轉 | 先快轉 `release`，在 `origin/release` 上打 tag |
| verify 一律報 `is not on release` | checkout 沒有 `fetch-depth: 0` | 加 `fetch-depth: 0`（規則 17） |
| `release` 快轉時 `--ff-only` 失敗 | 舊的 `version.yml` 還在，bot 直接提交到分支上 | 依 3.4 遷移，再依 elf-team-rule 回報處理 |
| `version.mjs` 丟 `no version field matched` | 新 csproj 沒有 `<Version>`，或路徑 / crate 名稱錯 | 補 `<Version>`、修正 `TARGETS` |
| `cargo build --locked` 失敗 | `Cargo.lock` 的自身版本沒跟著改 | `Cargo.lock` 列入 `TARGETS`（規則 5） |
| release 裡簽章步驟報 "Missing comment in secret key" | secret 沒設定，或設在別的 environment | 檢查 repo secrets；release 端保留 fail-fast 檢查（elf-cicd-desktop） |

## 7. 待確認

- tag 訊息格式 `<AppName> vX.Y.Z` 與 release 名稱格式，待與 elf-cicd-desktop 統一。
- 是否需要支援 pre-release 版號（`1.2.0-beta.1`）：目前 `version.mjs` 只接受純 `X.Y.Z`，待確認。
- 3.2 的 `verify` job 以 `package.json` 為版號來源。純 .NET 專案（沒有根 `package.json`，例如 ELF.Modules 用 `Directory.Build.props`）的對應寫法尚未統一；ELF.Modules 目前在 CI 的 tag 步驟以 `sed` 讀 `<Version>` 比對。
- 是否用 ruleset 限制「只有維護者能建立 `v*` tag」，尚未實測。`verify` 只檢查「在 `release` 上、版號相符」，有 write 權限的人都能發版，建議優先處理。
- 3.2 的 `verify` job 只在本機 repo 驗證過判斷邏輯（在 release 上／不在 release 上／版號不符三種結果），尚未在真實 GitHub Actions 跑過 push tag 與 `workflow_dispatch` 兩條路徑，包括 checkout 後 `origin/release` 是否存在。第一個採用的專案要回報結果。
- `verify` 是否加「tag 必須是 annotated」的檢查（`git cat-file -t "$TAG"` 應為 `tag`）：`actions/checkout` 取回 tag 時是否保留 annotated 物件未實測，貿然加上可能誤擋。
