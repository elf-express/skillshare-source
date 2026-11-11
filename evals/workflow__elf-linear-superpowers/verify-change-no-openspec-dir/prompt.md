---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

`_openspec` 不是裝了嗎，直接用 openspec-verify-change 幫我驗 E-xx，Spec 在 `spec.md`。這個 repo 還沒有 openspec/，需要的話就 init 一下，結果寫到 `out/verification.md`。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: spec.md, src/export.ts, test-output.txt
