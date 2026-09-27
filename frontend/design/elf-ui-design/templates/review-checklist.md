# 設計審查與驗收清單

## 1. 設計審查（每輪原型迭代後）

- [ ] 掛載 Ant Design 設計系統；使用 DS 元件（Button、Tag、Badge、Pagination、Icon…）
- [ ] 品牌 / 語意色在 `:root` 一處定義，畫面引用變數（無散落 hex）
- [ ] 間距 4 的倍數；控制項高 24 / 32 / 40；圓角 2 / 4 / 6 / 8；刻度外值已標註
- [ ] DS 缺的元件（Table、Card、Upload、Slider、Tree、Avatar、Form）已註明「手刻：對應 antd X」
- [ ] 每個畫面有載入 / 空 / 錯誤的設計或註明
- [ ] 危險操作有確認步驟
- [ ] 文案：sentence case（en）、台灣用語 + 全形標點（zh-TW）、無 emoji / 驚嘆號 / 字元圖示
- [ ] 固定寬元素用最長語系字串檢查過
- [ ] 簡報中的最小視窗下所有內容可見

## 2. 交接完整性（放進 repo 前）

- [ ] `docs/design/` 結構符合 `elf-ui-design` 規則 9
- [ ] `HANDOFF.md` 路徑與實際目錄一致（路徑對照表已填）
- [ ] 主要原型 import 的檔案全部存在
- [ ] `_ds/*/readme.md` 引用的檔案全部存在，缺漏已列入 SPEC.md 待確認
- [ ] `chats/` 為完整對話（未摘要、未刪減）
- [ ] `uploads/` 每張圖都能在對話中找到出處
- [ ] HANDOFF.md「Out of scope」列出所有未獲同意的提議
- [ ] SPEC.md 狀態為「已確認」

## 3. 實作驗收

### 3.1 環境矩陣

| 視窗 | en 展開 | en 收合 | zh-TW 展開 | zh-TW 收合 |
| --- | --- | --- | --- | --- |
| 1440×900 | [ ] | [ ] | [ ] | [ ] |
| 1280×800 | [ ] | [ ] | [ ] | [ ] |
| 900×640 | [ ] | [ ] | [ ] | [ ] |
| 360×540 | [ ] | [ ] | [ ] | [ ] |

### 3.2 每個畫面

- [ ] SPEC.md 元素對照全部落實（無手刻取代 antd、無 `.ant-*` 內部 class 覆寫）
- [ ] 狀態表每格都能重現（含人為製造 loading / empty / error）
- [ ] 顏色 / 陰影 / 字型只來自 token（DevTools 或 `getComputedStyle` 抽查）
- [ ] 版面數字（高度、寬度、門檻）與 SPEC.md 第 6 節一致
- [ ] 鍵盤可走完整頁；focus 外框可見；Esc 關閉對話框且 focus 還原
- [ ] antd 內建文字（Modal 按鈕、Pagination、Empty）隨語系切換
- [ ] 無文字被截斷（或截斷處有 tooltip）
- [ ] 同環境 Playwright 截圖基準已更新（若專案啟用）

### 3.3 差異表

| # | 畫面 / 位置 | 預期（SPEC / 原型行號） | 實際 | 嚴重度（高 / 中 / 低） | 證據（截圖 / 計算值） | 處理 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Library / 匯入字典按鈕 | 文字完整（SPEC §7） | en 被截為 `Import dicti…` | 高 | 1280×800 en 截圖 | 改 `min-width` |

嚴重度定義見 `references/workflow.md` §8。「高」全部處理完才可結案；**MUST NOT** 以「大致一致」結案。
