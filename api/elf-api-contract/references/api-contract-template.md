# `docs/api-contract.md` 範本

複製以下內容到專案的 `docs/api-contract.md`，把 `<App>`、`<app>` 與範例列換成實際內容。
結構取自參考專案，另加 `Status` 欄與「Error codes」表（新專案 MUST（參考專案未實作））。

---

```markdown
# API contract

Base URL comes from `VITE_API_BASE_URL` (the Docker deployment sets it to `/api`
and lets nginx proxy). All request and response shapes are typed in
`apps/src/api/types.ts` and implemented as C# records in `server/src/<App>.Api/Api/` —
change all three, plus this file, in the same pull request.

Authentication is a bearer JWT (`Authorization: Bearer <token>`), stored in
`localStorage` under `<app>.token`. Every error is RFC 9457 ProblemDetails with a
`code` extension (see [Error codes](#error-codes)).

Paged lists take `?page=1&size=50` (page starts at 1, size clamped to 1..500)
and return `PagedResult<T>` = `{ total, page, size, rows }`.

Status: `done` = implemented on the server; `mock` = served by fixtures only
(`VITE_USE_MOCK=true`); `deprecated` = kept for old clients, removal planned.

## Endpoints

| Method        | Path                         | Purpose                                                | Status |
| ------------- | ---------------------------- | ------------------------------------------------------ | ------ |
| GET           | `/health`                    | liveness probe → `{ status, utc }`                     | done   |
| POST          | `/auth/login`                | `LoginRequest` → `AuthUserDto`                         | mock   |
| POST          | `/auth/register`             | same shape as login                                    | mock   |
| GET           | `/categories`                | bounded category catalogue (`CategoryDto[]`)           | done   |
| GET           | `/texts?category=&level=`    | practice texts; `category` is a code (`TextDto[]`)     | done   |
| GET           | `/texts/{id}`                | one text including `content` (`TextDto`)               | done   |
| POST          | `/sessions`                  | submit a run (`SessionSubmitDto` → `SessionResultDto`) | mock   |
| GET           | `/sessions/me?page=&size=`   | own history (`PagedResult<HistoryItemDto>`)            | mock   |
| GET           | `/stats/trend?lang=&days=30` | trend series (`TrendPointDto[]`)                       | mock   |
| POST · DELETE | `/models/{code}/install`     | mark a model installed / remove it (204)               | done   |
| POST          | `/translate/locales`         | one locale in, the remaining UI locales out            | done   |

### POST /sessions — server re-scoring

`POST /sessions` carries the full keystroke array (`{ k, t, ok }[]`). The server
recomputes speed and accuracy from it and rejects (`409 session.score_mismatch`)
a submission whose client-side numbers disagree.

### Locale resolution

`GET /models` and `GET /prompts` take `?locale=` or fall back to
`Accept-Language`, ordered by `q` (not by position). Resolution order is the
requested locale → the row's base column → English.

## Error codes

| Code                        | Status | Meaning                                  |
| --------------------------- | ------ | ---------------------------------------- |
| `validation.failed`         | 400    | see `errors` for per-field messages      |
| `query.invalid_sort`        | 400    | `sort` is not one of the allowed fields  |
| `query.invalid_order`       | 400    | `order` is not `asc` or `desc`           |
| `auth.invalid_credentials`  | 401    | wrong username or password               |
| `category.not_found`        | 404    | no category with that id                 |
| `category.duplicate_code`   | 409    | a category with that code already exists |
| `session.score_mismatch`    | 409    | submitted numbers disagree with keystrokes |
| `rate_limit.exceeded`       | 429    | retry after the `Retry-After` seconds    |
| `server.error`              | 500    | unexpected; look up `traceId` in the logs |

## Versioning

No version segment until a breaking change is unavoidable; then only the
affected endpoints move under `/api/v2`, and the old rows here are marked
`deprecated` with the release they will be removed in.
```

---

## 撰寫規則回顧

- 表格欄位固定 `Method | Path | Purpose | Status`；Purpose 用 `RequestDto → ResponseDto` 或 `(ResponseDto[])`。
- Path 不含 `/api` 前綴（與前端 `http.get('/categories')` 的寫法一致）。
- Query 參數直接寫在 Path，預設值照寫（`days=30`）。
- 同一路徑多個 method 用 `·` 合併成一列（`GET · PUT`）。
- 行為不直觀的 endpoint 在表格下方用 `###` 小節寫「為什麼」，不要只寫「做什麼」。
- Entity / 資料表的說明若也放在此檔，標明 Entity 是 source of truth、schema 匯出檔為產生檔。
