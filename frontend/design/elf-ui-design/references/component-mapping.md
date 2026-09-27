# 原型元素 → ant-design-vue 4 對照

用法：寫 SPEC.md 時，原型的每個元素在本表找對應；找不到 → SPEC.md「自訂元件」表（名稱、理由、a11y 契約，依 `elf-ui-pattern` 規則 45）。
新用到的 `a-*` **MUST** 加入 `src/plugins/antd.ts`（`elf-vue` 規則 47）。

「原型寫法」欄取自 `TypingTrainer/docs/design/prototype/TypingTrainer.dc.html`；「參考實作」欄為 `TypingTrainer/apps/src` 的現況（多為反例）。

## 1. 對照表

| 原型元素（辨識特徵） | 原型位置 | 參考實作 | ant-design-vue 4 | 必設屬性 / 注意 |
| --- | --- | --- | --- | --- |
| DS `Button`（`type="primary" / "default"`、`size="sm"`） | 全站 20 處 | `a-button` + `.btn-slot` 固定寬 | `a-button` | 不覆寫內距；固定寬改 `min-width`；圖示按鈕加 `:aria-label` |
| 分段選擇：`background:#f0ebe2;border-radius:6px;padding:2px` + 子項白底 `box-shadow:0 2px 8px` | Category、統計語言、範圍 / 週期、AI 分頁、偏好設定 | `app.css .seg`（div 點擊） | `a-segmented`（`v-model:value`、`:options`） | 軌道色由 `theme.components.Segmented.colorBgLayout`；**切換整個內容面板**時改 `a-tabs` |
| 開關：`width:44px;height:22px;border-radius:100px` + 白色圓鈕 | 設定、AI 自動化 | `ToggleSwitch.vue`（`span role="switch"`） | `a-switch`（`v-model:checked`） | antd 預設 44×22 與原型相同；原型 40×20 版本無對應尺寸 → 用預設，SPEC.md 記錄差異 |
| 對話框：`position:fixed` 遮罩 + 白卡 `width:440/560/600px` + 三層陰影 | 新增分類、匯入檔案、匯入字典 | `.mask` + `.modal`（`LibraryView.vue`、`DictionaryView.vue`） | `a-modal`（`v-model:open`、`:width`、`#footer`） | 遮罩色由 `token.colorBgMask`；Esc / focus 還原為預設行為（`elf-ui-pattern` 規則 20） |
| 拖放上傳：`border:1px dashed` + `onDragOver/onDrop` + 隱藏 `input[type=file]` | 匯入檔案、匯入字典 | 自寫 `.drop.is-over` | `a-upload-dragger`（`:before-upload="() => false"` 本機解析、`accept`、`multiple`、`:file-list`） | 拖入樣式由 antd 提供；說明文字（格式、大小上限）放 `ant-upload-hint` |
| 可搜尋下拉：`input` + 三角形 + 絕對定位清單 + 「No matching model」 | AI 設定 → Model | `AiView.vue` 第 122–143 行自寫 | `a-select`（`show-search`、`:options`、`:filter-option`、`#notFoundContent`） | 使用者說「下拉應該是搜尋才對，因為如果上百種」（`chat1.md` 第 1145 行）→ `show-search` 必開 |
| 原生 `<select>` | 字典匯入欄位對應 | `DictionaryView.vue` 第 214 行原生 select | `a-select` | 與其他控制項同高（32） |
| 滑桿：`input[type=range]` + `accent-color` | Temperature | `AiView.vue` 第 182 行 | `a-slider`（`:min`、`:max`、`:tooltip`） | |
| 文字輸入：`height:32/34/36px;border:1px solid #ddd6ca` | 搜尋、Base URL、API key、名稱 | `.input` class | `a-input` / `a-input-search` / `a-input-password`（API key） | 高度統一 32（34、36 為刻度外）；API key 用 `a-input-password` |
| 多行輸入 | 貼文區、Prompt | `.textarea` | `a-textarea`（`:auto-size` 或撐滿） | |
| 表格：表頭列 + flex 資料列 + `border-bottom:1px solid #ebe5db` + 內捲 | 題庫、字典、排行榜、成績比較 | flex div 列 | `a-table`（`:columns`、`:scroll="{ y }"`、`:pagination`、`#bodyCell`） | 使用者要求「表頭與分頁固定，資料列區塊內部捲動」（`chat1.md` 第 300 行）→ `scroll.y` 依容器高度計算；窄版改雙行列（第 1237 行）用 `#bodyCell` 自訂 |
| 分頁 | 題庫 | `a-pagination` | `a-pagination` 或 `a-table :pagination` | |
| 兩層分類樹：展開箭頭 `▸` + 行內改名 + `×` 刪除 + 虛線縮排 | 題庫 → 分類管理 | 自寫 | `a-tree`（`#title` slot 放改名輸入與刪除鈕、`show-line`） | 刪除 **MUST** 包 `a-popconfirm`（原型無確認） |
| 膠囊單選：圓角 100px、選中填分類色 | Topic、所屬大項、Prompt 分頁 | `.pill` | `a-checkable-tag`（受控單選）或 `a-radio-group` + `button-style="solid"` | 可及性：`role="radiogroup"`（`elf-ui-pattern` references §3） |
| DS `TagColorful color="volcano"` 等 | 分類標籤 | `a-tag` | `a-tag :color` | antd 預設色名（`volcano`、`lime`…）屬 antd 色票，不需 token；自訂 hex **MUST NOT** |
| DS `BadgeStatus` | 同步 / 離線狀態 | `a-badge` | `a-badge :status :text` | 可點擊時外層用 `button` |
| 進度條：`height:8px;border-radius:100px` 軌道 + 主色填滿 | 狀態列、熟練度、錯字簿、比較條 | `.bar > i` | `a-progress`（`:show-info="false"`、`:stroke-color`、`size="small"`） | 顏色來自 token；雙條比較（本期 / 上期）可保留自訂，列入自訂元件表 |
| 統計卡：小標 + 大數字 + 說明 | 統計摘要、Coach 指標、結果頁 | div | `a-statistic`（`:value`、`#suffix`）放在卡片中 | 數字加 `.nums` |
| 白卡：`background:#fff;border-radius:8px;padding:16px 20px;box-shadow:…0.03` | 全站 | `.card` | `a-card :bordered="false"` 或 `.card` primitive（待確認） | 同一專案只選一種 |
| 頭像縮寫圓 | 排行榜 | div | `a-avatar`（`size="small"`） | 背景色：分類色票（待確認） |
| 側欄：深色、群組標題、圖示 + 文字 + 徽章、收合 72/216、釘選 | 殼層 | `AppSider.vue` 自寫 | `a-layout-sider`（`:collapsed`、`:collapsed-width="72"`、`:width="216"`）+ `a-menu`（`mode="inline"`、`theme="dark"`、item group）或 `elf-ui-pattern` references §4 `AppNav.vue` | 收合時群組標題改分隔線、項目 tooltip；目前頁 `aria-current="page"` |
| 空狀態文字（`No mistakes this round.`） | 結果頁 | 文字 | `a-empty`（`:image="Empty.PRESENTED_IMAGE_SIMPLE"`、`description`） | DS readme：空狀態用內建兩款插圖 |
| 提示條：主色淡底 + 小標 | 3 次錯誤提示 | div | `a-alert type="info" show-icon`（info = primary，見 tokens §1） | 需要 `role="status"`（`a-alert` 內建） |
| 快捷鍵標記：等寬小字 + 淺底 + 內框線 | 設定 → 快捷鍵 | span | `a-typography-text keyboard` | |
| 圖示：DS `Icon name="Thunderbolt3"` 等 | 全站 | `@ant-design/icons-vue` | `@ant-design/icons-vue`（`ThunderboltOutlined`…） | 後綴 `3` = Outlined（readme）；裝飾用 `aria-hidden="true"` |
| `×` / `＋` / `▸` 字元 | 關閉、新增、展開 | 字元 | `CloseOutlined` / `PlusOutlined` / 元件內建圖示 | 不以字元當圖示（DS readme） |

## 2. 必須自訂的領域元件（列入 SPEC.md 自訂元件表）

| 元件 | 原因 | a11y 契約 |
| --- | --- | --- |
| 打字文字區（逐字上色、游標、組字氣泡、自動置中捲動） | 無對應 antd 元件 | 文字區 `aria-live="off"`；隱藏 IME 輸入框有 `aria-label`；focus 持有者模式（`elf-ui-pattern` references §6） |
| 虛擬鍵盤 / 熱力圖鍵盤 | 領域專屬 | 純裝飾 `aria-hidden="true"`，資訊另以文字提供（下一鍵、手指） |
| 趨勢折線圖 | 圖表函式庫未定（待確認） | 提供文字摘要或 `role="img"` + `aria-label` |
| 倒數覆蓋層 | 領域專屬 | `role="status"` 讀出秒數 |

## 3. 選擇規則

1. 語意優先於外觀：外觀像分段、行為是切換內容面板 → `a-tabs`；設定一個值 → `a-segmented`。
2. antd 元件外觀與原型不同時，先用 `theme.token` / `theme.components` 調；調不到 → SPEC.md 記錄差異並詢問，**MUST NOT** 用 CSS 覆寫 `.ant-*` 內部 class。
3. 原型因 DS 缺元件而手刻（Table、Card、Upload、Slider、Tree、Avatar、Form…）→ 一律用 antd 同名元件。
