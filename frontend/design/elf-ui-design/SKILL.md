---
name: elf-ui-design
description: |
  Elf Express UI 設計流程規範：從需求簡報、AI 設計工具 / Figma 原型（Ant Design 設計系統）、審查迭代、
  交接包（HANDOFF.md + chats + 原型 + 設計系統 + uploads），到 ant-design-vue 4 實作對照與視覺驗收，
  讓 AI 不再自行發揮視覺設計。
  當任務涉及：撰寫設計簡報、用 claude.ai/design / Figma / Pencil 製作或修改原型、讀取或建立 docs/design/ 交接包、
  依原型或 Figma frame 實作畫面、把 Figma variables 或原型 CSS 變數對應到團隊 token 與 antd theme.token、
  字型 / 色彩 / 間距 / 圓角 / 陰影 / 深色模式決策、UI 文案語氣與中英標點、設計 vs 實作的視覺驗收或截圖比對時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express UI 設計流程規範

> 事實來源：參考專案 `E:\source\TypingTrainer\docs\design\`（Claude Design 交接包：`HANDOFF.md`、`chats/chat1.md`、
> `prototype/TypingTrainer.dc.html`、`prototype/_ds/ant-design-system-*/`（Ant Design v5.9.4 Community Figma 匯入）、
> `prototype/uploads/`）與其實作 `TypingTrainer/apps/src/`。原型 vs 實作的逐項比對見
> [`references/case-typingtrainer.md`](references/case-typingtrainer.md)。

相關 skill（本檔不重複其內容，只引用）：
- `elf-ui-pattern`：token 名稱封閉清單（規則 27、31）、`theme.ts` + `theme.test.ts` 同步、三態、a11y、ant-design-vue 元件對照（2.8）。
- `elf-vue`：SFC、`src/plugins/antd.ts` 按需註冊。
- `elf-i18n`：locale JSON、zh-TW 標點與空格（規則 26）、antd `ConfigProvider :locale`（規則 39）、IME。
- `elf-e2e`：Playwright 截圖基準、focus 行為測試。
- 第三方（僅輔助，**不得覆蓋本檔與 elf-ui-pattern**）：
  | skill | 何時用 | 不可用來 |
  | --- | --- | --- |
  | `frontend/design/ui-ux-pro-max` | 簡報 / 探索階段找配色、字型搭配、版面方向 | 決定已存在專案的 token 值、取代 antd 元件 |
  | `frontend/design/frontend-design` | 非 antd 產物（行銷頁、一次性展示頁、海報） | 產品畫面（產品畫面一律 Ant Design + ant-design-vue） |
  | `frontend/design/web-design-guidelines` | 實作完成後做 UI / a11y 稽核，作為第 5 節檢查清單的補充 | 取代設計交接包或本檔規則 |

---

## 1. 何時使用

- 把需求寫成設計簡報，或在 AI 設計工具（claude.ai/design）/ Figma / Pencil 產生、修改原型
- 收到或建立 `docs/design/` 交接包；依交接包或 Figma frame 實作 Vue 畫面
- 新增 / 修改顏色、字型、間距、圓角、陰影、深色模式，或 antd `theme.token`
- 撰寫 UI 文案、決定中英文語氣與標點
- 驗收「實作是否與設計一致」、決定要不要截圖比對

流程總覽（每步細節見 [`references/workflow.md`](references/workflow.md)）：

```
1 簡報 brief ──► 2 原型 prototype ──► 3 審查迭代 review ──► 4 交接包 handoff
   (templates/        (Ant Design 設計系統，     (chats 保留全部       (docs/design/，
    design-brief.md)   先定 token 再畫)          回饋與截圖)           templates/HANDOFF.template.md)
                                                                        │
6 視覺驗收 acceptance ◄── 5 實作 implementation ◄── 4.5 設計規格 SPEC.md ◄┘
   (templates/            (ant-design-vue 4，       (templates/spec.template.md：
    review-checklist.md)   token 單一來源)           元素→antd、token、狀態表、待確認)
```

---

## 2. 固定規則

### 2.1 設計工具與設計系統（MUST）

1. **MUST** 產品畫面的設計系統是 **Ant Design**（參考交接包使用 `ant-design-system-*`：Ant Design v5.9.4 Community Figma 匯入），實作是 **ant-design-vue 4**。**MUST NOT** 在原型階段換成其他設計系統（Material、shadcn 等）。
   WHY：原型元件與實作元件一對一，實作時才不必重新設計。
2. **MUST** 原型先定義一組品牌 / 語意色（覆寫設計系統的 seed token，例：參考原型在 `<style>` 的 `:root { --color-primary-colorprimary:#d97757; ... }`），再畫畫面；畫面中的顏色 **MUST** 引用這組變數。
   WHY：參考原型在 inline style 寫了 36 種不同 hex（`#8b877e` 出現 113 次），實作時只能逐一猜測歸屬哪個 token。
3. **MUST** 原型用 4px 間距刻度（4/8/12/16/20/24/32/48）、控制項高 24/32/40、圓角 2/4/6/8（見 [`references/tokens.md`](references/tokens.md) §3）。出現刻度外數值（例 `padding:10px 20px 12px`、`height:34px`）時，交接前 **MUST** 在 SPEC.md 標註「刻意例外」或改回刻度。
4. **MUST** 設計系統缺的元件（參考 DS readme「Caveats」：Figma 檔**沒有** Table、Form、Upload、Avatar、List、Card、Collapse、Tree、Slider、Calendar、Descriptions、Timeline…）在 SPEC.md 對應到 ant-design-vue 的同名元件，**MUST NOT** 把原型手刻的版本照抄進實作。
   WHY：原型因 DS 缺元件而手刻表格、拖放區、滑桿、樹狀清單；參考實作照抄後失去 antd 的鍵盤操作、Esc 關閉、focus 管理。
5. **MUST** 原型在 AI 設計工具中完成時，交接包依第 2.3 節格式放進 repo；在 Figma 完成時，交接 = Figma 連結（含 `node-id`）+ SPEC.md（見 [`references/workflow.md`](references/workflow.md) §6）。

### 2.2 審查與迭代（MUST）

6. **MUST** 每一輪回饋（文字、標註截圖）留在設計對話中，不另開私訊；標註截圖會成為交接包 `uploads/`。
   WHY：`chat1.md` 是唯一記錄「為什麼改」的地方（例：單字練習模式方向改了 5 次，最終版在第 838、982 行）。
7. **MUST** 設計對話中「AI 提議但使用者未同意」的項目視為**不在範圍**（例：`chat1.md` 第 1253 行「還可以再加的（你決定要不要）」、第 119 行「下一步可做：…深色主題」均未獲同意）。
8. **MUST** 語言基準在設計階段決定並寫進簡報。參考專案決定 `en` 為基準語言、原型文案用英文（`chat1.md` 第 1343–1357 行）；Elf Express 產品介面仍 **MUST** 同時交付 zh-TW + en（`elf-i18n`）。

### 2.3 交接包（MUST）

9. **MUST** 交接包放 `docs/design/`，結構固定：

   ```
   docs/design/
   ├─ HANDOFF.md          # 給 coding agent 的讀取指示（templates/HANDOFF.template.md）
   ├─ SPEC.md             # 設計規格：元素→antd、token、狀態、響應式、待確認（templates/spec.template.md）
   ├─ chats/*.md          # 完整設計對話（不可摘要、不可刪減）
   ├─ prototype/
   │  ├─ <Primary>.html   # 主要原型（HANDOFF.md 指名）
   │  ├─ support.js 等    # 主要原型 import 的所有檔案
   │  ├─ _ds/<design-system>/   # 設計系統參考（readme.md、tokens/、styles.css…）
   │  └─ uploads/         # 使用者在對話中貼的截圖 / 素材
   └─ figma.md            # （Figma 流程才有）檔案 URL、每個畫面的 node-id、variables collection
   ```

10. **MUST** `HANDOFF.md` 內的路徑與實際目錄一致。參考專案把 `project/` 改名為 `prototype/`、`README.md` 改名為 `HANDOFF.md`，但 `HANDOFF.md` 仍寫 `project/TypingTrainer.dc.html`——搬移時 **MUST** 同步改寫或在開頭加路徑對照。
11. **MUST** 交接前確認 `_ds/readme.md` 引用的檔案都在。參考交接包的 readme 引用 `assets/icons/Icon.d.ts`、`guidelines/`、`ui_kits/`、`SKILL.md`，實際都**不在**包內——缺檔 **MUST** 補齊或在 SPEC.md「待確認」列出。
12. **MUST** 交接包進版控後**唯讀**：之後的設計變更走新一輪對話 + 新的匯出，不在 repo 內手改原型 HTML。

### 2.4 AI 讀取與實作（MUST / MUST NOT）

13. **MUST** 實作前**完整讀** `chats/` 全部對話與主要原型檔（不可略讀），並追蹤主要原型 import 的每個檔案；讀完才寫 SPEC.md 或程式。
    WHY：`HANDOFF.md` 明訂「The chat is where the intent lives」；最終 HTML 只呈現結果，不呈現被否決的方向。
14. **MUST** 對話與原型衝突時：同一主題以**對話中最後一次使用者確認**為準；仍無法判定 → 列入 SPEC.md「待確認」並**先問**，不自行選一個。
15. **MUST** 以原型**原始碼**取得尺寸、顏色、版面規則；實作過程 **MUST NOT** 為了「看設計」而開瀏覽器截圖原型（`HANDOFF.md`：a screenshot won't tell you anything the source doesn't）。截圖只用於第 2.7 節驗收與 Figma 參考。
16. **MUST** 每個原型元素對應到一個 ant-design-vue 4 元件，或在 SPEC.md「自訂元件」表記錄名稱、理由、a11y 契約（見 [`references/component-mapping.md`](references/component-mapping.md)）。對照結果 **MUST** 符合 `elf-ui-pattern` 2.8。
17. **MUST NOT** 照抄原型內部結構（inline style、`<div onClick>`、`sc-if` / `sc-for`、`dc-props`）。`HANDOFF.md`：「Match the visual output; don't copy the prototype's internal structure」。
18. **MUST NOT** 照搬原型執行環境的 workaround。例：原型 DS 的 Button 文字偏上，對話中以「上下 6px 內距」修補（`chat1.md` 第 866 行）；參考實作把它變成 `app.css` 的 `.btn-slot .ant-btn { padding: 6px 16px }`——ant-design-vue 的 `a-button` 沒有這個問題，此覆寫只會讓按鈕與 antd 其他元件不一致。
19. **MUST NOT** 使用 token 表以外的顏色、字型、陰影；**MUST NOT** 發明原型沒有的元件、圖示、插圖、動畫或配色。需要新 token → 走 `elf-ui-pattern` 規則 31 流程。
20. **MUST** 遇到下列情況**先問使用者**再實作：對話與原型衝突、原型缺某狀態且無法由設計系統推得、需要新 token、需要自訂元件、響應式規則不明、中英文長度造成版面改變。

### 2.5 Design token（MUST）

21. **MUST** token 流向單向：`Figma variables / 原型 CSS 變數` → 團隊 CSS token（`src/styles/app.css :root`，名稱為 `elf-ui-pattern` 規則 27 封閉清單）→ `src/styles/theme.ts` 的 `TOKENS`（antd `theme.token` / `theme.components`）。對照表見 [`references/tokens.md`](references/tokens.md) §1；**MUST** 由 `theme.test.ts` 驗證同步（範本：`elf-ui-pattern` references §7.3）。
22. **MUST NOT** 把設計系統的變數名稱（`--color-primary-colorprimary`、`--neutral-gray-5`…）搬進 `app.css`。ant-design-vue 4 以 CSS-in-JS 讀 `ConfigProvider` 的 `theme`，**不會讀**這些 CSS 變數；參考實作 `app.css` 保留的這 6 行是無效程式碼，且違反封閉清單。
23. **MUST** 字型堆疊以繁體中文字形為準：拉丁字先走系統 UI 字、CJK 依序 `PingFang TC` → `Microsoft JhengHei` → `Noto Sans TC`；**MUST NOT** 使用 DS 預設的 `PingFang SC` / `Noto Sans SC`（簡體字形）（完整堆疊見 [`references/tokens.md`](references/tokens.md) §2）。
24. **MUST** 字級 / 行高沿用 Ant Design：內文 14/22、說明 12/20、標題 Semibold 38/30/24/20/16；卡片標題 14 Semibold（參考專案全站統一，`chat1.md` 第 1173 行）。
25. **MUST** 深色模式只在簡報明列時做；要做時，CSS token 在 `:root[data-theme="dark"]` 重新定義、antd 用 `theme.darkAlgorithm` + 同一份深色 `TOKENS`，兩份都要被 `theme.test.ts` 檢查（見 [`references/tokens.md`](references/tokens.md) §5）。**MUST NOT** 只換 antd 不換 CSS token（或反之）。

### 2.6 文案（MUST）

26. **MUST** 遵守 Ant Design content fundamentals 並依語系調整（完整對照見 [`references/content.md`](references/content.md)）：en 一律 sentence case、按鈕為簡短祈使動詞、單行說明不加句點；zh-TW 用台灣用語、全形標點、中英數之間半形空格（`elf-i18n` 規則 26）。
27. **MUST NOT** 使用 emoji、驚嘆號、第一人稱或玩笑；狀態以「圖示 + 語意色」表達。**MUST NOT** 以 Unicode 字元充當圖示（參考原型用 `×` 當關閉、`＋` 當新增、`▸` 當展開 → 實作改用 `CloseOutlined`、`PlusOutlined`、`a-tree` 內建展開圖示）。
28. **MUST** 所有文案（含 `aria-label`、`placeholder`、單位 WPM / CPM、快捷鍵提示）走 i18n；antd 內建文字由 `ConfigProvider :locale` 提供（`elf-i18n` 規則 39；參考實作 `App.vue` 只傳 `:theme` 未傳 `:locale`，屬反例）。

### 2.7 視覺驗收（MUST）

29. **MUST** 驗收以**規格比對**為主：逐一核對 SPEC.md 的元素 → antd 元件、token、尺寸、狀態、響應式規則；顏色與間距 **MUST** 與 token 完全相等，文字寬度造成的尺寸差異不算缺陷。
30. **MUST NOT** 拿原型與實作做跨環境像素 diff。原型字型走 `-apple-system`（macOS = SF Pro），Windows / WebView2 回退 Segoe UI；原型元件是 DS bundle 的 React 版、實作是 ant-design-vue——像素必然不同。
31. **MUST** 截圖只用於：(a) Figma 設計的視覺參考（`get_screenshot`）；(b) 驗收時設計 vs 實作並排審查；(c) 同一環境下的**實作回歸基準**（Playwright `toHaveScreenshot`，見 `elf-e2e`）。
32. **MUST** 驗收視窗至少：1440×900、1280×800、900×640（桌面版建議最小視窗，`chat1.md` 第 739 行）、360×540（`elf-ui-pattern` 規則 43 暫定最小）；每個視窗 × `en` / `zh-TW` × 側欄展開 / 收合。
33. **MUST** 差異以表格回報（位置、預期、實際、嚴重度、證據），**MUST NOT** 以「大致一致」帶過（範本：[`templates/review-checklist.md`](templates/review-checklist.md) §3）。

---

## 3. 標準範本

| 檔案 | 用途 |
| --- | --- |
| [`templates/design-brief.md`](templates/design-brief.md) | 設計簡報：範圍、語言基準、目標視窗、深色模式、資料狀態 |
| [`templates/HANDOFF.template.md`](templates/HANDOFF.template.md) | 交接包 `HANDOFF.md`（讀取順序、路徑、範圍外清單） |
| [`templates/spec.template.md`](templates/spec.template.md) | 設計規格 `SPEC.md`：畫面清單、元素 → antd、狀態表、響應式、文案長度、待確認 |
| [`templates/token-mapping.md`](templates/token-mapping.md) | token 對照表空白範本 + `theme.ts` 擴充片段 |
| [`templates/review-checklist.md`](templates/review-checklist.md) | 設計審查、交接完整性、實作驗收、差異表 |
| [`references/workflow.md`](references/workflow.md) | 六個階段的步驟、工具選擇、Figma MCP 讀取流程、截圖時機 |
| [`references/tokens.md`](references/tokens.md) | Ant Design 變數 → 團隊 token → antd `theme.token` 對照、字型、刻度、深色模式 |
| [`references/component-mapping.md`](references/component-mapping.md) | 原型常見手刻元素 → ant-design-vue 4 元件對照與屬性 |
| [`references/content.md`](references/content.md) | 文案基礎（en / zh-TW）、用語對照、長度規則 |
| [`references/case-typingtrainer.md`](references/case-typingtrainer.md) | 參考專案原型 vs 實作逐項比對（本檔規則的證據） |

### 3.1 開工指令（AI 收到交接包時照做）

```text
1. Read docs/design/HANDOFF.md → fix any path mismatch (rule 10) before continuing.
2. Read every file in docs/design/chats/ top to bottom. Note, per topic, the LAST user-confirmed decision.
3. Read the primary prototype top to bottom, then every file it imports (support.js, _ds/*/readme.md, tokens/*.css).
4. List uploads/ and open each image referenced in the chat (they are annotated feedback, not specs).
5. Write/refresh docs/design/SPEC.md from templates/spec.template.md:
   screens, element → ant-design-vue mapping, token mapping, state table, responsive rules, copy lengths, open questions.
6. STOP and ask the user about every open question. Implement only after answers.
```

### 3.2 token 同步片段（`src/styles/theme.ts` 擴充 components 與尺寸）

`TOKENS` / `CSS_VAR_OF` / `theme.test.ts` 範本在 `elf-ui-pattern` references §7；設計交接時額外補齊非顏色 token 與元件 token：

```ts
import { theme as antdTheme } from 'ant-design-vue'

// TOKENS / CSS_VAR_OF: see elf-ui-pattern references §7.2 (colors, mirrored in app.css).
// Extra values that must also equal an app.css variable; add each to CSS_VAR_OF-style checks in theme.test.ts.
export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', 'Helvetica Neue', Arial, sans-serif" // --font
export const TOKENS_EXTRA = { segBg: '#f0ebe2', sider: '#262624' } as const // --seg-bg, --sider

export const theme = {
  token: {
    ...TOKENS,
    colorInfo: TOKENS.colorPrimary, // otherwise info states stay antd blue
    fontFamily: FONT,
    fontSize: 14,
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    borderRadiusXS: 2,
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,
    motionDurationMid: '0.2s',
  },
  // ant-design-vue 4.2.6: Segmented has no component token for the track; it reads colorBgLayout,
  // so override that alias token for Segmented only. Layout sider/header read colorBgHeader.
  components: {
    Segmented: { colorBgLayout: TOKENS_EXTRA.segBg }, // --seg-bg
    Layout: { colorBgHeader: TOKENS_EXTRA.sider }, // --sider
  },
  algorithm: antdTheme.defaultAlgorithm,
}
```

---

## 4. 禁止簡化

以下細節 AI 最常在「依原型實作」時丟掉或做錯（證據與檔案行號見 [`references/case-typingtrainer.md`](references/case-typingtrainer.md)）。每一項 **MUST** 出現在 SPEC.md 並在實作中保留：

1. **原型沒畫的狀態 MUST 補**：原型全是假資料，沒有 loading / error，只有兩處 empty（`No mistakes this round.`、`No matching model`）。每個非同步區塊 **MUST** 依 `elf-ui-pattern` 2.6 補三態；參考實作 `apps/src` 內完全沒有 `a-spin` / `a-empty` / `a-result`。
2. **門檻驅動的樣式 MUST 保留數值**：正確率 ≥97 成功色 / ≥92 警告色 / 其餘錯誤色；熟練度 ≥70 / ≥45；錯字簿 box ≥4 / ≥2；到期（dueIn ≤ 0）用 `--primary-active`；未解鎖成就 `opacity:0.5`。數值照抄、**顏色改用 token**（參考實作寫成 `session.ts:126`、`DictionaryView.vue:50` 的 hex）。
3. **互動狀態 MUST 全部實作**：hover（連結 `--primary-hover`）、按下（虛擬鍵 down / active 兩種樣式）、拖入（drop zone 邊框 + 底色變主色）、選中（側欄項目主色底白字、分段白底 + `--seg-shadow`）、停用（釘選時收合鈕 `cursor:not-allowed` + 25% 白）、focus（`elf-ui-pattern` 規則 15；原型完全沒有 focus 樣式，**MUST** 補，不可以「原型沒有」為由省略）。
4. **版面鎖定規則 MUST 帶數字**：殼層 100vh（頂列 48 + 內容 + 狀態列 48）、內容 max-width 1000、頁面內距 16/24、卡片內距 16×20、卡片間距 12；練習頁文字區下限 120 / 200（逐字格）/ 210（單字）、鍵盤高 clamp 120–340、<190 隱藏提示列、<130 隱藏鍵盤、視窗高 <640 隱藏手指圖例；內容區 <620 雙欄改單欄；側欄 216 / 72；表格表頭與分頁固定、資料列內捲。
5. **微互動 MUST 保留**：游標閃爍（三種 keyframes：`caret`、`caretPulse`、`caretCell`）、IME 組字氣泡、目前字自動捲到文字區垂直置中、3–2–1 倒數且倒數中鎖輸入、同字錯 3 次提示、收合側欄以分隔線取代群組標題且項目有 tooltip。
6. **危險操作 MUST 加確認**：原型的 `×` 直接刪除分類 / 細項 / 檔案；實作 **MUST** 用 `a-popconfirm`（`elf-ui-pattern` 規則 26）。原型省略確認是原型簡化，不是設計意圖。
7. **i18n 長度 MUST 驗證**：原型固定寬（按鈕 80 / 96 / 118px、標籤欄 56px、日期欄 64px）是以單一語言量出來的；切英文後對話中出現「Category / Topic 標籤被截」「Drill 被截」（`chat1.md` 第 1381、1403 行）。每個固定寬元素 **MUST** 以 en 與 zh-TW 最長字串檢查，改用 `min-width` 或可換行。
8. **元件語意 MUST 由 antd 提供**：分段、開關、對話框、下拉搜尋、滑桿、上傳、表格、樹 **MUST NOT** 沿用原型手刻版（參考實作 `ToggleSwitch.vue`、`app.css .seg / .mask / .modal`、`AiView.vue` 自寫模型搜尋、`DictionaryView.vue` 原生 `<select>`、`<input type="range">`）。
9. **設計系統的圖示主題 MUST 對齊意圖**：DS 圖示以名稱後綴區分主題（readme：`Home3` = Outlined）；使用者要求「側欄全部改用線框版圖示」（`chat1.md` 第 288 行）→ 實作一律 `*Outlined`，選中 / 釘選狀態才用 `*Filled`（`AppSider.vue`：`PushpinFilled`）。

---

## 5. 檢查清單

設計階段：
- [ ] 簡報寫明範圍、語言基準、目標視窗、深色模式是否需要、每個畫面的資料狀態
- [ ] 原型掛載 Ant Design 設計系統，品牌 / 語意色在一處定義，畫面引用變數
- [ ] 間距 / 圓角 / 控制項高度都在刻度內，例外已標註

交接階段：
- [ ] `docs/design/` 結構完整；`HANDOFF.md` 路徑正確；`_ds/readme.md` 引用檔案都在
- [ ] `chats/` 為完整對話；`uploads/` 截圖都能在對話中找到出處
- [ ] SPEC.md 已完成：元素 → antd 對照、自訂元件理由、token 對照、狀態表、響應式數字、文案長度、待確認已由使用者回覆

實作與驗收：
- [ ] 完整讀過 chats 與主要原型（含 import）才開始寫程式
- [ ] 沒有照抄原型結構、手刻控制項或 DS workaround
- [ ] `app.css` 只有 `elf-ui-pattern` 規則 27 的 token 名稱；`.vue` / `.ts` 沒有 hex；`theme.test.ts` 通過
- [ ] 字型堆疊為繁中字形；antd `ConfigProvider` 同時傳 `:theme` 與 `:locale`
- [ ] 第 4 節九項全部核對
- [ ] 四種視窗 × 兩語系 × 側欄兩態驗收，差異表無未處理的「高」嚴重度項目

---

## 6. 常見錯誤

| 錯誤（多數出自參考專案） | 正確做法 | 原因 |
| --- | --- | --- |
| 只看最終 HTML，不讀 chats | 先讀完 chats，記下每個主題最後的決定 | 被否決的方向與使用者意圖只在對話裡 |
| 把 AI 提議但未獲同意的功能也做了 | 只做使用者確認的項目 | 範圍膨脹 |
| 開瀏覽器截圖原型來「量」尺寸 | 讀原型原始碼的數值 | 截圖有縮放誤差，原始碼是精確值 |
| 原型手刻的表格 / 開關 / 對話框照抄成 Vue | 對應到 `a-table` / `a-switch` / `a-modal` | 失去鍵盤、focus、Esc、a11y |
| `app.css` 留 `--color-primary-colorprimary` 等 DS 變數 | antd 顏色只從 `theme.ts` 進 `ConfigProvider` | ant-design-vue 不讀這些變數，屬死碼且破壞封閉清單 |
| `App.vue` 內聯 antd theme 色碼 | `import { theme } from '@/styles/theme'` + 同步測試 | 兩份來源必然漂移 |
| 字型寫 `'PingFang SC', 'Noto Sans SC'` | `'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC'` | 簡體字形不適用台灣使用者 |
| 字型把 `'SF Pro Text'` 放第一位 | 以 `-apple-system, BlinkMacSystemFont, 'Segoe UI'` 開頭 | SF Pro 不可散布、非 macOS 不存在 |
| 分類色、手指色、頭像色寫成 TS 陣列的 hex | 以 token 定義或列入待確認（`elf-ui-pattern` 規則 31） | 換主題 / 深色模式無法同步 |
| 用 `×`、`＋`、`▸` 字元當圖示 | `@ant-design/icons-vue` 圖示 + `aria-label` | 字元無語意、字型不同時對不齊 |
| 固定寬按鈕放「Import dictionary」 | `min-width` + 兩語系測試 | 英文比中文長，文字被截 |
| 深色模式只加 `theme.darkAlgorithm` | CSS token 與 antd 同時切換 | 自訂區塊仍是淺色 |
| 拿原型截圖與實作截圖做像素 diff | 規格比對 + 同環境實作回歸基準 | 字型與元件實作不同，diff 全是雜訊 |
| 驗收只寫「大致一致」 | 差異表：位置 / 預期 / 實際 / 嚴重度 / 證據 | 無法追蹤、無法驗證修正 |

---

## 7. 待確認

1. **「Open Design」是哪一個產品**：團隊口頭提到的 AI 設計工具名稱未確認；參考專案實際使用 **claude.ai/design（Claude Design）**。確認後補入 `references/workflow.md` §2 的工具表與其交接格式。
2. **Pencil（pen.dev）MCP 是否為團隊正式工具**：環境中存在 `pencil` MCP（`.pen` 檔加密、只能經 MCP 讀寫），是否用於產品設計、交接格式為何未定。
3. **Figma 團隊檔案與 Code Connect**：團隊是否有自己的 Figma library（或直接用 Ant Design 5.9.4 Community 檔）、是否建立 Code Connect 對應到 ant-design-vue 元件，未定；影響 `references/workflow.md` §6。
4. **Elf Express 品牌色與深色模式 token 值**：參考專案暖色系（`#d97757` 等）為產品專屬；團隊共用品牌 token、深色 token 值未定（同 `elf-ui-pattern` 待確認 #2）。
5. **非顏色 CSS token**：`elf-ui-pattern` 規則 27 封閉清單沒有圓角、間距、字級、遮罩色、資料視覺化 / 分類色（參考 `app.css` 已另有 `--key-bg`、`--track`、`--text-4`，違反清單）。是否擴表（例 `--radius-*`、`--mask`、`--cat-*`）需依規則 31 提案。
6. **`elf-ui-pattern` 範本與參考專案 `--overlay-shadow` 不一致**：該 skill references §7.1 寫單層 `0 6px 16px rgba(0,0,0,0.08)`，DS 與參考 `app.css` 為三層陰影。以何者為準待該 skill owner 確認（本檔 `references/tokens.md` 暫採 DS 三層）。
7. **標題字級 H1**：DS readme 寫 38，`fig-tokens.css` 的 `--h1` 為 40；本檔暫採 antd 預設 38。
8. **卡片元件**：DS 沒有 Card；團隊新專案用 `a-card`（`:bordered="false"`）還是 `.card` CSS primitive 未定。
9. **圖表函式庫**：簡報提到 ECharts，參考實作用手寫 SVG polyline；團隊標準未定（配色規則見 `dataviz` 類 skill，值仍須 token 化）。
10. **驗收視窗與截圖基準**：規則 32 的視窗組合、是否在 CI 跑 Playwright 截圖基準、基準影像的作業系統（Windows / Linux runner 字型不同）未定。
11. **zh-TW 字型是否自帶**：Tauri Linux 版若系統無 `Noto Sans TC`，是否隨 app 打包字型檔未定。
12. **DS 圖示後綴語意**：readme 只確認 `3` = Outlined；`2` 與無後綴的對應（Filled / TwoTone）需以 `assets/icons/Icon.d.ts` 確認，而該檔不在參考交接包內。
