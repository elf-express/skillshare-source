# new-src-tauri：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：5/5 個 grader 通過 → **沒有失敗（維持案例）**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-cargo-versions` | 通過 | `tauri` `2.12.5`、`tauri-build` `2.7.4` |
| `02-package-json` | 通過 | `@tauri-apps/cli` `^2.12.4`、`engines.node` `>=24.22.2` |
| `03-toolchain-parses` | 通過 | 指令結束碼 0（Python 3.13.0） |
| `04-rustup-active-toolchain` | 通過 | 結束碼 0，輸出 `stable-x86_64-pc-windows-msvc (overridden by '…ust-toolchain.toml')`（rustup 1.29.0） |
| `05-no-old-values` | 通過 | `grep` 零筆；`tauri-plugin-updater = "2"` 不是 `version = "2"`，也不在判準範圍 |

## 子代理最後回覆（逐字）

`````markdown
已寫好 `src-tauri/Cargo.toml`、根 `package.json`、`apps/package.json`、`.nvmrc`、`pnpm-workspace.yaml`、`rust-toolchain.toml`；只驗過 JSON／TOML 語法，沒跑過 install、build。

**版本照 elf-stack v2，不照 elf-tauri 範本（兩者衝突，以 elf-stack 為準，範本該修）**

| 項目 | elf-tauri 範本 | 實際寫入 |
|---|---|---|
| `tauri` | `"2"` | `2.12.5` |
| `tauri-build` | `"2"` | `2.7.4` |
| `@tauri-apps/cli` | `^2` | `^2.12.4` |
| `engines.node` | `>=24.18` | `>=24.22.2`（`.nvmrc` 為 `24.22.2`） |
| `packageManager` | `pnpm@<PNPM_VERSION>` | `pnpm@12.16.1` |

`@tauri-apps/api` 寫 `^2.12.4`，放在 `apps/package.json`。elf-cicd-desktop、elf-cicd-frontend 也還寫著 Node 24.18，新 repo 接 CI 時同樣以 elf-stack 為準。

**要你處理的事**

1. 名稱：你沒給 App 名稱，`<appname>`、`<AppName>`、`<web>` 和描述都留著佔位，換掉才能用。我沒有自己取，因為 `identifier`（`tw.elf.<appname>`）上線後不能改。`<web-dir>` 我用了團隊慣例的 `apps`，不同的話要改 `pnpm-workspace.yaml`。
2. elf-stack 沒列的版本：`tauri-plugin-updater`、`tauri-plugin-process`（`"2"`）和 `serde`（`"1"`）、`serde_json`（`"1"`）沿用範本值，屬「待加入 elf-stack」。前端的 `@tauri-apps/plugin-updater`、`@tauri-apps/plugin-process` 範本沒有版本、表上也沒有，我沒有寫進 `apps/package.json`，要先決定版本再加。
3. Lockfile：換好名稱後要產生並提交 `pnpm-lock.yaml`、`src-tauri/Cargo.lock`（elf-stack 規則 6）。

**這次沒做**：`build.rs`、`main.rs`、`lib.rs`、`tauri.conf.json`、capabilities、`scripts/version.mjs`（`version:*` 指令會用到）和前端本體都不在這次要求內，所以還不能 build。`apps/package.json` 目前只有桌面橋接需要的依賴，也沒有 `dev`／`build` script，根目錄的 `pnpm dev`、`pnpm build` 要等前端補上才能跑。
`````

## 產出檔案（逐字）

`.nvmrc`

`````
24.22.2
`````

`apps/package.json`

`````
{
  "name": "<web>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {
    "@tauri-apps/api": "^2.12.4"
  }
}
`````

`package.json`

`````
{
  "name": "<appname>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "engines": {
    "node": ">=24.22.2"
  },
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
  "devDependencies": {
    "@tauri-apps/cli": "^2.12.4"
  }
}
`````

`pnpm-workspace.yaml`

`````
packages:
  - apps

# Refuse to install on an unsupported Node instead of warning.
engineStrict: true
`````

`rust-toolchain.toml`

`````
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
`````

`src-tauri/Cargo.toml`

`````
[package]
name = "<appname>"
version = "0.0.1"
description = "<AppName> — <one line>"
authors = ["<AppName>"]
edition = "2021"
rust-version = "1.77.2"

# Required for the mobile targets: Tauri replaces main() with a generated entry
# point, so every bit of application logic has to be reachable from the lib.
[lib]
name = "<appname>_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.7.4", features = [] }

[dependencies]
tauri = { version = "2.12.5", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Desktop only: an update on iOS/Android goes through the app store, and the
# updater plugin does not build for those targets.
[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-updater = "2"
# Supplies `relaunch`, which the installer needs after a successful update.
tauri-plugin-process = "2"

[features]
# Used by `tauri dev`/`tauri build` to strip the devtools from release bundles.
default = []
`````

## grader 03、04 指令實跑

```text
python --version: Python 3.13.0
rustup --version: rustup 1.29.0 (28d1352db 2026-03-05)
03 exit=0
stable-x86_64-pc-windows-msvc (overridden by 'E:\source\e46-scratch\desktop__elf-tauri-workspace\iteration-0
ew-src-tauri\old_skill\workust-toolchain.toml')
04 exit=0
```
