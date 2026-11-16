# cargo-msrv-and-plugin-versions：GREEN 紀錄

## 第 1 次（Plan Task 5 原文）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `8bf449e825569535bd8b3e06938fb0c8f375945b`（HEAD `54291d8c7d715d95fc5cc471a8089a2ceaec3072` ＋ 未提交的 stack/elf-stack/SKILL.md、desktop/elf-tauri/templates/Cargo.toml）；`git diff --stat`：`2 files changed, 13 insertions(+), 7 deletions(-)`，只列這兩個檔
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：13，耗時 82 秒
- 結果：4/5 個 grader 通過 → **未通過**
- 備註：05 未通過 → 修 skill（§3 前言同行加「寫進 manifest 時要說明依據哪一列、屬 3.7 哪一批、精確或 caret」與 WHY）；同一快照的回歸 new-src-tauri 5/5、desktop-root-package-json 3/3，修正後用新快照重跑

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-msrv-1-90` | 通過 | work/src-tauri/Cargo.toml:7 為 rust-version = "1.90"。 |
| `02-table-crates-exact` | 通過 | Cargo.toml 的 tauri 2.12.5、tauri-build 2.7.4、updater 2.14.1、process 2.4.0；grep -nE '= "2"' 結束碼 1。 |
| `03-serde-untouched` | 通過 | serde = { version = "1", features = ["derive"] }、serde_json = "1" 原樣。 |
| `04-npm-plugins-caret` | 通過 | apps/package.json 多出 plugin-process ^2.4.0、plugin-updater ^2.14.1，其餘欄位與 fixture 相同。 |
| `05-cites-rules` | 未通過 | final-response.md 只說「範本和團隊版本表 elf-stack 一致」，沒有引用 §3 前言的 Cargo 精確值規定、沒有指出 §3.7 Tauri 批次、也沒有說明 npm plugin 用 caret 預設而非例外；三點皆缺。 |

### 子代理最後回覆（逐字）

````markdown
我已新增 `src-tauri/`，`Cargo.toml` 是照團隊範本寫的，兩個前端 plugin 也加進了 `apps/package.json`。目前還沒編譯過：缺圖示和前端產物，`tauri.conf.json` 裡也還有幾項要你填。

**`Cargo.toml` 的版本**（範本和團隊版本表 elf-stack 一致）
- `rust-version = "1.90"`、`edition = "2021"`。elf-tauri 第 6 節「待確認」還寫著舊的 `1.77.2`，我以團隊版本表為準，沒有用它。
- `tauri = "2.12.5"`、`tauri-build = "2.7.4"`。`tauri-plugin-updater = "2.14.1"`、`tauri-plugin-process = "2.4.0"` 放在只限桌面平台的相依區塊，在 `lib.rs` 的 `setup` 裡用 `#[cfg(desktop)]` 註冊。
- 另外產生了 `Cargo.lock`。產生時 Cargo 先自動解析到較新的 `tauri 2.12.6` 和 `tauri-build 2.7.5`，我把它們降回表上的 `2.12.5` 和 `2.7.4`，避免順手升級。四個 crate 在 lock 裡現在都和表一致。

**一起加的檔案**：`build.rs`、`rust-toolchain.toml`、`src/main.rs`（只呼叫 `acme_lib::run()`）、`src/lib.rs`、`capabilities/default.json`（只開基本權限）、`tauri.conf.json`。

**`apps/package.json`**：加了 `@tauri-apps/plugin-updater ^2.14.1`、`@tauri-apps/plugin-process ^2.4.0`。repo 原本的版本都已和團隊表一致，沒有落差要回報。

**需要你決定或補上的**
1. **App 名稱和 `identifier`**：我從 `@acme/web` 推成 `acme`，所以 identifier 是 `tw.elf.acme`。它一上線就不能再改，不對的話要在第一次發版前換掉。
2. **`tauri.conf.json` 還有三個佔位字串**，不填就建置不了：
   - `pubkey`：要先執行 `pnpm tauri signer generate -w ~/.tauri/acme.key`，再把產生的公鑰完整貼上，私鑰要備份到密碼管理器。我沒有替你產生金鑰。
   - `endpoints` 裡的 `<owner>/<repo>`。
   - CSP 裡的 `<api-origin>`：填後端的網址來源；如果是完全離線的 App，就把這一段刪掉。
3. **範本要求、但這次範圍外沒建立的**：
   - 根目錄的 `package.json`（含 `packageManager: pnpm@12.16.1`、`tauri`／`desktop:*` scripts、`@tauri-apps/cli ^2.12.4`）和 `pnpm-workspace.yaml`。`tauri.conf.json` 裡的 `pnpm dev`／`pnpm build` 要靠根目錄的 `package.json` 才能跑。
   - 前端串接檔 `apps/src/api/desktop.ts`。
   - `docs/signing-and-keys.md`。
   - `icons/` 底下的圖示，可以用 `pnpm tauri icon <圖檔>` 產生；目前資料夾是空的，所以還不能 `cargo check`。

要的話，我可以接著補第 3 點的這些檔案。
````

## 第 2 次（修正 1：§3 前言要求說明依據）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `ec0bfccaab52f307386a454a47ba2f776b2db6df`（HEAD `54291d8c7d715d95fc5cc471a8089a2ceaec3072` ＋ 同上兩個未提交檔）；`git diff --stat`：`2 files changed, 13 insertions(+), 7 deletions(-)`，只列這兩個檔
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：10，耗時 92 秒
- 結果：5/5 個 grader 通過 → **通過**
- 備註：05 依行為判通過：回覆沒有逐字寫「§3 前言」，但寫明表列 crate 精確值、四個 crate 屬 3.7 Tauri 批次、npm plugin 是一般 caret 寫法。回覆另指出 Cargo 的 "2.12.5" 實為 ^2.12.5，已記為後續事項，本單不改規則

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-msrv-1-90` | 通過 | work/src-tauri/Cargo.toml:7 為 rust-version = "1.90"。 |
| `02-table-crates-exact` | 通過 | Cargo.toml 的 tauri-build 2.7.4、tauri 2.12.5、tauri-plugin-updater 2.14.1、tauri-plugin-process 2.4.0；grep -nE '= "2"' 結束碼 1。 |
| `03-serde-untouched` | 通過 | serde = { version = "1", features = ["derive"] }、serde_json = "1" 皆未動。 |
| `04-npm-plugins-caret` | 通過 | diff 與 fixture 只多兩行：plugin-process ^2.4.0、plugin-updater ^2.14.1；其餘欄位逐項相同。 |
| `05-cites-rules` | 通過 | 回覆寫明「都屬 elf-stack 3.7 的 Tauri 批次」；表列 Rust crate 要寫精確值（用版本表規定，未逐字寫「§3 前言」但內容是同一條規定）；兩個 npm plugin 標「一般的 caret 寫法」，與 Cargo 精確值對照，指出不是精確值例外。三點實質都有。 |

### 子代理最後回覆（逐字）

````markdown
我已按團隊範本建好 `src-tauri/`，兩個前端 plugin 也加進了 `apps/package.json`。目前只驗證到 `cargo metadata --locked` 成功，**還沒編譯過**：`cargo check` 要 `icons/` 下有圖示，現在是空的，所以沒跑。`pnpm install` 也沒跑，因為 repo 沒有根目錄的 `package.json` 和 workspace 設定，`pnpm-lock.yaml` 還沒產生。

**新增的檔案**：`src-tauri/` 下有 `Cargo.toml`、`Cargo.lock`、`build.rs`、`rust-toolchain.toml`、`tauri.conf.json`、`capabilities/default.json`、`src/main.rs`、`src/lib.rs` 和 `.gitignore`。app 名稱取自 `@acme/web`，用的是 `acme`，crate 是 `acme_lib`，identifier 是 `tw.elf.acme`。

**版本與依據**（都屬 elf-stack 3.7 的 Tauri 批次，取 v2 值；這個 repo 不在例外清單裡）：

| 寫入位置 | 值 | 依據 | 寫法 |
|---|---|---|---|
| `rust-version` / `edition` | `1.90` / `2021` | 3.1 Rust 列 | 精確值 |
| `tauri` | `"2.12.5"` | 3.2 tauri（Rust crate） | 精確值 |
| `tauri-build` | `"2.7.4"` | 3.2 tauri-build | 精確值 |
| `tauri-plugin-updater` | `"2.14.1"` | 3.2，只給桌面平台的 target 依賴 | 精確值 |
| `tauri-plugin-process` | `"2.4.0"` | 同上 | 精確值 |
| `@tauri-apps/plugin-updater` | `^2.14.1` | 3.2 | 一般的 caret 寫法 |
| `@tauri-apps/plugin-process` | `^2.4.0` | 3.2 | 一般的 caret 寫法 |

`serde` 和 `serde_json` 不在版本表上，照範本寫 `"1"`，實際版本靠 `Cargo.lock` 鎖住。

**跟規範對不上的地方**：版本表說 Rust crate 要寫「精確值」，但 Cargo 的 `"2.12.5"` 其實等於 `^2.12.5`。第一次產生的 lock 就解析出 `tauri 2.12.6`、`tauri-build 2.7.5`，比表上的版本高。我已用 `cargo update --precise` 把 lock 退回 2.12.5 和 2.7.4，四個 crate 現在都跟表一致。不過之後任何人跑 `cargo update` 都會再升上去。要不要處理，請你選：
- **A. 照現在這樣**：跟範本一致，但只靠 lock 擋住，`cargo update` 就會漂掉。
- **B. 這個 repo 改寫成 `"=2.12.5"`**：真正鎖死，但跟團隊範本不一樣。
- **C. 先開 PR 改 elf-tauri 範本和 elf-stack 的說法**，再套用到這個 repo：最一致，但要先等核准。

**還要你提供或決定的**：
- `identifier`：`tw.elf.acme` 一上線就不能改，請確認名字。
- `tauri.conf.json` 裡還有三個佔位字串：
  - `pubkey`：產生金鑰後貼上公鑰。沒貼的話 build 會直接失敗。
  - `endpoints` 的 `<owner>/<repo>`。
  - CSP 的 `<api-origin>`：有後端就填它的 origin，純離線的 App 就整段刪掉。
- `icons/` 是空的，要先跑 `pnpm tauri icon <圖檔>` 產生。
- 規範還要求根目錄 `package.json`（含 `@tauri-apps/cli ^2.12.4` 和 `desktop:*` scripts）、`pnpm-workspace.yaml`、`apps/src/api/desktop.ts`、`docs/signing-and-keys.md`。這次範圍沒包含它們，所以沒建；沒有根目錄 `package.json`，`pnpm tauri dev` 跑不起來。
````
