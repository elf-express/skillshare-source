---
name: elf-vue
description: |
  Elf Express 團隊 Vue 3 + TypeScript 前端開發規範（目錄結構、SFC 寫法、Pinia、命名、環境變數、lint/format/typecheck、Vitest 單元測試）。
  當任務涉及：新建或修改 `.vue` 元件、`<script setup lang="ts">`、props/emits/v-model 型別、Pinia store、composable、
  `@/` 路徑別名、`apps/` 前端目錄、`VITE_*` 環境變數、ant-design-vue 元件註冊、eslint / prettier / vue-tsc 設定、
  前端 `*.test.ts`（Vitest + @vue/test-utils）或覆蓋率門檻時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express Vue 3 + TypeScript 規範

> 事實來源：參考專案 `TypingTrainer/apps`（Vue 3.5、Vite 6、Pinia、vue-i18n、Vitest、ant-design-vue）。
> 團隊標準（Node 24.18、pnpm、UI 函式庫 ant-design-vue 4）覆蓋參考專案（參考專案用 npm）。
> 完整範本：[`references/templates.md`](references/templates.md)；設定檔：[`references/config.md`](references/config.md)。

相關 skill：
- `elf-stack` — 技術棧版本總表
- `elf-api-contract` / `elf-api-design` — API 形狀、錯誤格式、DTO 命名
- `elf-ui-pattern` — 元件 API、a11y、三態、design token
- `elf-i18n` — 多語系、IME 輸入
- `elf-unit` — 單元測試通則；`elf-e2e` — Playwright；`elf-cicd-frontend` — CI 流程

---

## 1. 何時使用

- 建立 / 修改任何 `.vue`、`src/**/*.ts` 前端程式
- 新增 Pinia store、composable、route、API 呼叫
- 設定或修改 `vite.config.ts`、`tsconfig.json`、`eslint.config.js`、`.prettierrc.json`、`.env.example`
- 撰寫前端單元測試或調整覆蓋率

不適用：純後端（→ `elf-dotnet`）、E2E（→ `elf-e2e`）。

---

## 2. 固定規則

### 2.1 目錄結構（MUST）

前端一律放在 repo 根目錄的 `apps/`（pnpm workspace 成員），結構固定如下：

```
apps/
├─ .env.example        # 提交；列出所有 VITE_* 變數與說明
├─ .env.local          # 不提交（.gitignore: *.local / .env.*）
├─ env.d.ts            # vite/client 參考、ImportMetaEnv、*.vue 宣告、define 常數
├─ eslint.config.js    # ESLint flat config
├─ index.html
├─ package.json        # name: @<project>/web
├─ tsconfig.json
├─ vite.config.ts      # 含 Vitest 的 test 區塊
└─ src/
   ├─ main.ts          # createApp + use(pinia/router/i18n)，不放業務邏輯
   ├─ App.vue          # 殼層：layout、全域快捷鍵、初始載入
   ├─ router/index.ts  # 路由表；view 一律 lazy import
   ├─ views/           # 一個 route 一個 XxxView.vue；只做版面與文案
   ├─ components/      # 可重用元件 PascalCase.vue
   ├─ composables/     # useXxx.ts
   ├─ stores/          # Pinia setup store，一檔一 store
   ├─ api/             # http.ts（axios 實例）、types.ts（DTO）、index.ts（api 物件）、mock/
   ├─ i18n/            # index.ts + locales/*.json（見 elf-i18n）
   ├─ plugins/antd.ts  # ant-design-vue 按需註冊清單（main.ts 與元件測試共用）
   ├─ lib/             # 純函式（無 Vue 依賴），最適合單元測試
   ├─ data/            # 常數、共用型別
   ├─ assets/          # 由程式 import 的圖片 / 字型
   └─ styles/          # 全域 CSS 與 design token（見 elf-ui-pattern）
```

1. **MUST** 維持分層：`views → stores → api`。View **MUST NOT** 直接 import `axios` 或 `@/api`；View 讀 store，store 呼叫 `api`。
2. **MUST NOT** 在 `views/` 放可重用元件；被兩個以上 view 使用即移到 `components/`。
3. **MUST** 將無 Vue 依賴的計算邏輯放 `lib/`，並附 `*.test.ts`。
4. 參考專案使用 `src/router.ts` 單檔；新專案 **MUST** 用 `src/router/index.ts`（import 路徑同為 `@/router`）。

### 2.2 SFC 寫法（MUST）

5. **MUST** 使用 `<script setup lang="ts">`。**MUST NOT** 使用 Options API、`defineComponent({ ... })`、`this`。
6. **MUST** 區塊順序：`<script setup lang="ts">` → `<template>` → `<style scoped>`。
7. **MUST** `<script setup>` 內部順序：
   1. `import`（vue → 第三方 → `@/` → `import type`）
   2. `defineProps` / `defineEmits` / `defineModel`
   3. composable / store / `useI18n()` / `useRoute()`
   4. `ref` / `reactive` 狀態
   5. `computed`
   6. 函式
   7. `watch`
   8. 生命週期（`onMounted` / `onBeforeUnmount`）
8. **MUST** props 用型別宣告：`withDefaults(defineProps<{ ... }>(), { ... })`；**MUST NOT** 用 runtime 物件宣告（`defineProps({ foo: String })`）。
9. **MUST** emits 用具名 tuple 語法：`defineEmits<{ select: [id: string]; close: [] }>()`。
10. **MUST** 雙向綁定用 `defineModel<T>()`，新程式 **MUST NOT** 手寫 `modelValue` + `update:modelValue`。
11. **MUST** 樣式用 `<style scoped>`；覆寫 ant-design-vue 內部 class（`.ant-*`）用 `:deep()`，且優先改 `theme.token`（見 `elf-ui-pattern` 規則 29）。**MUST NOT** 在元件寫未 scoped 的全域樣式（全域樣式只放 `src/styles/`）。
12. **MUST NOT** 在 template 寫多於一個運算子的邏輯；抽成 `computed`。
13. **MUST** 以 `const xxxRef = ref<HTMLElement | null>(null)` + `ref="xxxRef"` 取 DOM；存取前判斷 `null`。
14. **MUST** 在 `onMounted` 註冊的 `addEventListener` / `setInterval` / `ResizeObserver`，於 `onBeforeUnmount` 移除。

### 2.3 Pinia（MUST）

15. **MUST** 用 setup 風格：`defineStore('<id>', () => { ...; return { ... } })`。**MUST NOT** 用 options 風格（`state/getters/actions`）。
16. **MUST** 命名：檔案 `stores/<id>.ts`，id 與檔名相同（小寫），匯出 `use<Id>Store`（例：`stores/library.ts` → `useLibraryStore`，id `'library'`）。
17. **MUST** 回傳所有 state（`ref`）、getter（`computed`）、action（function）；未回傳的 state 在 devtools 不可見、測試無法設定。
18. **MUST** 非同步載入的 store 帶 `loading` / `loaded`（或 `status` union）旗標並以 `try/finally` 還原；已載入或載入中時直接 return。
19. **MUST NOT** 在 store 回傳已翻譯字串；回傳 i18n key（例：`statusKey`），由元件 `t()` 翻譯。
20. **MUST** 在元件中解構 store state 時用 `storeToRefs()`；直接 `const { x } = store` 會失去響應性。action 可直接解構。

### 2.4 命名與匯入（MUST）

| 對象 | 規則 | 範例 |
| --- | --- | --- |
| 元件檔 | PascalCase.vue | `ToggleSwitch.vue`、`AppSider.vue` |
| 頁面檔 | PascalCase + `View` | `PracticeView.vue` |
| composable | `use` + PascalCase，檔名同函式 | `useViewport.ts` → `export function useViewport()` |
| store | 見 2.3 | `useSettingsStore` |
| 型別 / interface | PascalCase；API 傳輸型別加 `Dto` 後綴 | `TextDto`、`Category` |
| 常數 | UPPER_SNAKE_CASE | `TOKEN_KEY`、`SRS_DAYS` |
| route name | 小寫 | `{ name: 'practice' }` |
| 測試 | `<同名>.test.ts` 放在受測檔旁 | `analyze.ts` → `analyze.test.ts` |

21. **MUST** 跨目錄 import 使用 `@/`（對應 `apps/src`）；同目錄可用 `./`。**MUST NOT** 使用 `../`。
22. **MUST** TS 模組使用具名匯出（`export function` / `export const`）；`.vue` 由編譯器提供 default export。
23. **MUST NOT** 使用 `any`；未知型別用 `unknown` 再收窄。**MUST NOT** 使用 `var`。
24. 頁面元件名稱允許單字（`Practice`、`Result`），因此 ESLint 關閉 `vue/multi-word-component-names`。

### 2.5 環境變數（MUST）

25. **MUST** 前端可讀的變數以 `VITE_` 開頭；透過 `import.meta.env.VITE_XXX` 讀取，**MUST** 在 `env.d.ts` 的 `ImportMetaEnv` 宣告型別。
26. **MUST** 提交 `apps/.env.example`（每個變數附註解說明用途與可選值）。**MUST NOT** 提交 `.env`、`.env.local`、`.env.*.local`。
27. **MUST NOT** 在 `VITE_*` 放任何秘密（API key、token、密碼）— 打包後會出現在 JS bundle。
28. **MUST** 讀取時給預設值並集中在 `api/http.ts` 或單一 config 模組（例：`import.meta.env.VITE_API_BASE_URL || '/api'`），**MUST NOT** 散落在元件中。

### 2.6 API 呼叫（MUST）

29. **MUST** 所有 HTTP 經過 `src/api/http.ts` 的單一 axios 實例（baseURL、timeout、Bearer token、401 處理、錯誤正規化為 `ApiError`）。`http.ts`、`ApiError`、`normalizeError` 的**唯一範本**在 `elf-api-contract` references/client-templates.md §1，本 skill 不另給一份。
30. **MUST** DTO 型別放 `src/api/types.ts`，欄位與後端契約逐字一致（見 `elf-api-contract`）；**MUST NOT** 在元件內宣告 API 回應型別。
31. **MUST** 以 `VITE_USE_MOCK` 切換 `api/mock/` fixture，且**預設開**：`USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`；`apps/.env.example` 寫 `VITE_USE_MOCK=true`。正式映像由 `web.Dockerfile` 的 `ARG VITE_USE_MOCK=false` 關閉（見 `elf-cicd-docker`）。**MUST NOT** 改成 `=== 'true'`。

### 2.7 品質工具（MUST）

32. **MUST** 通過 `pnpm verify`（= `format:check` → `lint` → `typecheck` → `test:coverage` → `build`，與 CI web job 同序，見 `elf-cicd-frontend`）才可提交 / 開 PR。
33. **MUST** 型別檢查用 `vue-tsc --noEmit`；`build` 腳本 **MUST** 先跑 `vue-tsc --noEmit` 再 `vite build`。
34. **MUST** ESLint 用 flat config（`eslint.config.js`：`@eslint/js` + `typescript-eslint` + `eslint-plugin-vue` `flat/recommended`，`eslint-config-prettier` 放最後）。
35. **MUST** Prettier：`semi: false`、`singleQuote: true`、`printWidth: 110`、`trailingComma: 'all'`。排版交給 Prettier，ESLint 不管排版。
36. **MUST** `.editorconfig`：UTF-8、LF、2 空格、結尾換行。
37. **MUST NOT** 用 `// eslint-disable` 或 `// @ts-ignore` 繞過錯誤；確有必要時用 `// @ts-expect-error <原因>`，並在 PR 說明。

### 2.8 測試（MUST）

38. **MUST** 測試檔為 `Xxx.test.ts`，放在受測檔旁（`ToggleSwitch.vue` → `ToggleSwitch.test.ts`）。**MUST NOT** 建立 `.test.vue`、`__tests__/` 或 `src/**/*.spec.ts`（`.spec.ts` 保留給 `e2e/`）。
39. **MUST** 使用 Vitest + `@vue/test-utils`，環境 `jsdom`，`globals: false`（從 `vitest` 明確 import `describe/it/expect/vi`）。
40. **MUST** store 測試在 `beforeEach` 執行 `setActivePinia(createPinia())`。
41. **MUST** 行覆蓋率（lines）≥ **55%**，由 `vite.config.ts` 的 `coverage.thresholds.lines: 55` 強制，未達標即失敗。計算範圍固定：`include: ['src/**/*.{ts,vue}']`，`exclude` 為測試檔、`.d.ts`、`src/main.ts`、`src/api/mock/**`（與 `elf-cicd-frontend` 相同）。
42. **MUST** 修 bug 時先寫會紅的測試；修好後暫時拿掉修正，確認測試會紅（參考專案曾兩次出現測試對已壞程式碼仍綠燈）。
43. jsdom 觀察不到 focus、IME 組字、瀏覽器事件順序 — 這類行為 **MUST** 寫在 `e2e/`（見 `elf-e2e`）。

### 2.9 工具鏈（MUST）

44. **MUST** Node `>=24.18`（`package.json` `engines`；repo 根目錄 `.nvmrc` = `24.18`），engine-strict **只**寫在 `pnpm-workspace.yaml`（`engineStrict: true`）；`.npmrc` 只放 registry / auth（見 references/config.md、`elf-stack`）。
45. **MUST** 使用 pnpm，`packageManager` 寫 `pnpm@<PNPM_VERSION>` 完整版號（版號見 `elf-stack`）。**MUST NOT** 使用 corepack。**MUST NOT** 提交 `package-lock.json` / `yarn.lock`；只提交 `pnpm-lock.yaml`。
46. **MUST** CI 安裝用 `pnpm install --frozen-lockfile`（CI 細節見 `elf-cicd-frontend`）。前端依賴 **MUST** 加在 `apps`（`pnpm --filter ./apps add`），不加在 repo 根目錄。

### 2.10 UI 函式庫（MUST，已決議）

47. **MUST** UI 函式庫使用 **ant-design-vue 4**（版本見 `elf-stack`），在 `src/plugins/antd.ts` 按需註冊（範本見 references/templates.md §1）。**MUST NOT** 自行引入第二套 UI 函式庫或改用其他函式庫。對話框、確認、載入、空狀態、錯誤結果等一律用對應 `a-*` 元件（對照表見 `elf-ui-pattern` 2.8）。
48. SoybeanAdmin / NaiveUI 系既有 repo（例 `platform.client`：`@sa/*` 套件、kebab-case 檔名、`src/service/api/`、`declare namespace Api`）為**歷史例外**：在該 repo 內工作時**以該 repo 的 CLAUDE.md 為準**，不套用本檔的目錄結構與 UI 函式庫規則，也**MUST NOT** 把 ant-design-vue 帶進去。

---

## 3. 標準範本

完整可複製版本在 [`references/templates.md`](references/templates.md)（main.ts + `plugins/antd.ts`、元件、View、router、store、composable、api 型別與 index、元件測試、store 測試；`http.ts` 見 `elf-api-contract`）
與 [`references/config.md`](references/config.md)（package.json、pnpm-workspace.yaml、vite.config.ts、tsconfig、eslint、prettier、env）。

### 3.1 元件骨架

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TextItem } from '@/data/types'

const props = withDefaults(defineProps<{ item: TextItem; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ select: [title: string] }>()

const { t } = useI18n()

const label = computed(() => (props.compact ? props.item.title.slice(0, 12) : props.item.title))

function onClick() {
  emit('select', props.item.title)
}
</script>

<template>
  <button type="button" class="text-card" :class="{ 'is-compact': props.compact }" @click="onClick">
    <span class="title">{{ label }}</span>
    <span class="meta">{{ t('library.chars', { count: props.item.chars }) }}</span>
  </button>
</template>

<style scoped>
.text-card {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
}
</style>
```

### 3.2 Setup store 骨架

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import type { TextItem } from '@/data/types'

export const useLibraryStore = defineStore('library', () => {
  const texts = ref<TextItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const count = computed(() => texts.value.length)

  async function load() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      texts.value = await api.texts.list()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return { texts, loading, loaded, count, load }
})
```

### 3.3 Composable 骨架

```ts
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Window size as reactive refs. */
export function useViewport() {
  const vw = ref(typeof window === 'undefined' ? 1400 : window.innerWidth)
  const vh = ref(typeof window === 'undefined' ? 900 : window.innerHeight)

  const onResize = () => {
    vw.value = window.innerWidth
    vh.value = window.innerHeight
  }

  onMounted(() => window.addEventListener('resize', onResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onResize))

  return { vw, vh }
}
```

### 3.4 常用指令（repo 根目錄）

```bash
pnpm install                          # 安裝（CI: pnpm install --frozen-lockfile）
pnpm dev                              # 開發伺服器 http://localhost:5173
pnpm verify                           # format:check → lint → typecheck → test:coverage → build（提交前必跑）
pnpm --filter ./apps test:coverage    # 覆蓋率（門檻 lines 55%）
pnpm --filter ./apps add <pkg>        # 前端依賴加在 apps，不加在根目錄
```

---

## 4. 檢查清單

- [ ] 所有 `.vue` 為 `<script setup lang="ts">`，區塊順序 script → template → style scoped
- [ ] props / emits / model 皆為型別宣告，無 runtime 物件宣告
- [ ] View 沒有 import `axios` 或 `@/api`
- [ ] 新 store 為 setup 風格、id = 檔名、匯出 `useXxxStore`、所有 state 皆已 return
- [ ] 元件解構 store state 時使用 `storeToRefs`
- [ ] 沒有 `../` import、沒有 `any`、沒有 `@ts-ignore`
- [ ] 新增的 `VITE_*` 已寫入 `.env.example` 與 `env.d.ts` 的 `ImportMetaEnv`
- [ ] 沒有秘密放在 `VITE_*`；`.env.local` 未被 `git add`
- [ ] `onMounted` 註冊的 listener / timer / observer 皆於 `onBeforeUnmount` 清除
- [ ] 新邏輯有同目錄 `*.test.ts`；`pnpm --filter ./apps test:coverage` lines ≥ 55%
- [ ] UI 文字全部走 i18n（見 `elf-i18n`）；沒有 `` t(`xxx.${var}`) `` 動態拼 key
- [ ] 對話框 / 確認 / 載入 / 空狀態用 ant-design-vue `a-*` 元件，且已加入 `src/plugins/antd.ts`
- [ ] `VITE_USE_MOCK` 判斷為 `!== 'false'`；`.env.example` 為 `true`
- [ ] `pnpm verify` 全綠

---

## 5. 常見錯誤

| 錯誤寫法 | 正確寫法 | 原因 |
| --- | --- | --- |
| `const { texts } = useLibraryStore()` | `const { texts } = storeToRefs(useLibraryStore())` | 直接解構失去響應性 |
| View 內 `axios.get('/texts')` | View 呼叫 `store.load()`，store 呼叫 `api.texts.list()` | 違反分層，mock 切換失效 |
| `defineProps({ size: String })` | `defineProps<{ size?: 'sm' \| 'md' }>()` | 失去型別與字面值檢查 |
| `defineEmits(['change'])` | `defineEmits<{ change: [value: string] }>()` | payload 無型別 |
| `import x from '../../stores/session'` | `import { useSessionStore } from '@/stores/session'` | 搬檔即壞 |
| `Foo.test.vue` / `__tests__/Foo.spec.ts` | `Foo.test.ts` 與 `Foo.vue` 同目錄 | Vitest `include` 只收 `src/**/*.test.ts` |
| store 回傳 `t('status.ready')` | store 回傳狀態值，元件用完整 key 對照表：`const STATUS_LABEL: Record<Status, string> = { ready: 'status.ready', … }` → `t(STATUS_LABEL[status])` | 切換語系時 store 不會重算；**禁止** `` t(`status.${x}`) `` 動態拼 key（見 `elf-i18n` 規則 19） |
| `USE_MOCK = VITE_USE_MOCK === 'true'` | `USE_MOCK = VITE_USE_MOCK !== 'false'`，正式映像用 Docker `ARG VITE_USE_MOCK=false` 關閉 | 團隊預設開（與 `elf-api-contract` 一致）；關閉責任在正式建置 |
| 在 `http.ts` 自寫一份 `ApiError` / `normalizeError` | 照 `elf-api-contract` client-templates §1 原樣複製 | 兩份實作會漂移，`code` / `errors` 會被漏掉 |
| 自寫 Modal / 確認框 / spinner | `a-modal`、`a-popconfirm`、`a-spin`、`a-empty`、`a-result` | 團隊 UI 函式庫已定為 ant-design-vue 4，自寫會缺 focus 管理 |
| `VITE_API_KEY=sk-...` | 秘密放後端，前端只放公開 URL / 旗標 | `VITE_*` 會打包進 JS |
| `window.addEventListener` 未移除 | `onBeforeUnmount` 移除 | 路由切換後重複觸發、記憶體洩漏 |
| template 寫 `a && b ? x : y \|\| z` | 抽 `computed` | 可讀性、可測性 |
| `npm install` / 提交 `package-lock.json` | `pnpm install`，只提交 `pnpm-lock.yaml` | 團隊統一 pnpm |
| 用 jsdom 測 focus / IME | 寫 Playwright e2e | jsdom 無真實 focus / 組字 |

---

## 6. 待確認

以下項目**不要自行猜測**；遇到時沿用本檔預設並在 PR 中標注：

1. **pnpm 確切版號**：11.x 或 12 由 `elf-stack` 決定；定案前 `packageManager` 寫 `pnpm@<PNPM_VERSION>` 並填本機完整版號。
2. **套件版本基準**：Pinia 2（參考專案）或 3（`platform.client`）；vue-i18n 10 或 11；Vitest 主版本。以 `elf-stack` 為準，`elf-stack` 未定前沿用參考專案版本。
3. **`defineOptions({ name })`**：SoybeanAdmin 規範要求每個元件都加；參考專案沒有。是否全團隊強制（KeepAlive `include` 需要）待定，本檔預設不強制。
4. **v-model 寫法**：本檔規定 `defineModel`；參考專案 `ToggleSwitch.vue` 仍用 `modelValue` + `update:modelValue`。舊元件是否回頭統一待定。
5. **覆蓋率排除清單擴充**：include / exclude 已固定（規則 41）；是否再排除 `router/`、`i18n/locales/` 等，待團隊決定（與 `elf-cicd-frontend` 同一項）。
6. **Router 模式**：參考專案用 `createWebHashHistory`（為了 Tauri `file://`）；純 Web 專案是否改 `createWebHistory` 待定。

已決議、不再列入待確認：engine-strict 只寫 `pnpm-workspace.yaml`；UI 函式庫 = ant-design-vue 4（SoybeanAdmin / NaiveUI repo 為歷史例外，見規則 48）；`VITE_USE_MOCK` 預設開；覆蓋率 include / exclude。
