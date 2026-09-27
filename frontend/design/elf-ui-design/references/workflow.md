# UI 設計流程細節

對應 SKILL.md 第 1 節流程圖。每階段列出：輸入、步驟、產出、完成條件。

目錄：
1. [簡報 brief](#1-簡報-brief)
2. [工具選擇](#2-工具選擇)
3. [原型 prototype](#3-原型-prototype)
4. [審查與迭代](#4-審查與迭代)
5. [交接包與 SPEC.md](#5-交接包與-specmd)
6. [Figma 交接與 MCP 讀取](#6-figma-交接與-mcp-讀取)
7. [實作](#7-實作)
8. [視覺驗收與截圖時機](#8-視覺驗收與截圖時機)

---

## 1. 簡報 brief

- 輸入：需求文件（參考專案：`chat1.md` 第 9–77 行，功能模組 + 前後端架構 + 「Ant desigin 設計出打字練習 UI，只需要 web，最終用 Tauri 包成桌面端」）。
- 步驟：以 [`templates/design-brief.md`](../templates/design-brief.md) 補齊需求文件沒寫的設計決策：
  - 平台與目標視窗（桌面 Tauri → 最小視窗；網頁 → 手機寬度是否支援）
  - 語言基準（參考專案最後決定 `en`，但一開始沒寫，導致整份原型事後翻譯，並衍生多輪截字修正）
  - 深色模式（參考專案 AI 在第 119 行提議、從未執行 → 若需要，一開始寫進簡報）
  - 每個畫面的資料狀態（載入 / 空 / 錯誤 / 離線）
  - 版面約束（參考專案在第 165 行才提出「練習輸入要剛好一個螢幕放得下」，之後十多輪「Found issues」修正都在處理高度）
- 產出：`docs/design/brief.md`（或直接貼在設計對話第一則訊息）。
- 完成條件：簡報的「待確認」欄為空。

探索視覺方向時可呼叫 `frontend/design/ui-ux-pro-max`（配色、字型搭配）；選定後**只把結果寫成 token 值**，不要把該 skill 的元件建議帶進產品。

## 2. 工具選擇

| 工具 | 狀態 | 用途 | 交接格式 |
| --- | --- | --- | --- |
| claude.ai/design（Claude Design） | 參考專案已使用 | AI 產生 HTML/CSS/JS 原型，可掛載設計系統 | 匯出 bundle：`README.md`（→ 改名 `HANDOFF.md`）、`chats/`、`project/`（→ `prototype/`） |
| Figma | 團隊使用；Ant Design 5.9.4 Community 檔為設計系統來源 | 設計系統來源、需要精修的畫面 | Figma URL + node-id（§6） |
| 「Open Design」 | **待確認**（產品未確認） | — | — |
| Pencil（pen.dev） | **待確認**（環境有 `pencil` MCP） | `.pen` 設計檔 | 只能透過 MCP 讀取；`.pen` 為加密檔，**MUST NOT** 用檔案讀取工具開啟 |

選擇規則：
1. 新產品 / 大改版：Claude Design 做可互動原型（能驗證打字引擎、倒數、IME 這類行為）。
2. 單一畫面精修、行銷素材、需要設計師手動調整：Figma。
3. 不論工具，設計系統一律 Ant Design，交接一律落到 `docs/design/` + SPEC.md。

## 3. 原型 prototype

1. 掛載設計系統：Claude Design 專案中加入 Ant Design 設計系統（參考：`prototype/_ds/ant-design-system-*/`，由 Figma 檔匯入，含 350 個 Figma variables、123 個元件集、787 個圖示）。
2. **第一則設計指令先定 token**：品牌色、語意色、背景、文字色、線條色，要求 AI 以 CSS 變數定義在 `<style>` 的 `:root`，畫面只引用變數。參考原型只把 6 個 antd 色覆寫成變數（`--color-primary-colorprimary` 等），其餘 30 種顏色寫死在 inline style。
3. 要求 AI 使用 DS 元件（`AntDesignSystem_*.Button / TagColorful / BadgeStatus / Pagination / Icon`）。DS 沒有的元件（Table、Card、Upload、Slider、Tree…，見 DS readme Caveats）允許手刻，但要求 AI 在畫面上以註解標出「手刻：對應 antd X」。
4. 刻度：間距 4 的倍數、控制項高 24/32/40、圓角 2/4/6/8；陰影只用 DS 三層懸浮陰影與卡片淡陰影。
5. 文案：依簡報的語言基準；遵守 [`content.md`](content.md)。

## 4. 審查與迭代

- 每輪回饋寫在同一個設計對話；貼截圖時用紅框標示問題（參考 `uploads/pasted-1789808434065-0.png`：紅框標出貼文區未撐滿）。
- 「Found issues — fixing…」是設計工具的自動驗證回合（`chat1.md` 多處），不是使用者需求；判斷意圖時略過。
- 同一主題多次改向時，**最後一次使用者確認**為準。參考專案「單字練習」的演變：
  中英對照句子（第 598 行）→ 字典驅動、打英文（第 614 行）→ 純單字（第 676 行）→ 中文上、英文遮碼（第 716 行）→ 打中文、英文不遮碼（第 838 行）→ 中英各打一次（第 982 行）。
- 設計師 / 使用者要求「對照 ant 規範」時（第 854 行），以 DS 原始碼或 antd 官方規格為準，不以肉眼判斷。
- 每輪結束確認：新增或改變的元素是否都還在刻度與 token 內。

## 5. 交接包與 SPEC.md

1. 匯出 bundle → 放進 `docs/design/`，依 SKILL.md 規則 9 的結構改名；用 [`templates/HANDOFF.template.md`](../templates/HANDOFF.template.md) 覆寫或補充 `HANDOFF.md`（保留原文的讀取指示，修正路徑）。
2. 完整性檢查（[`templates/review-checklist.md`](../templates/review-checklist.md) §2）：主要原型 import 的檔案都在、`_ds/readme.md` 引用檔案都在、uploads 都有出處。
3. 由實作者（或 AI）讀完 chats + 原型後寫 SPEC.md（[`templates/spec.template.md`](../templates/spec.template.md)），逐畫面填：
   - 元素 → ant-design-vue 對照（[`component-mapping.md`](component-mapping.md)）
   - token 對照（[`tokens.md`](tokens.md)、[`templates/token-mapping.md`](../templates/token-mapping.md)）
   - 狀態表（loading / empty / error / hover / focus / disabled / 選中 / 拖入…）
   - 響應式數字、固定寬元素的兩語系長度
   - 待確認問題
4. 使用者回覆所有待確認後，SPEC.md 狀態改為「已確認」，才進入實作。

## 6. Figma 交接與 MCP 讀取

交接內容（寫在 `docs/design/figma.md`）：
- 檔案 URL；每個畫面 × 每個狀態一個 frame，列出 `node-id`（URL 參數 `?node-id=12-345`）
- 使用的 variables collection 名稱（Ant Design 5.9.4 檔共 8 個 collection）與品牌覆寫的 mode
- 與 SPEC.md 相同的元素 → antd 對照與待確認

AI 讀取順序（環境中 Figma MCP 工具：`get_metadata`、`get_design_context`、`get_variable_defs`、`get_screenshot`、`get_code_connect_map`）：

| 步驟 | 工具 | 目的 | 注意 |
| --- | --- | --- | --- |
| 1 | `get_metadata` | 取得頁面 / 大 frame 的子節點清單與 node-id | 大 frame 直接取 context 會過大，先拆 |
| 2 | `get_design_context`（逐個 frame） | 取得版面、尺寸、文字、使用的元件 | 產出的程式碼是**參考**（常為 React / Tailwind），**MUST** 轉成 Vue + ant-design-vue，**MUST NOT** 直接貼上 |
| 3 | `get_variable_defs` | 取得 frame 用到的 variables 與值 | 逐一填入 token 對照表；對不到團隊 token 的值 → 待確認 |
| 4 | `get_screenshot` | 視覺參考（Figma 沒有可讀的 CSS 原始碼時） | 只當參考；數值以 2、3 為準 |
| 5 | `get_code_connect_map` | 若 Figma 元件已對應程式元件，直接取得對應 | 團隊是否建立 Code Connect **待確認** |

- 工具參數與回傳格式以當下 MCP schema 為準；需要寫入 Figma（`use_figma`）時先載入 `figma:figma-use` skill。
- 通用的 Figma 轉程式流程可參考 `figma:figma-design-to-code` skill，但元件選擇、token、狀態仍以本 skill 與 `elf-ui-pattern` 為準。

## 7. 實作

1. 依 SPEC.md 建立 / 更新 token：`app.css`（名稱限 `elf-ui-pattern` 規則 27）→ `theme.ts` → `theme.test.ts`。
2. 在 `src/plugins/antd.ts` 註冊 SPEC.md 用到的 `a-*` 元件（`elf-vue` 規則 47）。
3. 殼層（側欄、頂列、狀態列）→ 各頁 → 對話框；每完成一頁即對照 SPEC.md 狀態表自我檢查。
4. 所有文案進 locale JSON（`elf-i18n`），先寫 en 再寫 zh-TW，兩者同時交付。
5. 固定寬、鎖高度的元件以最長語系字串測試。
6. 不確定就停下來問；**MUST NOT** 以「先做一個版本再說」取代詢問。

## 8. 視覺驗收與截圖時機

| 情境 | 用截圖嗎 | 做法 |
| --- | --- | --- |
| 依 Claude Design 原型實作 | 否 | 讀原型原始碼（`HANDOFF.md` 明訂） |
| 依 Figma 實作 | 是（參考） | `get_screenshot` + 以 `get_design_context` / `get_variable_defs` 的數值為準 |
| 設計 vs 實作驗收 | 是（並排審查） | 原型在瀏覽器開啟、實作在同尺寸視窗；逐項比對 SPEC.md，不做像素 diff |
| 實作回歸 | 是（自動） | Playwright `toHaveScreenshot`，基準影像由**同一 OS + 瀏覽器**產生（`elf-e2e`） |
| 顏色 / 間距是否正確 | 否 | DevTools 或 Playwright `getComputedStyle` 讀值，對照 token |

驗收步驟：
1. 以 SKILL.md 規則 32 的視窗 × 語系 × 側欄狀態組合逐一檢查。
2. 每個畫面檢查 SPEC.md 狀態表的每一格（含故意製造 loading / empty / error）。
3. 鍵盤走一遍（Tab / Enter / Space / Esc）。
4. 差異寫入 [`templates/review-checklist.md`](../templates/review-checklist.md) §3 差異表；嚴重度：
   - **高**：功能 / 狀態缺失、錯誤元件、token 外顏色、文字被截、a11y 無法操作
   - **中**：尺寸 / 間距不在規格、對齊錯誤、互動回饋缺失
   - **低**：文字寬度造成的微小位移（僅記錄）
5. 可另用 `frontend/design/web-design-guidelines` 做通用 UI 稽核，結果合併進差異表。
