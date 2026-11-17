# [Plan] 客戶通知中心：通知列表與已讀（E-201）

**目標：** 完成 Spec 範圍第 1、2 項（通知列表、點開標為已讀）。

## 檔案結構

| 動作 | 路徑 |
|---|---|
| 新增 | `src/notifications/NotificationList.vue` |
| 新增 | `src/notifications/useNotifications.ts` |
| 新增 | `src/notifications/useNotifications.test.ts` |

## Task 1：通知列表

- [x] 步驟 1.1：寫測試 `lists latest 50 notifications with unread marks`
- [x] 步驟 1.2：確認失敗
- [x] 步驟 1.3：實作 `useNotifications().list(limit = 50)`
- [x] 步驟 1.4：確認通過
- [x] 步驟 1.5：commit

## Task 2：點開標為已讀

- [x] 步驟 2.1：寫測試 `marks a notification as read when opened`
- [x] 步驟 2.2：確認失敗
- [x] 步驟 2.3：實作 `useNotifications().open(id)`
- [x] 步驟 2.4：確認通過
- [x] 步驟 2.5：commit

E-202 負責 Spec 範圍第 3、4 項（Email 開關、每日摘要信），從本 Plan 的完成點開分支。
