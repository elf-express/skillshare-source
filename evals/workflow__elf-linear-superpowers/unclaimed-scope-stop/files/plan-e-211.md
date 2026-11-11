# [Plan] 會員資料匯出：匯出按鈕、欄位與權限（E-211）

**目標：** 完成 Spec 範圍第 1、2、3 項。

## 檔案結構

| 動作 | 路徑 |
|---|---|
| 新增 | `src/members/exportMembers.ts` |
| 修改 | `src/members/MemberList.vue` |
| 新增 | `src/members/exportMembers.test.ts` |

## Task 1：匯出 CSV 與欄位

- [x] 步驟 1.1：寫測試 `exports one row per member` 與 `exports only id, name, joinedAt`
- [x] 步驟 1.2：確認失敗
- [x] 步驟 1.3：實作 `exportMembers(filter): Promise<Blob>`
- [x] 步驟 1.4：確認通過
- [x] 步驟 1.5：commit

## Task 2：只有管理員看得到按鈕

- [x] 步驟 2.1：寫測試 `hides export button for non-admin roles`
- [x] 步驟 2.2：確認失敗
- [x] 步驟 2.3：在 `MemberList.vue` 依角色顯示按鈕
- [x] 步驟 2.4：確認通過
- [x] 步驟 2.5：commit
