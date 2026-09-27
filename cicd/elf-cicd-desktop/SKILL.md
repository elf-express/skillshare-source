---
name: elf-cicd-desktop
description: |
  Elf Express Tauri 桌面應用的 GitHub Actions 發佈流程規範（Windows / macOS universal / Ubuntu
  三平台矩陣、updater 簽章金鑰檢查、Apple 公證憑證檢查、tauri-action draft release、
  latest.json 驗證、中英雙語 release 說明）。當任務涉及撰寫或修改 `.github/workflows/release.yml`
  的桌面建置、tauri-apps/tauri-action、TAURI_SIGNING_PRIVATE_KEY、APPLE_* secrets、
  latest.json / updater manifest、draft release 發佈，或排查桌面 release 失敗時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 桌面發佈流程（Tauri release pipeline）

> 參考實作：`TypingTrainer/.github/workflows/release.yml`（v0.1.9 / v0.1.10 已實機驗證：Windows 自動更新、
> macOS Apple Silicon 無 Gatekeeper 警告）。本 skill 以團隊標準（Node 24.18、pnpm 11.x）改寫。

相關 skill：
- `elf-tauri` — `src-tauri/` 專案慣例、updater 設定、簽章金鑰產生與保管（`docs/signing-and-keys.md`）
- `elf-cicd-versioning` — `version.yml`：自動 bump、`[release]` 標記、以 `workflow_call` 呼叫本流程
- `elf-cicd-docker` — 同一個 `release.yml` 內的 `docker` job（GHCR 映像）
- `elf-cicd-frontend` / `elf-cicd-backend` — PR 階段 CI（lint、test、build）
- `desktop/tauri-v2` — 第三方通用 Tauri 2 知識（本 skill 不重複）

---

## 1. 何時使用

- 新專案要加上桌面安裝檔發佈 → 直接複製 [`templates/release.yml`](templates/release.yml)
- 修改 release.yml 的 `desktop` / `updater-manifest` job
- release 失敗排查：簽章金鑰為空、latest.json 缺平台、draft 看不到、macOS 打不開
- 撰寫 / 修改 GitHub Release 頁面說明文字（[`templates/release-body.md`](templates/release-body.md)）

不適用：PR CI（→ `elf-cicd-frontend`）、版號與 tag（→ `elf-cicd-versioning`）、容器映像（→ `elf-cicd-docker`）。

---

## 2. 固定規則

### 觸發與呼叫

1. **MUST** 同時保留三種觸發：`push: tags: ['v*']`、`workflow_dispatch`（input `tag`）、`workflow_call`（input `tag`）。
   WHY：用 `GITHUB_TOKEN` 推的 tag 不會觸發任何 workflow（GitHub 防遞迴），所以 `version.yml` 必須用 `workflow_call` 直接呼叫。
2. **MUST** 所有 checkout / tagName 都寫 `${{ inputs.tag || github.ref }}` / `${{ inputs.tag || github.ref_name }}`。
   WHY：三種觸發來源的 tag 放在不同欄位。
3. **MUST** 呼叫端（`version.yml`）寫 `secrets: inherit`，且給 `permissions: contents: write, packages: write`。
   WHY：被呼叫的 workflow 只會自動拿到 `GITHUB_TOKEN`，其他 secret 全是空字串。TypingTrainer 因此連掛三次 release。

### 矩陣

4. **MUST** 矩陣固定三個平台：`windows-latest`、`macos-latest`（`args: '--target universal-apple-darwin'`）、`ubuntu-latest`。
5. **MUST** `strategy.max-parallel: 1`、`fail-fast: false`。
   WHY：tauri-action 以「讀取 → 合併 → 刪除 → 重傳」更新 `latest.json`，**沒有鎖**。平行跑時最後寫入者勝出，其他平台從清單消失，但三個 job 都顯示綠燈。
6. **MUST** macOS 的 rust toolchain 安裝 `aarch64-apple-darwin,x86_64-apple-darwin` 兩個 target。WHY：universal 需要兩個架構。
7. **MUST** Ubuntu 安裝 `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`。WHY：Tauri 2 使用 webkit2gtk **4.1**，裝 4.0 會編譯失敗。
8. **MUST NOT** 自行加入 ARM 的 Windows / Linux 列（`windows-11-arm`、`ubuntu-24.04-arm`），除非需求單明確要求。
   WHY：`max-parallel: 1` 無法放寬，每多一列約多 8 分鐘；目前無使用者需求。

### 工具鏈（團隊標準，覆蓋參考專案的 npm）

9. **MUST** 順序為 `pnpm/action-setup@v4` → `actions/setup-node@v5`（`node-version-file: .nvmrc`、`cache: pnpm`）。`.nvmrc` 內容 `24.18`，規範見 `elf-cicd-frontend`；**MUST NOT** 寫死 `node-version`。
   WHY：`cache: pnpm` 需要 pnpm 已在 PATH，順序反了 setup-node 會報找不到 pnpm。
10. **MUST NOT** 在 `pnpm/action-setup` 寫 `version:`；版本由根目錄 `package.json` 的 `"packageManager": "pnpm@<PNPM_VERSION>"` 決定。MUST NOT 使用 corepack。
    WHY：兩處都寫且不一致時 action 直接失敗；單一來源也保證 CI 與本機一致。
11. **MUST** 安裝依賴用 `pnpm install --frozen-lockfile`（對應舊的 `npm ci`）。WHY：lockfile 與 package.json 不一致時要失敗，而不是悄悄改 lockfile。
12. **MUST** 使用 `swatinem/rust-cache@v2`，`workspaces: src-tauri`。WHY：Rust 編譯是最慢的步驟。

### 簽章與憑證

13. **MUST** 在 `tauri-action` 前放「Require the signing key」step：`TAURI_SIGNING_PRIVATE_KEY` 為空就 `exit 1`。
    WHY：空金鑰會先編譯十分鐘，最後報 `Missing comment in secret key`，看起來像金鑰格式錯，其實是沒傳進來。
14. **MUST** macOS 放「Check the Apple credentials」step，缺憑證時只 `::warning::`，**不** fail。
    WHY：未簽章的 macOS 版仍可右鍵 → 打開使用；但必須在建置前就讓人看到警告，而不是等使用者回報打不開。
15. **MUST** `tauri-action` 的 `env` 帶入全部簽章變數（見下方 Secrets 表）。WHY：tauri-action 只從環境變數讀取。
16. **MUST NOT** 在 workflow、log、release body 寫出任何 secret 值；只能用 `${{ secrets.NAME }}`。

### tauri-action 參數

17. **MUST** 使用 `tauri-apps/tauri-action@v0`，並固定以下參數：

    | 參數 | 值 | WHY |
    |---|---|---|
    | `releaseDraft` | `true` | 先人工檢查資產再公開 |
    | `prerelease` | `false` | 更新端點只看 latest release |
    | `retryAttempts` | `3` | updater JSON 合併時的上傳沒有 backoff，舊 asset id 會先 404 |
    | `updaterJsonPreferNsis` | `true` | `windows-x86_64` 指向 NSIS `-setup.exe`，與使用者實際安裝的格式一致（從 `.exe` 安裝卻用 `.msi` 更新會變成兩套安裝紀錄）；明確寫出是因為 action 預設值文件註明可能改變 |
    | `updaterJsonKeepUniversal` | `false` | universal 已展開成 `darwin-aarch64` + `darwin-x86_64`，多留一個沒人測的路徑 |
    | `releaseName` | `'<AppName> ${{ inputs.tag \|\| github.ref_name }}'` | — |
    | `releaseBody` | `${{ steps.notes.outputs.body }}`（由「Read the release notes」step 讀 `.github/release-body.md`） | 給從搜尋引擎進來的一般使用者看；內文只有一個來源 |

18. **MUST** job 權限 `permissions: contents: write`。WHY：要建立 release 與上傳資產。

### 驗證與發佈

19. **MUST** 保留 `updater-manifest` job（`needs: desktop`），斷言 `latest.json` 含四個 key：
    `windows-x86_64`、`darwin-aarch64`、`darwin-x86_64`、`linux-x86_64`。WHY：綠燈不代表清單完整（見規則 5）。
20. **MUST** `updater-manifest` 的權限是 `contents: write`，**不是** `read`。
    WHY：此時 release 還是 draft，唯讀 token 看不到 draft，會報 `release not found`。
21. **MUST** 人工發佈：`gh release edit vX.Y.Z --draft=false --latest`。
    WHY：`/releases/latest/download/latest.json` 只解析已公開的 release；draft 對 App 而言等於清單不存在。
22. **MUST** 更新 release body 時 Windows / macOS / Linux 表格、「其他檔案」說明、「只提供 x86-64」聲明三段都保留，且中英並列。
23. **MUST** release 說明只有一個來源：專案的 `.github/release-body.md`（複製自 [`templates/release-body.md`](templates/release-body.md)），由 release.yml 的「Read the release notes」step 讀入。**MUST NOT** 在 release.yml 內嵌另一份 `releaseBody` 文字。
    WHY：兩份內文必然走鐘，最後改了一份、發出去的是另一份。
24. **MUST** 專案同時發佈容器映像（release.yml 內有 `docker` job，見 `elf-cicd-docker`）時保留 release-body.md 最後的 GHCR 行，並把 `<owner>/<repo>` 換成**小寫**；沒有容器映像時刪除該行與其上方的 `---`。
25. **MUST** `tauri-action` step 的 `env` 設 `VITE_USE_MOCK: 'false'` 與 `VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}`，並在 repo **Settings → Secrets and variables → Actions → Variables** 建立 `VITE_API_BASE_URL`（正式 API 的完整網址，例如 `https://api.example.com/api`）。
    WHY：桌面版由 `beforeBuildCommand` 建置，不經過 `web.Dockerfile`，那裡的 `ARG VITE_USE_MOCK=false` 管不到；`VITE_*` 在建置時就寫死，漏設的話發出去的安裝檔會用假資料、而且打到不存在的相對路徑 `/api`（參考專案 TypingTrainer 就是這樣）。見 `elf-tauri` 規則 13b。

---

## 3. 標準範本

| 檔案 | 用途 |
|---|---|
| [`templates/release.yml`](templates/release.yml) | 完整 `.github/workflows/release.yml`（desktop + updater-manifest），替換 `<AppName>` 即可 |
| [`templates/release-body.md`](templates/release-body.md) | 放到 `.github/release-body.md`：雙語 release 說明的**唯一來源**；替換 `<AppName>`；有容器映像時保留最後一行 GHCR 連結（`<owner>/<repo>` 小寫），沒有就刪除 |

### 前置條件（專案端）

```jsonc
// package.json（根目錄）
{
  "packageManager": "pnpm@<PNPM_VERSION>",   // 待確認：pnpm 11.x 或 12 的確切版本
  "engines": { "node": ">=24.18" },
  "scripts": {
    "tauri": "tauri",
    "build": "<建置前端的指令>"          // tauri.conf.json 的 beforeBuildCommand 會呼叫 `pnpm build`
  }
}
```

`src-tauri/tauri.conf.json` 必須 `"bundle": { "createUpdaterArtifacts": true }`，且 `plugins.updater.pubkey` 為真實公鑰（見 `elf-tauri`）。

### Secrets（名稱固定，值絕不寫進 repo）

| Secret | 必要性 | 建立方式 |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | **必要** | `pnpm tauri signer generate -w ~/.tauri/<app>.key` → `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/<app>.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 金鑰有密碼時 | `gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（團隊建議金鑰不設密碼） |
| `APPLE_CERTIFICATE` | 選用（macOS 簽章） | `openssl base64 -A -in Certificates.p12` 的輸出 |
| `APPLE_CERTIFICATE_PASSWORD` | 選用 | 匯出 `.p12` 時設定的密碼 |
| `APPLE_SIGNING_IDENTITY` | 選用 | `security find-identity -v -p codesigning` → `Developer ID Application: …` |
| `APPLE_ID` | 選用（公證） | Apple 帳號 email |
| `APPLE_PASSWORD` | 選用（公證） | account.apple.com 產生的 **App 專用密碼**（不是帳號密碼） |
| `APPLE_TEAM_ID` | 選用（公證） | Apple Developer 會員頁面 |
| `GITHUB_TOKEN` | 自動 | 不需建立 |

完整步驟（CSR、Developer ID Application 憑證、備份金鑰）見 `elf-tauri` 的 `references/signing-and-keys.md`。

### 發佈後確認

```bash
gh release edit vX.Y.Z --draft=false --latest
curl -sSL -o /dev/null -w '%{http_code}\n' \
  https://github.com/<owner>/<repo>/releases/latest/download/latest.json
# 200 = 已安裝的 App 看得到更新；404 = 還是 draft
```

---

## 4. 檢查清單

提交 release.yml 前：

- [ ] 三種觸發（push tag / workflow_dispatch / workflow_call）都在，且都有 `tag` input
- [ ] `max-parallel: 1`、`fail-fast: false`
- [ ] macOS 列 `args: '--target universal-apple-darwin'` + 兩個 rust target
- [ ] `pnpm/action-setup@v4` 在 `setup-node` 之前，且沒有 `version:`
- [ ] `node-version-file: .nvmrc`、`cache: pnpm`、`pnpm install --frozen-lockfile`
- [ ] 「Require the signing key」step 存在且會 `exit 1`
- [ ] macOS「Check the Apple credentials」step 只警告不失敗
- [ ] `updaterJsonPreferNsis: true`、`updaterJsonKeepUniversal: false`、`retryAttempts: 3`、`releaseDraft: true`
- [ ] `updater-manifest` job 存在、權限 `contents: write`、斷言四個平台 key
- [ ] `<AppName>` 已全部替換；`.github/release-body.md` 存在、中英雙語完整，release.yml 沒有內嵌的 release 文字
- [ ] 有 `docker` job ⇔ release-body.md 有 GHCR 行（小寫 `<owner>/<repo>`）
- [ ] 呼叫端 `version.yml` 有 `secrets: inherit`（→ `elf-cicd-versioning`）

首次發佈後：

- [ ] `updater-manifest` 綠燈
- [ ] `gh release edit … --draft=false --latest` 已執行，`latest.json` 回 200
- [ ] 至少一台 Windows 實機「檢查更新 → 下載安裝 → 重新啟動」成功
- [ ] macOS 實機從 `universal.dmg` 開啟無 Gatekeeper 警告（已設 Apple 憑證時）

---

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| CI 報 `Missing comment in secret key` | 金鑰**是空的**（Tauri 先 base64 解碼再驗證，空字串當成格式錯） | 呼叫端加 `secrets: inherit`；確認 `gh secret list` 有 `TAURI_SIGNING_PRIVATE_KEY` |
| Docker job 成功、desktop job 金鑰錯誤 | 同上 — `GITHUB_TOKEN` 是唯一自動傳遞的 secret | 同上 |
| 三個 job 都綠，但部分平台收不到更新 | 平行寫 `latest.json`，後寫覆蓋先寫 | `max-parallel: 1`；靠 `updater-manifest` job 抓 |
| `updater-manifest` 報 `release not found`，資產明明在 | 權限 `contents: read` 看不到 draft | 改 `contents: write` |
| App 顯示 `Could not fetch a valid release JSON from the remote` | release 仍是 draft | `gh release edit vX.Y.Z --draft=false --latest` |
| `tauri build` 在簽章步驟報 `failed to decode base64 pubkey` | `tauri.conf.json` 的 `pubkey` 是佔位字串或不完整 | 貼上 `<app>.key.pub` **完整內容**（→ `elf-tauri`） |
| 建置、發佈、清單檢查全過，使用者按「下載並安裝」才失敗 | 私鑰與 `pubkey` 不成對（輪替金鑰後沒更新 secret） | 重新 `gh secret set`，比對 `gh secret list` 時間晚於金鑰檔 |
| macOS 使用者：「無法打開，Apple 無法檢查是否有惡意軟體」 | 未簽章或只簽章未公證 | 設齊 `APPLE_*` secrets；`xcrun notarytool log <id>` 看拒絕原因 |
| 很久沒問題的 macOS 發佈突然失敗 | Developer ID 憑證（5 年）到期或 API key 被撤銷 | 重新產生憑證並更新 secrets |
| setup-node 報找不到 pnpm | `pnpm/action-setup` 放在 `setup-node` 之後 | 調換順序 |
| `pnpm/action-setup` 報版本衝突 | 同時寫了 `version:` 與 `packageManager` 且不一致 | 移除 `version:` |
| tag 推上去但 release 沒跑 | tag 由 `GITHUB_TOKEN` 推送（不觸發事件）或是 lightweight tag | 由 `version.yml` 以 `workflow_call` 呼叫；用 `git tag -a`（→ `elf-cicd-versioning`） |
| Ubuntu 編譯 `webkit2gtk` 找不到 | 安裝了 4.0 版套件 | 用 `libwebkit2gtk-4.1-dev` |
| Windows 使用者更新後「程式和功能」出現兩筆、或更新失敗 | 使用者裝的是 `-setup.exe`（NSIS），`latest.json` 卻指向 `.msi` | `updaterJsonPreferNsis: true` |
| Release 頁面文字與 repo 裡的 release-body.md 不同 | release.yml 內嵌了另一份 `releaseBody` | 刪除內嵌文字，改由「Read the release notes」step 讀檔（規則 23） |
| 「Read the release notes」step 報找不到檔案 | 沒把範本複製到 `.github/release-body.md` | 複製範本並替換佔位符 |

---

## 6. 待確認

- pnpm 確切版本：`packageManager` 欄位要填 11.x 的哪一版，或改用 12（團隊尚未定案）。
- `pnpm/action-setup` 的主版號（範本用 `@v4`；是否已有更新的 major 需團隊確認後統一）。
- 以 pnpm 取代 npm 後，tauri-action 依 `pnpm-lock.yaml` 自動改用 `pnpm tauri build` —— 參考專案只用 npm 驗證過，第一次 pnpm 發佈需實際確認 log。
- Windows 程式碼簽章（`WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD`）團隊是否要購買與導入；目前範本未含。
- Apple 公證要用 Apple ID 方式（`APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`，範本採用）還是 App Store Connect API key 方式（`APPLE_API_ISSUER`/`APPLE_API_KEY`/`APPLE_API_KEY_PATH`）；團隊帳號由誰持有。
- Windows / Linux ARM 是否要納入矩陣（目前刻意不做）。
