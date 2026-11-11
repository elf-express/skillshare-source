# [Plan] 每月營收報表：CSV 下載與排程（E-302）

**目標：** 完成 Spec 範圍第 3、4 項。分支從 E-301 的完成點開。

## Task 1：下載 CSV

- [x] 步驟 1.1：寫測試 `downloads report as revenue-YYYY-MM.csv`
- [x] 步驟 1.2：確認失敗
- [x] 步驟 1.3：實作 `reportToCsv(rows): string` 與下載按鈕
- [x] 步驟 1.4：確認通過
- [x] 步驟 1.5：commit

## Task 2：每月排程

- [x] 步驟 2.1：寫測試 `schedules report generation at 06:00 on day 1`
- [x] 步驟 2.2：確認失敗
- [x] 步驟 2.3：註冊排程 `0 6 1 * *`
- [x] 步驟 2.4：確認通過
- [x] 步驟 2.5：commit
