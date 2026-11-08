# new-src-tauri：RED v2 紀錄（不載入 elf-stack）

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：5/5 個 grader 通過 → **沒有失敗（維持案例）**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示；回覆引用 elf-stack 規則 6、4.1，並寫明版本改用 v2。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制「案例 2、3、4、B1、B2」那一行（`skills` 依 `case.yaml` 展開成路徑），其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-cargo-versions` | 通過 | `src-tauri/Cargo.toml:16,19` `tauri-build` `2.7.4`、`tauri` `2.12.5` |
| `02-package-json` | 通過 | `@tauri-apps/cli` `^2.12.4`、`engines.node` `>=24.22.2` |
| `03-toolchain-parses` | 通過 | 指令結束碼 0（Python 3.13.0） |
| `04-rustup-active-toolchain` | 通過 | 結束碼 0，輸出含 `overridden by` 與 `rust-toolchain.toml`（rustup 1.29.0） |
| `05-no-old-values` | 通過 | `grep -rnE 'version = "2"|"\^2"|24\.18'` 結束碼 1，零筆；`tauri-plugin-updater = "2"` 不是 `version = "2"`，也不在判準範圍 |

## 子代理最後回覆（逐字）

`````markdown
已寫入 5 個檔，TOML 與 JSON 都解析通過；`pnpm install`、`cargo build`、`tauri build` 都沒跑（目前沒有前端與 Rust 原始碼），所以沒有 `pnpm-lock.yaml` 和 `Cargo.lock`，第一次建置後要提交（elf-stack 規則 6）。

檔案：`src-tauri/Cargo.toml`、`package.json`、`rust-toolchain.toml`、`.nvmrc`、`pnpm-workspace.yaml`。

**與範本不符的地方**
- **版本改用 elf-stack v2：** elf-tauri 範本和第 3 節寫的是 `tauri = "2"`、`tauri-build = "2"`、`@tauri-apps/cli ^2`、`node >=24.18`、`pnpm@<PNPM_VERSION>`。這是新 repo，而 elf-stack 是版本的唯一來源，所以我改寫成 `2.12.5`、`2.7.4`、`^2.12.4`、`>=24.22.2`、`pnpm@12.16.1`。elf-tauri 這幾處已落後，應回報修正。
- **toolchain 檔不在 elf-tauri 內：** `rust-toolchain.toml` 是照 elf-stack 4.1 補的，elf-tauri 的目錄結構和範本表都沒列。

**需要處理的問題**
1. **MSRV 對不上：** elf-stack 規定 `rust-version = "1.77.2"`，但 crates.io 上 `tauri 2.12.5` 和 `tauri-build 2.7.4` 都宣告 `rust_version = 1.90`。我照表保留 1.77.2；toolchain 是 stable，只要 stable ≥ 1.90 應該還能編譯（未實跑），但這個 MSRV 宣告是不實的。elf-stack 的表應改成 1.90。
2. **plugin 版本不在表上：** `tauri-plugin-updater`、`tauri-plugin-process` 沒列在 elf-stack，我沿用範本的 `"2"`，沒有自行決定版本，應補進表內。

**先用暫代值，要換掉或補上**
- **App 名稱：** 需求沒給，先用 `myapp`／`MyApp`，換名時 `[package] name`、`[lib] name` 和根 `package.json` 的 `name` 都要改。
- **前端目錄：** 先用 `apps`，對應 `pnpm-workspace.yaml` 和 `--filter ./apps`，用路徑篩選所以不依賴前端套件名。
- **還沒建立的檔案：** `apps/`（`@tauri-apps/api` 要裝 `^2.12.4`）和 `scripts/version.mjs` 都還不存在，所以 `dev`、`build`、`version:*` 這些 script 現在跑不起來。

檔案都在 `E:/source/e46-scratch/desktop__elf-tauri-workspace/iteration-0-v2/new-src-tauri/old_skill/work/`。
`````

## 產出檔案（逐字）

`.nvmrc`

`````
24.22.2
`````

`package.json`

`````
{
  "name": "myapp",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "engines": {
    "node": ">=24.22.2"
  },
  "scripts": {
    "dev": "pnpm --filter ./apps dev",
    "build": "pnpm --filter ./apps build",
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
name = "myapp"
version = "0.0.1"
description = "MyApp — desktop application"
authors = ["MyApp"]
edition = "2021"
rust-version = "1.77.2"

# Required for the mobile targets: Tauri replaces main() with a generated entry
# point, so every bit of application logic has to be reachable from the lib.
[lib]
name = "myapp_lib"
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

## 指令實跑（逐字）

`````text
python --version: Python 3.13.0
rustup --version: rustup 1.29.0 (28d1352db 2026-03-05)
03 exit=0
stable-x86_64-pc-windows-msvc (overridden by 'E:\source\e46-scratch\desktop__elf-tauri-workspace\iteration-0-v2\new-src-tauri\old_skill\work\rust-toolchain.toml')
04 exit=0
`````
