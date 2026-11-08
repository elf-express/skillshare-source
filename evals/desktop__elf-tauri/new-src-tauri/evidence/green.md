# new-src-tauri：GREEN 紀錄

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive c86619e609094e26817647d6c00eb8376d6709ae`（Task 7 的 commit）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：5/5 個 grader 通過 → **全部通過**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示，回覆寫明版本依 elf-stack。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制的那一行（案例 1、5 含 elf-stack；案例 2、3、4、B1、B2 不含），其餘逐字照 `prompt.md`，和 RED 同一個模型。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-cargo-versions` | 通過 | `src-tauri/Cargo.toml:16,19` `tauri-build` `2.7.4`、`tauri` `2.12.5` |
| `02-package-json` | 通過 | `@tauri-apps/cli` `^2.12.4`、`engines.node` `>=24.22.2` |
| `03-toolchain-parses` | 通過 | 指令結束碼 0（Python 3.13.0） |
| `04-rustup-active-toolchain` | 通過 | 在 `src-tauri/` 跑，結束碼 0，輸出含 `overridden by` 與 `rust-toolchain.toml`（rustup 1.29.0） |
| `05-no-old-values` | 通過 | `grep` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
已寫入 5 個檔案，只驗了 `package.json` 能解析、`Cargo.toml` 與 `rust-toolchain.toml` 和範本一字不差，沒跑 install 或 build；版本依 elf-stack：`tauri` 2.12.5、`tauri-build` 2.7.4、`@tauri-apps/cli` ^2.12.4、`pnpm@12.16.1`、Node 24.22.2、Rust stable（MSRV 1.77.2）。

專案名未提供，`<appname>`、`<AppName>`、`<web>`、`<web-dir>` 和描述 `<one line>` 仍是佔位字串，換掉前無法 install 或 build。

與範本或版本表的差異：
- **根 `package.json`：** 合併 elf-tauri 與 elf-stack 的片段；elf-cicd-versioning 規定它是版號唯一來源，所以補了 `name` 和與 `Cargo.toml` 相同的 `version` 0.0.1。
- **`pnpm-workspace.yaml`：** 範本片段只有 `engineStrict`，我另加了 `packages` 指向 `<web-dir>`。
- **版本表未列：** `tauri-plugin-updater`、`tauri-plugin-process` 照範本寫 `"2"`，前端的 `@tauri-apps/plugin-*` 版號也不在表內。

還沒做：
- `Cargo.lock` 要第一次 build 後才有，產生後要提交。
- 前端 `package.json` 和 `scripts/version.mjs` 不在這次要求內，所以 `version:*` 腳本還跑不起來。前端的 `@tauri-apps/api` 用 ^2.12.4。

檔案在 `E:/source/e46-scratch/desktop__elf-tauri-workspace/iteration-1/new-src-tauri/with_skill/work/`：
- `package.json`
- `.nvmrc`
- `pnpm-workspace.yaml`
- `src-tauri/Cargo.toml`
- `src-tauri/rust-toolchain.toml`
`````

## 產出檔案（逐字）

`.nvmrc`

`````
24.22.2
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
  - "<web-dir>"

# Refuse to install on an unsupported Node instead of warning.
engineStrict: true
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

`src-tauri/rust-toolchain.toml`

`````
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
`````

## 指令實跑（逐字）

`````text
python --version: Python 3.13.0
rustup --version: rustup 1.29.0 (28d1352db 2026-03-05)
03 exit=0
stable-x86_64-pc-windows-msvc (overridden by 'E:\source\e46-scratch\desktop__elf-tauri-workspace\iteration-1\new-src-tauri\with_skill\work\src-tauri\rust-toolchain.toml')
04 exit=0
`````
