# [Plan] 每日摘要通知（E-512）

**目標：** 完成 Spec E-511 的每日摘要通知：每天 08:00 彙整前一天的通知寄給開著 Email 的客戶。
**Spec：** E-511

## 全域限制

- 本單無資料庫變更。
- 本單無 .ps1。
- 不在計畫範圍內的檔案不修改，不刪測試、不放寬斷言、不降低 coverage 門檻。
- 發版由發版審計員執行（規則 39）。

## 檔案結構

| 動作 | 路徑 |
|---|---|
| 新增 | `src/notifications/digest.ts` |
| 新增 | `src/notifications/digest.test.ts` |

## Task 1：彙整前一天的通知

- [ ] 步驟 1.1：寫測試 `collects yesterday notifications for opted-in customers`
- [ ] 步驟 1.2：確認失敗
- [ ] 步驟 1.3：在 `src/notifications/digest.ts` 實作 `buildDigest(customerId: string, day: Date): Promise<Digest | null>`
- [ ] 步驟 1.4：確認通過
- [ ] 步驟 1.5：commit

## 完成檢查

- [ ] 步驟 5-1 審查完成
- [ ] 步驟 6 驗證留言
