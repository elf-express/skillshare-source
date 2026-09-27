# 設計規格 SPEC：<產品 / 功能名稱>

- 狀態：<草稿 / 待確認 / 已確認>（「已確認」後才開始實作）
- 來源：`docs/design/chats/<file>.md`、`docs/design/prototype/<Primary>.html`<、Figma node-id>
- 撰寫：<name / agent>　日期：<YYYY-MM-DD>

## 1. 畫面清單

| # | 畫面 | 路由 | 原型位置（行號 / node-id） | 對話依據（最後確認的行號） |
| --- | --- | --- | --- | --- |
| 1 | Practice | `/practice` | `TypingTrainer.dc.html` L68–162 | `chat1.md` L982 |

## 2. 元素 → ant-design-vue 對照（每個畫面一張）

### 2.x <畫面名稱>

| 元素 | 原型寫法（摘要） | ant-design-vue | 主要屬性 / slot | token | 備註 |
| --- | --- | --- | --- | --- | --- |
| 分類選擇 | 手刻分段，`#f0ebe2` 軌道 | `a-segmented` | `v-model:value`、`:options` | `--seg-bg` | |
| 開始按鈕 | DS Button default 96px | `a-button` | `min-width: 96px` | — | 文字依狀態：開始 / 重新開始 |

## 3. 自訂元件

| 元件 | 為何不用 antd | 外觀規格 | a11y 契約（role / 鍵盤 / aria） | 測試 |
| --- | --- | --- | --- | --- |
| TypingArea | 領域專屬 | 等寬字、行高 1.8、字級 clamp(18px,2.6vh,24px) | 隱藏 IME 欄位 `aria-label`；focus 持有者 | e2e：點工具列後 focus 回到 IME 欄位 |

## 4. Token 對照

依 `templates/token-mapping.md` 填寫；新 token 需求列在第 8 節。

## 5. 狀態表（每個畫面 × 每個互動元素）

| 畫面 / 元素 | default | hover | active / 按下 | focus | disabled | selected | loading | empty | error | 其他 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Library / 表格 | — | 列底 `colorBgTextHover` | — | 列 focus 外框 | — | — | `AsyncBlock` 首次 spin | 「尚無題庫」+ 新增文本 | 載入失敗 + 重試 | 重新載入不清空 |
| Library / 拖放區 | 虛線框 | — | — | 外框 | — | — | 解析中 | — | 格式 / 大小錯誤訊息 | 拖入：主色框 + 主色淡底 |
| 門檻樣式 | 正確率 ≥97 success / ≥92 warning / 其餘 error | | | | | | | | | |

## 6. 響應式與版面數字

| 規則 | 值 | 來源 |
| --- | --- | --- |
| 殼層 | 頂列 48 / 內容 flex / 狀態列 48，100vh 不捲動 | chat L187 |
| 內容 max-width | 1000 | chat L1173 |
| 雙欄 → 單欄 | 內容區 < 620 | `elf-ui-pattern` 規則 41 |
| <元件高度公式> | <clamp(120, 可用高 − 文字區下限, 340)> | 原型邏輯 `kbPx` |

## 7. 文案與長度

| key | en | zh-TW | 容器寬 | 處理（min-width / 換行 / 省略 + tooltip） |
| --- | --- | --- | --- | --- |
| `library.importDict` | Import dictionary | 匯入字典 | 96px 按鈕 | 改 `min-width: 96px` |

## 8. 待確認

| # | 問題 | 選項 | 建議 | 使用者回覆 |
| --- | --- | --- | --- | --- |
| 1 | 對話 L716 與 L838 對單字練習方向不同，以何者為準？ | A / B | 最後確認（L982：中英各打一次） | |
| 2 | 分類色 6 色需要新 token 嗎？ | 擴表 / 集中色票模組 | 依 `elf-ui-pattern` 規則 31 擴表 | |
