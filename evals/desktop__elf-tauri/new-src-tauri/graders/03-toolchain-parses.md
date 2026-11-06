---
type: llm
focus: trace
weight: 1
---

指令：把 `rust-toolchain.toml` 當 TOML 解析，`toolchain.channel` 等於 `stable`，`toolchain.components` 含 `rustfmt` 與 `clippy`。結束碼為 0 才算通過。需要 Python >= 3.11；evidence 記下 `python --version`，並貼上結束碼與逐字輸出。

```bash
python -c "import sys,tomllib; t=tomllib.load(open(sys.argv[1],'rb'))['toolchain']; assert t['channel']=='stable' and {'rustfmt','clippy'} <= set(t['components'])" <rust-toolchain.toml 路徑>
```
