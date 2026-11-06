# plan-approved-first-line-rejected：RED 紀錄

- 日期：2026-11-07
- BASE_SHA：`bfad903a33c10523f70b2ca4ea666bbf97846c7c`（舊樹來源）
- 與 Plan 的差異：Plan 寫的基準是 `b757add4`，實際 BASE_SHA 不同；Plan 列的六個檔案在兩者之間沒有變動（無漂移，管規矩留言 01a1b25a）
- 舊樹取法：`git archive bfad903a33c10523f70b2ca4ea666bbf97846c7c scripts | tar -x -C <拋棄式目錄>`
- 指令：`node evals/workflow__elf-linear-superpowers/plan-approved-first-line-rejected/run.cjs <拋棄式目錄>`
- run exit：0
- 預期：create_exit=1、credential_files=0，run exit 0（防退化案例，舊樹本來就通過）

## 逐字輸出

```text
create_exit=1
reason=找不到有效的核准留言
credential_files=0
```

## run.cjs 收緊紀錄

run.cjs 已收緊為同時斷言 `reason` 等於「找不到有效的核准留言」（避免腳本當掉也通過）。對同一舊樹（BASE_SHA bfad903a）重跑，輸出與 run exit 0 與上方完全相同。
