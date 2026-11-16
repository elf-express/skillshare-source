# cargo-msrv-and-plugin-versions：RED 紀錄

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：`git archive 86651e5b2530bdc516d995e99246da832205c1f3` 取出的樹（BASE＝舊 skill）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：10，耗時 108 秒
- 結果：1/5 個 grader 通過 → **失敗（RED 成立）**
- 作廢輪次：本案例前兩輪執行作廢、未評分。第 1 輪 runner 以 cp950 輸出提示本文，代理收到亂碼；第 2 輪 runner 的工具清單多了 MCP 工具，與 `prompt.md` 的 `allowed_tools` 不符（Multica E-159 教訓）。本紀錄是修正 runner 後的第 3 輪。

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-msrv-1-90` | 未通過 | work/src-tauri/Cargo.toml:7 rust-version = "1.77.2" |
| `02-table-crates-exact` | 未通過 | tauri 2.12.5、tauri-build 2.7.4 正確；但 Cargo.toml:26 tauri-plugin-updater = "2"、:28 tauri-plugin-process = "2"；grep -nE '= "2"' 結束碼 0 |
| `03-serde-untouched` | 通過 | Cargo.toml:17 serde = { version = "1", features = ["derive"] }、:18 serde_json = "1" |
| `04-npm-plugins-caret` | 未通過 | diff 僅多兩列，其餘不變，但值為 "^2"、"^2"，不是 ^2.14.1、^2.4.0 |
| `05-cites-rules` | 未通過 | 回覆只說「elf-stack 沒列、待加入 3.2 的 Tauri 批次」，沒引用 §3 前言 Cargo 精確值規定，沒指 §3.7，沒說 npm 用 caret 預設屬非例外 |

### 要重現的舊行為

| 行為 | grader 組 | 重現 | 依據 |
| --- | --- | --- | --- |
| P3a MSRV 1.77.2 | 01 | 重現 | Cargo.toml 沿用 1.77.2 |
| P3b 表列 crate 沿用 "2"、§3 前言沒有 Cargo 規定 | 02, 05 | 重現 | 兩 plugin 為 "2"；回覆未引 §3 前言 Cargo 規定 |
| P3c npm plugin 無表可查、由代理自挑 | 04, 05 | 重現 | 代理自選 ^2，回覆稱 elf-stack 沒列兩 plugin |

### 子代理最後回覆（逐字）

````markdown
`src-tauri/` 已照團隊範本建好，兩個 plugin 也加進了 `apps/package.json`。不過還沒編譯過，有兩個版本問題要你決定。

**做了什麼**
- `src-tauri/` 裡有 `Cargo.toml`、`build.rs`、`rust-toolchain.toml`、`tauri.conf.json`、`capabilities/default.json`、`src/main.rs`、`src/lib.rs`，內容照範本，占位符換成 `acme`。
- 產生了 `Cargo.lock`。`"2.12.5"` 在 Cargo 裡會自動解析到較新的 2.12.6，我用 `cargo update --precise` 把 `tauri` 固定在 2.12.5、`tauri-build` 固定在 2.7.4，跟版本表一致。
- `apps/package.json` 加了 `@tauri-apps/plugin-updater` 和 `@tauri-apps/plugin-process`，版本寫 `^2`。

**要你決定的事**

1. **`rust-version` 跟實際不符。** 範本和 elf-stack 都寫 `1.77.2`，但我查了 crates.io：`tauri` 2.12.5、`tauri-build` 2.7.4 和兩個 plugin 的 2.x 版，最低都要 Rust 1.90。也就是說 1.77.2 根本編不過，這個欄位是錯的。我目前照範本保留 1.77.2。
   - 選項 A：維持 1.77.2。符合範本，但宣告的最低版本不正確。
   - 選項 B（建議）：先送 PR 把 elf-stack 和 elf-tauri 範本改成 `1.90`，這裡再跟著改。要多一張 skill PR。

2. **兩個 plugin 的版本 elf-stack 沒列。** 版本表沒有的東西不該由我決定版本，所以我只寫最寬的寫法：Rust 端沿用範本的 `"2"`，npm 端用 `^2`。Rust 端目前解析到 updater 2.14.1、process 2.4.0；npm 端還沒跑 `pnpm install`。另外 registry 上已經有 3.0.0-alpha，現在的寫法不會裝到它。
   - 建議：把這兩個 plugin 加進 elf-stack 3.2 的 Tauri 批次，Rust 和 npm 兩邊寫同一個版本，再回來改成固定版號。不補的話，這個 PR 要註明「待加入 elf-stack」。

3. **App 名稱 `acme` 是我從 `@acme/web` 推的。** 所以 `identifier` 是 `tw.elf.acme`，正式發版後就不能再改。名稱不對請告訴我。

**還沒填、還沒做**
- `tauri.conf.json` 還有三個占位：CSP 的 `<api-origin>`、updater 的 `pubkey`、`<owner>/<repo>`。
- 沒有 `icons/`，所以還不能編譯，`cargo build` 沒跑過。
- 你這次沒要求的範本其餘部分也還沒做：根目錄 `package.json`、`pnpm-workspace.yaml`、`.nvmrc`、`apps/src/api/desktop.ts`、`docs/signing-and-keys.md`、`pnpm-lock.yaml`。要的話跟我說。
````
