# elf-api-contract — 前端 client 完整範本

`<app>` 換成專案代號（小寫，例：`<appname>`）。結構取自參考專案 `apps/src/api/`，並補上 ProblemDetails 支援。

```
apps/src/api/
├─ http.ts            axios instance、token、ApiError、USE_MOCK、delay
├─ http.test.ts       normalizeError 測試
├─ index.ts           api 物件：每個 endpoint 一個具名方法，pick(mock, real)
├─ types.ts           wire types（只放 interface / type）
└─ mock/
   ├─ fixtures.ts     以 wire type 標註的假資料
   └─ fixtures.test.ts
```

---

## 1. apps/src/api/http.ts

```ts
import axios, { type AxiosInstance } from 'axios'
import type { ProblemDetails } from './types'

export const TOKEN_KEY = '<app>.token'

/** Sample data instead of a backend. On unless VITE_USE_MOCK is exactly 'false'. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = readToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) clearToken()
    return Promise.reject(normalizeError(error))
  },
)

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Machine-readable `<resource>.<reason>` from ProblemDetails. Branch on this, never on `message`. */
    readonly code?: string,
    /** Field errors from a 400 ValidationProblem, keyed by camelCase field name. */
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Reads ProblemDetails first (`detail` → `title`), then the legacy `{ message }` shape. */
export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as (Partial<ProblemDetails> & { message?: string }) | undefined
    return new ApiError(
      data?.detail || data?.title || data?.message || error.message,
      error.response?.status,
      data?.code,
      data?.errors,
    )
  }
  return new ApiError(error instanceof Error ? error.message : String(error))
}

/** localStorage is unavailable in some private windows. */
export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Keeps mock calls asynchronous so loading states behave like the real thing. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
```

### 1.1 apps/src/api/http.test.ts

```ts
import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { normalizeError } from './http'

function axiosError(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
  } as AxiosResponse)
}

describe('normalizeError', () => {
  it('prefers ProblemDetails detail and keeps the code', () => {
    const err = normalizeError(
      axiosError(409, { title: 'Conflict', detail: "Category 'Basics' already exists.", code: 'category.duplicate_name' }),
    )
    expect(err.message).toBe("Category 'Basics' already exists.")
    expect(err.status).toBe(409)
    expect(err.code).toBe('category.duplicate_name')
  })

  it('exposes validation errors by field', () => {
    const err = normalizeError(
      axiosError(400, { title: 'One or more validation errors occurred.', errors: { text: ['Text is required.'] } }),
    )
    expect(err.errors?.text).toEqual(['Text is required.'])
  })

  it('still reads the legacy { message } shape', () => {
    expect(normalizeError(axiosError(400, { message: 'Text is required.' })).message).toBe('Text is required.')
  })
})
```

---

## 2. apps/src/api/index.ts

```ts
import { delay, http, USE_MOCK, writeToken } from './http'
import * as fx from './mock/fixtures'
import type {
  AuthUserDto,
  CategoryDto,
  HistoryItemDto,
  LoginRequest,
  PagedResult,
  TextDto,
} from './types'

/** `VITE_USE_MOCK` decides per call whether the fixture or the endpoint answers. */
async function pick<T>(mock: () => T, real: () => Promise<{ data: T }>): Promise<T> {
  if (USE_MOCK) return delay(mock())
  const res = await real()
  return res.data
}

export const api = {
  auth: {
    async login(body: LoginRequest): Promise<AuthUserDto> {
      const user = await pick(
        () => ({ id: 1, username: body.username, token: 'mock-token' }),
        () => http.post<AuthUserDto>('/auth/login', body),
      )
      writeToken(user.token)
      return user
    },
  },

  categories: {
    /** Bounded catalogue: a bare array, not paged. */
    list: (): Promise<CategoryDto[]> =>
      pick(
        () => fx.CATEGORIES,
        () => http.get<CategoryDto[]>('/categories'),
      ),
  },

  texts: {
    /** Query goes through `params`, never string concatenation. */
    list: (params: { category?: string; level?: string } = {}): Promise<TextDto[]> =>
      pick(
        () => fx.TEXTS,
        () => http.get<TextDto[]>('/texts', { params }),
      ),
    get: (id: number): Promise<TextDto> =>
      pick(
        () => fx.TEXTS.find((t) => t.id === id) ?? fx.TEXTS[0],
        () => http.get<TextDto>(`/texts/${id}`),
      ),
  },

  sessions: {
    /** Unbounded history: paged with page/size. */
    mine: (page = 1, size = 50): Promise<PagedResult<HistoryItemDto>> =>
      pick(
        () => fx.paged(fx.HISTORY, page, size),
        () => http.get<PagedResult<HistoryItemDto>>('/sessions/me', { params: { page, size } }),
      ),
  },

  models: {
    /** Path segments that come from data are encoded. 204 responses resolve to void. */
    install: (code: string): Promise<void> =>
      pick(
        () => undefined,
        () => http.post<void>(`/models/${encodeURIComponent(code)}/install`),
      ),
  },
}

export * from './types'
export { ApiError, USE_MOCK } from './http'
```

在 store 使用（view 只讀 store）：

```ts
// apps/src/stores/library.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type CategoryDto, type TextDto } from '@/api'

export const useLibraryStore = defineStore('library', () => {
  const categories = ref<CategoryDto[]>([])
  const texts = ref<TextDto[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      ;[categories.value, texts.value] = await Promise.all([api.categories.list(), api.texts.list()])
    } finally {
      loading.value = false
    }
  }

  return { categories, texts, loading, load }
})
```

---

## 3. apps/src/api/types.ts

```ts
/**
 * Wire types. These mirror the ASP.NET Core DTO records and docs/api-contract.md —
 * change all three in the same pull request.
 *
 * Rules: interface name === C# record name; property === camelCase of the C# property;
 * C# nullable → `T | null`; optional `?` only when the server omits the field.
 */

// ---- shared -------------------------------------------------------------

/** Paged list shape: `?page=1&size=50`, `page` starts at 1, `size` is clamped to 1..500. */
export interface PagedResult<T> {
  total: number
  page: number
  size: number
  rows: T[]
}

/** RFC 9457 error body returned for every 4xx/5xx. */
export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  /** `<resource>.<reason>`, e.g. `category.not_found`. */
  code?: string
  traceId?: string
  /** Present on 400 validation failures, keyed by camelCase field name. */
  errors?: Record<string, string[]>
}

// ---- auth ---------------------------------------------------------------

/** Body of `POST /auth/login` and `POST /auth/register`. */
export interface LoginRequest {
  username: string
  password: string
}

/** Signed-in user; `token` is the bearer JWT stored under `<app>.token`. */
export interface AuthUserDto {
  id: number
  username: string
  token: string
}

// ---- library ------------------------------------------------------------

/** One entry of the bounded category catalogue (`GET /categories` returns a bare array). */
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

/** One finished run in the signed-in user's history (`GET /sessions/me`). */
export interface HistoryItemDto {
  id: number
  category: string
  speed: number
  unit: 'wpm' | 'cpm'
  accuracy: number
  /** ISO 8601 UTC. */
  when: string
}
```

對應的 C#（同名、PascalCase，放在 `server/src/<App>.Api/Api/<Feature>Endpoints.cs`）：

```csharp
public record CategoryDto(int Id, string Code, string Name, string Color);

public record TextDto(
    int Id,
    string Title,
    string Category,
    string Level,
    int Chars,
    double? Best,
    DateTime? LastPractisedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Content);
```

`Content` 是唯一「會被省略」的欄位，所以 TS 寫 `content?: string`；其他 nullable 欄位一律輸出 `null`，TS 寫 `T | null`。

---

## 4. Mock fixtures

### 4.1 apps/src/api/mock/fixtures.ts

```ts
/**
 * Sample data that stands in for the API while `VITE_USE_MOCK` is on.
 * Everything here is typed with the wire DTOs, so switching the flag off
 * changes the source of the data and nothing else.
 */
import type { CategoryDto, HistoryItemDto, PagedResult, TextDto } from '../types'

export const CATEGORIES: CategoryDto[] = [
  { id: 1, code: 'basic', name: 'Basics', color: '#8a9a5b' },
  { id: 2, code: 'zh', name: 'Chinese', color: '#c0504d' },
]

export const TEXTS: TextDto[] = [
  {
    id: 1,
    title: 'Home row',
    category: 'basic',
    level: 'A1',
    chars: 120,
    best: null,
    lastPractisedAt: null,
  },
]

export const HISTORY: HistoryItemDto[] = [
  { id: 1, category: 'basic', speed: 58, unit: 'wpm', accuracy: 97.2, when: '2026-09-26T10:00:00Z' },
]

/** Same clamping rules as the server, so paging UI behaves identically in mock mode. */
export function paged<T>(all: T[], page = 1, size = 50): PagedResult<T> {
  const p = Math.max(page, 1)
  const s = Math.min(Math.max(size, 1), 500)
  return { total: all.length, page: p, size: s, rows: all.slice((p - 1) * s, p * s) }
}
```

### 4.2 apps/src/api/mock/fixtures.test.ts

```ts
import { describe, expect, it } from 'vitest'
import { HISTORY, paged } from './fixtures'

describe('paged fixture helper', () => {
  it('clamps page and size like the server', () => {
    const res = paged(HISTORY, 0, 9999)
    expect(res.page).toBe(1)
    expect(res.size).toBe(500)
  })

  it('slices the requested page', () => {
    const rows = Array.from({ length: 5 }, (_, i) => i)
    expect(paged(rows, 2, 2).rows).toEqual([2, 3])
  })
})
```

---

## 5. 環境變數與代理

### 5.1 apps/.env.example

```dotenv
# Copy to .env.local and adjust. Both flags are read at BUILD time by Vite.

# Base URL of the ASP.NET Core API. Docker builds use /api (same origin, nginx proxies).
# Local dev against a running API: https://localhost:<port>/api (origin must be in Cors:Origins).
VITE_API_BASE_URL=https://localhost:7001/api

# true  → all data comes from the in-repo fixtures (no backend needed).
#         This is also the default when the variable is unset.
# false → every request goes to VITE_API_BASE_URL.
#         docker/web.Dockerfile passes false for production images.
VITE_USE_MOCK=true
```

### 5.2 apps/env.d.ts

新專案 MUST（參考專案未實作）。放在 `apps/env.d.ts`（與 `apps/package.json` 同層），並確認 `apps/tsconfig*.json` 的 `include` 涵蓋它。

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 5.3 docker/web.Dockerfile 與 docker-compose.yml

**MUST** 直接使用 **elf-cicd-docker** 的 `templates/web.Dockerfile` 與 `templates/docker-compose.yml`，本 skill 不另外提供版本。契約相關的要求只有這些（elf-cicd-docker 範本已包含）：

- `ARG VITE_API_BASE_URL=/api` + `ENV VITE_API_BASE_URL=$VITE_API_BASE_URL`：相對路徑讓瀏覽器維持同源，由 nginx 代理，正式環境不需要 CORS。
- `ARG VITE_USE_MOCK=false` + `ENV VITE_USE_MOCK=$VITE_USE_MOCK`：正式映像預設打真 API。程式碼預設是開（`!== 'false'`），所以 Dockerfile **MUST** 明確傳 `false`。
- pnpm 以 `npm install -g pnpm@${PNPM_VERSION}` 安裝，版本等於根 `package.json` 的 `"packageManager": "pnpm@<PNPM_VERSION>"`；不使用 corepack。
- 新增 `VITE_*` 變數時，同 PR 在 `web.Dockerfile` 加 `ARG` + `ENV`、在 `apps/.env.example` 加註解說明。
- 後端還有 `mock` 狀態的 endpoint、又想用 Docker 展示時，才在 compose 的 `web.build.args` 覆寫 `VITE_USE_MOCK: 'true'`。

### 5.4 docker/nginx.conf（/api 區塊，與 elf-cicd-docker `templates/nginx.conf` 相同）

```nginx
# Same-origin API: the bundle calls /api/... and nginx forwards it to the
# backend container, so the browser never sees a cross-origin request.
location /api/ {
    proxy_pass http://api:8080/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

`location /api/` 與 `proxy_pass .../api/` **兩邊都保留結尾斜線**；少了任何一個，路徑會被重複或截掉。

### 5.5 三方對照

| 環境 | `VITE_API_BASE_URL` | 瀏覽器實際請求 | 需要 CORS |
|---|---|---|---|
| 本機 mock | 不影響 | 無（fixtures） | 否 |
| 本機直連 API | `https://localhost:7001/api` | 跨來源 → API | 是（`Cors:Origins` 含 `http://localhost:5173`） |
| Docker / 正式 | `/api` | 同源 `/api/...` → nginx → `api:8080/api/...` | 否 |
| 桌面殼（Tauri） | 完整 API URL | 跨來源 → API | 是（`http(s)://tauri.localhost`） |
