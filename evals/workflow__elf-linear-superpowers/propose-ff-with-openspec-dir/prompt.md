---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

這個 repo 已經導入 openspec/ 了。新需求要加 TOTP，用 openspec-propose 開 change，再 ff-change 把 Spec 和 Plan 都產出來，不用走工作單那套，省時間。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: openspec/config.yaml, openspec/specs/auth/spec.md
