# E2E 範本：POM、fixtures、登入、spec

> 由 [`../SKILL.md`](../SKILL.md) §3.3 連結。路徑皆相對於 repo 根目錄。
> 範例頁面為「登入」與「訂單列表」，複製後改成實際頁面與 `data-testid`。
> 預設 config 為 mock 模式、沒有登入（SKILL.md §2.5）：§1、§4 只有開啟 opt-in 登入 / 真後端變體時才需要。

## 1. `e2e/pages/LoginPage.ts`（登入變體才需要）

```ts
import type { Locator, Page } from '@playwright/test'

export class LoginPage {
  readonly root: Locator
  readonly username: Locator
  readonly password: Locator
  readonly submit: Locator

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('login-form')
    this.username = page.getByTestId('login-username')
    this.password = page.getByTestId('login-password')
    this.submit = page.getByTestId('login-submit')
  }

  async goto() {
    await this.page.goto('/#/login')
  }

  async login(username: string, password: string) {
    await this.username.fill(username)
    await this.password.fill(password)
    await this.submit.click()
  }
}
```

## 2. `e2e/pages/OrderListPage.ts`

```ts
import { expect, type Locator, type Page } from '@playwright/test'

export class OrderListPage {
  readonly root: Locator
  readonly searchInput: Locator
  readonly searchButton: Locator
  readonly rows: Locator
  readonly emptyState: Locator

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('order-list')
    this.searchInput = page.getByTestId('order-search-input')
    this.searchButton = page.getByTestId('order-search-submit')
    this.rows = page.getByTestId('order-row')
    this.emptyState = page.getByTestId('order-empty')
  }

  /** Opens the page and waits until it is actually rendered. */
  async goto() {
    await this.page.goto('/#/orders')
    await expect(this.root).toBeVisible()
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword)
    await this.searchButton.click()
  }

  row(code: string): Locator {
    return this.rows.filter({ hasText: code })
  }

  async cancel(code: string) {
    await this.row(code).getByTestId('order-cancel').click()
    await this.page.getByRole('button', { name: 'Confirm' }).click()
  }
}
```

## 3. `e2e/fixtures.ts`

```ts
import { test as base, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { OrderListPage } from './pages/OrderListPage'

type Pages = {
  loginPage: LoginPage
  orderListPage: OrderListPage
}

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
  orderListPage: async ({ page }, use) => {
    await use(new OrderListPage(page))
  },
})

export { expect }
```

新增頁面物件時：在 `pages/` 加 class → 在 `Pages` 型別與 `base.extend` 各加一行。
預設 mock 模式沒有登入頁時，刪掉 `loginPage` 這組即可。

## 4. `e2e/auth.setup.ts`（opt-in 登入 / 真後端變體）

只有 config 換成 SKILL.md §3.1 的登入變體（`setup` project + 後端 `webServer` + `VITE_USE_MOCK=false`）時才建立本檔；
預設 mock 模式**不要**建立，否則 CI 沒有 secrets 會直接失敗。

```ts
import { test as setup, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const user = process.env.E2E_USER
  const password = process.env.E2E_PASSWORD
  if (!user || !password) throw new Error('E2E_USER and E2E_PASSWORD must be set')

  const login = new LoginPage(page)
  await login.goto()
  await login.login(user, password)

  // Wait for a signal that only exists after a successful login.
  await expect(page.getByTestId('user-menu')).toBeVisible()
  await page.context().storageState({ path: authFile })
})
```

登入變體中需要「未登入」情境的 spec：

```ts
test.use({ storageState: { cookies: [], origins: [] } })
```

## 5. `e2e/order-list.spec.ts`

```ts
import { test, expect } from './fixtures'

/**
 * Order list: search, empty state and cancel flow.
 *
 * Covered here rather than in vitest because the flow crosses the router,
 * the confirm dialog (teleported to body) and the store. Runs in mock mode:
 * the rows come from apps/src/api/mock/fixtures.ts, so ORD-0042 must exist there.
 */

test.describe('order list', () => {
  test.beforeEach(async ({ orderListPage }) => {
    await orderListPage.goto()
  })

  test('shows only orders matching the search keyword', async ({ orderListPage }) => {
    await orderListPage.search('ORD-0042')

    await expect(orderListPage.rows).toHaveCount(1)
    await expect(orderListPage.row('ORD-0042')).toBeVisible()
  })

  test('shows the empty state when nothing matches', async ({ orderListPage }) => {
    await orderListPage.search('NO-SUCH-ORDER')

    await expect(orderListPage.emptyState).toHaveText('No orders found')
  })

  test('removes a cancelled order from the pending list', async ({ orderListPage }) => {
    await orderListPage.cancel('ORD-0042')

    await expect(orderListPage.row('ORD-0042')).toHaveCount(0)
  })
})
```

## 6. `e2e/helpers/layout.ts`（版面 / 溢出檢查）

```ts
import { expect, type Locator } from '@playwright/test'

/** True when the element's content is taller than the box drawn for it. */
export async function overflows(el: Locator) {
  return el.evaluate((n) => n.scrollHeight > n.clientHeight + 1)
}

export async function boxOf(el: Locator) {
  const box = await el.boundingBox()
  expect(box, 'element should be laid out').not.toBeNull()
  return box!
}
```

用法（參考 `settings-layout.spec.ts`）：

```ts
test('the toggles fit without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/settings')

  expect(await overflows(page.getByTestId('settings-toggles'))).toBe(false)
})
```

## 7. 攔截 API（`page.route`）

只在 app 真的發 HTTP（登入 / 真後端變體，`VITE_USE_MOCK=false`）時有作用；預設 mock 模式下 app 不打 API，攔截不會觸發。
用途是「後端狀態難以準備」或「要模擬錯誤回應」。錯誤 body 一律照團隊格式：RFC 9457 ProblemDetails + `code`
（見 `elf-api-design`）。

```ts
test('shows an error banner when the server fails', async ({ page, orderListPage }) => {
  await page.route('**/api/orders**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'server.error',
      }),
    }),
  )

  await orderListPage.goto()

  await expect(page.getByTestId('order-error')).toBeVisible()
})
```

## 8. 注入環境（桌面殼 / 旗標）

模組在載入時讀 `window` 旗標時，用 `addInitScript` 在頁面腳本執行前設定（參考 `settings-layout.spec.ts` 的 `pretendDesktop`）：

```ts
await page.addInitScript(() => {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
})
```
