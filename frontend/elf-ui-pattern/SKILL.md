---
name: elf-ui-pattern
description: |
  Elf Express UI 元件設計模式與可用性規範（元件 API、a11y / ARIA、鍵盤操作與 focus、表單、design token、
  loading / empty / error 三態、響應式版面）。
  當任務涉及：設計或修改可重用元件、按鈕 / 開關 / 導覽 / 對話框、ARIA 屬性、鍵盤快捷鍵、focus 管理、
  表單欄位與驗證訊息、顏色 / 字型 / 陰影 token、非同步資料的載入 / 空 / 錯誤畫面、斷點或版面縮放、
  ant-design-vue 元件（a-modal / a-popconfirm / a-spin / a-empty / a-result）選用時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express UI 元件設計規範

> 事實來源：參考專案 `TypingTrainer/apps`（`styles/app.css` token、`ToggleSwitch.vue`、`AppSider.vue`、
> `SettingsView.vue` 更新狀態機、`useGridLayout`、`PracticeView.vue` focus 管理）。參考專案的 a11y 缺口在
> 「常見錯誤」列為反例。完整範本：[`references/components.md`](references/components.md)。
> 團隊 UI 函式庫：**ant-design-vue 4**（已決議；版本見 `elf-stack`，註冊方式見 `elf-vue` 規則 47）。

相關 skill：`elf-vue`（SFC / store 寫法）、`elf-i18n`（所有文案、IME 輸入）、`elf-e2e`（focus / 鍵盤行為的測試）、
`elf-unit`（元件測試）。通用 UI 美學參考第三方 skill `frontend/design/*`，本檔只規定團隊硬規則。

---

## 1. 何時使用

- 新增或修改 `src/components/` 的可重用元件
- 任何可點擊、可輸入、可切換的 UI（按鈕、開關、分段選擇、導覽、對話框、表單）
- 顯示非同步資料的畫面（清單、卡片、統計）
- 新增顏色、字級、陰影、間距或調整版面斷點

---

## 2. 固定規則

### 2.1 元件 API（MUST）

1. **MUST** 區分兩類元件：
   - **通用元件**（`components/` 內一般元件）：只透過 props / `defineModel` / emits / slots 溝通，**MUST NOT** 讀寫 Pinia store、router、API。
   - **殼層元件**（`AppSider`、`TopBar`、`StatusBar` 等 `App*` / 殼層）：可讀 store 與 router，只能在 `App.vue` 使用。
2. **MUST** 變體用字面值聯集 prop：`size?: 'sm' | 'md'`、`variant?: 'primary' | 'default' | 'danger'`；**MUST NOT** 用多個 boolean（`isSmall`、`isLarge`）。
3. **MUST** 布林 prop 為選填且預設 `false`（`disabled?: boolean`），命名不加 `is` 前綴。
4. **MUST** 內容用 slot、資料用 prop：可放任意標記的區塊（標題列右側動作、空狀態插圖）用具名 slot；文字 / 數字用 prop。
5. **MUST** emits 名稱用動詞原形小寫（`select`、`close`、`retry`）；payload 為單一值或物件，**MUST NOT** 傳 DOM Event 給父層。
6. **MUST** 元件根元素接受外部 `class`（Vue 預設 attribute 透傳），**MUST NOT** 設定 `inheritAttrs: false` 除非同時手動 `v-bind="$attrs"` 到可互動元素。

### 2.2 語意與 ARIA（MUST）

7. **MUST** 先用原生元素：可點擊 → `<button type="button">`；換頁 → `<RouterLink>`；輸入 → `<input>` / `<textarea>` / `<select>`。**MUST NOT** 在 `<div>` / `<span>` 上掛 `@click` 當按鈕。
8. **MUST** 自訂控制項加正確 role 與狀態：開關 `role="switch"` + `:aria-checked`；分段選擇 `role="radiogroup"` + 子項 `role="radio"` + `:aria-checked`；分頁 `role="tablist"/"tab"` + `:aria-selected`。
9. **MUST** 只有圖示的按鈕加 `:aria-label="t('...')"`（`title` 不算可及名稱）；裝飾性圖示加 `aria-hidden="true"`。
10. **MUST** 視覺文字無法表達完整意義時，用 `aria-label` 補足（參考專案：畫面顯示 `v0.1.9`，可及名稱為「軟體更新 v0.1.9」）。
11. **MUST** 導覽清單用 `<nav>` 包住，目前頁面項目加 `aria-current="page"`。
12. **MUST** 每個頁面有一個 `<h1>`（可視覺隱藏），區塊標題依序 `h2` → `h3`，不跳級。
13. **MUST** 所有 `aria-label`、`placeholder`、`title`、`alt` 文字走 i18n（見 `elf-i18n`）。

### 2.3 鍵盤與 focus（MUST）

14. **MUST** 所有互動元素可用 Tab 到達、Enter / Space 觸發；自訂元件若非原生 `<button>`，**MUST** 加 `tabindex="0"` 與 `@keydown.enter` / `@keydown.space.prevent`。
15. **MUST** 保留可見 focus 樣式：用 `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }`。**MUST NOT** 寫 `outline: none` 而不提供替代。
16. **MUST** 全域快捷鍵只在 `App.vue`（或 `useShortcuts` composable 於 `App.vue` 呼叫）註冊於 `document`，`onBeforeUnmount` 移除；只用 `Ctrl/⌘ + 鍵` 組合，觸發時 `preventDefault()`。
17. **MUST** 快捷鍵與 Enter 送出處理先檢查 `e.isComposing`，組字中一律 return（避免中文輸入法選字時的 Enter 被當成送出）。
18. **MUST** 在畫面上提示快捷鍵（參考專案狀態列：`Ctrl+Enter 開始 · Ctrl+N 換一篇`），提示文字走 i18n。
19. **MUST** 若某元素必須持有 focus（例：打字練習的隱藏 IME 欄位），任何會搶走 focus 的操作（點工具列按鈕、換題、重置）結束後以 `nextTick(() => el.value?.focus())` 還回；此行為 **MUST** 由 e2e 測試覆蓋（jsdom 觀察不到 focus）。
20. **MUST** 對話框用 ant-design-vue 的 `a-modal`（`v-model:open`），開啟時 focus 移入、Esc 關閉、關閉後 focus 回到觸發按鈕（`a-modal` 預設行為）；**MUST NOT** 設 `:keyboard="false"` 或 `:focus-trigger-after-close="false"`，**MUST NOT** 自寫對話框或 focus trap（範本見 references §10.2）。

### 2.4 表單（MUST）

21. **MUST** 每個輸入都有 `<label>`（`for` / `id` 配對或包住 input）；視覺上不顯示時用 `.visually-hidden` 類別，**MUST NOT** 只靠 `placeholder`。
22. **MUST** 驗證錯誤：輸入加 `:aria-invalid="!!error"` 與 `:aria-describedby="errorId"`，錯誤訊息元素 `:id="errorId"` 並放在輸入下方。
23. **MUST** 送出中：送出按鈕 `:disabled="pending"`、表單 `:aria-busy="pending"`；重複送出直接 return。
24. **MUST** 文字輸入用 `v-model.trim`（密碼除外）；數字用 `type="number"` + `v-model.number`。
25. **MUST NOT** 在由 composition 事件驅動的「非受控」輸入欄位綁定 `:value` / `v-model`（會清掉輸入法組字緩衝）；詳見 `elf-i18n` 的 IME 規則。
26. **MUST** 危險操作（刪除、覆蓋）需二次確認：單筆用 `a-popconfirm`（確認鈕 `danger`），批次 / 影響範圍大用 `Modal.confirm({ okType: 'danger' })`；**MUST NOT** 點一下直接執行（範本見 references §10.1）。

### 2.5 Design token（MUST）

27. **MUST** 顏色、字型、陰影定義在 `src/styles/app.css` 的 `:root` CSS 變數，命名固定：

| 類別 | token |
| --- | --- |
| 背景 | `--bg`（頁面）、`--surface`（卡片）、`--sider`（側欄） |
| 文字 | `--text`（主）、`--text-2`（次）、`--text-3`（說明）、`--muted`（停用） |
| 線條 | `--line`、`--line-2` |
| 控制項 | `--seg-bg`（分段選擇底色） |
| 品牌 | `--primary`、`--primary-hover`、`--primary-active` |
| 語意 | `--success`、`--warning`、`--error` |
| 陰影 | `--card-shadow`、`--overlay-shadow`、`--seg-shadow` |
| 字型 | `--font`、`--font-mono` |

28. **MUST** 元件樣式只用 `var(--token)`；**MUST NOT** 在 `.vue` 的 `<style>`、`:style` 或 TS 寫十六進位色碼 / `rgb()`（半透明陰影除外，且應優先抽成 token）。
29. **MUST** ant-design-vue 主題（`<a-config-provider :theme="theme">` 的 `theme.token`）值集中在 `src/styles/theme.ts`，與 `app.css` 同值，並有同步測試 `theme.test.ts`（範本見 references §7）。**MUST NOT** 在 `App.vue` 內聯另一份色碼。
30. **MUST** 數字欄位（計數、百分比、計時）加 `.nums`（`font-variant-numeric: tabular-nums`），避免跳動。
31. **MUST** 規則 27 表格是**封閉清單**：`app.css` `:root` 只能出現表內名稱，**MUST NOT** 在元件或 `app.css` 自創 token。確實需要新 token 時，**MUST** 在同一個 PR：(1) 更新本 skill 規則 27 表格（PR 標註需 review）；(2) 加入 `app.css`；(3) 若 ant-design-vue 也要用該色，加入 `theme.ts` 的 `TOKENS` 與 `CSS_VAR_OF`，讓 `theme.test.ts` 自動檢查同步。

### 2.6 Loading / Empty / Error 三態（MUST）

32. **MUST** 非同步資料用狀態聯集 `'idle' | 'loading' | 'success' | 'error'`（在 store，見 `elf-vue`），**MUST NOT** 用多個互相矛盾的 boolean。
33. **MUST** template 依序判斷：首次 `loading`（尚無資料）→ `error` → `empty` → 內容（`v-if` / `v-else-if` / `v-else` 串接），同一時間只顯示一種；已有資料時的 `loading` 落在「內容」分支並疊加指示（規則 34）。
34. **MUST** 非同步區塊用 `AsyncBlock.vue`（references §1）呈現三態。loading：容器 `:aria-busy="true"`；首次載入顯示 `a-spin` + `role="status"` 文字；資料已存在時的重新載入 **MUST NOT** 清空畫面，改用 `<a-spin :spinning="status === 'loading'">` 包住既有內容（`AsyncBlock` 最後一個分支）。
35. **MUST** error：`a-result status="error"` + `role="alert"`，顯示 i18n 訊息 + 原因 + 「重試」`a-button`（emit `retry` 或呼叫 `load({ force: true })`）。
36. **MUST** empty：`a-empty`，`description` 說明「為什麼是空的」、預設 slot 放下一步動作（例：「尚無題庫」+「新增文本」按鈕；篩選無結果 +「清除搜尋」）；**MUST NOT** 只顯示空白或「無資料」。用 `AsyncBlock` 時傳 `empty-text` 並填 `#empty-action`。
37. **MUST** 按鈕觸發的動作（檢查更新、儲存）以狀態機驅動按鈕文字與 `disabled`（參考 `SettingsView.vue`：`idle / checking / latest / found / installing / done / error`）。
38. mock 模式下 API **MUST** 保持非同步延遲（`delay()`，預設 120ms），確保 loading 畫面在開發時看得到。

### 2.7 響應式版面（MUST）

39. **MUST** 殼層固定 `height: 100vh`：頂列 48px、內容區 `flex: 1; overflow-y: auto`、狀態列 48px；捲動只發生在內容區或卡片內部。
40. **MUST** flex / grid 中會捲動或縮小的子元素加 `min-width: 0; min-height: 0`（否則內容撐破容器、捲動失效）。
41. **MUST** 雙欄頁面在**內容區**寬度 < 620px 時改為單欄（參考專案 `useGridLayout` 的門檻）。優先用 CSS `@container` / `@media`；只有需要算出實際像素高度時（例：鍵盤高度 = 欄高 − 工具列高）才用 `useElementSize`（ResizeObserver）。
42. **MUST** 長文字加 `.ell`（單行省略）或允許換行，**MUST NOT** 讓文字溢出卡片。
43. **MUST** 最小支援視窗：寬 360px、高 540px 時所有功能可操作（值待確認，見第 6 節）。

### 2.8 ant-design-vue 元件對照（MUST，已決議）

44. **MUST** 下列情境使用指定的 ant-design-vue 4 元件，**MUST NOT** 自寫同功能元件：

| 情境 | 元件 | 對應規則 |
| --- | --- | --- |
| 對話框 / 表單對話框 | `a-modal`（`v-model:open`） | 20 |
| 單筆危險操作確認 | `a-popconfirm`（`:ok-button-props="{ danger: true }"`） | 26 |
| 批次 / 大範圍危險操作確認 | `Modal.confirm({ okType: 'danger' })` | 26 |
| 載入中 / 重新載入 | `a-spin`（重新載入時包住內容） | 34 |
| 空狀態 | `a-empty`（`description` + 預設 slot 動作） | 36 |
| 載入失敗 | `a-result status="error"`（`#extra` 放重試） | 35 |
| 按鈕 / 圖示按鈕 | `a-button`（圖示按鈕加 `:aria-label`） | 7、9 |
| 開關 | `a-switch`（`v-model:checked`） | 8 |
| 分段選擇 | `a-segmented`（`v-model:value`） | 8 |
| 主題 | `a-config-provider`（`:theme` 來自 `styles/theme.ts`） | 29 |

45. 函式庫元件無法滿足時（產品專屬外觀、需要 radio 語意的自訂內容等）才可自寫，且 **MUST** 照 references 的自寫範本（`ToggleSwitch`、`SegmentedControl`、`FormField`）達成同等 a11y，並在 PR 說明為何不用函式庫元件。新用到的 `a-*` 元件 **MUST** 加入 `src/plugins/antd.ts`（見 `elf-vue`）。
46. SoybeanAdmin / NaiveUI 系既有 repo（例 `platform.client`）為歷史例外：在該 repo 內**以該 repo 的 CLAUDE.md 為準**（NCard、Modal `preset="card"` 等規格），本節對照表不適用。

---

## 3. 標準範本

完整範本在 [`references/components.md`](references/components.md)：
- `AsyncBlock.vue` — 三態容器（`a-spin` / `a-result` / `a-empty` / default slot）
- `FormField.vue` — label + 錯誤訊息 + aria 綁定
- `SegmentedControl.vue` — `role="radiogroup"` + 方向鍵
- `AppNav.vue` — `<nav>` + `RouterLink` + `aria-current`
- `useShortcuts.ts` — 全域快捷鍵（含 `isComposing` 防護）與測試
- Focus 持有者模式（IME 欄位）
- `SplitLayout.vue` — 以 `@container` 依內容區寬度切換雙欄 / 單欄
- `styles/app.css` token 區塊、`styles/theme.ts`、`theme.test.ts` 同步測試
- `a-popconfirm` 危險操作、`a-modal` 表單對話框

### 3.1 三態 template 骨架

一律透過 `AsyncBlock`（完整原始碼見 references §1）：

```vue
<template>
  <section>
    <AsyncBlock
      :status="status"
      :empty="!items.length"
      :error="errorMessage"
      :empty-text="t('library.empty')"
      @retry="store.load({ force: true })"
    >
      <template #empty-action>
        <a-button type="primary" @click="emit('create')">{{ t('library.create') }}</a-button>
      </template>

      <ul class="list">
        <li v-for="item in items" :key="item.id">{{ item.title }}</li>
      </ul>
    </AsyncBlock>
  </section>
</template>
```

`AsyncBlock` 內部順序固定為 首次載入（`a-spin`）→ 錯誤（`a-result`）→ 空（`a-empty`）→ 內容（重新載入時以 `a-spin :spinning` 包住，不清空）。

### 3.2 圖示按鈕

```vue
<a-button type="text" :aria-label="t('shell.toggleSidebar')" @click="settings.toggleSider()">
  <template #icon><MenuFoldOutlined aria-hidden="true" /></template>
</a-button>
```

### 3.3 必要全域樣式（`src/styles/app.css`）

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.nums {
  font-variant-numeric: tabular-nums;
}
.ell {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

---

## 4. 檢查清單

- [ ] 所有可點擊元素是 `<button>` / `<RouterLink>` / `<a>`，沒有 `div @click`
- [ ] 圖示按鈕有 `aria-label`；裝飾圖示有 `aria-hidden="true"`
- [ ] 自訂開關 / 分段 / 分頁有正確 `role` 與 `aria-checked` / `aria-selected`
- [ ] Tab 可走完整頁、Enter / Space 可觸發、focus 外框可見
- [ ] 快捷鍵在 `App.vue` 註冊、會移除、檢查 `isComposing`、畫面上有提示
- [ ] 每個輸入有 label；錯誤訊息以 `aria-describedby` 連結；送出中按鈕 disabled
- [ ] 非同步畫面經 `AsyncBlock`：四種狀態皆有、error 有重試、重新載入不清空、empty 有原因 + 下一步
- [ ] 對話框用 `a-modal`、危險操作用 `a-popconfirm` / `Modal.confirm`；沒有自寫 Modal / spinner / 空狀態
- [ ] `app.css` 只有規則 27 表內的 token 名稱
- [ ] `.vue` 內沒有色碼；新顏色已加到 `app.css` token 與 `theme.ts`，`theme.test.ts` 通過
- [ ] 內容區寬 < 620px 時雙欄變單欄；視窗 360×540 可操作
- [ ] 所有可見文字與 aria 文字走 i18n
- [ ] focus 必須停留的元素有 e2e 測試

---

## 5. 常見錯誤

| 錯誤寫法（多數出自參考專案） | 正確寫法 | 原因 |
| --- | --- | --- |
| `<span role="switch" :aria-checked @click>` | `<button type="button" role="switch" :aria-checked>` | span 無法 Tab 到達、無法用鍵盤切換 |
| 導覽項 `<div class="nav-item" @click="go(id)">` | `<nav>` + `<RouterLink :to :aria-current>` | 鍵盤不可用、螢幕閱讀器不知道是連結 |
| 收合側欄只用 `:title` 當名稱 | `:aria-label` + `title` | `title` 不是可靠的可及名稱 |
| `:style="{ color: '#d97757' }"`、`bg: '#f5f1ea'` 寫在 computed | `var(--primary)`、`var(--seg-bg)`（皆為規則 27 表內 token） | 換主題要改 N 處，易不一致 |
| `App.vue` 內聯一份 AntD theme 色碼、`app.css` 再一份 | 集中 `styles/theme.ts` + 同步測試 | 兩份來源必然漂移 |
| `if (loading) ... if (!list.length) ...` 平行判斷 | `AsyncBlock`（內部 `v-if` / `v-else-if` 串接） | 載入中同時出現「無資料」 |
| 重新載入時 `v-if="loading"` 把清單換成 spinner | `<a-spin :spinning>` 包住既有清單 | 畫面閃爍、捲動位置遺失 |
| 空狀態只寫「無資料」 | `a-empty` 說明原因 + 下一步按鈕 | 使用者不知道能做什麼 |
| `div` + `position: fixed` 自寫對話框 | `a-modal` | 缺 focus 移入 / Esc / focus 還原 |
| 刪除按鈕直接呼叫 API | `a-popconfirm` 包住按鈕 | 誤觸無法挽回 |
| 在元件 `<style>` 自創 `--my-color` | 用規則 27 表內 token；真的需要時依規則 31 擴表 | token 清單失控 |
| 錯誤只 `console.error` | `role="alert"` + 訊息 + 重試 | 使用者不知道失敗 |
| `outline: none` | `:focus-visible` 外框 | 鍵盤使用者迷失位置 |
| Enter 送出未檢查 `isComposing` | `if (e.isComposing) return` | 注音 / 倉頡選字的 Enter 誤送出 |
| 點工具列按鈕後 IME 欄位失焦 | 動作後 `nextTick` 還 focus + e2e 測試 | 輸入法無處組字，無法打中文 |
| flex 子元素沒有 `min-height: 0` | 加上 `min-height: 0` | 內部捲動失效、撐破 100vh |
| 用 JS 監聽 resize 決定所有斷點 | CSS `@container` / `@media`，JS 只量高度 | 多餘重算、SSR / 測試不穩 |

---

## 6. 待確認

1. **斷點值**：除 620px（內容區雙欄門檻，來自參考專案）外，團隊標準斷點（手機 / 平板 / 桌機）未定；最小支援視窗 360×540 為暫定。
2. **品牌色 token 值**：參考專案色票（`--primary: #d97757` 等）為該產品專屬；Elf Express 共用品牌色 / 深色模式 token 是否存在待定（token **名稱**已固定，見規則 27）。
3. **a11y 合規等級**：是否以 WCAG 2.2 AA 為驗收標準、是否在 CI 加 axe 檢查（見 `elf-e2e`）待定。
4. **對比度**：參考專案 `--text-3: #8b877e` 於 `--bg: #faf9f5` 上試算約 3.4:1，未達 WCAG AA 小字 4.5:1。團隊 token 定案時是否調整待定；在定案前，`--text-3` 只用於 ≥ 18px 或非必要資訊。

已決議、不再列入待確認：UI 函式庫 = ant-design-vue 4（對照表見 2.8）；SoybeanAdmin / NaiveUI repo 為歷史例外、依該 repo CLAUDE.md（規則 46），其 NCard / Modal 規格不提升為全團隊規範。
