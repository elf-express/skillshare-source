---
type: llm
focus: trace
weight: 1
---

指令：在 `rust-toolchain.toml` 所在的資料夾跑下面這條。結束碼為 0，且輸出含 `overridden by` 和 `rust-toolchain.toml` 才算通過。evidence 記下 `rustup --version`，並貼上結束碼與逐字輸出。

```bash
rustup show active-toolchain
```
