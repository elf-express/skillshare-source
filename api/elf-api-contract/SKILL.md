---
name: elf-api-contract
description: |
  Elf Express 前後端 API 契約同步規範：以 docs/api-contract.md 為人讀契約、apps/src/api/types.ts 對齊 .NET DTO、
  mock 模式 (VITE_USE_MOCK)、VITE_API_BASE_URL=/api 與 nginx /api 代理、schema 匯出，以及「改契約必須同 PR 改文件 + 型別 + 測試」。
  當任務涉及新增或修改 endpoint 的 request/response 形狀、編輯 types.ts 或 C# DTO record、api-contract.md、
  mock fixtures、apps/src/api/ 下的 client、.env 的 VITE_API_BASE_URL / VITE_USE_MOCK、nginx /api 代理，
  或審查可能改動 API 契約的 PR 時觸發。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# Elf Express 前後端 API 契約同步規範

前端 Vue 3 + TS（Node 24.18、pnpm 11.x）與後端 ASP.NET Core 10 之間的「線上格式」只有一份，分別寫在三個地方，**必須同時更新**：

| 位置 | 角色 | 誰讀 |
|---|---|---|
| `docs/api-contract.md` | 人讀契約：endpoint 表、DTO 名稱、特殊行為 | 人、AI review |
| `server/src/<App>.Api/Api/<Feature>Endpoints.cs` 內的 `record <Name>Dto` | 後端實作 | 編譯器、OpenAPI |
| `apps/src/api/types.ts` | 前端 wire types | vue-tsc |

URL、狀態碼、錯誤格式、分頁形狀等「API 長什麼樣子」見 **elf-api-design**；PR 自動審查設定見 **elf-cicd-review**；
DTO ↔ Entity 投影與 schema 見 **elf-sqlsugar**；前端 store/元件寫法見 **elf-vue**；HTTP 整合測試見 **elf-integration**；
`web.Dockerfile`、compose、nginx 範本見 **elf-cicd-docker**。

---

## 1. 何時使用

- 新增 endpoint，或改動任何 request/response 欄位、欄位型別、nullable、enum 值、狀態碼。
- 編輯 `apps/src/api/`（`http.ts`、`index.ts`、`types.ts`、`mock/`）。
- 編輯 C# DTO record、`docs/api-contract.md`。
- 設定 `.env*`、`VITE_API_BASE_URL`、`VITE_USE_MOCK`、Docker build args、`docker/nginx.conf` 的 `/api` 區塊。
- 審查 PR：檢查契約是否三方一致。

---

## 2. 固定規則

### 2.1 同 PR 原則

1. **MUST** 任何改變 API 契約的 PR，**同一個 PR** 內同時包含：
   - `docs/api-contract.md` 的對應列或段落；
   - `apps/src/api/types.ts` 的 interface；
   - C# DTO record 與 endpoint；
   - `apps/src/api/mock/fixtures.ts` 的假資料；
   - 測試：前端 `*.test.ts`（colocated）與 `server/tests/<App>.Api.IntegrationTests/` 的契約/整合測試（WebApplicationFactory，見 elf-integration）。
   **MUST NOT** 「先改後端，前端下個 PR 再補」。CI 的 AI review 會把「改了契約或評分規則卻沒更新 `docs/`」標為問題（見 elf-cicd-review）。
2. **MUST** 改動順序：`docs/api-contract.md` → `types.ts` + fixture → C# DTO + endpoint → 測試。先寫文件，讓 review 的人先看到意圖。
3. **新專案 MUST（參考專案未實作）** 契約文件列出、但後端尚未實作的 endpoint，在表格 `Status` 欄標 `mock`；實作完成改為 `done`；保留給舊前端的標 `deprecated`（參考專案只在 docker-compose 註解說明）。

### 2.2 `docs/api-contract.md` 格式

4. **MUST** 開頭寫明：Base URL 來自 `VITE_API_BASE_URL`（Docker 為 `/api`，由 nginx 代理）、型別位於 `apps/src/api/types.ts`、認證為 Bearer JWT 與 token 的 `localStorage` key。
5. **MUST** 用一張表列出所有 endpoint，欄位固定為 `Method | Path | Purpose | Status`（契約文件內文用英文，欄名也用英文），Purpose 寫 `RequestDto → ResponseDto`；query 參數直接寫在 Path（`/texts?category=&level=`），有預設值寫出來（`/stats/trend?lang=&days=30`）。
6. **MUST** 有非顯而易見行為的 endpoint（伺服器重算分數、語系解析順序、失敗時的部分結果），在表格下方用 `###` 小節說明。
7. **MUST** 錯誤碼 `code` 新增時，列在文件的「錯誤碼」表。範本：[`references/api-contract-template.md`](references/api-contract-template.md)。

### 2.3 `types.ts` ↔ C# DTO 對齊

8. **MUST** TS interface 名稱與 C# record 名稱**完全相同**（C# `CategoryDto(int Id, string Code, string Name, string Color)` ↔ TS `CategoryDto { id: number; code: string; name: string; color: string }`，與 elf-api-design 範本同一份）。參考專案 C# `ModelDto` 對應 TS `LocalModelDto` 是反例，**MUST NOT** 再出現。
9. **MUST** TS 屬性名 = C# 屬性名轉 camelCase（`UsedMb` → `usedMb`）。**MUST NOT** 在任何一邊手動改名。
10. **MUST** 依下表對應型別：

| C# | JSON | TS |
|---|---|---|
| `int` / `long` / `double` / `decimal` | number | `number` |
| `string` | string | `string` |
| `string?`、`int?` 等 nullable | 值或 `null` | `string \| null`、`number \| null` |
| `bool` | boolean | `boolean` |
| `DateTime`（UTC）/ `DateTimeOffset` | ISO 8601 字串 | `string` |
| `DateOnly` | `"2026-09-27"` | `string` |
| `Guid` | string | `string` |
| enum（camelCase `JsonStringEnumConverter`）或固定字串集合 | `"wpm"` | 字串聯集 `'wpm' \| 'cpm'` |
| `IReadOnlyList<T>` / `T[]` | array | `T[]` |
| `IReadOnlyDictionary<string, T>` | object | `Record<string, T>` |
| `PagedResult<T>` | `{ total, page, size, rows }` | `PagedResult<T>` |

11. **MUST** C# nullable 對應 TS `T | null`（欄位一定存在）。TS 可選屬性 `field?: T` **只**用在伺服器會**省略**該欄位的情況（例如列表不回 `content`），並加註解說明何時省略。
12. **MUST** 固定字串集合在 TS 寫成字串聯集，值與 C# 輸出**逐字相同**（含大小寫）；**MUST NOT** 用 `string` 帶過。
13. **MUST** 每個 interface 上方有一行 JSDoc，說明用途或非顯而易見的單位（`/** Milliseconds since the run started. */`）。
14. **MUST** `types.ts` 只放 wire types（`interface`、`type`），**MUST NOT** 放函式、常數、UI 專用的衍生型別；UI 型別放 store 或元件內，由 wire type 轉換而來。

### 2.4 前端 client 分層

15. **MUST** 分層固定：`views/` → `stores/`（Pinia）→ `api/index.ts` → `api/http.ts`（axios）。**MUST NOT** 在 view 或 component 內 import `axios` 或 `http`，也 **MUST NOT** 在 view 內放 fixture。
16. **MUST** 每個 endpoint 在 `api/index.ts` 有一個具名方法，以 `pick(mock, real)` 包起來；呼叫路徑寫**相對路徑、不含 `/api`**：`http.get<CategoryDto[]>('/categories')`。
17. **MUST** 所有請求走同一個 `http` axios instance：`baseURL: import.meta.env.VITE_API_BASE_URL || '/api'`、`timeout: 15000`、request interceptor 加 `Authorization: Bearer <token>`、response interceptor 收到 `401` 清 token 並把錯誤正規化成 `ApiError`。
18. **MUST** `ApiError` 帶 `status` 與 `code`；訊息依序取 ProblemDetails 的 `detail → title`，再退回舊格式 `message`（見 elf-api-design 規則 19）。
19. **MUST** query 參數用 axios `params` 傳，**MUST NOT** 手動字串拼接 `?a=${x}`；路徑參數用 `encodeURIComponent`。

### 2.5 Mock 模式

20. **MUST** `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`：未設定時預設開啟，讓前端不需後端即可執行。
21. **MUST** 每個 `api` 方法都有 fixture；fixture 放 `apps/src/api/mock/fixtures.ts`，**MUST** 以 wire type 標註（`export const CATEGORIES: CategoryDto[] = [...]`），型別不對時 `vue-tsc` 直接失敗。
22. **MUST** mock 回應經過 `delay()`（預設 120ms），保持非同步，讓 loading 狀態與真實情況一致。
23. **MUST** 有邏輯的 fixture（依語系、依參數變化）要有 colocated 測試 `fixtures.test.ts`。
24. **MUST NOT** 在 mock 分支以外的地方判斷 `USE_MOCK`；切換旗標必須是從假資料換成真 API 的**唯一**變更。

### 2.6 Base URL 與代理

25. **MUST** 三處一致使用 `/api` 前綴：
    - 後端 `app.MapGroup("/api")`；
    - nginx `location /api/ { proxy_pass http://api:8080/api/; }`（**兩邊都保留結尾 `/`**）；
    - 前端 Docker build arg `VITE_API_BASE_URL=/api`（同源，正式環境不需要 CORS）。
26. **MUST** `apps/.env.example` 列出 `VITE_API_BASE_URL` 與 `VITE_USE_MOCK=true`（與程式碼預設一致）並附註解說明兩個值的意義；個人設定放 `.env.local`（不進版控）。本機開發直連後端時 `VITE_API_BASE_URL=https://localhost:<port>/api`，並確認該 origin 在後端 `Cors:Origins`。
27. **MUST** 記得 `VITE_*` 是 **build time** 變數：Docker 以 `ARG` + `ENV` 傳入 `web.Dockerfile` 後再 `pnpm build`；改值必須重新 build image，**MUST NOT** 期待在容器啟動時用環境變數改。
    `web.Dockerfile` 只用 **elf-cicd-docker** 的範本（`ARG VITE_API_BASE_URL=/api`、`ARG VITE_USE_MOCK=false` + 對應 `ENV`），本 skill 不另給版本。
28. **新專案 MUST（參考專案未實作）** 新增 `apps/env.d.ts` 宣告 `ImportMetaEnv`，讓旗標有型別。

### 2.7 Schema 匯出

29. **MUST** DB schema 由 CodeFirst Entity 產生，匯出檔（參考專案為 `server/db/schema.sql`，由 `scripts/export-schema.mjs` 產生）**MUST NOT** 手動編輯；改 Entity 的 PR **MUST** 同時重新匯出並提交。注意：這支腳本匯出的是**資料庫 DDL**，不是 API 契約。
30. **新專案 MUST（參考專案未實作）** PostgreSQL 18 專案改用 `pg_dump --schema-only --no-owner --no-privileges` 匯出，腳本包在 `package.json` 的 `db:schema`。
31. **MUST NOT** 用 DB schema 推導 TS 型別；wire type 以 DTO 為準，DTO 與 Entity 可以不同（elf-sqlsugar）。

---

## 3. 標準範本

### 3.1 新增一個 endpoint 的完整變更（同一個 PR）

以 `GET /api/stats/summary` 為例：

**① `docs/api-contract.md`**

```markdown
| GET | `/stats/summary` | headline numbers (`StatsSummaryDto`) | done |
```

**② `apps/src/api/types.ts`**

```ts
/** Headline numbers on the Stats page. Deltas are versus the previous 7 days. */
export interface StatsSummaryDto {
  englishWpm: number
  englishDelta: number
  accuracy: number
  personalBest: number
  /** ISO 8601 UTC; `null` until the first run. */
  personalBestOn: string | null
}
```

**③ `apps/src/api/mock/fixtures.ts`**

```ts
export const SUMMARY: StatsSummaryDto = {
  englishWpm: 62,
  englishDelta: 3,
  accuracy: 96.4,
  personalBest: 78,
  personalBestOn: '2026-09-20T09:12:00Z',
}
```

**④ `apps/src/api/index.ts`**

```ts
stats: {
  summary: (): Promise<StatsSummaryDto> =>
    pick(
      () => fx.SUMMARY,
      () => http.get<StatsSummaryDto>('/stats/summary'),
    ),
},
```

**⑤ `server/src/<App>.Api/Api/StatsEndpoints.cs`**

```csharp
public record StatsSummaryDto(
    double EnglishWpm,
    double EnglishDelta,
    double Accuracy,
    double PersonalBest,
    DateTime? PersonalBestOn);

// endpoint → service → db; GetUserId() reads ElfClaimTypes.UserId (elf-dotnet)
group.MapGet("/summary", async (IStatsService stats, ClaimsPrincipal user, CancellationToken ct) =>
        TypedResults.Ok(await stats.GetSummaryAsync(user.GetUserId(), ct)))
    .WithName("GetStatsSummary");
```

**⑥ 測試**：`server/tests/<App>.Api.IntegrationTests/Contract/StatsContractTests.cs` 驗證 JSON 欄位名（見 [`references/contract-tests.md`](references/contract-tests.md)），前端 store 測試 `stores/stats.test.ts` 在 mock 模式下驗證資料流。

### 3.2 其他完整範本

| 內容 | 位置 |
|---|---|
| `http.ts`（axios instance、token、`ApiError`、`normalizeError`） | [`references/client-templates.md` §1](references/client-templates.md#1-appssrcapihttpts) |
| `index.ts`（`pick` 與具名方法） | [`references/client-templates.md` §2](references/client-templates.md#2-appssrcapiindexts) |
| `types.ts` 共用型別（`PagedResult<T>`、`ProblemDetails`） | [`references/client-templates.md` §3](references/client-templates.md#3-appssrcapitypests) |
| fixtures 與測試 | [`references/client-templates.md` §4](references/client-templates.md#4-mock-fixtures) |
| `.env.example`、`env.d.ts`、nginx `/api` 區塊 | [`references/client-templates.md` §5](references/client-templates.md#5-環境變數與代理) |
| `web.Dockerfile`、`docker-compose.yml` | **elf-cicd-docker** `templates/` |
| `docs/api-contract.md` 範本 | [`references/api-contract-template.md`](references/api-contract-template.md) |
| .NET 與前端契約測試 | [`references/contract-tests.md`](references/contract-tests.md) |

---

## 4. 檢查清單

提交改動 API 的 PR 前逐項確認：

- [ ] `docs/api-contract.md` 表格已新增/修改該列，`Status` 欄正確（`mock` / `done` / `deprecated`）。
- [ ] 有特殊行為的 endpoint 已在文件寫 `###` 說明；新增的錯誤碼已列入錯誤碼表。
- [ ] `types.ts` interface 名稱 = C# record 名稱；每個欄位名、nullable、字串聯集值逐一比對過。
- [ ] `fixtures.ts` 已更新且以 wire type 標註；`pnpm typecheck` 通過。
- [ ] `api/index.ts` 有對應具名方法，使用 `pick`、相對路徑、`params` 傳 query。
- [ ] view/component 沒有 import `axios`、`http`、`fixtures`。
- [ ] `VITE_USE_MOCK=false` 對真 API 跑過一次（或整合測試涵蓋），確認 fixture 與真回應形狀一致。
- [ ] 後端契約測試（`server/tests/<App>.Api.IntegrationTests/Contract/`）與前端 colocated 測試已新增/更新；`dotnet test` 與 `pnpm test` 通過，合併後 line coverage ≥ 55%。
- [ ] 若改了 Entity：schema 匯出檔已重新產生並提交。
- [ ] 若是破壞性變更：已依 elf-api-design §2.5 開 `/api/v2` 或在同 PR 改完所有前端呼叫點。
- [ ] 新環境變數已加入 `apps/.env.example`、`apps/env.d.ts` 與 `docker/web.Dockerfile` 的 `ARG` + `ENV`。

---

## 5. 常見錯誤

| 錯誤 | 正確做法 |
|---|---|
| 後端加了欄位，`types.ts` 下個 PR 再補 | 同 PR 更新 docs + types + fixture + 測試 |
| C# `ModelDto`、TS `LocalModelDto` | 名稱完全相同 |
| C# `string?` 寫成 TS `note?: string` | `note: string \| null` |
| TS `unit: string` | `unit: 'wpm' \| 'cpm'`，值與 C# 輸出逐字一致 |
| `'WPM'` 與 `'wpm'` 在不同 DTO 混用 | 同一概念只用一種大小寫 |
| view 內 `axios.get('/api/categories')` | view → store → `api.categories.list()` |
| `http.get('/api/categories')`（重複前綴，變 `/api/api/...`） | `http.get('/categories')` |
| `` http.get(`/words?q=${q}`) `` | `http.get('/words', { params: { q } })` |
| fixture 寫成 `const TEXTS = [...]` 沒標型別 | `const TEXTS: TextDto[] = [...]` |
| 在 store 內 `if (USE_MOCK) ...` | 只在 `pick()` 內判斷 |
| 想在容器啟動時改 `VITE_API_BASE_URL` | 重新 build image（build arg） |
| 自己寫一份 `web.Dockerfile`（例如用 corepack、漏了 `ARG VITE_USE_MOCK=false`） | 用 elf-cicd-docker 的範本 |
| nginx `proxy_pass http://api:8080;`（少結尾 `/api/`） | `proxy_pass http://api:8080/api/;` |
| 手改 `server/db/schema.sql` | 改 Entity，重跑 `db:schema` |
| 錯誤訊息只讀 `data.message`，ProblemDetails 顯示不出來 | 依序讀 `detail → title → message` |
| 以 `error.message` 字串判斷錯誤種類 | 判斷 `ApiError.code` |

---

## 6. 待確認

1. **型別產生方式**：維持手寫 `types.ts`（參考專案做法），或導入 OpenAPI → TS 產生器（例如 `openapi-typescript`），並在 build 時輸出 OpenAPI 文件（`Microsoft.Extensions.ApiDescription.Server`）納入版控做 diff？
2. **參考專案沒有 API schema 匯出腳本**：`scripts/export-schema.mjs` 只匯出 SQLite DDL。PostgreSQL 版的輸出路徑（`server/db/schema.sql`？）與是否在 CI 檢查差異，需團隊決定。
3. **正式 build 的 mock 檢查**：`VITE_USE_MOCK` 的預設已定案（程式碼預設開、`.env.example` 為 `true`、`web.Dockerfile` 為 `false`）；是否另在 CI 加檢查，防止正式映像以 `VITE_USE_MOCK=true` 建置？
4. **本機開發連線方式**：維持 `VITE_API_BASE_URL=https://localhost:<port>/api` + 後端 CORS（參考專案），或改用 Vite `server.proxy` 把 `/api` 代理到後端（無需 CORS）？
5. **錯誤碼集中管理**：`code` 清單放 `docs/api-contract.md`（本文），是否另外產生 TS 字串聯集（`type ApiErrorCode = ...`）？
6. **token 儲存**：key 統一為 `<app>.token`？是否改 HttpOnly cookie（會影響 CORS 與 CSRF 設計）？
