# 參考專案：原型 vs 實作比對

- 原型：`E:\source\TypingTrainer\docs\design\prototype\TypingTrainer.dc.html`（1816 行；第 1–934 行為版面，第 935 行起為邏輯）
- 對話：`E:\source\TypingTrainer\docs\design\chats\chat1.md`（1437 行）
- 實作：`E:\source\TypingTrainer\apps\src\`（ant-design-vue 4.2.6、Vue 3、Pinia、vue-i18n 10）

結論：實作在**行為與數值**上高度忠於原型（門檻、版面高度公式、微互動幾乎全保留），但在**結構**上把原型的手刻寫法原樣搬過來——
控制項沒換成 antd、token 散成三份、DS 變數與 workaround 留在程式裡，原型沒畫的狀態也沒有補。SKILL.md 的規則與「禁止簡化」由此歸納。

## 1. 保留得好的（實作時照做）

| 原型 | 實作位置 | 備註 |
| --- | --- | --- |
| 文字區下限 120 / 200 / 210、鍵盤 clamp 120–340（原型邏輯 `textFloorPx`、`kbPx`） | `views/PracticeView.vue` 第 29–36 行 | 另加 `<130 隱藏鍵盤`、`<190 隱藏提示列` |
| 目前字自動捲到垂直置中（原型 `componentDidUpdate`） | `views/PracticeView.vue` 第 166–168 行 | |
| 正確率門檻 97 / 92 | `stores/session.ts` 第 126 行 | 顏色仍為 hex |
| 熟練度門檻 70 / 45 | `views/DictionaryView.vue` 第 50 行 | 顏色仍為 hex |
| 收合側欄以分隔線取代群組標題、釘選時收合鈕停用 | `components/AppSider.vue` 第 81、105–115、272–277 行 | |
| 側欄線框圖示、釘選用實心 | `components/AppSider.vue` 第 6–17 行 | 對應 `chat1.md` 第 288 行 |
| 內容區 <620 改單欄 | `composables/useGridLayout.ts` | 用 JS 視窗寬減側欄；`elf-ui-pattern` 建議改 `@container` |
| 三個游標 keyframes | `styles/app.css` | keyframes 內仍寫死 `#d97757` |
| en 為基準語言、`en` fallback | `i18n/index.ts` | 對應 `chat1.md` 第 1343–1357 行 |

## 2. 被簡化或做錯的（禁止簡化的證據）

| # | 原型 / 設計系統 | 實作現況 | 應為 | 對應 SKILL.md |
| --- | --- | --- | --- | --- |
| 1 | 手刻分段（`background:#f0ebe2;padding:2px` + 子項） | `app.css .seg`、`.seg-item`（div 點擊） | `a-segmented` / `a-tabs` | 規則 16、禁止簡化 8 |
| 2 | 手刻開關 44×22 / 40×20 | `components/ToggleSwitch.vue`（`span role="switch"`，無法 Tab） | `a-switch` | 規則 16 |
| 3 | 手刻對話框（`position:fixed` 遮罩） | `LibraryView.vue`、`DictionaryView.vue` 的 `.mask` / `.modal` | `a-modal` | 規則 16、`elf-ui-pattern` 20 |
| 4 | 手刻可搜尋下拉 + 「No matching model」 | `views/AiView.vue` 第 122–143 行自寫 | `a-select show-search` + `#notFoundContent` | 規則 16 |
| 5 | 原生 `<select>` | `views/DictionaryView.vue` 第 214 行 | `a-select` | 規則 16 |
| 6 | `input[type=range]` | `views/AiView.vue` 第 182 行 | `a-slider` | 規則 16 |
| 7 | 表格以 flex 列手刻（DS 無 Table） | 各 view flex 列 | `a-table`（`scroll.y`、固定表頭） | 規則 4 |
| 8 | 原型 `:root` 覆寫 DS 變數 `--color-primary-colorprimary` 等 6 個 | `styles/app.css` 同 6 行照抄 | 刪除（antd-vue 不讀）；顏色走 `theme.ts` | 規則 22 |
| 9 | 原型 DS Button 文字偏上，以 6px 內距修補（`chat1.md` 第 866 行） | `app.css .btn-slot .ant-btn { padding: 6px 16px }` | 刪除；`a-button` 原生即置中 | 規則 18 |
| 10 | 主題色只在原型一處 | `App.vue` 內聯 `theme.token`（9 個色）+ `app.css` 一份 + TS 內 hex | `styles/theme.ts` 單一來源 + `theme.test.ts` | 規則 21、`elf-ui-pattern` 29 |
| 11 | 原型 36 種 hex inline | hex 散在 15 個檔案（`StatsView.vue` 12、`ProgressView.vue` 17、`CoachView.vue` 12…） | token 或集中的色票模組 | 規則 19、tokens.md §4 |
| 12 | — | `app.css` 有 `--key-bg`、`--track`、`--text-4`（不在封閉清單） | 合併或依規則 31 擴表 | 待確認 5 |
| 13 | 字型 `'SF Pro Text', …, 'PingFang TC'` | `App.vue` / `app.css` 照抄，缺 Windows / Linux 繁中字型 | tokens.md §2 堆疊 | 規則 23 |
| 14 | 原型無 loading / error 狀態 | `apps/src` 無 `a-spin` / `a-empty` / `a-result` | `AsyncBlock`（`elf-ui-pattern` 2.6） | 禁止簡化 1 |
| 15 | 原型 `×` 直接刪除分類 / 細項 / 檔案 | 同樣直接刪除 | `a-popconfirm` | 禁止簡化 6 |
| 16 | 原型無 focus 樣式、`div onClick` | `aria-label` 只出現在 2 個檔案 | `elf-ui-pattern` 2.2–2.3 | 禁止簡化 3 |
| 17 | antd 內建文字 | `App.vue` 的 `a-config-provider` 只傳 `:theme`，未傳 `:locale` | `:locale="ANTD_LOCALE[uiLang]"` | 規則 28、`elf-i18n` 39 |
| 18 | `zh-TW` 群組名 | `i18n/locales/zh-TW.json` `nav.groups.data = "數據"` | 「資料」或「統計」 | content.md §3 |
| 19 | 固定寬按鈕 96px 放 `Import dictionary` | 沿用固定寬 `.btn-slot` | `min-width` + 兩語系測試 | 禁止簡化 7 |
| 20 | `info` 色 = primary（DS `--color-info-colorinfo`） | 未設 `colorInfo`、`colorTextTertiary`、`colorBorderSecondary`、`colorBgLayout`、`colorBgMask` | 依 tokens.md §1 設齊 | tokens.md §1 |

## 3. 交接包本身的缺陷

| 問題 | 證據 | 規則 |
| --- | --- | --- |
| `HANDOFF.md` 路徑未隨改名更新 | 寫 `project/TypingTrainer.dc.html`、`README.md`；實際為 `prototype/`、`HANDOFF.md` | SKILL.md 規則 10 |
| DS readme 引用的檔案缺漏 | readme 引用 `assets/icons/Icon.d.ts`、`guidelines/`、`ui_kits/`、`SKILL.md`；`_ds/` 內只有 `readme.md`、`styles.css`、`tokens/`、`components/data-display/fig-assets.css`、`_ds_bundle.js`、`_ds_manifest.json`、`_adherence.oxlintrc.json` | 規則 11 |
| 沒有 SPEC.md | 元素對照、狀態、待確認都在實作者腦中 | 規則 9、13–16 |
| 範圍外項目沒有列出 | 深色主題（`chat1.md` 第 119 行）、AI 設定的額外項目（第 1253 行）未獲同意 | 規則 7 |

## 4. 值得沿用的設計系統資產

- `_ds/.../_adherence.oxlintrc.json`：原型端的 lint 規則——禁止 raw hex（`Raw hex color — use a design-system color token via var()`）、禁止 raw px、限制字型。團隊在實作端的對應是 `elf-ui-pattern` 規則 28 與 `theme.test.ts`；可考慮在 `eslint` 加同類規則（待確認）。
- DS readme「States」：hover 亮一階（primary-5）、按下暗一階（primary-7）、停用 = 25% 文字 + `#F5F5F5` 底、聚焦 = 主色 20% 的 2px 外框——SPEC.md 狀態表的預設值。
