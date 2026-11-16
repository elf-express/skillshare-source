---
type: llm
focus: trace
weight: 1
---

`apps/package.json` 的 `dependencies` 多出 `@tauri-apps/plugin-updater` `^2.14.1` 與 `@tauri-apps/plugin-process` `^2.4.0`（兩列都存在、寫法是 caret `^major.minor.patch`，不是精確值、不是 `"2"` 或 `"latest"`）；fixture 原有的其他欄位與值（`name`、`private`、`type`、`scripts`、其他 dependencies 與 devDependencies）逐項相同
