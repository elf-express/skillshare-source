---
name: elf-i18n
description: |
  Elf Express 前端多語系（vue-i18n）與中文輸入法（IME）規範：i18n 初始化、locale JSON 結構、key 命名、
  `useI18n()` 用法、zh-TW / en 文案、語言切換、缺漏 key 偵測、i18n-ally 設定、IME 組字欄位處理、ant-design-vue 元件語系。
  當任務涉及：新增或修改 UI 文字、`t()` / `$t()`、`src/i18n/`、locale JSON、語言切換器、日期 / 數字格式、
  i18n-ally 警告、翻譯缺漏、或處理中文輸入（composition 事件、注音 / 倉頡輸入、Enter 送出）時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express i18n 與 IME 規範

> 事實來源：參考專案 `TypingTrainer/apps/src/i18n/`（vue-i18n 10、`legacy: false`、`en` / `zh-TW` / `zh-CN` JSON）、
> `docs/architecture.md`（copy vs data）、`CLAUDE.md` 與 `.github/workflows/claude-review.yml`（IME 規則）。
> 完整範本：[`references/setup.md`](references/setup.md)。

相關 skill：
- `frontend/vue/vue3-i18n-debugging`（第三方）— i18n-ally 誤報、worktree 重複警告、`this.$t` 錯誤的**除錯流程**；本檔不重複。
- `frontend/i18n-localization`（第三方）— 通用 i18n 觀念、RTL；本檔只規定團隊硬規則。
- `elf-vue`（SFC / store 寫法）、`elf-ui-pattern`（aria 文字、表單）、`elf-e2e`（IME / focus 測試）、`elf-api-contract`（API 資料的語系參數）。

---

## 1. 何時使用

- 畫面上新增 / 修改任何使用者看得到的文字（含 `aria-label`、`placeholder`、`title`、toast、錯誤訊息）
- 建立或修改 `src/i18n/index.ts`、`src/i18n/locales/*.json`
- 語言切換器、`<html lang>`、日期 / 數字 / 百分比顯示
- 撰寫處理中文輸入的欄位或 `keydown` / Enter 處理
- 出現 i18n-ally 警告或畫面顯示原始 key

---

## 2. 固定規則

### 2.1 設定（MUST）

1. **MUST** 使用 `vue-i18n` Composition 模式：`createI18n({ legacy: false, ... })`，實例放在 `src/i18n/index.ts` 並具名匯出 `i18n`。
2. **MUST** 語系代碼用 BCP 47，大小寫固定：`en`、`zh-TW`、`zh-CN`；locale 檔名與代碼完全一致（`zh-TW.json`）。
3. **MUST** 以 `export const LOCALES = [...] as const` 定義支援清單，`type Locale = (typeof LOCALES)[number]`；其他地方 **MUST NOT** 寫死語系字串陣列。
4. **MUST** `fallbackLocale: 'en'`，且 `en.json` 為**來源語系**（source of truth）：新 key 先加 `en.json`，再補其他語系。缺翻譯時畫面顯示英文，而不是原始 key。
5. **MUST** 初始語系：`localStorage` 已存值且在 `LOCALES` 內 → 使用；否則用 `DEFAULT_LOCALE`（值見待確認 #1）。`localStorage` 存取 **MUST** 包 `try/catch`（無痕視窗會丟例外）。
6. **MUST** 切換語系只透過 `setLocale(locale)`：同時設定 `i18n.global.locale.value`、`document.documentElement.lang`、寫入 `localStorage`。**MUST** 在啟動時也設定一次 `<html lang>`。
7. **MUST** 設定頁的語言選擇器是**唯一寫入者**：settings store 持有 `uiLang`，`watch(uiLang, setLocale)`；其他元件 **MUST NOT** 直接改 `i18n.global.locale`。
8. **MUST** 開發環境開啟缺漏警告（`missingWarn` / `fallbackWarn` 在 `import.meta.env.DEV` 為 true），正式環境關閉。

### 2.2 Locale 檔案結構（MUST）

9. **MUST** 位置：`src/i18n/locales/<locale>.json`，巢狀 JSON；**MUST NOT** 使用扁平 `"a.b.c"` 字串 key 或 YAML。
10. **MUST** 第一層為功能命名空間：`common`（跨頁共用：取消 / 儲存 / 關閉 / 載入中）、`nav`、`shell`（殼層）、`page`（頁首標題 / 副標）、`status`、`form`，其餘每個 view 一個（`practice`、`library`、`settings`…）。
11. **MUST** key 為語意名稱、camelCase、最多 3 層：`library.import.title`、`settings.update.checking`。**MUST NOT** 用中文或英文原句當 key（`"儲存"`、`"Save changes"`）。
12. **MUST** 所有語系檔 key 集合完全相同、每個 key 的插值參數相同；由 `locales.test.ts` 強制（範本見 references）。
13. **MUST** 插值用具名參數 `{name}`：`"streak": "連續 {days} 天"`。**MUST NOT** 在程式中串接翻譯片段（`t('a') + value + t('b')`）— 語序因語言而異，整句放一個 key。
14. **MUST** 英文複數用 vue-i18n 管線語法 `"items": "no items | one item | {count} items"`，呼叫 `t('library.items', count)`；中文同一個 key 可只寫一種形式。
15. **MUST** JSON 由 Prettier 格式化（2 空格），key 順序：新增 key 放在同命名空間末尾，三個語系檔順序一致。

### 2.3 使用方式（MUST）

16. **MUST** 在 `<script setup>` 用 `const { t } = useI18n()`，template 也用同一個 `t(...)`。**MUST NOT** 使用 `this.$t`（`<script setup>` 沒有 `this`）；新程式 **MUST NOT** 在 template 用 `$t`（統一 `t`）。
17. **MUST** 翻譯在元件內做。store / `lib/` / `api/` **MUST** 回傳 key（例：`statusKey: 'ready'`、`speedUnitKey: 'wpm'`），**MUST NOT** 回傳翻譯後字串 — store 不會因切換語系重算。
18. 非元件情境確實需要翻譯（例：router guard 設定 `document.title`）時，**MUST** 用 `i18n.global.t(...)`，且在語系切換時重新計算。
19. **MUST** 動態 key 用「完整 key 對照表」而非字串拼接：`const STATUS_LABEL: Record<Status, string> = { ready: 'status.ready', running: 'status.running' }` → `t(STATUS_LABEL[s])`。**MUST NOT** 以任何形式組 key：`` t(`status.${s}`) ``、`t('status.' + s)`、`t(prefix + key)` 一律禁止（拼出來的 key i18n-ally 與 grep 找不到、typo 不會報錯；改用 `Record<Status, string>` 對照表時，少一格 `vue-tsc` 就會直接報錯）。清單資料（導覽、選項）帶完整 key 欄位（`labelKey: 'nav.practice'`）。此規則無例外，`elf-vue` / `elf-ui-pattern` 範本皆遵守。
20. **MUST** 所有 aria 文字、`placeholder`、`title`、`alt`、`document.title` 走 i18n。
21. 快捷鍵、單位（`WPM`、`CPM`）、品牌名稱也 **MUST** 放在 locale 檔（可同值），以便日後調整。

### 2.4 Copy 與 Data 的分界（MUST）

22. **Copy**（出貨的 UI 文字、內建選項名稱）**MUST** 放在前端 locale JSON。
23. **Data**（使用者建立的分類 / 文字、後端資料）**MUST NOT** 放 locale JSON；原樣顯示使用者輸入的內容。內建資料列若需翻譯，由後端帶 `i18nKey` 欄位，前端 `t(item.i18nKey)`；否則顯示 `item.name`。
24. 後端提供的目錄型資料（說明文字、提示詞名稱）**MUST** 以 API 帶語系參數取得（參考專案：`GET /prompts?locale=zh-TW`），格式依 `elf-api-contract`。

### 2.5 zh-TW / en 文案（MUST）

25. **MUST** zh-TW 使用台灣用語：儲存（非保存）、設定（非設置）、資料（非數據，統計類「數據」除外依產品決定）、檔案（非文件）、預設（非默認）、登入（非登錄）、網路（非網絡）、程式（非程序）。
26. **MUST** zh-TW 使用全形標點（，。：；！？「」（）），中文與英文 / 數字之間加半形空格（`AI 設定`、`連續 {days} 天`）。
27. **MUST** en 使用句首大寫（sentence case）：`"Pin sidebar"`，不用 Title Case；按鈕為動詞開頭。
28. **MUST NOT** 以機器翻譯直接覆蓋既有人工翻譯；zh-CN 由 zh-TW 轉換時須經人工檢查（工具見待確認 #3）。

### 2.6 中文輸入法（IME）（MUST）

29. **MUST NOT** 在由 `compositionstart` / `compositionupdate` / `compositionend` 驅動的非受控輸入欄位上綁定 `v-model` 或 `:value`。重新渲染時 Vue 會寫回 `value`，**清掉瀏覽器的組字緩衝**，使用者打到一半的字會消失。
30. **MUST** 非受控 IME 欄位的處理順序：
    - `compositionstart` → 標記 `composing = true`
    - `compositionupdate` → 只更新「組字中」顯示（例：注音泡泡），不比對、不送出
    - `compositionend` → `composing = false`，讀 `(e.target as HTMLInputElement).value` 並處理
    - `input` → `composing` 為 true 時直接 return
31. **MUST** 需要清空欄位時，只在 `!composing` 時以 `el.value = ''` 直接操作 DOM。
32. **MUST** 任何 `keydown` 的 Enter / 快捷鍵處理先 `if (e.isComposing) return`（選字的 Enter 不能觸發送出）。
33. 一般表單的 `<input v-model>` 可照常使用 — Vue 的 `v-model` 本身會等 `compositionend` 才更新；規則 29 只針對自行處理 composition 事件的欄位。
34. **MUST** 中文模式下 IME 欄位全程持有 focus（見 `elf-ui-pattern` 規則 19）；英文練習直接讀 `keydown`，不經 IME 欄位。
35. **MUST** IME 與 focus 行為以 Playwright 測試（派發 `CompositionEvent`），jsdom 單元測試不能證明其正確。

### 2.7 測試（MUST）

36. **MUST** 有 `src/i18n/locales.test.ts`：比對所有語系 key 集合與插值參數，缺一個即失敗。
37. **MUST** 元件單元測試以 `en` 斷言（`i18n.global.locale.value = 'en'`）。
38. **MUST** e2e 斷言英文文案：全新 Playwright context 無 localStorage，初始語系為預設值；**MUST NOT** 用「某中文字串不存在」當斷言 — 在英文畫面下它永遠成立（參考專案曾有兩個此類斷言無法失敗）。若預設語系改為 zh-TW，e2e 須先 `addInitScript` 寫入語系。

### 2.8 ant-design-vue 元件語系（MUST）

39. **MUST** ant-design-vue 內建文字由 `<a-config-provider :locale>` 提供，值取自完整對照表 `ANTD_LOCALE: Record<Locale, AntdLocale>`，並隨 settings store 的 `uiLang` 切換（範本見 references §9）。**MUST NOT** 讓函式庫停在預設英文而頁面是中文。
40. **MUST** `setLocale` 同時切換 dayjs 語系（ant-design-vue 4 的日期元件使用 dayjs）；新增語系時 `ANTD_LOCALE`、dayjs 對照、`LOCALES` 三處同 PR 更新。

---

## 3. 標準範本

完整範本在 [`references/setup.md`](references/setup.md)：`i18n/index.ts`、三個 locale JSON 片段、settings store 接線、
語言選擇器、`locales.test.ts`、`.vscode/settings.json`（i18n-ally）、IME 欄位完整範例、e2e IME 測試、ant-design-vue / dayjs 語系同步。

### 3.1 元件中使用

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/stores/session'

type SpeedUnit = 'wpm' | 'cpm'
const UNIT_LABEL: Record<SpeedUnit, string> = { wpm: 'status.wpm', cpm: 'status.cpm' }

const { t } = useI18n()
const session = useSessionStore()

const unitLabel = computed(() => t(UNIT_LABEL[session.speedUnit]))
</script>

<template>
  <span class="label">{{ unitLabel }}</span>
  <span class="value nums">{{ session.speed }}</span>
  <span>{{ t('shell.streak', { days: session.streakDays }) }}</span>
</template>
```

### 3.2 Locale JSON 片段

`en.json`

```json
{
  "common": { "cancel": "Cancel", "save": "Save", "loading": "Loading…", "retry": "Retry" },
  "shell": { "streak": "{days}-day streak", "toggleSidebar": "Toggle sidebar" },
  "library": { "items": "no texts | one text | {count} texts" }
}
```

`zh-TW.json`

```json
{
  "common": { "cancel": "取消", "save": "儲存", "loading": "載入中…", "retry": "重試" },
  "shell": { "streak": "連續 {days} 天", "toggleSidebar": "收合／展開側欄" },
  "library": { "items": "{count} 篇文本" }
}
```

### 3.3 IME 欄位（最小版）

```vue
<input
  ref="imeRef"
  class="ime"
  :aria-label="t('practice.imeField')"
  autocomplete="off"
  @compositionstart="onCompStart"
  @compositionupdate="onCompUpdate"
  @compositionend="onCompEnd"
  @input="onInput"
/>
<!-- No v-model, no :value. The field is uncontrolled on purpose. -->
```

---

## 4. 檢查清單

- [ ] 新文字已加到 `en.json`，且 `zh-TW.json`（與其他語系）同位置同 key
- [ ] key 為語意 camelCase、≤ 3 層、放在正確命名空間
- [ ] 沒有翻譯片段串接；插值參數在各語系一致
- [ ] `<script setup>` 用 `useI18n()` 的 `t`，沒有 `this.$t`
- [ ] store / lib 回傳 key 而非翻譯字串
- [ ] 沒有 `` t(`xxx.${var}`) `` / `t('xxx.' + var)`；動態 key 走完整 key 對照表（`` grep -rnE "\bt\((\`|'[^']*' *\+)" apps/src `` 應無結果）
- [ ] 切換語系後 ant-design-vue 內建文字（Modal 按鈕、Empty、分頁）也跟著切換
- [ ] 使用者資料沒有被塞進 locale JSON
- [ ] zh-TW 為台灣用語、全形標點、中英間半形空格
- [ ] IME 欄位沒有 `v-model` / `:value`；Enter 處理有 `isComposing` 防護
- [ ] `pnpm --filter ./apps test`（含 `locales.test.ts`）通過
- [ ] e2e 斷言英文，沒有「中文不存在」式斷言

---

## 5. 常見錯誤

| 錯誤寫法 | 正確寫法 | 原因 |
| --- | --- | --- |
| `this.$t('save')` in `<script setup>` | `const { t } = useI18n(); t('common.save')` | 沒有 `this` |
| `createI18n({ ... })` 未設 `legacy: false` | `legacy: false` | `useI18n()` 在 legacy 模式會丟錯 |
| `fallbackLocale: 'en'` 但 messages 的 key 是 `'en-US'` | 兩者代碼一致 | fallback 找不到語系，顯示原始 key |
| `t('practice.useFinger', …) + t('practice.pressKey', …)`（參考專案） | 整句一個 key：`"hint": "用{finger}按 {key} 鍵"` | 語序無法在他語系調整 |
| `` t(`nav.${n.id}`) ``（參考專案）、`t('status.' + s)` | `labelKey: 'nav.practice'` 完整 key；狀態用 `Record<Status, string>` 對照表 | 工具找不到、typo 無警告 |
| 頁面切到 zh-TW，`a-modal` 按鈕仍是 OK / Cancel | `a-config-provider :locale="ANTD_LOCALE[uiLang]"` + dayjs 同步 | 函式庫文字不走 vue-i18n |
| store 回傳 `t('status.ready')` | store 回傳 `'ready'`，元件翻譯 | 切換語系不更新 |
| 把使用者建立的分類名放進 `zh-TW.json` | 顯示 `item.name`；內建項目用 `item.i18nKey` | 建置後新增的資料不可能在 bundle 內 |
| `<input v-model="text" @compositionend=…>` | 非受控，`compositionend` 讀 `e.target.value` | 重繪清掉組字緩衝 |
| Enter 送出不檢查 `isComposing` | `if (e.isComposing) return` | 選字 Enter 直接送出半成品 |
| e2e `expect(page.getByText('開始')).toHaveCount(0)` | 斷言英文 `'Start'` 存在 | 英文畫面下永遠通過 |
| 用 i18n-ally 警告判斷 key 是否存在 | 以 `locales.test.ts` / node 讀 JSON 為準 | 擴充套件有快取（見 `vue3-i18n-debugging`） |
| `setLocale` 只改 `locale`，沒改 `<html lang>` | 同時設 `document.documentElement.lang` | 螢幕閱讀器發音、瀏覽器翻譯判斷錯誤 |

---

## 6. 待確認

1. **預設語系**：參考專案無儲存值時用 `en`；SoybeanAdmin 系（`platform.client`）預設 `zh-TW`。團隊預設（`DEFAULT_LOCALE`）待定。若改為 `zh-TW`，e2e 規則 38 的作法需同步調整。
2. **必備語系**：團隊要求 `zh-TW` + `en`；`zh-CN` 是否為必備（參考專案三語皆有）待定。
3. **zh-CN 產生方式**：參考專案後端資料以 OpenCC 做繁簡轉換；前端 `zh-CN.json` 是人工維護還是由 OpenCC 從 zh-TW 產生（及產生腳本）待定。
4. **來源語系**：本檔規定 `en.json` 為 source of truth（參考專案作法）；若團隊以 `zh-TW` 為主要撰寫語系，fallback 與 i18n-ally `sourceLanguage` 需一併改。
5. **API 語系傳遞方式**：參考專案以查詢參數 `?locale=` 傳遞；後端也解析 `Accept-Language`（依 `q` 排序）。前端是否統一由 axios interceptor 帶 `Accept-Language` 待 `elf-api-contract` 定案。
6. **locale 檔格式**：參考專案用 JSON；SoybeanAdmin 系用 TS（`langs/zh-tw.ts`、檔名小寫）並有模組級 locale（`packages/@elf/*/src/locales/`）。在該 repo 內**以該 repo 慣例為準**；新專案用 JSON。
7. **日期 / 數字格式**：參考專案未使用 vue-i18n `d()` / `n()`，也未集中 `Intl` 格式化。團隊要採 `datetimeFormats` / `numberFormats` 還是 `lib/format.ts` 包 `Intl` 待定（範本暫給 `Intl` 版本）。
8. **未使用 key 偵測**：是否在 CI 加入「locale 中存在但程式未引用」的檢查（及工具）待定。
9. **`.vscode/settings.json` 提交**：參考專案 `.gitignore` 只放行 `.vscode/extensions.json`；本檔建議放行 `settings.json` 以共用 i18n-ally 設定，待團隊同意。
