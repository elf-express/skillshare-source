# elf-vue 標準範本

所有範本可直接複製；`<project>`、`Xxx`、欄位名稱請依實際需求替換。範本取材自參考專案 `TypingTrainer/apps`，
並依 elf-vue 規則修正（例：v-model 改 `defineModel`、switch 改原生 `<button>`）。

目錄：
1. [main.ts + plugins/antd.ts](#1-maints)
2. [router/index.ts](#2-routerindexts)
3. [View 元件](#3-view-元件)
4. [可重用元件（含 v-model）](#4-可重用元件含-v-model)
5. [Setup store（含非同步狀態）](#5-setup-store含非同步狀態)
6. [Composable](#6-composable)
7. [API 層：http.ts / types.ts / index.ts](#7-api-層)
8. [元件測試](#8-元件測試-xxxtestts)
9. [Store 測試](#9-store-測試)
10. [純函式測試](#10-純函式測試)

---

## 1. main.ts

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'ant-design-vue/dist/reset.css'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { antd } from './plugins/antd'
import './styles/app.css'

createApp(App).use(createPinia()).use(router).use(i18n).use(antd).mount('#app')
```

`src/plugins/antd.ts` — ant-design-vue 4 按需註冊的**唯一清單**（`main.ts` 與元件測試共用）：

```ts
import type { App, Plugin } from 'vue'
import { Button, ConfigProvider, Empty, Input, Modal, Popconfirm, Result, Spin, Switch } from 'ant-design-vue'

/** Every ant-design-vue component the app renders. Add here, never with a second app.use elsewhere. */
const COMPONENTS = [Button, ConfigProvider, Empty, Input, Modal, Popconfirm, Result, Spin, Switch]

export const antd: Plugin = {
  install(app: App) {
    for (const c of COMPONENTS) app.use(c)
  },
}
```

規則：
- `main.ts` 只做註冊，不放業務邏輯、不呼叫 API。
- UI 函式庫固定 ant-design-vue 4（見 SKILL.md 規則 47）；按需註冊（參考專案作法），**不** `app.use(Antd)` 全量註冊。新用到的 `a-*` 元件先加進 `COMPONENTS`。
- 元件測試用 `global: { plugins: [antd, ...] }` 掛同一個 plugin，測試與正式環境的元件清單不會分岔。

---

## 2. router/index.ts

```ts
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

// Hash history keeps deep links working when the bundle is served from file:// (Tauri).
// Pure web apps: see 待確認 #6 in SKILL.md before switching to createWebHistory.
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/practice' },
  { path: '/practice', name: 'practice', component: () => import('@/views/PracticeView.vue') },
  { path: '/library', name: 'library', component: () => import('@/views/LibraryView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
```

規則：view 一律 `() => import(...)` lazy load；route `name` 小寫；導頁用 `router.push({ name: 'practice' })`，不用字串路徑。

---

## 3. View 元件

`src/views/LibraryView.vue` — 只做版面與文案；資料來自 store。三態交給 `AsyncBlock`（`elf-ui-pattern` references §1），
因此自動符合 `elf-ui-pattern` 規則 34（已有資料時重新載入不清空畫面）與規則 36（空狀態說明原因 + 下一步動作）。

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import AsyncBlock from '@/components/AsyncBlock.vue'
import TextCard from '@/components/TextCard.vue'

const emit = defineEmits<{ create: [] }>()

const { t } = useI18n()
const library = useLibraryStore()
const { texts, status, errorMessage } = storeToRefs(library)

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? texts.value.filter((x) => x.title.toLowerCase().includes(q)) : texts.value
})

// Two different empties: nothing in the library vs. nothing matches the search.
const isFiltering = computed(() => query.value.trim() !== '' && texts.value.length > 0)
const emptyText = computed(() => (isFiltering.value ? t('library.noMatch') : t('library.empty')))

function onSelect(title: string) {
  library.select(title)
}

onMounted(() => {
  void library.load()
})
</script>

<template>
  <section class="page">
    <h1 class="page-title">{{ t('library.title') }}</h1>

    <label for="library-search" class="visually-hidden">{{ t('library.search') }}</label>
    <a-input
      id="library-search"
      v-model:value="query"
      type="search"
      allow-clear
      :placeholder="t('library.search')"
    />

    <AsyncBlock
      :status="status"
      :empty="!filtered.length"
      :error="errorMessage"
      :empty-text="emptyText"
      @retry="library.load({ force: true })"
    >
      <template #empty-action>
        <a-button v-if="isFiltering" @click="query = ''">{{ t('library.clearSearch') }}</a-button>
        <a-button v-else type="primary" @click="emit('create')">{{ t('library.create') }}</a-button>
      </template>

      <ul class="list">
        <li v-for="item in filtered" :key="item.title">
          <TextCard :item="item" @select="onSelect" />
        </li>
      </ul>
    </AsyncBlock>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
</style>
```

三態（loading / error / empty）的完整規則與 `AsyncBlock.vue` 原始碼見 `elf-ui-pattern`。
需要的 i18n key：`library.title`、`library.search`、`library.empty`、`library.noMatch`、`library.clearSearch`、`library.create`
（加上 `AsyncBlock` 用到的 `common.*`）。

---

## 4. 可重用元件（含 v-model）

`src/components/ToggleSwitch.vue` — 示範 `defineModel` 與自訂控制項的 a11y 寫法。
**實務上開關一律用 ant-design-vue 的 `a-switch`**（`v-model:checked`）；只有 `a-switch` 無法滿足產品專屬樣式時才自寫，
且必須照此範本（原生 `<button role="switch">`；參考專案的 `<span role="switch">` 無法用鍵盤操作）。

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'sm' | 'md'; label: string; disabled?: boolean }>(), {
  size: 'md',
  disabled: false,
})
const checked = defineModel<boolean>({ required: true })

function toggle() {
  if (!props.disabled) checked.value = !checked.value
}
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :class="[`switch--${props.size}`, { 'is-on': checked }]"
    :aria-checked="checked"
    :aria-label="props.label"
    :disabled="props.disabled"
    @click="toggle"
  >
    <i aria-hidden="true" />
  </button>
</template>

<style scoped>
.switch {
  position: relative;
  flex-shrink: 0;
  display: inline-block;
  padding: 0;
  border: 0;
  border-radius: 100px;
  background: var(--muted);
  cursor: pointer;
}
.switch:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.switch.is-on {
  background: var(--primary);
}
.switch > i {
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: var(--surface);
  transition: left 0.15s ease-in-out;
}
.switch--sm {
  width: 40px;
  height: 20px;
}
.switch--sm > i {
  width: 16px;
  height: 16px;
}
.switch--sm.is-on > i {
  left: 22px;
}
.switch--md {
  width: 44px;
  height: 22px;
}
.switch--md > i {
  width: 18px;
  height: 18px;
}
.switch--md.is-on > i {
  left: 24px;
}
</style>
```

使用：

```vue
<ToggleSwitch v-model="settings.sound" :label="t('settings.sound')" size="sm" />
```

---

## 5. Setup store（含非同步狀態）

`src/stores/library.ts`

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { ApiError } from '@/api/http'
import type { TextItem } from '@/data/types'
import type { TextDto } from '@/api/types'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

// TextItem.best is display text; on the wire it is a number or null (elf-api-contract TextDto).
const toText = (t: TextDto): TextItem => ({
  title: t.title,
  category: t.category,
  chars: t.chars,
  best: t.best === null ? '—' : String(t.best),
})

export const useLibraryStore = defineStore('library', () => {
  // state
  const texts = ref<TextItem[]>([])
  const selected = ref<string | null>(null)
  const status = ref<LoadStatus>('idle')
  const errorMessage = ref('')

  // getters
  const count = computed(() => texts.value.length)
  const current = computed(() => texts.value.find((x) => x.title === selected.value) ?? null)

  // actions
  async function load(opts: { force?: boolean } = {}) {
    if (status.value === 'loading') return
    if (status.value === 'success' && !opts.force) return
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const list = await api.texts.list()
      texts.value = list.map(toText)
      status.value = 'success'
    } catch (e) {
      errorMessage.value = e instanceof ApiError ? e.message : String(e)
      status.value = 'error'
    }
  }

  function select(title: string) {
    selected.value = title
  }

  return { texts, selected, status, errorMessage, count, current, load, select }
})
```

---

## 6. Composable

`src/composables/useElementSize.ts`

```ts
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** Measured height of an element, kept current with a ResizeObserver. */
export function useElementSize(el: Ref<HTMLElement | null>) {
  const height = ref(0)
  let ro: ResizeObserver | undefined

  const read = () => {
    const node = el.value
    if (node && node.clientHeight !== height.value) height.value = node.clientHeight
  }

  const observe = () => {
    ro?.disconnect()
    if (!el.value) return
    ro = new ResizeObserver(read)
    ro.observe(el.value)
    read()
  }

  onMounted(observe)
  watch(el, observe)
  onBeforeUnmount(() => ro?.disconnect())

  return { height, read }
}
```

規則：composable 回傳 ref 物件（不回傳 `.value`）；所有副作用在 `onBeforeUnmount` 清除；需要 store 時在函式內呼叫 `useXxxStore()`。

---

## 7. API 層

依 `elf-api-contract` / `elf-api-design` 決定 URL、錯誤格式與 DTO 欄位；以下為前端側的固定寫法。

### 7.1 `src/api/http.ts`

**唯一版本在 `elf-api-contract` 的 `references/client-templates.md` §1**
（含 `http` axios 實例、`USE_MOCK`、`ApiError`、`normalizeError`、token 讀寫、`delay`，以及 §1.1 的 `http.test.ts`）。
本檔**不重複**這段程式碼，避免兩份 `ApiError` / `normalizeError` 漂移；請照該檔原樣複製。

前端側要記住的重點：

- `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'` — **預設開**：未設定時用 fixture，前端不需後端即可開發。
  正式映像由 `docker/web.Dockerfile` 的 `ARG VITE_USE_MOCK=false` + `ENV VITE_USE_MOCK=$VITE_USE_MOCK` 關閉（見 `elf-cicd-docker`）。
- `ApiError` 帶 `status`、`code`（ProblemDetails 的 `<resource>.<reason>`）、`errors`（欄位驗證錯誤）；
  程式分支 **MUST** 依 `code` 判斷，**MUST NOT** 比對 `message` 字串。
- store 取錯誤訊息：`e instanceof ApiError ? e.message : String(e)`（見 §5）。

### 7.2 `src/api/types.ts`

型別規則見 `elf-api-contract` references §3；以下只列本檔範例用到的型別，欄位**必須**與契約逐字相同。

```ts
/** Wire shapes. Field names must match the backend contract (elf-api-contract). */
export interface CategoryDto {
  id: number
  /** Stable lower-case key, immutable after creation; `TextDto.category` refers to it. */
  code: string
  name: string
  /** CSS colour, e.g. `#8a9a5b`. */
  color: string
}

/** A practice text. List endpoints omit `content`. */
export interface TextDto {
  id: number
  title: string
  /** `CategoryDto.code` of the owning category. */
  category: string
  level: string
  chars: number
  /** Personal best for this text; `null` until it has been drilled once. */
  best: number | null
  /** ISO 8601 UTC; `null` until it has been drilled once. */
  lastPractisedAt: string | null
  /** Omitted by list endpoints; present on `GET /texts/{id}`. */
  content?: string
}
```

分頁回應一律用契約的 `PagedResult<T>`（`{ total, page, size, rows }`，定義見 `elf-api-contract` §3），**MUST NOT** 自訂 `items` / `list` 等欄位名。

### 7.3 `src/api/index.ts`

```ts
import { delay, http, USE_MOCK } from './http'
import * as fx from './mock/fixtures'
import type { TextDto } from './types'

export * from './types'

/** VITE_USE_MOCK decides per call whether the fixture or the endpoint answers. */
async function pick<T>(mock: () => T, real: () => Promise<{ data: T }>): Promise<T> {
  if (USE_MOCK) return delay(mock())
  const res = await real()
  return res.data
}

export const api = {
  texts: {
    list: (params: { category?: string } = {}): Promise<TextDto[]> =>
      pick(
        () => fx.TEXTS,
        () => http.get<TextDto[]>('/texts', { params }),
      ),
  },
}
```

---

## 8. 元件測試 `Xxx.test.ts`

`src/components/ToggleSwitch.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToggleSwitch from './ToggleSwitch.vue'

describe('ToggleSwitch', () => {
  it('emits the flipped value when clicked', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, label: 'Sound' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('exposes its state to assistive technology', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: true, label: 'Sound' } })
    const btn = wrapper.get('button')

    expect(btn.attributes('role')).toBe('switch')
    expect(btn.attributes('aria-checked')).toBe('true')
    expect(btn.attributes('aria-label')).toBe('Sound')
  })

  it('does nothing while disabled', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, label: 'Sound', disabled: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
```

需要 store + i18n 的元件：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { i18n } from '@/i18n'
import { antd } from '@/plugins/antd'
import { useLibraryStore } from '@/stores/library'
import LibraryView from './LibraryView.vue'

describe('LibraryView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    i18n.global.locale.value = 'en' // assert English copy; see elf-i18n
  })

  it('shows the empty state when the store has no texts', async () => {
    const library = useLibraryStore()
    library.status = 'success'
    library.texts = []

    const wrapper = mount(LibraryView, { global: { plugins: [pinia, i18n, antd] } })

    expect(wrapper.text()).toContain('No texts yet')
    // elf-ui-pattern rule 36: the empty state offers a next step.
    expect(wrapper.text()).toContain('Add a text')
  })
})
```

> 註：`library.status = 'success'` 讓 `load()` 直接 return，不打 API。需要驗證 API 呼叫時用 `vi.mock('@/api', ...)`。

---

## 9. Store 測試

`src/stores/library.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLibraryStore } from './library'
import { api } from '@/api'
import { ApiError } from '@/api/http'

vi.mock('@/api', () => ({
  api: { texts: { list: vi.fn() } },
}))

describe('library store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(api.texts.list).mockReset()
  })

  it('loads once and maps DTOs', async () => {
    vi.mocked(api.texts.list).mockResolvedValue([
      { id: 1, title: 'Home row', category: 'basic', level: 'A1', chars: 40, best: null, lastPractisedAt: null },
    ])
    const store = useLibraryStore()

    await store.load()
    await store.load()

    expect(api.texts.list).toHaveBeenCalledTimes(1)
    expect(store.texts[0].best).toBe('—')
    expect(store.status).toBe('success')
  })

  it('records the error message and allows a forced retry', async () => {
    vi.mocked(api.texts.list).mockRejectedValueOnce(new ApiError('Server down', 500))
    const store = useLibraryStore()

    await store.load()
    expect(store.status).toBe('error')
    expect(store.errorMessage).toBe('Server down')

    vi.mocked(api.texts.list).mockResolvedValueOnce([])
    await store.load({ force: true })
    expect(store.status).toBe('success')
  })
})
```

---

## 10. 純函式測試

`src/lib/analyze.test.ts`（參考專案原樣）

```ts
import { describe, expect, it } from 'vitest'
import { analyzeText } from './analyze'

describe('analyzeText', () => {
  it('returns null for empty input', () => {
    expect(analyzeText('   ')).toBeNull()
  })

  it('files Chinese finance text under Chinese › Finance', () => {
    const a = analyzeText('本季營收成長，匯率波動使毛利率下降。')!
    expect(a.category).toBe('Chinese')
    expect(a.sub).toBe('Finance')
  })
})
```

測試命名：`describe` 用受測單位名稱，`it` 用英文完整句描述行為（`'records the missed target character, not the key pressed'`）。
AAA 結構與 mock 規則見 `elf-unit`。
