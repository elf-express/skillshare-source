---
type: llm
focus: trace
weight: 1
---

`src-tauri/Cargo.toml` 的四個表列 crate 都是精確 `major.minor.patch`：`tauri` `2.12.5`、`tauri-build` `2.7.4`、`tauri-plugin-updater` `2.14.1`、`tauri-plugin-process` `2.4.0`；並且 `grep -nE '= "2"' src-tauri/Cargo.toml` 結束碼是 1（沒有任何 `= "2"`）
