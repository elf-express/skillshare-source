# UI 文案基礎（en / zh-TW）

來源：Ant Design 設計系統 readme「Content fundamentals」（`prototype/_ds/ant-design-system-*/readme.md`），依 Elf Express zh-TW + en 介面調整。
locale 檔結構、key 命名、標點與空格的強制規則在 `elf-i18n`（規則 26 等）；本檔規定**寫什麼、怎麼寫**。

## 1. 共通原則（兩種語言都適用）

| 原則（DS readme） | 規則 | 參考專案例 |
| --- | --- | --- |
| 平實、指令式 UI 用語 | 說明「做什麼」，不說明「為什麼很棒」 | `Typing starts the timer · Backspace to correct` |
| 標籤是簡短祈使動詞 | 按鈕 = 動詞（+ 受詞）：Save、Import files、Start | `Import files`、`Next text`、`Analyse` |
| 語氣中性、功能導向 | **MUST NOT** 驚嘆號、幽默、第一人稱（I / we / 我 / 我們） | 反例待審：`No mistakes this round. Keep it up.`（鼓勵語屬產品語氣決策，需簡報明列才可用） |
| 不用 emoji | 狀態 = 圖示 + 語意色 | `a-badge status="success" text="Synced 2 min ago"` |
| 數字與資料優先 | 用表格、統計、標籤、徽章取代長文 | 統計卡、排行榜、錯字簿 |
| 不用字元當圖示 | `×`、`＋`、`▸`、`→` 不當按鈕或圖示 | 原型 `＋ New category` → `PlusOutlined` + `New category` |

## 2. English

1. **MUST** sentence case：只有句首與專有名詞大寫（`Import dictionary`、`Personal bests by text`、`API base URL`）。**MUST NOT** Title Case 按鈕（`Import Dictionary` ✗）。
2. 按鈕 1–3 個字；對話框主按鈕重複標題的動詞（標題 `Import files` → 主按鈕 `Import`）。
3. 說明文字（helper / caption）是完整句子，**單行不加句點**；多句時每句加句點。
4. 單位與縮寫固定寫法：`WPM`、`CPM`、`API key`、`URL`；時間 `2 min ago`、`12 min`。
5. 日期 / 數字用 `Intl` / dayjs 依 locale 格式化，**MUST NOT** 字串拼接（參考對話修過 `Sep  16` 雙空白，`chat1.md` 第 1381 行）。
6. 拼字統一一種（參考原型 UI 文案用英式 `Analyse`、`Categorising`、`practise`，但同時有名詞 `Practice` 與程式識別字 `analyze`，容易被實作者「順手改成美式」）。**MUST** 在簡報決定 US 或 UK 拼法；未決定 → 待確認。
7. 錯字 / 黏字要在審查抓出（參考原型 `TopicCategory`）。

## 3. 繁體中文（zh-TW）

1. **MUST** 台灣用語（常見誤用對照）：

   | 避免（大陸用語） | 使用 |
   | --- | --- |
   | 數據（參考 `zh-TW.json` `nav.groups.data`） | 資料 / 統計 |
   | 默認 | 預設 |
   | 信息 | 訊息 |
   | 文件（指檔案時） | 檔案 |
   | 保存 | 儲存 |
   | 設置 | 設定 |
   | 登錄 | 登入 |
   | 用戶 | 使用者 |
   | 網絡 | 網路 |
   | 程序 | 程式 |
   | 加載 | 載入 |
   | 緩存 | 快取 |
   | 支持（功能） | 支援 |
   | 菜單 | 選單 |
   | 屏幕 | 螢幕 |
   | 視頻 | 影片 |

2. **MUST** 全形標點（，。：；！？「」（））；中文與英文 / 數字之間加半形空格（`AI 設定`、`連續 12 天`、`雲端已同步 2 分鐘前`）——`elf-i18n` 規則 26。
3. 按鈕 2–4 字動詞：`儲存`、`匯入檔案`、`開始`、`換一篇`；**MUST NOT** 加「請」「點此」。
4. 單行說明**不加句號**（對應英文單行不加句點）；多句說明句尾加「。」。
5. 量詞與單位：`128 篇`、`46 篇`、`12 分鐘`；WPM / CPM 保留英文縮寫，說明處可加註（`CPM（字/分）`）。
6. 引用 UI 元素名稱用「」：`按「AI 分析」後…`。
7. 不用「您」與「你」混用；UI 內偏好省略主詞（`已加入錯字簿`，而非「我們已把它加入你的錯字簿」）。

## 4. 長度與版面

- 以**最長的語系**設計固定寬元素；一般 en 比 zh-TW 長（參考：切英文後出現多輪截字修正，`chat1.md` 第 1381、1403 行；`Import dictionary` 放在 96px 按鈕）。
- 固定寬（按鈕、標籤欄、日期欄）**MUST** 在 SPEC.md「文案長度」表列出最長字串（en / zh-TW）與處理方式：`min-width`、換行、`.ell` + tooltip 三選一。
- **MUST NOT** 以縮短原文遷就版面而改變語意（參考：`練習` → `Drill` 是為了寬度改詞，應先確認）。

## 5. 審查清單（文案）

- [ ] en 全部 sentence case；按鈕是祈使動詞
- [ ] 無 emoji、無驚嘆號、無第一人稱、無字元圖示
- [ ] zh-TW 無大陸用語；全形標點；中英數間半形空格
- [ ] 單行說明無句點 / 句號；多句有
- [ ] 日期、數字、單位由 i18n / Intl 格式化
- [ ] 固定寬元素已用兩語系最長字串檢查
- [ ] 拼法（US / UK）一致
