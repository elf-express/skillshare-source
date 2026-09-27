# Vitest 單元測試範本

> 由 [`../SKILL.md`](../SKILL.md) §3.4 連結。每個範本都可直接複製，換掉被測物件名稱即可。
> 前提：`apps/vite.config.ts` 為 `environment: 'jsdom'`、`globals: false`、`include: ['src/**/*.test.ts']`。
> 以下路徑皆相對於 `apps/`。

## 1. 純函式 —— `src/lib/analyze.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { analyzeText } from './analyze'

describe('analyzeText', () => {
  it('returns null for empty input', () => {
    expect(analyzeText('   ')).toBeNull()
  })

  it.each([
    ['SELECT UserId FROM Sessions;', 'Code', 'SQL'],
    ['本季營收成長，匯率波動使毛利率下降。', 'Chinese', 'Finance'],
    ['Please transfer the balance before the payment date.', 'English', 'Banking'],
  ])('files %s under %s › %s', (input, category, sub) => {
    const result = analyzeText(input)!

    expect(result.category).toBe(category)
    expect(result.sub).toBe(sub)
  })

  it('truncates long titles to 18 characters plus an ellipsis', () => {
    const result = analyzeText('a'.repeat(50))!

    expect(result.title).toHaveLength(19)
    expect(result.title.endsWith('…')).toBe(true)
  })

  it('keeps a title of exactly 18 characters untouched', () => {
    const result = analyzeText('a'.repeat(18))!

    expect(result.title).toBe('a'.repeat(18))
  })
})
```

## 2. Pinia setup store —— `src/stores/order.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOrderStore } from './order'

describe('useOrderStore', () => {
  let store: ReturnType<typeof useOrderStore>

  beforeEach(() => {
    // A fresh Pinia per test: no state leaks between cases.
    setActivePinia(createPinia())
    store = useOrderStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with an empty cart', () => {
    expect(store.items).toEqual([])
    expect(store.total).toBe(0)
  })

  it('adds the quantity to an existing line instead of duplicating it', () => {
    store.add({ sku: 'A1', price: 100 }, 1)

    store.add({ sku: 'A1', price: 100 }, 2)

    expect(store.items).toHaveLength(1)
    expect(store.items[0].quantity).toBe(3)
  })

  it('refuses a zero quantity and leaves the cart unchanged', () => {
    const added = store.add({ sku: 'A1', price: 100 }, 0)

    expect(added).toBe(false)
    expect(store.items).toEqual([])
  })

  it('clears the cart after the checkout timeout', () => {
    vi.useFakeTimers()
    store.add({ sku: 'A1', price: 100 }, 1)

    store.startCheckout()
    vi.advanceTimersByTime(15 * 60 * 1000)

    expect(store.items).toEqual([])
  })
})
```

## 3. Vue 元件 —— `src/components/OrderCard.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderCard from './OrderCard.vue'

const order = { id: 42, code: 'ORD-0042', status: 'pending', total: 1250 } as const

describe('OrderCard', () => {
  it('renders the order code and formatted total', () => {
    const wrapper = mount(OrderCard, { props: { order } })

    expect(wrapper.get('[data-testid="order-code"]').text()).toBe('ORD-0042')
    expect(wrapper.get('[data-testid="order-total"]').text()).toContain('1,250')
  })

  it('emits cancel with the order id when the cancel button is clicked', async () => {
    const wrapper = mount(OrderCard, { props: { order } })

    await wrapper.get('[data-testid="order-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toEqual([[42]])
  })

  it('hides the cancel button once the order has shipped', () => {
    const wrapper = mount(OrderCard, { props: { order: { ...order, status: 'shipped' } } })

    expect(wrapper.find('[data-testid="order-cancel"]').exists()).toBe(false)
  })
})
```

- 元件用到 Pinia：`mount(C, { global: { plugins: [createPinia()] } })`
- 元件用到 vue-i18n：`global: { plugins: [i18n] }`，`i18n` 以 `createI18n({ legacy: false, locale: 'en', messages })` 建立；
  **MUST** 明確指定 locale，斷言該 locale 的字串
- 用到 ant-design-vue 等大型 UI 元件且與被測邏輯無關時，才用 `shallowMount` 或 `global.stubs`

## 4. 模組替身 —— `src/api/orderApi.test.ts`

HTTP 一律經 `@/api/http` 的 `http` instance（見 `elf-api-contract` §1）。它的 `baseURL` 已經是 `/api`，
所以呼叫路徑寫 `/orders`，**不要**再加 `/api`。分頁回應固定為 `{ total, page, size, rows }`。

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above every import; anything its factory uses must be hoisted too.
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/api/http', async (importOriginal) => ({
  // Keep ApiError / normalizeError real; replace only the axios instance and force real-API mode.
  ...(await importOriginal<typeof import('@/api/http')>()),
  http: { get, post },
  USE_MOCK: false,
}))

/**
 * Re-imports after resetModules so values computed at load time (USE_MOCK) see the mock above.
 * ApiError is taken from the same fresh module graph, so `instanceof` checks inside orderApi still match.
 */
async function load() {
  vi.resetModules()
  const [{ fetchOrders }, { ApiError }] = await Promise.all([import('./orderApi'), import('@/api/http')])
  return { fetchOrders, ApiError }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchOrders', () => {
  it('passes page and size as query parameters', async () => {
    get.mockResolvedValue({ data: { total: 0, page: 2, size: 20, rows: [] } })
    const { fetchOrders } = await load()

    await fetchOrders({ page: 2, size: 20 })

    expect(get).toHaveBeenCalledWith('/orders', { params: { page: 2, size: 20 } })
  })

  it('returns an empty page when the server responds 404', async () => {
    const { fetchOrders, ApiError } = await load()
    get.mockRejectedValue(new ApiError('Not found', 404, 'order.not_found'))

    const result = await fetchOrders({ page: 1, size: 20 })

    expect(result).toEqual({ total: 0, page: 1, size: 20, rows: [] })
  })

  it('rethrows server errors other than 404', async () => {
    const { fetchOrders, ApiError } = await load()
    get.mockRejectedValue(new ApiError('Server error', 500, 'server.error'))

    await expect(fetchOrders({ page: 1, size: 20 })).rejects.toMatchObject({ status: 500, code: 'server.error' })
  })
})
```

- 真實的 `http` 會在 interceptor 把錯誤正規化成 `ApiError`；替身直接 reject `ApiError`，與真實行為一致
- 分支判斷用 `ApiError.status` / `ApiError.code`，**不要**比對 `message` 文字
- **MUST NOT** 用 `vi.spyOn` 去改 ES module 的 named export（ESM 綁定唯讀）；要替換整個模組就用 `vi.mock`
