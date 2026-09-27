---
name: elf-api-design
description: |
  Elf Express RESTful API 設計規範（ASP.NET Core 10 Minimal API），規定 URL 命名、HTTP method 與狀態碼、
  endpoint → service → db 分層、ProblemDetails 錯誤格式、分頁/排序/篩選參數、版本控制、Bearer 認證、CORS、
  rate limiting、OpenAPI 與 /api/health。
  當任務涉及新增或修改 API endpoint、命名路由、決定回傳狀態碼、設計錯誤回應、分頁查詢、
  API 版本 (v1/v2)、Authorization header、CORS 設定、限流、OpenAPI/Swagger 或健康檢查時觸發。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# Elf Express RESTful API 設計規範

後端技術棧：ASP.NET Core 10 **Minimal API** + SqlSugar 5.x + PostgreSQL 18。
本規範描述「API 表面長什麼樣子」。前後端如何保持同步（`docs/api-contract.md`、`types.ts`、mock）請看 **elf-api-contract**；
C# 分層、DI、設定請看 **elf-dotnet**；查詢與分頁的 SqlSugar 寫法請看 **elf-sqlsugar**；
端對端 HTTP 測試請看 **elf-integration**；容器與 healthcheck 請看 **elf-cicd-docker**；PR 審查規則請看 **elf-cicd-review**。

> 標示「**新專案 MUST（參考專案未實作）**」的規則是 ASP.NET Core 10 標準做法，參考專案尚未採用；新專案一律照做，舊專案修改到該處時一併導入。
> 目錄慣例：API 專案在 `server/src/<App>.Api/`，測試在 `server/tests/<Project>.Tests/`；HTTP / 契約測試在 `server/tests/<App>.Api.IntegrationTests/`（見 elf-integration）。

---

## 1. 何時使用

- 新增、修改、刪除任何 HTTP endpoint。
- 決定 URL、HTTP method、狀態碼、查詢參數名稱。
- 撰寫或修改錯誤處理、`Program.cs` 的 middleware 管線（forwarded headers、例外、CORS、認證、限流、OpenAPI、health）。
- Code review 時檢查 API 是否符合團隊慣例。

---

## 2. 固定規則

### 2.1 路由與命名

1. **MUST** 所有 endpoint 掛在 `app.MapGroup("/api")` 底下。前端 `VITE_API_BASE_URL=/api`、nginx `location /api/` 都依賴這個前綴。
2. **MUST** 每個功能一個 `<Feature>Endpoints` 靜態類別，對外只暴露一個擴充方法：
   `public static RouteGroupBuilder Map<Feature>(this IEndpointRouteBuilder app, string prefix = "/<resources>")`，
   在 `Program.cs` 以 `api.Map<Feature>();` 註冊。檔案放 `server/src/<App>.Api/Api/<Feature>Endpoints.cs`。
   分層固定 **endpoint → service → db**：endpoint 只做綁定、格式驗證、呼叫 `I<Feature>Service`（`server/src/<App>.Api/Services/<Feature>Service.cs`，Scoped）、把結果對應成狀態碼；
   **MUST NOT** 在 endpoint 注入 `ISqlSugarClient`。每個 handler **MUST** 宣告 `CancellationToken ct` 並一路傳到 service 與 SqlSugar（`FirstAsync(ct)`、`ToPageListAsync(..., ct)`）。
3. **MUST** 資源用**複數名詞、全小寫**：`/categories`、`/texts`、`/words`、`/sessions`。多字用 **kebab-case**：`/error-books`。**MUST NOT** 用 `camelCase`、`snake_case` 或動詞（`/getCategories`）。
4. **MUST** 路由參數加型別約束：`/{id:int}`、`/{id:guid}`；以代碼識別的資源用 `/{code}`。
5. **MUST** 目前登入者自己的資料用 `/<resources>/me`（例：`GET /sessions/me`）。**MUST NOT** 讓前端在路由或 query 傳自己的 `userId`，一律從 JWT claims（`ElfClaimTypes.UserId`）取。
6. **MUST** 子資源最多巢狀一層：`/models/{code}/install`。更深的關係改用 query：`/texts?category=basic`。
7. **MUST** 非 CRUD 的動作依下列判斷選路由：
   - 動作結果是「某個狀態存在 / 不存在」、事後可以 `GET` 查到（安裝、訂閱、釘選、啟用）→ 建模成**子資源**，`POST` 建立、`DELETE` 移除：`POST /models/{code}/install`、`DELETE /models/{code}/install`。
   - 動作是一次性計算或批次處理、不留下可單獨 `GET` 的狀態（翻譯、匯入、重算）→ 才用**動作路由**，且 **MUST** 用 `POST`：`POST /translate/locales`、`POST /words/import`。
8. **MUST** Query 參數用 **camelCase**：`?category=&level=`、`?lang=en&days=30`、`?locale=zh-TW`。
9. **MUST** 每個 endpoint 呼叫 `.WithName("<Verb><Noun>")`（例 `GetModels`、`TranslateLocales`），每個 group 呼叫 `.WithTags("<Feature>")`，OpenAPI 才有穩定的 operationId 與分組。
10. **MUST NOT** 回傳 SqlSugar Entity，一律投影成 `<Name>Dto` record。**MUST NOT** 在新專案使用泛型 `MapCrud<T>`；既有專案保留的 `MapCrud<T>` 只准用在「沒有敏感欄位、純後台維護」的表，**MUST NOT** 用在含 `PasswordHash`、token、個資的 Entity，且必須符合規則 11、14（`Location` 含 `/api`、PUT 以路由 id 為準）。

### 2.2 HTTP method 與狀態碼

11. **MUST** 依下表回應。參考專案 `Api/CrudEndpoints.cs` 只有部分符合（PUT 忽略路由 id、`Location` 少 `/api`），**MUST NOT** 以它為範本：

| 操作 | Method | 成功 | 常見失敗 |
|---|---|---|---|
| 列表 | `GET /x` | `200` + `T[]` 或 `PagedResult<T>` | `400` 參數錯 |
| 取單筆 | `GET /x/{id}` | `200` + DTO | `404` |
| 建立 | `POST /x` | `201 Created`，`Location: /api/x/{id}`，body 為完整 DTO | `400`、`409` 重複 |
| 整筆更新 | `PUT /x/{id}` | `204 No Content` | `400`、`404` |
| 部分更新 | `PATCH /x/{id}` | `204` | `400`、`404` |
| 刪除 | `DELETE /x/{id}` | `204` | `404` |
| 子資源動作 | `POST`/`DELETE /x/{id}/<action>` | `204`（無回傳）或 `200` + 結果 | `404`、`409` |
| 計算型 POST | `POST /translate/locales` | `200` + 結果 DTO | `400` |

12. **MUST** 未登入或 token 無效回 `401`（前端收到會清掉 token），已登入但沒權限回 `403`。**MUST NOT** 用 `200` + `success:false` 表示錯誤。
13. **MUST** 驗證失敗回 `400`（`ValidationProblem`），業務衝突（重複代碼、狀態不允許）回 `409`，被限流回 `429`，未預期例外回 `500`。
14. **MUST** `PUT /x/{id}` 以路由的 `id` 為準：service 先依路由 id 讀出再套用 body；body 若也帶 id 且與路由不同，回 `400`。**MUST NOT** 直接 `Updateable(body)`。
15. **MUST** `GET`、`PUT`、`DELETE` 為冪等；`GET` **MUST NOT** 有副作用。

### 2.3 錯誤回應（ProblemDetails）

16. **MUST** 所有錯誤回應為 RFC 9457 **ProblemDetails**（`Content-Type: application/problem+json`）加 `code`，形狀固定：

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "Category 42 was not found.",
  "instance": "/api/categories/42",
  "code": "category.not_found",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

   - `detail`：給人看的英文句子。
   - `code`：機器可判斷的錯誤碼，格式 `<resource>.<reason>`，全小寫 snake_case（`category.not_found`、`session.score_mismatch`、`auth.invalid_credentials`）。前端要依錯誤分流時**只能**判斷 `code`，不可比對 `detail` 字串。所有 `code` 列在 `docs/api-contract.md` 的「Error codes」表（elf-api-contract 規則 7）。
   - 驗證錯誤另有 `errors: { "<camelCaseField>": ["message"] }`，`code` 固定 `validation.failed`。
17. **MUST** 錯誤處理分工如下（與 elf-dotnet 相同）：
   - **service** 對可預期的失敗回傳**結果 enum**（寫入類，例 `CategoryWriteResult.DuplicateCode`）或 `T?`（查詢類，`null` = 找不到）。service **MUST NOT** throw `AppException`、**MUST NOT** 回傳 `IResult`。
   - **endpoint** 把結果對應成 `Problems.NotFound/Conflict/BadRequest/Forbidden(code, detail)`（內部為 `TypedResults.Problem` + `code` extension）或 `ApiValidation.Problem(...)`。`AppException` 只允許在 endpoint 層、無法回傳 `IResult` 的 helper 中使用。
   - `Program.cs` 啟用 `AddProblemDetails()`、`AddExceptionHandler<GlobalExceptionHandler>()`、`app.UseExceptionHandler()`、`app.UseStatusCodePages()`，未預期例外由全域 handler 轉成 `500`。
   - 參考專案目前回 `Results.BadRequest(new { message = "..." })`；新程式碼 **MUST NOT** 再寫 `{ message }` 形狀。
18. **MUST NOT** 把 exception message、stack trace、SQL 回傳給前端。`500` 的 `detail` 固定為 `"An unexpected error occurred."`、`code` 為 `server.error`，細節只寫 log（帶 `traceId`）。
19. **MUST** 前端 `normalizeError` 依序讀 `detail → title → message`（`message` 相容舊回應），見 elf-api-contract。

完整程式碼：[`references/server-templates.md` §1](references/server-templates.md#1-錯誤處理)。

### 2.4 分頁、排序、篩選

20. **MUST** 任何**可能超過 500 列**（= `size` 上限）的列表一律分頁，包括紀錄、歷史、使用者產生的資料；只有能確定永遠 ≤ 500 列的目錄型資料（分類、內建 prompt、模型清單）可回傳裸陣列 `T[]`。無法確定時就分頁。
21. **MUST** 分頁參數固定為 `?page=1&size=50`：`page` 從 **1** 開始、`size` 預設 `50`、上限 `500`，伺服器端 `Math.Max(page, 1)`、`Math.Clamp(size, 1, 500)`。**MUST NOT** 使用 `pageIndex`、`pageSize`、`limit`、`offset`、`skip`、`take`。
22. **MUST** 分頁回應形狀固定為 `PagedResult<T>`：`{ "total": 1234, "page": 2, "size": 50, "rows": [ ... ] }`，C# 定義為 `record PagedResult<T>(int Total, int Page, int Size, IReadOnlyList<T> Rows)`（與 elf-sqlsugar 同一份）。
    回應中的 `page`/`size` **MUST** 是 clamp 後實際使用的值（參考專案回傳原始輸入，是反例）。
23. **新專案 MUST（參考專案未實作）** 排序用 `?sort=<camelCaseField>&order=asc|desc`，未帶 `order` 時為 `desc`。endpoint **MUST** 以白名單 `switch` 把字串轉成 enum，未知值回 `400`（`query.invalid_sort` / `query.invalid_order`）；service 只收 enum。**MUST NOT** 把字串直接拼進 SQL 或 `OrderBy(string)`。
24. **MUST** 篩選用具名 query 參數（`?category=basic&level=A1`、`?topic=food&q=apple`）：關鍵字搜尋固定叫 `q`；日期範圍用 `from`/`to`（ISO 8601）；天數用 `days`；多值用重複參數 `?tag=a&tag=b`（綁定 `string[] tag`）。**MUST NOT** 自訂逗號分隔格式。
25. **MUST** 語系用 `?locale=zh-TW`；未帶時讀 `Accept-Language`，並**依 `q` 值排序**（不是依出現順序），`q=0` 代表不接受。

範本：[`references/server-templates.md` §2](references/server-templates.md#2-分頁排序篩選)。

### 2.5 版本控制

26. **新專案 MUST（參考專案未實作）** 第一版不加版本段：`/api/<resources>`。出現**無法向下相容**的變更時，只為受影響的 endpoint 新增 `app.MapGroup("/api/v2")`，舊路由保留到前端全部切換後再移除，並在 `docs/api-contract.md` 標註 `deprecated`。
27. **MUST** 以下屬於相容變更、**不需要**開新版本：新增 endpoint、回應新增欄位、新增選填 query 參數。以下屬於破壞性變更、**需要**新版本或同 PR 同步改前端：刪除/改名欄位、改型別、改狀態碼語意、選填變必填。
28. **MUST NOT** 用 header（`api-version`）或 query（`?v=2`）分版——nginx 只按路徑轉發，前端 base URL 也只認路徑。

### 2.6 認證

29. **MUST** 認證 header 固定為 `Authorization: Bearer <jwt>`。**MUST NOT** 自訂 `X-Token`、`X-Auth`，**MUST NOT** 把 token 放 query string。
30. **MUST** 登入 `POST /auth/login`、註冊 `POST /auth/register`，request 為 `LoginRequest { username, password }`，回傳 `AuthUserDto`（含 `token`）。
31. **新專案 MUST（參考專案未實作）** 以 `AddAuthentication().AddJwtBearer()` + `AddAuthorization()` 驗證；受保護的 group 呼叫 `.RequireAuthorization()`；`/auth/*` 與 `/health` 呼叫 `.AllowAnonymous()`。JWT 金鑰走 `appsettings` / 環境變數（`Jwt__Key`），**MUST NOT** 寫死在程式碼。Claim 名稱一律用 `ElfClaimTypes`（`sub`、`company_id`、`role`）。

### 2.7 CORS

32. **MUST** 使用具名 policy，origin 從設定 `Cors:Origins`（字串陣列）讀取，程式內 fallback 只放本機開發 origin（範本見 §3.1）。
33. **MUST NOT** 使用 `AllowAnyOrigin()`，更 **MUST NOT** 搭配 `AllowCredentials()`。
34. **MUST** 正式環境走 nginx 同源代理（瀏覽器只打 `/api`，無跨來源請求），因此 `Cors:Origins` 只列開發伺服器與桌面殼，例如 `http://localhost:5173`、`http://tauri.localhost`、`https://tauri.localhost`。

### 2.8 Forwarded headers 與 rate limiting

35. **MUST** 啟用 `UseForwardedHeaders()`，並放在管線**最前面**（在 `UseExceptionHandler`、`UseCors` 之前）；API 永遠在 nginx 後面，否則 client IP 都是 nginx 容器。**新專案 MUST（參考專案未實作）** 使用內建 `AddRateLimiter()`，至少對 `/auth/*` 套用依 client IP 分區的 fixed-window policy，被拒回 `429` + `rate_limit.exceeded`。**MUST NOT** 呼叫 `UseHttpsRedirection()`（TLS 在 nginx 結束）。範本：[`references/server-templates.md` §5](references/server-templates.md#5-rate-limiting-與-forwarded-headers)。

### 2.9 OpenAPI

36. **MUST** 使用內建 `Microsoft.AspNetCore.OpenApi`：`builder.Services.AddOpenApi();`，並**只在 Development** 執行 `app.MapOpenApi();`（文件位於 `/openapi/v1.json`）。**MUST NOT** 另外安裝 Swashbuckle。
37. **MUST** handler 回傳 `TypedResults`（例 `Task<Results<Ok<CategoryDto>, ProblemHttpResult>>`），或補 `.Produces<T>(200)` / `.ProducesProblem(404)`，讓 OpenAPI 推得出回應型別。

### 2.10 健康檢查

38. **MUST** 提供匿名的 `GET /api/health`（路徑已定案），回 `200` + `{ "status": "ok", "utc": "<ISO 8601>" }`，並 `.WithName("Health")`。容器 healthcheck **MUST NOT** 依賴 `wget`（`aspnet` 映像沒有）；由 **elf-cicd-docker** 的 `api.Dockerfile` 在最終階段以 `apt-get install -y --no-install-recommends curl` 安裝 curl，compose 以 `curl -fsS http://localhost:8080/api/health` 探測。
39. **新專案 MUST（參考專案未實作）** 需要檢查 PostgreSQL 連線時，另開 `GET /api/health/ready`；`/api/health` 保持不碰 DB，避免 DB 短暫抖動讓容器被判定不健康。

### 2.11 JSON 慣例

40. **MUST** 維持 ASP.NET Core 預設 web JSON 設定：屬性名 **camelCase**、`null` 照常輸出。**MUST NOT** 用 `[JsonPropertyName]` 改成其他命名風格。
41. **MUST** 時間一律 UTC、ISO 8601 字串（`2026-09-27T08:00:00Z`）；enum 以 **camelCase 字串**輸出（`new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)`，`SpeedUnit.Wpm` → `"wpm"`），值與前端 `types.ts` 字串聯集完全一致。
42. **MUST** DTO 用 positional `record`：`public record CategoryDto(int Id, string Code, string Name, string Color);`。Request DTO 命名 `<Name>Request`，Response DTO 命名 `<Name>Dto`；名稱與 `types.ts` 的 interface 完全相同（elf-api-contract 規則 8）。

---

## 3. 標準範本

### 3.1 `Program.cs`（管線順序即規範）

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using <App>.Api.Api;
using <App>.Api.Data;
using <App>.Api.Infrastructure;
using <App>.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
    ctx.ProblemDetails.Extensions.TryAdd("traceId", ctx.HttpContext.TraceIdentifier);
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddSqlSugar(builder.Configuration, builder.Environment);   // elf-sqlsugar
builder.Services.AddScoped<ICategoryService, CategoryService>();

// Behind nginx. KnownIPNetworks must match the docker network (server-templates §5).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("172.16.0.0/12"));
});

const string WebCors = "web";
builder.Services.AddCors(o => o.AddPolicy(WebCors, p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
        ?? ["http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseForwardedHeaders();       // first: everything below sees the real client IP / scheme
app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
app.UseCors(WebCors);
// When introduced, in this order: app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();

var api = app.MapGroup("/api");

api.MapGet("/health", () => TypedResults.Ok(new { status = "ok", utc = DateTime.UtcNow }))
    .WithName("Health")
    .AllowAnonymous();

api.MapCategories();

app.Run();

// Lets server/tests/<App>.Api.IntegrationTests use WebApplicationFactory<Program>.
public partial class Program;
```

### 3.2 Endpoint 模組骨架（endpoint → service）

```csharp
using Microsoft.AspNetCore.Http.HttpResults;
using <App>.Api.Infrastructure;
using <App>.Api.Services;

namespace <App>.Api.Api;

public static class CategoryEndpoints
{
    public record CategoryDto(int Id, string Code, string Name, string Color);
    public record CategoryCreateRequest(string Code, string Name, string Color);
    public record CategoryUpdateRequest(string Name, string Color);

    public static RouteGroupBuilder MapCategories(this IEndpointRouteBuilder app, string prefix = "/categories")
    {
        var group = app.MapGroup(prefix).WithTags("Categories");

        group.MapGet("/", ListAsync).WithName("ListCategories");
        group.MapGet("/{id:int}", GetAsync).WithName("GetCategory");
        group.MapPost("/", CreateAsync).WithName("CreateCategory");
        group.MapPut("/{id:int}", UpdateAsync).WithName("UpdateCategory");
        group.MapDelete("/{id:int}", DeleteAsync).WithName("DeleteCategory");

        return group;
    }

    private static async Task<Results<Ok<CategoryDto>, ProblemHttpResult>> GetAsync(
        ICategoryService categories, int id, CancellationToken ct)
    {
        var dto = await categories.GetAsync(id, ct);   // service returns T?; null = not found
        return dto is null
            ? Problems.NotFound("category.not_found", $"Category {id} was not found.")
            : TypedResults.Ok(dto);
    }

    // ListAsync / CreateAsync / UpdateAsync / DeleteAsync and CategoryService:
    // see references/server-templates.md §3
}
```

寫入類操作由 service 回傳結果 enum（`CategoryWriteResult.Ok / NotFound / DuplicateCode`），endpoint 用 `switch` 對應成 `201` / `204` / `Problems.NotFound(...)` / `Problems.Conflict(...)`，完整寫法見 server-templates §3。

### 3.3 其他完整範本

| 內容 | 位置 |
|---|---|
| `Problems`、`AppException`、`GlobalExceptionHandler`、驗證錯誤 | [`references/server-templates.md` §1](references/server-templates.md#1-錯誤處理) |
| `PagedResult<T>`、`Paging`、排序白名單（endpoint 解析 → service enum） | [`references/server-templates.md` §2](references/server-templates.md#2-分頁排序篩選) |
| 完整 CRUD：`CategoryService` + `CategoryEndpoints` | [`references/server-templates.md` §3](references/server-templates.md#3-完整-crud-endpoint-模組) |
| JWT、`/api/v2` group | [`references/server-templates.md` §4](references/server-templates.md#4-認證與版本) |
| Rate limiting + Forwarded headers | [`references/server-templates.md` §5](references/server-templates.md#5-rate-limiting-與-forwarded-headers) |
| `api.Dockerfile`、compose healthcheck | **elf-cicd-docker** |

---

## 4. 檢查清單

- [ ] 路徑在 `/api` group 下、複數名詞、小寫 kebab-case、id 有型別約束。
- [ ] 每個 endpoint 有 `.WithName("VerbNoun")`，group 有 `.WithTags(...)`。
- [ ] endpoint 沒有注入 `ISqlSugarClient`；邏輯在 `I<Feature>Service`；每個 handler 有 `CancellationToken ct` 並傳到 service 與 SqlSugar。
- [ ] 回傳 DTO record，沒有直接回傳 Entity；新程式碼沒有 `MapCrud<T>`。
- [ ] 狀態碼符合 §2.2：POST 建立回 `201` + `/api/...` Location，PUT/DELETE 回 `204`，找不到回 `404`。
- [ ] 所有錯誤都是 ProblemDetails 且有 `code`；service 回結果 enum / `T?`，endpoint 用 `Problems.*`；沒有 `{ message }`、沒有 `200 + success:false`、沒有外洩 exception message。
- [ ] 新增的 `code` 已列入 `docs/api-contract.md` 的錯誤碼表。
- [ ] 可能超過 500 列的列表已分頁：參數 `page`/`size`，回應 `{ total, page, size, rows }` 且為 clamp 後的值。
- [ ] 排序欄位走白名單 enum；沒有字串拼 SQL。
- [ ] 需要登入的 group 有 `.RequireAuthorization()`；使用者身分來自 claims（`ElfClaimTypes`），不是 query。
- [ ] `UseForwardedHeaders()` 在管線最前面；沒有 `UseHttpsRedirection()`；沒有新增 `AllowAnyOrigin()`，新 origin 加在 `Cors:Origins` 設定。
- [ ] Development 下 `/openapi/v1.json` 看得到新 endpoint，回應型別正確。
- [ ] 破壞性變更已開 `/api/v2`，或已確認屬於相容變更（規則 27）。
- [ ] 同一個 PR 已更新 `docs/api-contract.md`、`apps/src/api/types.ts`、fixtures、測試（**elf-api-contract**）。
- [ ] service 有單元測試（`server/tests/<App>.Api.Tests`，elf-unit），endpoint 有整合測試（`server/tests/<App>.Api.IntegrationTests`，elf-integration）；合併後 line coverage ≥ 55%。

---

## 5. 常見錯誤

| 錯誤 | 正確做法 |
|---|---|
| `GET /getCategories`、`POST /category/create` | `GET /categories`、`POST /categories` |
| `GET /users/5/sessions`，前端傳自己的 userId | `GET /sessions/me`，userId 從 JWT 取 |
| endpoint 直接注入 `ISqlSugarClient` 寫查詢 | 移到 `I<Feature>Service`，endpoint 只呼叫 service |
| handler 沒有 `CancellationToken`，或有卻沒往下傳 | `CancellationToken ct` 一路傳到 `FirstAsync(ct)` 等 |
| `Results.BadRequest(new { message = "Text is required." })` | `ApiValidation.Problem(("text", "Text is required."))` |
| service 內 `throw AppException.Conflict(...)` 或 `throw new InvalidOperationException("duplicate")` | service 回 `CategoryWriteResult.DuplicateCode`，endpoint 回 `Problems.Conflict("category.duplicate_code", ...)` |
| `Results.Ok(new { success = false, error = "..." })` | 回對應 4xx 的 ProblemDetails |
| `catch (Exception ex) { return Results.Problem(ex.Message); }` | 不要 catch；交給 `GlobalExceptionHandler`，500 不外洩訊息 |
| `?pageIndex=0&pageSize=20` | `?page=1&size=20` |
| 分頁回應回傳使用者原始 `page`/`size` | 回傳 clamp 後的值 |
| `PUT /x/{id}` 忽略路由 id，直接 `Updateable(body)` | 依路由 id 讀出再套用 body |
| `Results.Created($"/x/{id}", ...)`，Location 少了 `/api` | `TypedResults.Created($"/api/x/{id}", dto)` |
| `api.MapCrud<User>("/users")`，`PasswordHash` 外洩 | 手寫 endpoint + service + `UserDto` |
| `.OrderBy(sortField)` 直接吃 query 字串 | endpoint 白名單 `switch` → enum，service 依 enum 選 expression |
| 為了方便用 `AllowAnyOrigin()` | 在 `Cors:Origins` 加具體 origin |
| `UseForwardedHeaders()` 放在 `UseCors` / `UseRateLimiter` 之後，或沒呼叫 | 管線第一行 |
| 正式環境也 `MapOpenApi()` | 包在 `if (app.Environment.IsDevelopment())` |
| `/api/health` 查 DB，DB 慢就被判定不健康 | health 不碰 DB；DB 檢查放 `/api/health/ready` |
| compose healthcheck 用 `wget`，aspnet 映像沒有 → 永遠 unhealthy | 映像安裝 curl，`curl -fsS http://localhost:8080/api/health`（elf-cicd-docker） |
| 用 `?v=2` 或 `api-version` header 分版 | 路徑 `/api/v2/...` |
| enum 輸出成數字 `1` 或 `"Wpm"` | `JsonStringEnumConverter(JsonNamingPolicy.CamelCase)`，值與 `types.ts` 聯集一致 |

---

## 6. 待確認

1. **版本控制**：新專案從第一天就用 `/api/v1`，還是維持 `/api` 到第一次破壞性變更才開 `/api/v2`（本文採後者）？是否引入 `Asp.Versioning.Http` 套件？
2. **Rate limiting 數值**：`/auth/*` 每 IP 每分鐘上限（範本暫用 10）？一般 API 是否也要全域限流？nginx 容器所在網段（`KnownIPNetworks`）實際值？
3. **JWT**：簽章演算法、有效期、是否有 refresh token 與 `POST /auth/refresh`；token 存 `localStorage` 或改 HttpOnly cookie？
4. **OpenAPI UI**：開發環境是否加 Scalar / Swagger UI 檢視器？OpenAPI 文件是否在 build 時輸出成檔案納入版控（見 elf-api-contract 待確認）？
5. **排序格式**：`?sort=field&order=desc`（本文）或 `?sort=-field`？是否允許多欄排序？
6. **大整數 / 金額**：`long` 超過 2^53、`decimal` 金額在 JSON 是否改用字串輸出？
7. **enum 字串大小寫**：本規範定為 camelCase（規則 41）。參考專案同時出現 `'wpm'`、`'WPM'`、`'Token'`，既有專案是否要一次改齊（屬破壞性變更）？
