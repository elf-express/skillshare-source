---
name: elf-tauri
description: |
  Elf Express 團隊 Tauri 2 桌面應用慣例（src-tauri 目錄結構、command 註冊、capabilities 權限、
  updater 與 createUpdaterArtifacts、簽章金鑰保管、版號同步、前端 IPC 橋接）。當任務涉及新增或修改
  src-tauri/ 下的任何檔案、#[tauri::command]、generate_handler!、capabilities/default.json、
  tauri.conf.json、tauri-plugin-updater、自動更新、@tauri-apps/* 在前端的使用、簽章金鑰或
  docs/signing-and-keys.md 時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express Tauri 2 桌面應用慣例

> 參考實作：`TypingTrainer/src-tauri/`、`apps/src/api/desktop.ts`、`docs/signing-and-keys.md`。
> 這是**團隊層**規範；Tauri 2 本身的 API、IPC（emit / channel）、state、行動版建置等通用知識請載入
> `tauri-v2`（`desktop/tauri-v2`），本 skill 不重複。兩者衝突時以本 skill 為準。

相關 skill：
- `elf-cicd-desktop` — 三平台 release workflow、secrets 檢查、latest.json 驗證
- `elf-cicd-versioning` — `scripts/version.mjs` 與自動 bump
- `elf-vue` — 前端元件 / store 規範（desktop 橋接只能在 `api/` 層被呼叫）
- `elf-stack` — 團隊版本總表（Node 24.18、pnpm 版號）

---

## 1. 何時使用

- 新專案加入桌面殼：依第 3 節複製範本
- 新增 Rust command、新增 Tauri plugin、調整權限
- 設定或排查自動更新（updater、pubkey、endpoints）
- 產生 / 輪替 / 備份簽章金鑰
- 前端需要呼叫桌面功能（檔案路徑、版本、更新）

---

## 2. 固定規則

### 專案結構

1. **MUST** 使用 Tauri 標準結構，桌面殼只存在於 `src-tauri/`，前端在獨立 workspace（例：`apps/`）：

   ```
   <repo>/
   ├─ package.json            # packageManager: pnpm@<PNPM_VERSION>；scripts: tauri / desktop:dev / desktop:build
   ├─ pnpm-workspace.yaml
   ├─ <web-dir>/              # Vue 前端；同一份 bundle 給瀏覽器與桌面用
   │  └─ src/api/desktop.ts   # 唯一 import @tauri-apps/* 的檔案
   ├─ src-tauri/
   │  ├─ tauri.conf.json
   │  ├─ Cargo.toml / Cargo.lock / build.rs
   │  ├─ capabilities/default.json
   │  ├─ icons/
   │  └─ src/
   │     ├─ main.rs           # 只呼叫 <appname>_lib::run()
   │     └─ lib.rs            # 所有 command 與 Builder
   ├─ scripts/version.mjs     # → elf-cicd-versioning
   └─ docs/signing-and-keys.md
   ```

2. **MUST** `main.rs` 只做轉呼叫；所有邏輯與 command 放在 `lib.rs`（或 `lib.rs` 引入的模組）。
   WHY：行動版目標會產生自己的進入點，只有 lib 裡的程式碼可被共用。
3. **MUST** `Cargo.toml` 的 `[lib] name = "<appname>_lib"`、`crate-type = ["staticlib", "cdylib", "rlib"]`。
4. **MUST** `identifier` 格式為 `tw.elf.<appname>`（全小寫）。WHY：決定各 OS 的 app data 路徑，**上線後不可更改**，否則使用者資料「消失」。

### Command 與 IPC

5. **MUST** 每個 `#[tauri::command]` 都加進 `lib.rs` 的 `tauri::generate_handler![...]`。
   WHY：沒註冊的 command 編譯不會錯，`invoke` 在執行期才失敗。
6. **MUST** 會失敗的 command 回傳 `Result<T, String>`，錯誤訊息含上下文（`format!("cannot create {}: {e}", path)`）。**MUST NOT** 在 command 內 `unwrap()` / `expect()`。
   WHY：panic 會讓前端只拿到無意義的錯誤；`String` 錯誤可直接顯示。
7. **MUST** 回傳結構體 `#[derive(Serialize)]`，並在 `desktop.ts` 定義同名欄位的 TypeScript 型別。
8. **MUST** 前端所有 `@tauri-apps/*` 只能在 `<web-dir>/src/api/desktop.ts` 內以 **動態 `import()`** 使用；view / store 只呼叫 `desktop.ts` 匯出的函式。
   WHY：同一份 bundle 也跑在瀏覽器，靜態 import 會把 Tauri API 打進主 chunk，且瀏覽器端沒有 `__TAURI_INTERNALS__`。
9. **MUST** 每個橋接函式開頭 `if (!IS_DESKTOP) return null`，`IS_DESKTOP = '__TAURI_INTERNALS__' in window`。
10. **MUST** 大型檔案用 `app.path().app_local_data_dir()`，**MUST NOT** 用 roaming 的 `app_data_dir()` 存 GB 級資料。WHY：Windows roaming 目錄會在機器間同步。

### 權限（capabilities）

11. **MUST** 所有權限寫在 `src-tauri/capabilities/default.json`，`windows: ["main"]`，基線為
    `["core:default", "updater:default", "process:allow-restart"]`。WHY：Tauri 2 預設全部拒絕。
12. **MUST** 新增 plugin 時同時：`Cargo.toml` 加依賴 → `lib.rs` 註冊 → `default.json` 加**最小**權限（例：`fs:allow-read-text-file`，不用 `fs:default` 以外的萬用權限）→ 前端套件 `pnpm --filter <web> add @tauri-apps/plugin-xxx`。
13. **MUST NOT** 為了「先跑起來」加入過寬權限或把 CSP 設為 `null`。
13a. **MUST** CSP 含 `connect-src 'self' ipc: http://ipc.localhost <api-origin>`（範本見 `templates/tauri.conf.json`）：
    - `ipc:`（macOS / Linux）與 `http://ipc.localhost`（Windows）是 Tauri 2 的 IPC 通道，少了它 `invoke` 會被 CSP 擋下；
    - `<api-origin>` 是**每個專案必填**的後端來源（例 `https://api.example.com`，只寫 origin、不含路徑）。桌面版的 bundle 由 `tauri://localhost` / `http://tauri.localhost` 提供，
      相對路徑 `/api` 不會經過 nginx，因此桌面建置 **MUST** 以絕對網址設定 `VITE_API_BASE_URL`，其 origin 必須同時出現在 CSP `connect-src` 與後端 `Cors:Origins`（後端需允許 `tauri://localhost`、`http://tauri.localhost`）。
    - 純離線、不連後端的 App 刪掉 `<api-origin>` 這一段即可，**MUST NOT** 留著佔位字串，也 **MUST NOT** 改成 `connect-src *` 或 `https:`。
13b. **MUST** 桌面建置明確設定 `VITE_USE_MOCK`：`VITE_USE_MOCK` 程式預設為開（`!== 'false'`，見 `elf-vue` 規則 31），而桌面 release 不經過 `web.Dockerfile`，沒設就會出貨 fixture 資料。
    有後端的 App **MUST** 在 release workflow 的建置環境設 `VITE_USE_MOCK=false` 與 `VITE_API_BASE_URL=<api-origin>/api`（workflow 由 `elf-cicd-desktop` 維護）；刻意以 fixture / 本機資料運作的離線 App 須在 PR 說明。

### Updater

14. **MUST** `tauri.conf.json` 設 `"bundle": { "createUpdaterArtifacts": true }`。
    WHY：沒有簽章金鑰時 `tauri build` 直接失敗，確保未簽章版本不會出貨。
15. **MUST** `plugins.updater`：
    - `pubkey`：`~/.tauri/<appname>.key.pub` 的**完整內容**（佔位字串會讓 build 在簽章步驟報 `failed to decode base64 pubkey`）
    - `endpoints`：`["https://github.com/<owner>/<repo>/releases/latest/download/latest.json"]`
    - `windows.installMode`：`"passive"`（只顯示進度視窗，不需點擊）
16. **MUST** `tauri-plugin-updater` 與 `tauri-plugin-process` 放在 `[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]`，
    並在 `.setup()` 內以 `#[cfg(desktop)]` 註冊（不是 Builder 上的 `.plugin()`）。WHY：這兩個 plugin 不支援行動版，否則行動版無法編譯。
16a. **MUST** release workflow 的 `tauri-action` 設 `updaterJsonPreferNsis: true`，讓 `latest.json` 的 `windows-x86_64` 指向使用者實際安裝的 NSIS `-setup.exe`（而非 `.msi`），否則更新後會出現兩套安裝紀錄或更新失敗（workflow 見 `elf-cicd-desktop`）。
17. **MUST** 更新流程：`check()` → `downloadAndInstall(progress)` → `relaunch()`；進度最多顯示 99% 直到安裝返回。
    WHY：Windows 安裝程式接手後行程會在 `downloadAndInstall` 內結束；macOS / Linux 需要 `relaunch` 才會跑新版。

### 簽章金鑰

18. **MUST** 以 `pnpm tauri signer generate -w ~/.tauri/<appname>.key` 產生，密碼留空；公鑰進 `tauri.conf.json`，私鑰只進 `gh secret set TAURI_SIGNING_PRIVATE_KEY`。
19. **MUST** 私鑰備份到團隊密碼管理器。WHY：GitHub secret 無法讀回；遺失私鑰 = 所有已安裝的 App 永遠無法更新。
20. **MUST NOT** 把私鑰、`.p12`、App 專用密碼放進 repo、issue、PR、log 或對話。
21. **MUST** 輪替金鑰後同時更新 `pubkey` 與 secret，並用 `gh secret list` 確認 secret 時間晚於金鑰檔。WHY：不成對的金鑰會通過所有 CI 關卡，直到使用者按安裝才失敗。
22. **MUST** 專案內有 `docs/signing-and-keys.md`，內容複製自 [`references/signing-and-keys.md`](references/signing-and-keys.md)。

### 版號

23. **MUST NOT** 手動修改 `tauri.conf.json`、`Cargo.toml`、`Cargo.lock` 的版號；一律 `pnpm version:patch|minor|major`（`scripts/version.mjs`，見 `elf-cicd-versioning`）。
    WHY：版號同時存在 package.json ×2、tauri.conf.json、Cargo.toml `[package]`、Cargo.lock、.csproj；`Cargo.lock` 落後會讓 `cargo build --locked` 失敗。
24. **MUST** `version.mjs` 的 Cargo.lock 規則使用 `name = "<appname>"`（Cargo.toml `[package] name`）比對；改 crate 名稱時同步修改。

### 測試

25. **MUST** e2e 測試桌面專屬 UI 時以 `page.addInitScript(() => { (window as any).__TAURI_INTERNALS__ = {} })` 模擬殼層。
    WHY：否則 `v-if="IS_DESKTOP"` 區塊不會渲染，量到的是少了一截的頁面。前提是規則 8（動態 import）。
26. **MUST** 單元測試以 `vi.mock('@tauri-apps/plugin-updater', …)`、`vi.mock('@tauri-apps/plugin-process', …)` mock，不實際呼叫殼層。

---

## 3. 標準範本

| 範本 | 複製到 | 替換 |
|---|---|---|
| [`templates/tauri.conf.json`](templates/tauri.conf.json) | `src-tauri/tauri.conf.json` | `<AppName>` `<appname>` `<web-dir>` `<owner>/<repo>` `<api-origin>`（CSP，必填或整段移除）、pubkey、描述 |
| [`templates/Cargo.toml`](templates/Cargo.toml) | `src-tauri/Cargo.toml` | `<appname>` `<AppName>` |
| [`templates/main.rs`](templates/main.rs) | `src-tauri/src/main.rs` | `<appname>` |
| [`templates/lib.rs`](templates/lib.rs) | `src-tauri/src/lib.rs` | `<AppName>`、範例 command |
| [`templates/capabilities/default.json`](templates/capabilities/default.json) | `src-tauri/capabilities/default.json` | — |
| [`templates/desktop.ts`](templates/desktop.ts) | `<web-dir>/src/api/desktop.ts` | 對應的 command |
| [`references/signing-and-keys.md`](references/signing-and-keys.md) | `docs/signing-and-keys.md` | `<AppName>` `<appname>` `<owner>/<repo>` |

`src-tauri/build.rs`：

```rust
fn main() {
    tauri_build::build()
}
```

### 根目錄 package.json

```jsonc
{
  "packageManager": "pnpm@<PNPM_VERSION>",   // full version; exact team version in elf-stack. No corepack.
  "engines": { "node": ">=24.18" },
  "scripts": {
    "dev": "pnpm --filter <web> dev",
    "build": "pnpm --filter <web> build",
    "tauri": "tauri",
    "desktop:dev": "tauri dev",
    "desktop:build": "tauri build",
    "version:show": "node scripts/version.mjs",
    "version:patch": "node scripts/version.mjs patch",
    "version:minor": "node scripts/version.mjs minor",
    "version:major": "node scripts/version.mjs major"
  },
  "devDependencies": { "@tauri-apps/cli": "^2" }
}
```

前端依賴：`pnpm --filter <web> add @tauri-apps/api @tauri-apps/plugin-updater @tauri-apps/plugin-process`

### 新增一個 command（固定四步）

```rust
// 1. src-tauri/src/lib.rs
#[tauri::command]
fn read_setting(app: tauri::AppHandle, key: String) -> Result<String, String> {
    // ... 失敗時 Err(format!("cannot read {key}: {e}"))
}

// 2. 同檔案 generate_handler!
.invoke_handler(tauri::generate_handler![shell_info, data_dir, read_setting])
```

```ts
// 3. <web-dir>/src/api/desktop.ts
export async function readSetting(key: string): Promise<string | null> {
  if (!IS_DESKTOP) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<string>('read_setting', { key })   // 參數名 = Rust 參數名（camelCase 對應）
}
```

4. 若 command 使用了 plugin API，在 `capabilities/default.json` 加上對應最小權限。自訂 command 本身不需要在 capabilities 列出（見 `tauri-v2` skill 的權限說明）。

---

## 4. 檢查清單

- [ ] `main.rs` 只有 `<appname>_lib::run()`；邏輯全在 `lib.rs`
- [ ] 每個 `#[tauri::command]` 都在 `generate_handler!`
- [ ] command 無 `unwrap()` / `expect()`，失敗回 `Result<_, String>`
- [ ] 前端只有 `api/desktop.ts` import `@tauri-apps/*`，且為動態 `import()`
- [ ] `capabilities/default.json` 只含必要權限；CSP 未被放寬為 `null`
- [ ] CSP 有 `connect-src 'self' ipc: http://ipc.localhost <api-origin>`，`<api-origin>` 已換成真實 origin（或離線 App 已移除）
- [ ] 桌面建置已明確設定 `VITE_USE_MOCK` / `VITE_API_BASE_URL`；release 使用 `updaterJsonPreferNsis: true`
- [ ] `createUpdaterArtifacts: true`；`pubkey` 為真實公鑰；`endpoints` 指向本 repo；`installMode: "passive"`
- [ ] updater / process plugin 在 desktop-only target 依賴，並於 `setup` 內 `#[cfg(desktop)]` 註冊
- [ ] `identifier` = `tw.elf.<appname>`，且與既有版本相同
- [ ] 版號只透過 `pnpm version:*` 修改；`Cargo.lock` 已一併更新
- [ ] `docs/signing-and-keys.md` 存在；私鑰已備份到密碼管理器；`gh secret list` 有 `TAURI_SIGNING_PRIVATE_KEY`
- [ ] 本機 `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/<appname>.key)" pnpm desktop:build` 產出 bundle **與** `.sig`
- [ ] e2e 有模擬 `__TAURI_INTERNALS__` 的桌面 UI 測試

---

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| `invoke` 報 command not found | 沒加進 `generate_handler!` | 加入後重新編譯 |
| `invoke` 報權限不足 / not allowed | `capabilities/default.json` 缺 plugin 權限，或 `windows` 沒含該視窗 label | 加最小權限；確認 `windows: ["main"]` |
| `tauri build` 報 `failed to decode base64 pubkey` | `pubkey` 是佔位字串或只貼了一部分 | 貼上 `.key.pub` 完整內容 |
| 本機 build 失敗，提示需要簽章金鑰 | `createUpdaterArtifacts: true` 但沒設 `TAURI_SIGNING_PRIVATE_KEY` | `export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/<appname>.key)"`；只測前端用 `pnpm desktop:dev` |
| CI 報 `Missing comment in secret key` | secret 是空的（呼叫端沒 `secrets: inherit`） | 見 `elf-cicd-desktop` |
| 使用者按「下載並安裝」才失敗，CI 全綠 | 私鑰與 `pubkey` 不成對 | 重新 `gh secret set`，確認時間 |
| App 報 `Could not fetch a valid release JSON from the remote` | release 仍為 draft | `gh release edit vX.Y.Z --draft=false --latest` |
| macOS / Linux 更新完仍是舊版 | 沒呼叫 `relaunch()` 或缺 `process:allow-restart` | 補上 `relaunch` 與權限 |
| 行動版編譯失敗：updater 相關 | updater plugin 放在一般 `[dependencies]` 或在 Builder 上註冊 | 移到 desktop-only target，`setup` 內 `#[cfg(desktop)]` |
| 桌面版 `invoke` 全部失敗，console 出現 CSP `connect-src` 錯誤 | CSP 少了 `ipc:` / `http://ipc.localhost` | 補上規則 13a 的 `connect-src` |
| 桌面版呼叫 API 被擋（CSP 或 CORS） | `<api-origin>` 未列入 `connect-src`，或後端 `Cors:Origins` 沒有 `tauri://localhost` / `http://tauri.localhost` | 兩處都補上該 origin |
| 桌面正式版顯示假資料 | 建置時沒設 `VITE_USE_MOCK=false`（程式預設開） | 在 release workflow 設定（規則 13b） |
| Windows 更新後「程式和功能」出現兩筆 | `latest.json` 指向 `.msi`，使用者裝的是 `-setup.exe` | `updaterJsonPreferNsis: true` |
| 瀏覽器版白畫面 / 主 chunk 暴增 | 前端靜態 `import '@tauri-apps/api'` | 改在 `desktop.ts` 內動態 `import()` |
| `cargo build --locked` 失敗 | `Cargo.lock` 版號落後 | 用 `scripts/version.mjs`，不要手改 |
| 改版後使用者設定 / 資料不見 | `identifier` 被改動 | 還原原 `identifier` |
| e2e 找不到桌面專屬元素 | 沒模擬 `__TAURI_INTERNALS__` | `page.addInitScript` 注入 |

---

## 6. 待確認

- pnpm 確切版號（11.x 或 12）由 `elf-stack` 決定；定案前 `packageManager` 寫 `pnpm@<PNPM_VERSION>` 並填完整版號。
- `identifier` 前綴 `tw.elf.` 是否為團隊正式規範（取自參考專案 `tw.elf.typelab`）。
- 「前端只有 `api/desktop.ts` 可 import `@tauri-apps/*`」是由參考專案結構歸納出的規則，需團隊確認是否納入 `elf-vue`。
- `rust-version = "1.77.2"`、`edition = "2021"` 是否為團隊統一最低版本。
- 預設 CSP 其餘指令（`img-src` / `style-src 'unsafe-inline'` / `font-src`，沿用參考專案）是否收緊為團隊基線；`connect-src` 已定（規則 13a）。
- Windows 程式碼簽章憑證是否導入；Apple 公證採 Apple ID 或 API key 方式、帳號由誰持有。
- 私鑰備份的團隊密碼管理器（工具與存放路徑）尚未指定。
- `scripts/version.mjs` 的完整內容與目標檔清單以 `elf-cicd-versioning` 為準；本 skill 只規範 Tauri 相關的三個檔案。
