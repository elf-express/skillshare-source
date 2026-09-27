# elf-i18n 設定與範本

取材自參考專案 `TypingTrainer/apps/src/i18n/`、`stores/settings.ts`、`stores/session.ts`（IME）、`e2e/chinese-ime.spec.ts`，
並補上團隊規則（啟動時設 `<html lang>`、開發期缺漏警告、key 對等測試）。

目錄：
1. [src/i18n/index.ts](#1-srci18nindexts)
2. [Locale JSON 結構](#2-locale-json-結構)
3. [Settings store 接線與語言選擇器](#3-settings-store-接線與語言選擇器)
4. [locales.test.ts — 缺漏 key 偵測](#4-localestestts)
5. [i18n-ally 設定](#5-i18n-ally-設定)
6. [日期 / 數字格式](#6-日期--數字格式)
7. [IME 欄位完整範例](#7-ime-欄位完整範例)
8. [IME e2e 測試](#8-ime-e2e-測試)
9. [ant-design-vue 與 dayjs 語系同步](#9-ant-design-vue-與-dayjs-語系同步)

---

## 1. src/i18n/index.ts

```ts
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import { syncLibraryLocale } from './antd'

export const LOCALES = ['en', 'zh-TW', 'zh-CN'] as const
export type Locale = (typeof LOCALES)[number]

/** Shown in the language picker; always in the language itself. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
}

/** Used when nothing valid is stored. See 待確認 #1 in SKILL.md. */
export const DEFAULT_LOCALE: Locale = 'en'

const STORAGE_KEY = '<project>.locale'

export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v)

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* private windows have no storage; fall through to the default */
  }
  return DEFAULT_LOCALE
}

/**
 * `en` is the source of truth: the other files mirror its keys and fall back to it
 * key by key, so a missing translation shows English, not a raw key.
 */
export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, 'zh-TW': zhTW, 'zh-CN': zhCN },
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
})

/** The only way to change language. Keeps <html lang> and storage in step. */
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  syncLibraryLocale(locale) // ant-design-vue date pickers read dayjs; see §9
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export const currentLocale = (): Locale => i18n.global.locale.value as Locale

// Screen readers and browser translation read <html lang> from the first paint.
if (typeof document !== 'undefined') document.documentElement.lang = currentLocale()
syncLibraryLocale(currentLocale())
```

`main.ts`：`.use(i18n)`（見 `elf-vue` references）。

---

## 2. Locale JSON 結構

```
src/i18n/
├─ index.ts
├─ locales.test.ts
└─ locales/
   ├─ en.json      ← source of truth，新 key 先加這裡
   ├─ zh-TW.json
   └─ zh-CN.json
```

`en.json`（節錄，結構即規範）

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "saving": "Saving…",
    "delete": "Delete",
    "close": "Close",
    "retry": "Retry",
    "loading": "Loading…",
    "refreshing": "Refreshing…",
    "empty": "Nothing here yet",
    "loadFailed": "Couldn't load: {reason}",
    "dash": "—"
  },
  "nav": {
    "main": "Main navigation",
    "groups": { "practice": "Practice", "content": "Content" },
    "practice": "Practice",
    "library": "Library",
    "settings": "Settings"
  },
  "shell": {
    "streak": "{days}-day streak",
    "toggleSidebar": "Toggle sidebar",
    "shortcutHint": "Ctrl+Enter Start · Ctrl+N Next text"
  },
  "status": { "wpm": "WPM", "cpm": "CPM", "ready": "Ready", "running": "Typing" },
  "form": { "required": "This field is required" },
  "library": {
    "title": "Library",
    "search": "Search texts",
    "empty": "No texts yet",
    "noMatch": "No texts match your search",
    "clearSearch": "Clear search",
    "create": "Add a text",
    "deleteConfirm": "Delete {name}?",
    "items": "no texts | one text | {count} texts",
    "import": { "title": "Import files" }
  },
  "practice": {
    "imeField": "Chinese input",
    "missHint": "Use your {finger} to press {key}"
  }
}
```

`zh-TW.json`（同一組 key）

```json
{
  "common": {
    "cancel": "取消",
    "save": "儲存",
    "saving": "儲存中…",
    "delete": "刪除",
    "close": "關閉",
    "retry": "重試",
    "loading": "載入中…",
    "refreshing": "更新中…",
    "empty": "目前沒有內容",
    "loadFailed": "載入失敗：{reason}",
    "dash": "—"
  },
  "nav": {
    "main": "主選單",
    "groups": { "practice": "練習", "content": "內容" },
    "practice": "打字練習",
    "library": "題庫管理",
    "settings": "設定"
  },
  "shell": {
    "streak": "連續 {days} 天",
    "toggleSidebar": "收合／展開側欄",
    "shortcutHint": "Ctrl+Enter 開始 · Ctrl+N 換一篇"
  },
  "status": { "wpm": "WPM", "cpm": "CPM", "ready": "就緒", "running": "輸入中" },
  "form": { "required": "此欄位為必填" },
  "library": {
    "title": "題庫",
    "search": "搜尋文本",
    "empty": "尚無文本",
    "noMatch": "沒有符合搜尋條件的文本",
    "clearSearch": "清除搜尋",
    "create": "新增文本",
    "deleteConfirm": "確定刪除「{name}」？",
    "items": "{count} 篇文本",
    "import": { "title": "匯入檔案" }
  },
  "practice": {
    "imeField": "中文輸入欄位",
    "missHint": "用{finger}按 {key} 鍵"
  }
}
```

---

## 3. Settings store 接線與語言選擇器

`src/stores/settings.ts`（節錄）

```ts
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { currentLocale, setLocale, type Locale } from '@/i18n'

export const useSettingsStore = defineStore('settings', () => {
  const uiLang = ref<Locale>(currentLocale())

  // The picker is the only writer; i18n follows it.
  watch(uiLang, (l) => setLocale(l))

  return { uiLang }
})
```

`src/components/LanguagePicker.vue`

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { LOCALES, LOCALE_LABEL } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const { uiLang } = storeToRefs(useSettingsStore())
</script>

<template>
  <label class="field">
    <span>{{ t('settings.uiLang') }}</span>
    <select v-model="uiLang" class="input">
      <option v-for="l in LOCALES" :key="l" :value="l" :lang="l">{{ LOCALE_LABEL[l] }}</option>
    </select>
  </label>
</template>
```

> 此元件讀 store，屬殼層 / 設定頁元件（見 `elf-ui-pattern` 規則 1）。

---

## 4. locales.test.ts

`src/i18n/locales.test.ts` — 缺 key、多 key、插值參數不一致都會失敗。

```ts
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'

type Tree = { [k: string]: string | Tree }

/** 'a.b.c' → message */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flatten(v, key))
  }
  return out
}

/** Named placeholders, ignoring the implicit plural args. */
const params = (msg: string) =>
  [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((p) => p !== 'count' && p !== 'n').sort()

const source = flatten(en as Tree)
const others: Record<string, Record<string, string>> = {
  'zh-TW': flatten(zhTW as Tree),
  'zh-CN': flatten(zhCN as Tree),
}

describe.each(Object.entries(others))('%s', (_locale, messages) => {
  it('has every key of en.json', () => {
    expect(Object.keys(source).filter((k) => !(k in messages))).toEqual([])
  })

  it('has no key that en.json lacks', () => {
    expect(Object.keys(messages).filter((k) => !(k in source))).toEqual([])
  })

  it('uses the same placeholders as en.json', () => {
    const mismatched = Object.keys(source).filter(
      (k) => k in messages && params(source[k]).join() !== params(messages[k]).join(),
    )
    expect(mismatched).toEqual([])
  })

  it('has no empty message', () => {
    expect(Object.keys(messages).filter((k) => messages[k].trim() === '')).toEqual([])
  })
})
```

> `{count}` / `{n}` 被排除：中文複數句常只保留其一或都不用，由 vue-i18n 隱含提供。

---

## 5. i18n-ally 設定

`.vscode/extensions.json`

```json
{
  "recommendations": ["lokalise.i18n-ally", "Vue.volar", "dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
```

`.vscode/settings.json`（只放團隊共用的 i18n-ally 設定；需在 `.gitignore` 加 `!.vscode/settings.json`，見 SKILL.md 待確認 #9）

```json
{
  "i18n-ally.localesPaths": ["apps/src/i18n/locales"],
  "i18n-ally.pathMatcher": "{locale}.json",
  "i18n-ally.keystyle": "nested",
  "i18n-ally.sourceLanguage": "en",
  "i18n-ally.displayLanguage": "zh-TW",
  "i18n-ally.enabledFrameworks": ["vue"]
}
```

i18n-ally 顯示「key 不存在」但 `locales.test.ts` 通過 → 是擴充套件快取或 worktree 重複索引，依第三方 skill
`frontend/vue/vue3-i18n-debugging` 處理（Reload Window、排除 worktree 路徑），**不要**為了消警告改 key。

---

## 6. 日期 / 數字格式

在待確認 #7 定案前，統一使用 `src/lib/format.ts`（依目前語系呼叫 `Intl`），**不要**在元件內直接 `toLocaleString()`。

```ts
import { currentLocale } from '@/i18n'

export function formatNumber(value: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(currentLocale(), opts).format(value)
}

export function formatPercent(ratio: number, digits = 0) {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(ratio)
}

export function formatDate(value: Date | string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(currentLocale(), opts).format(new Date(value))
}
```

在元件中搭配 `computed` 使用，並讓 computed 依賴 `locale`（`const { locale } = useI18n()`；在 computed 內讀一次 `locale.value`）以便切換語系時重算。

---

## 7. IME 欄位完整範例

邏輯放在 store（參考專案 `stores/session.ts`），元件只綁事件。

Store 片段：

```ts
import { ref } from 'vue'

// inside defineStore('session', () => { ... })
const composing = ref(false)
const comp = ref('') // text currently being composed, painted above the caret
const typed = ref('')

function applyImeValue(v: string) {
  typed.value = v
  // compare against the target, advance, finish...
}

function onCompStart() {
  comp.value = ''
  composing.value = true
}

function onCompUpdate(e: CompositionEvent) {
  comp.value = e.data || ''
}

function onCompEnd(e: CompositionEvent) {
  comp.value = ''
  composing.value = false
  applyImeValue((e.target as HTMLInputElement | null)?.value || '')
}

function onIme(e: Event) {
  // Mid-composition input events are noise: the bubble already shows them.
  if (composing.value) return
  applyImeValue((e.target as HTMLInputElement).value || '')
}

// return { composing, comp, typed, onCompStart, onCompUpdate, onCompEnd, onIme, ... }
```

元件：

```vue
<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const session = useSessionStore()
const imeRef = ref<HTMLInputElement | null>(null)

// Uncontrolled: clear the DOM value directly, and never mid-composition.
watch(
  () => session.typed,
  (v) => {
    const el = imeRef.value
    if (el && !session.composing && v === '' && el.value !== '') el.value = ''
  },
)

function focusIme() {
  void nextTick(() => imeRef.value?.focus())
}

onMounted(focusIme)
</script>

<template>
  <div class="practice" @click="focusIme">
    <!-- text card, caret, composition bubble: {{ session.comp }} -->
    <input
      v-if="session.layout === 'zh'"
      ref="imeRef"
      class="ime"
      :aria-label="t('practice.imeField')"
      autocomplete="off"
      @input="session.onIme"
      @compositionstart="session.onCompStart"
      @compositionupdate="session.onCompUpdate"
      @compositionend="session.onCompEnd"
    />
  </div>
</template>

<style scoped>
/* Visually hidden but focusable; display:none would make it unfocusable. */
.ime {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
```

---

## 8. IME e2e 測試

`e2e/chinese-ime.spec.ts`（參考專案原樣精簡；Playwright 規則見 `elf-e2e`）

```ts
import { expect, test, type Page } from '@playwright/test'

const IME = 'input.ime'

/** Drives a full composition the way a bopomofo IME does: many keys, one character. */
async function compose(page: Page, readings: string[], committed: string) {
  await page.evaluate(
    ({ selector, readings, committed }) => {
      const ime = document.querySelector<HTMLInputElement>(selector)
      if (!ime) throw new Error('no IME field')
      ime.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      for (const data of readings) {
        ime.value = data
        ime.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data }))
        ime.dispatchEvent(new InputEvent('input', { bubbles: true, data, isComposing: true }))
      }
      ime.value = committed
      ime.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: committed }))
      ime.dispatchEvent(new InputEvent('input', { bubbles: true, data: committed, isComposing: false }))
    },
    { selector: IME, readings, committed },
  )
}

const imeHasFocus = (page: Page) =>
  page.evaluate((selector) => document.activeElement === document.querySelector(selector), IME)

async function openChinesePractice(page: Page) {
  await page.goto('/#/practice')
  // English copy: a fresh context has no stored locale (rule 38).
  await page.locator('.seg-item--cat', { hasText: 'Chinese' }).click()
  await expect(page.locator(IME)).toBeAttached()
}

test('Start does not steal focus from the IME field', async ({ page }) => {
  await openChinesePractice(page)

  await page.locator('button.ant-btn').first().click()

  expect(await imeHasFocus(page)).toBe(true)
})

test('a three-keystroke composition advances the caret by one cell', async ({ page }) => {
  await openChinesePractice(page)
  const cells = page.locator('.char')
  const first = await cells.first().textContent()
  expect(first).toBeTruthy()

  // 打 = ㄉㄚˇ — three physical keys producing a single character.
  await compose(page, ['ㄉ', 'ㄉㄚ', 'ㄉㄚˇ'], first!)

  await expect(cells.nth(1)).toHaveClass(/is-cur/)
  await expect(cells.nth(0)).not.toHaveClass(/is-cur/)
})
```

> selector（`.seg-item--cat`、`.char`、`.is-cur`、`button.ant-btn`）為參考專案畫面；新專案依 `elf-e2e` 改用 `data-testid` / role。
> 重點是兩個斷言：「點工具列後 focus 仍在 IME 欄位」與「整段組字結束才前進一格」。

---

## 9. ant-design-vue 與 dayjs 語系同步

ant-design-vue 元件內建文字（`a-empty` 的預設描述、`a-modal` / `a-popconfirm` 的 OK / Cancel、分頁、日期選擇器）
不走 vue-i18n，而是由 `a-config-provider` 的 `locale` 與 dayjs 語系決定。兩者 **MUST** 跟著 `setLocale` 一起切換，
否則會出現「頁面是中文、對話框按鈕是英文」。

`src/i18n/antd.ts`

```ts
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import 'dayjs/locale/zh-cn'
import enUS from 'ant-design-vue/es/locale/en_US'
import zhTW from 'ant-design-vue/es/locale/zh_TW'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import type { Locale as AntdLocale } from 'ant-design-vue/es/locale'
import type { Locale } from './index'

/** Full lookup table: every app locale maps to an ant-design-vue pack and a dayjs locale. */
export const ANTD_LOCALE: Record<Locale, AntdLocale> = { en: enUS, 'zh-TW': zhTW, 'zh-CN': zhCN }
const DAYJS_LOCALE: Record<Locale, string> = { en: 'en', 'zh-TW': 'zh-tw', 'zh-CN': 'zh-cn' }

export function syncLibraryLocale(locale: Locale) {
  dayjs.locale(DAYJS_LOCALE[locale])
}
```

`setLocale`（§1）已呼叫 `syncLibraryLocale(locale)`，模組載入時也呼叫一次。
`App.vue`（與 `elf-ui-pattern` 的 `theme` 同一個 provider）：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ANTD_LOCALE } from '@/i18n/antd'
import { useSettingsStore } from '@/stores/settings'
import { theme } from '@/styles/theme'

const { uiLang } = storeToRefs(useSettingsStore())
const antdLocale = computed(() => ANTD_LOCALE[uiLang.value])
</script>

<template>
  <a-config-provider :theme="theme" :locale="antdLocale">
    <RouterView />
  </a-config-provider>
</template>
```

> 對照表寫完整 key（`Record<Locale, …>`），新增語系時 `vue-tsc` 會直接指出缺哪一格；不要用 `` `zh_${x}` `` 拼路徑（規則 19）。
