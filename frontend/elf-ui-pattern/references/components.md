# elf-ui-pattern 元件範本

所有範本遵守 `elf-vue`（`<script setup lang="ts">`、型別 props / emits / `defineModel`）與 `elf-i18n`（文案走 `t()`）。
團隊 UI 函式庫為 **ant-design-vue 4**（已決議）：載入 / 空 / 錯誤 / 對話框 / 危險確認一律用 `a-spin`、`a-empty`、`a-result`、
`a-modal`、`a-popconfirm`（對照表見 SKILL.md 2.8）。範本中的 `a-*` 元件須已在 `src/plugins/antd.ts` 註冊（見 `elf-vue` references §1）。
`SegmentedControl` / `FormField` 等自寫範本示範 a11y 契約，只在函式庫元件不適用時使用（見各節說明）。

目錄：
1. [AsyncBlock.vue — 三態容器](#1-asyncblockvue)
2. [FormField.vue — 表單欄位](#2-formfieldvue)
3. [SegmentedControl.vue — 分段選擇（radiogroup + 方向鍵）](#3-segmentedcontrolvue)
4. [AppNav.vue — 導覽](#4-appnavvue)
5. [useShortcuts.ts — 全域快捷鍵](#5-useshortcutsts)
6. [Focus 持有者模式](#6-focus-持有者模式)
7. [Design token：app.css / theme.ts / theme.test.ts](#7-design-token)
8. [響應式：CSS container query 取代 JS 斷點](#8-響應式)
9. [元件測試範例](#9-元件測試範例)
10. [對話框與危險操作（a-modal / a-popconfirm）](#10-對話框與危險操作)

---

## 1. AsyncBlock.vue

`src/components/AsyncBlock.vue` — 統一 loading / error / empty / 內容的顯示順序與 ARIA，內部用 ant-design-vue 元件：

| 狀態 | 元件 | 規則 |
| --- | --- | --- |
| 首次載入（尚無資料） | `a-spin` + `role="status"` 文字 | 34 |
| 重新載入（畫面已有資料） | `<a-spin :spinning>` **包住既有內容**（資料保留、疊加小型指示） | 34 |
| 錯誤 | `a-result status="error"` + `role="alert"` + `#extra` 重試 `a-button` | 35 |
| 空 | `a-empty`：`description` = 為什麼是空的，預設 slot = 下一步動作 | 36 |

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const props = withDefaults(
  defineProps<{
    status: AsyncStatus
    empty: boolean
    error?: string
    /** Why the list is empty (rule 36). Falls back to a generic line only when nothing better exists. */
    emptyText?: string
  }>(),
  { error: '', emptyText: '' },
)
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="async" :aria-busy="props.status === 'loading'">
    <!-- First load: nothing on screen to keep yet. -->
    <div v-if="props.status === 'loading' && props.empty" role="status" class="state">
      <a-spin />
      <p>{{ t('common.loading') }}</p>
    </div>

    <a-result
      v-else-if="props.status === 'error'"
      role="alert"
      status="error"
      :title="t('common.loadFailed', { reason: props.error })"
    >
      <template #extra>
        <a-button type="primary" @click="emit('retry')">{{ t('common.retry') }}</a-button>
      </template>
    </a-result>

    <a-empty v-else-if="props.empty" :description="props.emptyText || t('common.empty')">
      <!-- The next step: create, clear the filter, … (rule 36). -->
      <slot name="empty-action" />
    </a-empty>

    <!-- Refreshing with data already on screen: keep the data, overlay a small spinner (rule 34). -->
    <a-spin v-else :spinning="props.status === 'loading'" :tip="t('common.refreshing')">
      <p v-if="props.status === 'loading'" role="status" class="visually-hidden">{{ t('common.refreshing') }}</p>
      <slot />
    </a-spin>
  </div>
</template>

<style scoped>
.async {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-2);
}
</style>
```

使用：

```vue
<AsyncBlock
  :status="status"
  :empty="!texts.length"
  :error="errorMessage"
  :empty-text="t('library.empty')"
  @retry="library.load({ force: true })"
>
  <template #empty-action>
    <a-button type="primary" @click="library.openComposer()">{{ t('library.create') }}</a-button>
  </template>

  <ul class="list">
    <li v-for="x in texts" :key="x.title">{{ x.title }}</li>
  </ul>
</AsyncBlock>
```

必要 i18n key：`common.loading`、`common.refreshing`、`common.loadFailed`（含 `{reason}`）、`common.retry`、`common.empty`。
`common.empty` 只是後備；清單類畫面 **MUST** 傳 `empty-text`（原因）並填 `#empty-action`（下一步），見規則 36。

---

## 2. FormField.vue

表單版面優先用 `a-form` / `a-form-item`（label、必填標記、`help` 錯誤訊息）。以下自寫版本示範規則 21–22 要求的
`label` ↔ `id`、`aria-invalid`、`aria-describedby` 配對；用 `a-form-item` 時同樣 **MUST** 以 e2e 或 axe 確認這三項成立，不成立就改用此元件。

```vue
<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    error?: string
    hint?: string
    type?: 'text' | 'email' | 'password' | 'search' | 'url'
    required?: boolean
    hideLabel?: boolean
  }>(),
  { error: '', hint: '', type: 'text', required: false, hideLabel: false },
)
const model = defineModel<string>({ required: true })

// Vue 3.5+: stable, SSR-safe ids for label / description wiring.
const inputId = useId()
const hintId = `${inputId}-hint`
const errorId = `${inputId}-error`

const describedBy = computed(
  () => [props.hint ? hintId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="field">
    <label :for="inputId" :class="{ 'visually-hidden': props.hideLabel }">
      {{ props.label }}<span v-if="props.required" aria-hidden="true"> *</span>
    </label>
    <input
      :id="inputId"
      v-model.trim="model"
      class="input"
      :type="props.type"
      :required="props.required"
      :aria-invalid="!!props.error"
      :aria-describedby="describedBy"
    />
    <p v-if="props.hint" :id="hintId" class="hint">{{ props.hint }}</p>
    <p v-if="props.error" :id="errorId" class="error">{{ props.error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.input[aria-invalid='true'] {
  border-color: var(--error);
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
}
.error {
  margin: 0;
  font-size: 12px;
  color: var(--error);
}
</style>
```

> `v-model.trim` 在 password 欄位不適用：密碼欄位請另寫或加 `trim` prop 控制。

表單送出（在父元件）：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '@/components/FormField.vue'

const emit = defineEmits<{ saved: [name: string] }>()
const { t } = useI18n()

const name = ref('')
const nameError = ref('')
const pending = ref(false)

async function onSubmit() {
  if (pending.value) return
  nameError.value = name.value ? '' : t('form.required')
  if (nameError.value) return
  pending.value = true
  try {
    // await store.save(name.value)
    emit('saved', name.value)
  } finally {
    pending.value = false
  }
}

// Enter inside an IME candidate window must not submit.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.isComposing) e.preventDefault()
}
</script>

<template>
  <form :aria-busy="pending" novalidate @submit.prevent="onSubmit" @keydown="onKeydown">
    <FormField v-model="name" :label="t('library.categoryName')" :error="nameError" required />
    <button type="submit" class="btn btn--primary" :disabled="pending">
      {{ pending ? t('common.saving') : t('common.save') }}
    </button>
  </form>
</template>
```

---

## 3. SegmentedControl.vue

預設用 ant-design-vue 的 `a-segmented`（`v-model:value` + `:options`）。參考專案用 `.seg` / `.seg-item.is-on` 的 `div`
做分段選擇（鍵盤不可用）；下列自寫版本改為 radiogroup + 方向鍵，只在 `a-segmented` 無法滿足需求（例：選項內要放自訂內容且需保留 radio 語意）時使用。
樣式用到的 `--seg-bg`、`--seg-shadow` 為規則 27 token 表內的固定 token。

```vue
<script setup lang="ts" generic="T extends string">
const props = defineProps<{ label: string; options: { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })

/** Roving focus: select the neighbour and move focus to its button. */
function move(e: KeyboardEvent, from: number, delta: number) {
  const n = props.options.length
  const next = (from + delta + n) % n
  model.value = props.options[next].value
  const group = (e.currentTarget as HTMLElement | null)?.parentElement
  ;(group?.children[next] as HTMLElement | undefined)?.focus()
}
</script>

<template>
  <div class="seg" role="radiogroup" :aria-label="props.label">
    <button
      v-for="(o, i) in props.options"
      :key="o.value"
      type="button"
      role="radio"
      class="seg-item"
      :class="{ 'is-on': model === o.value }"
      :aria-checked="model === o.value"
      :tabindex="model === o.value ? 0 : -1"
      @click="model = o.value"
      @keydown.right.prevent="move($event, i, 1)"
      @keydown.down.prevent="move($event, i, 1)"
      @keydown.left.prevent="move($event, i, -1)"
      @keydown.up.prevent="move($event, i, -1)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: var(--seg-bg);
}
.seg-item {
  border: 0;
  padding: 4px 12px;
  border-radius: 4px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.seg-item.is-on {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--seg-shadow);
}
</style>
```

規則：roving tabindex — 只有選中項 `tabindex="0"`，Tab 進入群組後用方向鍵切換。

---

## 4. AppNav.vue

取代參考專案 `AppSider.vue` 的 `div @click` 導覽。

```vue
<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

export interface NavItem {
  name: string // route name
  labelKey: string // full i18n key, e.g. 'nav.practice'
  icon: Component
}

const props = defineProps<{ items: NavItem[]; collapsed: boolean }>()

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <nav :aria-label="t('nav.main')">
    <ul class="nav">
      <li v-for="n in props.items" :key="n.name">
        <RouterLink
          :to="{ name: n.name }"
          class="nav-item"
          :aria-current="route.name === n.name ? 'page' : undefined"
          :aria-label="props.collapsed ? t(n.labelKey) : undefined"
          :title="props.collapsed ? t(n.labelKey) : undefined"
        >
          <component :is="n.icon" aria-hidden="true" />
          <span v-show="!props.collapsed">{{ t(n.labelKey) }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav {
  list-style: none;
  margin: 0;
  padding: 0;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  color: var(--muted);
}
.nav-item[aria-current='page'] {
  color: var(--surface);
  background: var(--primary);
}
</style>
```

---

## 5. useShortcuts.ts

`src/composables/useShortcuts.ts` — 只在 `App.vue` 呼叫一次。

```ts
import { onBeforeUnmount, onMounted } from 'vue'

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

/**
 * Ctrl/⌘ + key shortcuts on document.
 * Keys are lower-case `KeyboardEvent.key` values: 'enter', 'n', 'b'.
 */
export function useShortcuts(map: ShortcutMap, fallback?: (e: KeyboardEvent) => void) {
  function onKeydown(e: KeyboardEvent) {
    // An IME is choosing a candidate; the key belongs to it.
    if (e.isComposing) return
    if (e.metaKey || e.ctrlKey) {
      const run = map[e.key.toLowerCase()]
      if (run) {
        e.preventDefault()
        run(e)
      }
      return
    }
    fallback?.(e)
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
```

`App.vue`：

```ts
useShortcuts(
  {
    enter: () => startRun(),
    n: () => nextText(),
    b: () => settings.toggleSider(),
  },
  (e) => session.handleKey(e, route.name === 'practice'),
)
```

測試（`useShortcuts.test.ts`）：

```ts
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useShortcuts } from './useShortcuts'

function host(map: Record<string, () => void>) {
  return mount(
    defineComponent({
      setup() {
        useShortcuts(map)
        return () => h('div')
      },
    }),
  )
}

const press = (init: KeyboardEventInit) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { cancelable: true, ...init }))

describe('useShortcuts', () => {
  it('runs the mapped handler for Ctrl + key', () => {
    const next = vi.fn()
    const wrapper = host({ n: next })

    press({ key: 'n', ctrlKey: true })

    expect(next).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('ignores keys while an IME is composing', () => {
    const next = vi.fn()
    const wrapper = host({ n: next })

    press({ key: 'n', ctrlKey: true, isComposing: true })

    expect(next).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stops listening after unmount', () => {
    const next = vi.fn()
    host({ n: next }).unmount()

    press({ key: 'n', ctrlKey: true })

    expect(next).not.toHaveBeenCalled()
  })
})
```

---

## 6. Focus 持有者模式

參考專案 `PracticeView.vue`：中文模式下隱藏的 IME 欄位必須全程持有 focus，任何點擊都把 focus 還回去。

```vue
<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const imeRef = ref<HTMLInputElement | null>(null)

/** Hand focus back after anything (Start, Next, a topic pill) took it. */
function focusIme() {
  if (session.layout !== 'zh') return
  void nextTick(() => imeRef.value?.focus())
}

watch(() => session.layout, focusIme)
watch(() => [session.target, session.startedAt], focusIme)
onMounted(focusIme)
</script>

<template>
  <!-- Any click inside the practice screen ends up back on the IME field. -->
  <div class="page practice" @click="focusIme">
    <!-- toolbar, text card ... -->
  </div>
</template>
```

驗證：Playwright 斷言 `document.activeElement` 為該欄位（見 `elf-e2e`；jsdom 無法驗證）。

---

## 7. Design token

### 7.1 `src/styles/app.css`（token 區塊）

```css
:root {
  --bg: #faf9f5;
  --surface: #fff;
  --sider: #262624;

  --text: #1f1e1d;
  --text-2: #5c5951;
  --text-3: #8b877e;
  --muted: #b8b3a8;

  --line: #ebe5db;
  --line-2: #ddd6ca;
  --seg-bg: #f0ebe2;

  --primary: #d97757;
  --primary-hover: #e08a6c;
  --primary-active: #c0623f;
  --success: #8a9a5b;
  --warning: #c4922f;
  --error: #bc4b3c;

  --card-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --seg-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  --overlay-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);

  --font:
    'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Helvetica Neue', Arial,
    sans-serif;
  --font-mono: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

色值取自參考專案，為產品專屬（見 SKILL.md 待確認 #2）；**token 名稱**為團隊固定，清單與 SKILL.md 規則 27 表格完全一致，
不在表內的名稱 **MUST NOT** 出現在 `app.css`（規則 31）。

### 7.2 `src/styles/theme.ts`（UI 函式庫主題，唯一的 TS 端色值）

```ts
/** Values mirror src/styles/app.css :root. theme.test.ts fails if they drift. */
export const TOKENS = {
  colorPrimary: '#d97757',
  colorPrimaryHover: '#e08a6c',
  colorPrimaryActive: '#c0623f',
  colorSuccess: '#8a9a5b',
  colorError: '#bc4b3c',
  colorWarning: '#c4922f',
  colorText: '#1f1e1d',
  colorTextSecondary: '#5c5951',
  colorBorder: '#ddd6ca',
} as const

/** Maps each library token to the CSS variable it must equal. */
export const CSS_VAR_OF: Record<keyof typeof TOKENS, string> = {
  colorPrimary: '--primary',
  colorPrimaryHover: '--primary-hover',
  colorPrimaryActive: '--primary-active',
  colorSuccess: '--success',
  colorError: '--error',
  colorWarning: '--warning',
  colorText: '--text',
  colorTextSecondary: '--text-2',
  colorBorder: '--line-2',
}

/** ant-design-vue ConfigProvider theme. */
export const theme = {
  token: { ...TOKENS, borderRadius: 6, fontSize: 14, controlHeight: 32 },
}
```

`App.vue`：`import { theme } from '@/styles/theme'` → `<a-config-provider :theme="theme">`。

### 7.3 `src/styles/theme.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import css from './app.css?raw'
import { CSS_VAR_OF, TOKENS } from './theme'

function cssVar(name: string): string | undefined {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`))
  return m?.[1].trim().toLowerCase()
}

describe('theme tokens', () => {
  it.each(Object.entries(CSS_VAR_OF))('%s equals %s in app.css', (key, cssName) => {
    expect(cssVar(cssName)).toBe(TOKENS[key as keyof typeof TOKENS].toLowerCase())
  })
})
```

> `?raw` 需 `env.d.ts` 有 `/// <reference types="vite/client" />`（已包含）。

---

## 8. 響應式

優先 CSS container query，取代參考專案 `useGridLayout` 以視窗寬度減側欄寬的 JS 計算。

步驟 1 — 在殼層內容區宣告容器（`App.vue`）：

```css
.content {
  container-type: inline-size;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
```

步驟 2 — 雙欄元件依**內容區**寬度切換（`src/components/SplitLayout.vue`）：

```vue
<template>
  <div class="split">
    <aside class="split-side"><slot name="side" /></aside>
    <section class="split-main"><slot /></section>
  </div>
</template>

<style scoped>
.split {
  display: grid;
  grid-template-columns: minmax(0, 232px) minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
  height: 100%;
}
.split-side,
.split-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
/* Content area (not the window) narrower than 620px → stack. */
@container (max-width: 619px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(220px, 1.1fr) minmax(0, 1fr);
  }
}
</style>
```

> `@container` 查詢的是**最近的祖先容器**，所以 `container-type` 必須放在外層 `.content`，不能放在 `.split` 自己身上。

需要實際像素（例：鍵盤高度 = 欄高 − 工具列高，並 clamp 120–340px）時才用 `useElementSize`（見 `elf-vue` references）。

---

## 9. 元件測試範例

`src/components/SegmentedControl.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SegmentedControl from './SegmentedControl.vue'

const options = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
]

describe('SegmentedControl', () => {
  it('marks only the selected option as checked and tabbable', () => {
    const wrapper = mount(SegmentedControl, { props: { label: 'Font size', options, modelValue: 'M' } })
    const radios = wrapper.findAll('[role="radio"]')

    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('moves the selection with the arrow keys, wrapping at the end', async () => {
    const wrapper = mount(SegmentedControl, { props: { label: 'Font size', options, modelValue: 'L' } })

    await wrapper.findAll('[role="radio"]')[2].trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['S']])
  })
})
```

> Vue 的 `@keydown.right` 以 `event.key === 'ArrowRight'` 比對，測試用 `trigger('keydown', { key: 'ArrowRight' })`。

---

## 10. 對話框與危險操作

### 10.1 危險操作：`a-popconfirm`（規則 26）

```vue
<a-popconfirm
  :title="t('library.deleteConfirm', { name: item.title })"
  :ok-text="t('common.delete')"
  :cancel-text="t('common.cancel')"
  :ok-button-props="{ danger: true }"
  @confirm="library.remove(item.id)"
>
  <a-button danger>{{ t('common.delete') }}</a-button>
</a-popconfirm>
```

影響範圍大（批次刪除、覆蓋整份資料）時改用 `Modal.confirm({ title, content, okType: 'danger' })`，文案同樣走 `t()`。

### 10.2 表單對話框：`a-modal`（規則 20）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = ref(false)
const pending = ref(false)

async function onOk() {
  if (pending.value) return
  pending.value = true
  try {
    // await store.save(...)
    open.value = false
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <a-button type="primary" @click="open = true">{{ t('library.create') }}</a-button>

  <!-- ant-design-vue 4 uses v-model:open (not :visible). Esc closes; focus returns to the trigger. -->
  <a-modal
    v-model:open="open"
    :title="t('library.create')"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    :confirm-loading="pending"
    @ok="onOk"
  >
    <!-- form fields -->
  </a-modal>
</template>
```

規則：**MUST NOT** 設 `:keyboard="false"`（會關掉 Esc）或 `:focus-trigger-after-close="false"`（關閉後 focus 不回觸發按鈕）；
**MUST NOT** 用 `div` + `position: fixed` 自寫對話框。focus 行為以 e2e 驗證（見 `elf-e2e`）。
