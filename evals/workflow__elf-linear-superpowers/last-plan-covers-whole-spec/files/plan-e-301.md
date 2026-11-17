# [Plan] 每月營收報表：合計與時區欄位（E-301）

**目標：** 完成 Spec 範圍第 1、2 項。

## Task 1：依分店合計

- [x] 步驟 1.1：寫測試 `sums last month revenue per branch`
- [x] 步驟 1.2：確認失敗
- [x] 步驟 1.3：實作 `buildMonthlyReport(month): ReportRow[]`
- [x] 步驟 1.4：確認通過
- [x] 步驟 1.5：commit

## Task 2：時區欄位

- [x] 步驟 2.1：寫測試 `includes branch timezone in each row`
- [x] 步驟 2.2：確認失敗
- [x] 步驟 2.3：在 `ReportRow` 加 `timezone: string`
- [x] 步驟 2.4：確認通過
- [x] 步驟 2.5：commit
