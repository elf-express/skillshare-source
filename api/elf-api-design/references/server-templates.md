# elf-api-design — 後端完整範本

所有範本以 ASP.NET Core 10 Minimal API + SqlSugar 5.x 為準。`<App>` 換成專案名稱（PascalCase，例：`<AppName>`）。
程式碼一律放在 `server/src/<App>.Api/` 底下；分層固定為 **endpoint → service → db**，`CancellationToken ct` 從 endpoint 一路傳到 SqlSugar。
標示「新專案 MUST（參考專案未實作）」者為 ASP.NET Core 標準做法，參考專案尚未採用，新專案一律照做。

---

## 1. 錯誤處理

> 新專案 MUST（參考專案未實作）。參考專案目前回 `{ message }`，新程式碼一律使用本節。

分工：

| 層 | 可預期的失敗（找不到、重複、狀態不允許） | 未預期的例外 |
|---|---|---|
| service | 寫入類回傳**結果 enum**，查詢類回傳 `T?`。**MUST NOT** throw `AppException`，**MUST NOT** 回傳 `IResult` | 不 catch，往上拋 |
| endpoint | 把結果對應成 `Problems.*`（ProblemDetails + `code`）或 `ApiValidation.Problem(...)` | 不 catch，交給 `GlobalExceptionHandler` |
| `GlobalExceptionHandler` | 只處理 endpoint 層丟出的 `AppException`（例：無法回傳 `IResult` 的解析 helper） | 轉成 `500 server.error`，細節只寫 log |

### 1.1 `Infrastructure/Problems.cs`

```csharp
using Microsoft.AspNetCore.Http.HttpResults;

namespace <App>.Api.Infrastructure;

/// <summary>
/// Maps an expected failure to RFC 9457 ProblemDetails with a machine-readable
/// "code" ("<resource>.<reason>", lower snake_case). type/title come from the
/// status; instance/traceId are added by AddProblemDetails' CustomizeProblemDetails.
/// </summary>
public static class Problems
{
    public static ProblemHttpResult BadRequest(string code, string detail) =>
        Create(StatusCodes.Status400BadRequest, code, detail);

    public static ProblemHttpResult Forbidden(string code, string detail) =>
        Create(StatusCodes.Status403Forbidden, code, detail);

    public static ProblemHttpResult NotFound(string code, string detail) =>
        Create(StatusCodes.Status404NotFound, code, detail);

    public static ProblemHttpResult Conflict(string code, string detail) =>
        Create(StatusCodes.Status409Conflict, code, detail);

    private static ProblemHttpResult Create(int status, string code, string detail) =>
        TypedResults.Problem(
            detail: detail,
            statusCode: status,
            extensions: new Dictionary<string, object?> { ["code"] = code });
}
```

### 1.2 `Infrastructure/AppException.cs`（只限 endpoint 層）

```csharp
namespace <App>.Api.Infrastructure;

/// <summary>
/// Endpoint-layer escape hatch for helpers that cannot return an IResult.
/// Services never throw this; they return result enums or T?.
/// GlobalExceptionHandler turns it into ProblemDetails.
/// </summary>
public sealed class AppException(int status, string code, string detail) : Exception(detail)
{
    public int Status { get; } = status;
    public string Code { get; } = code;

    public static AppException BadRequest(string code, string detail) =>
        new(StatusCodes.Status400BadRequest, code, detail);
}
```

### 1.3 `Infrastructure/GlobalExceptionHandler.cs`

```csharp
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.WebUtilities;

namespace <App>.Api.Infrastructure;

public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetails,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, code, detail) = exception switch
        {
            AppException app => (app.Status, app.Code, app.Message),
            BadHttpRequestException bad => (bad.StatusCode, "request.invalid", "The request could not be read."),
            _ => (StatusCodes.Status500InternalServerError, "server.error", "An unexpected error occurred."),
        };

        if (status >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception, traceId {TraceId}", httpContext.TraceIdentifier);
        }
        else
        {
            logger.LogInformation("Request failed with {Status} {Code}: {Detail}", status, code, detail);
        }

        httpContext.Response.StatusCode = status;

        // type / instance / traceId are filled in by AddProblemDetails' CustomizeProblemDetails.
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = status,
                Title = ReasonPhrases.GetReasonPhrase(status),
                Detail = detail,
                Extensions = { ["code"] = code },
            },
        });
    }
}
```

### 1.4 `Infrastructure/ApiValidation.cs`

```csharp
using Microsoft.AspNetCore.Http.HttpResults;

namespace <App>.Api.Infrastructure;

public static class ApiValidation
{
    /// <summary>400 ValidationProblem; Field is camelCase to match the front-end field name.</summary>
    public static ValidationProblem Problem(params (string Field, string Message)[] errors) =>
        TypedResults.ValidationProblem(
            errors
                .GroupBy(e => e.Field)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray()),
            extensions: new Dictionary<string, object?> { ["code"] = "validation.failed" });
}
```

### 1.5 `Program.cs` 註冊

```csharp
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
    ctx.ProblemDetails.Extensions.TryAdd("traceId", ctx.HttpContext.TraceIdentifier);
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();

app.UseForwardedHeaders();   // first; see §5
app.UseExceptionHandler();   // exception → ProblemDetails
app.UseStatusCodePages();    // empty-body 401/403 → ProblemDetails
```

### 1.6 回應範例

驗證失敗（`400`）：

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "text": ["Text is required."] },
  "code": "validation.failed",
  "instance": "/api/translate/locales",
  "traceId": "0HN7..."
}
```

業務衝突（`409`，由 `Problems.Conflict("category.duplicate_code", ...)` 產生）：

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Conflict",
  "status": 409,
  "detail": "Category code 'basic' already exists.",
  "code": "category.duplicate_code",
  "instance": "/api/categories",
  "traceId": "0HN7..."
}
```

---

## 2. 分頁、排序、篩選

### 2.1 `Infrastructure/Paging.cs`

```csharp
using SqlSugar;

namespace <App>.Api.Infrastructure;

/// <summary>Paged response shape, fixed: { total, page, size, rows }. Same definition as elf-sqlsugar.</summary>
public sealed record PagedResult<T>(int Total, int Page, int Size, IReadOnlyList<T> Rows);

public static class Paging
{
    public const int DefaultSize = 50;
    public const int MaxSize = 500;

    public static (int Page, int Size) Normalize(int? page, int? size) =>
        (Math.Max(page ?? 1, 1), Math.Clamp(size ?? DefaultSize, 1, MaxSize));

    /// <summary>Returned Page/Size are the clamped values actually used, not the raw input.</summary>
    public static async Task<PagedResult<TDto>> ToPagedAsync<TEntity, TDto>(
        this ISugarQueryable<TEntity> query,
        int? page,
        int? size,
        Func<TEntity, TDto> map,
        CancellationToken ct)
    {
        var (p, s) = Normalize(page, size);
        RefAsync<int> total = 0;
        var rows = await query.ToPageListAsync(p, s, total, ct);
        return new PagedResult<TDto>(total.Value, p, s, rows.Select(map).ToList());
    }
}
```

### 2.2 篩選 + 排序白名單 + 分頁

> 排序為新專案 MUST（參考專案未實作）；篩選與分頁參數名與參考專案一致。
> query 字串是否合法（`sort`、`order`）屬於 HTTP 層，在 endpoint 解析並回 `400`；service 只收已驗證的強型別參數。

`server/src/<App>.Api/Services/WordService.cs`：

```csharp
using SqlSugar;
using <App>.Api.Infrastructure;
using <App>.Api.Models;
using static <App>.Api.Api.WordEndpoints;

namespace <App>.Api.Services;

public enum WordSort
{
    Id = 0,
    Text = 1,
    Freq = 2,
}

public sealed record WordQuery(string? Topic, string? Q, WordSort Sort, OrderByType Order, int? Page, int? Size);

public interface IWordService
{
    Task<PagedResult<WordDto>> ListAsync(WordQuery query, CancellationToken ct);
}

public sealed class WordService(ISqlSugarClient db) : IWordService
{
    public Task<PagedResult<WordDto>> ListAsync(WordQuery query, CancellationToken ct)
    {
        var q = db.Queryable<Word>()
            .WhereIF(!string.IsNullOrWhiteSpace(query.Topic), w => w.Topic == query.Topic)
            .WhereIF(!string.IsNullOrWhiteSpace(query.Q), w => w.Text.Contains(query.Q!));

        // Whitelist: the enum selects an expression; no user string ever reaches SQL.
        q = query.Sort switch
        {
            WordSort.Text => q.OrderBy(w => w.Text, query.Order),
            WordSort.Freq => q.OrderBy(w => w.Freq, query.Order),
            _ => q.OrderBy(w => w.Id, query.Order),
        };

        return q.ToPagedAsync(query.Page, query.Size, ToDto, ct);
    }

    private static WordDto ToDto(Word w) => new(w.Id, w.Text, w.Topic, w.Freq);
}
```

`server/src/<App>.Api/Api/WordEndpoints.cs`（節錄，`WordDto` 宣告在此類別內）：

```csharp
group.MapGet("/", async Task<Results<Ok<PagedResult<WordDto>>, ProblemHttpResult>> (
    IWordService words,
    string? topic,
    string? q,
    string? sort,
    string? order,
    int? page,
    int? size,
    CancellationToken ct) =>
{
    WordSort? sortField = sort?.ToLowerInvariant() switch
    {
        null or "" or "id" => WordSort.Id,
        "text" => WordSort.Text,
        "freq" => WordSort.Freq,
        _ => null,
    };
    if (sortField is null)
    {
        return Problems.BadRequest("query.invalid_sort", $"Cannot sort by '{sort}'.");
    }

    OrderByType? direction = order?.ToLowerInvariant() switch
    {
        null or "" or "desc" => OrderByType.Desc,
        "asc" => OrderByType.Asc,
        _ => null,
    };
    if (direction is null)
    {
        return Problems.BadRequest("query.invalid_order", $"Order must be 'asc' or 'desc', got '{order}'.");
    }

    var result = await words.ListAsync(
        new WordQuery(topic, q, sortField.Value, direction.Value, page, size), ct);
    return TypedResults.Ok(result);
})
.WithName("ListWords");
```

呼叫範例：`GET /api/words?topic=food&q=app&sort=freq&order=desc&page=2&size=20`

多租戶過濾、軟刪除、`WhereIF` 的效能注意事項見 **elf-sqlsugar**。

---

## 3. 完整 CRUD endpoint 模組

以 `Category` 為例。DTO 形狀與 **elf-api-contract** 的 `types.ts`、fixtures 完全一致：

| C# | TS（`apps/src/api/types.ts`） |
|---|---|
| `record CategoryDto(int Id, string Code, string Name, string Color)` | `interface CategoryDto { id: number; code: string; name: string; color: string }` |

分類是有限的目錄型資料（確定不會超過 500 列），列表回裸陣列 `CategoryDto[]`（規則 20）；可能超過 500 列的列表用 §2.2 的分頁寫法。

### 3.1 `server/src/<App>.Api/Services/CategoryService.cs`

```csharp
using SqlSugar;
using <App>.Api.Models;
using static <App>.Api.Api.CategoryEndpoints;

namespace <App>.Api.Services;

/// <summary>Outcome of a write; the endpoint maps each value to a status code.</summary>
public enum CategoryWriteResult
{
    Ok = 0,
    NotFound = 1,
    DuplicateCode = 2,
}

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken ct);
    Task<CategoryDto?> GetAsync(int id, CancellationToken ct);
    Task<(CategoryWriteResult Result, CategoryDto? Category)> CreateAsync(CategoryCreateRequest request, CancellationToken ct);
    Task<CategoryWriteResult> UpdateAsync(int id, CategoryUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(int id, CancellationToken ct);
}

public sealed class CategoryService(ISqlSugarClient db) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken ct)
    {
        var rows = await db.Queryable<Category>().OrderBy(c => c.Id).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<CategoryDto?> GetAsync(int id, CancellationToken ct)
    {
        var row = await db.Queryable<Category>().Where(c => c.Id == id).FirstAsync(ct);
        return row is null ? null : ToDto(row);
    }

    public async Task<(CategoryWriteResult Result, CategoryDto? Category)> CreateAsync(
        CategoryCreateRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim().ToLowerInvariant();
        if (await db.Queryable<Category>().AnyAsync(c => c.Code == code, ct))
        {
            return (CategoryWriteResult.DuplicateCode, null);
        }

        var entity = new Category { Code = code, Name = request.Name.Trim(), Color = request.Color };
        entity.Id = await db.Insertable(entity).ExecuteReturnIdentityAsync(ct);
        return (CategoryWriteResult.Ok, ToDto(entity));
    }

    public async Task<CategoryWriteResult> UpdateAsync(int id, CategoryUpdateRequest request, CancellationToken ct)
    {
        // The route id wins: load by id, then apply the body. Never Updateable(body).
        var row = await db.Queryable<Category>().Where(c => c.Id == id).FirstAsync(ct);
        if (row is null)
        {
            return CategoryWriteResult.NotFound;
        }

        row.Name = request.Name.Trim();
        row.Color = request.Color;
        await db.Updateable(row).ExecuteCommandAsync(ct);
        return CategoryWriteResult.Ok;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct) =>
        await db.Deleteable<Category>().Where(c => c.Id == id).ExecuteCommandAsync(ct) > 0;

    private static CategoryDto ToDto(Category c) => new(c.Id, c.Code, c.Name, c.Color);
}
```

註冊：`builder.Services.AddScoped<ICategoryService, CategoryService>();`（生命週期規則見 **elf-dotnet**）。
`Code` 建立後不可改（其他資料以 code 參照分類，例如 `TextDto.category`），所以 `CategoryUpdateRequest` 沒有 `Code`。

### 3.2 `server/src/<App>.Api/Api/CategoryEndpoints.cs`

endpoint 只做：綁定 → 格式驗證 → 呼叫 service → 把結果對應成狀態碼。**MUST NOT** 注入 `ISqlSugarClient`。

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

    private static async Task<Ok<IReadOnlyList<CategoryDto>>> ListAsync(
        ICategoryService categories, CancellationToken ct) =>
        TypedResults.Ok(await categories.ListAsync(ct));

    private static async Task<Results<Ok<CategoryDto>, ProblemHttpResult>> GetAsync(
        ICategoryService categories, int id, CancellationToken ct)
    {
        var dto = await categories.GetAsync(id, ct);
        return dto is null ? NotFound(id) : TypedResults.Ok(dto);
    }

    private static async Task<Results<Created<CategoryDto>, ValidationProblem, ProblemHttpResult>> CreateAsync(
        ICategoryService categories, CategoryCreateRequest body, CancellationToken ct)
    {
        var errors = new List<(string Field, string Message)>();
        if (string.IsNullOrWhiteSpace(body.Code)) errors.Add(("code", "Code is required."));
        if (string.IsNullOrWhiteSpace(body.Name)) errors.Add(("name", "Name is required."));
        if (errors.Count > 0)
        {
            return ApiValidation.Problem([.. errors]);
        }

        var (result, dto) = await categories.CreateAsync(body, ct);
        return result switch
        {
            // Location must include the /api prefix.
            CategoryWriteResult.Ok => TypedResults.Created($"/api/categories/{dto!.Id}", dto),
            CategoryWriteResult.DuplicateCode => Problems.Conflict(
                "category.duplicate_code", $"Category code '{body.Code}' already exists."),
            _ => throw new InvalidOperationException($"Unexpected result {result}."),
        };
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> UpdateAsync(
        ICategoryService categories, int id, CategoryUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
        {
            return ApiValidation.Problem(("name", "Name is required."));
        }

        return await categories.UpdateAsync(id, body, ct) switch
        {
            CategoryWriteResult.Ok => TypedResults.NoContent(),
            CategoryWriteResult.NotFound => NotFound(id),
            var other => throw new InvalidOperationException($"Unexpected result {other}."),
        };
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAsync(
        ICategoryService categories, int id, CancellationToken ct) =>
        await categories.DeleteAsync(id, ct) ? TypedResults.NoContent() : NotFound(id);

    private static ProblemHttpResult NotFound(int id) =>
        Problems.NotFound("category.not_found", $"Category {id} was not found.");
}
```

`_ => throw new InvalidOperationException(...)` 只防「新增 enum 值卻忘了對應」的程式錯誤，會變成 `500`；**MUST NOT** 拿它表達業務失敗。

`Program.cs`：`api.MapCategories();`

### 3.3 `MapCrud<T>`（泛型 plumbing）

參考專案的 `MapCrud<T>` 直接注入 `ISqlSugarClient`、PUT 忽略路由 id、`Location` 少 `/api`，**MUST NOT** 照抄。新專案一律用 §3.1 + §3.2 的 service + endpoint 寫法；既有專案若保留 `MapCrud<T>`，只能用在規則 10 允許的表，且至少修正兩處：`Location` 改為 `/api{prefix}/{id}`、PUT 依路由 id 讀出再套用 body（規則 11、14）。

---

## 4. 認證與版本

### 4.1 JWT Bearer

> 新專案 MUST（參考專案未實作）。套件：`Microsoft.AspNetCore.Authentication.JwtBearer`（10.x，版本寫在 `server/Directory.Packages.props`）。
> Claim 名稱一律用共用常數 `ElfClaimTypes`（`UserId = "sub"`、`CompanyId = "company_id"`、`Role = "role"`），定義見 **elf-sqlsugar**。

```csharp
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        var jwt = builder.Configuration.GetSection("Jwt");
        o.MapInboundClaims = false;   // keep "sub" / "role" as-is so ElfClaimTypes match
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            NameClaimType = ElfClaimTypes.UserId,
            RoleClaimType = ElfClaimTypes.Role,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
// UseForwardedHeaders → UseExceptionHandler → UseStatusCodePages → UseCors → (below)
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
api.MapGet("/health", ...).AllowAnonymous();
api.MapAuth();                           // /auth/login and /auth/register call .AllowAnonymous() internally
api.MapSessions().RequireAuthorization();
api.MapStats().RequireAuthorization();
```

`appsettings.json` 只放非機密值，`Jwt:Key` 由環境變數 `Jwt__Key` 或 user-secrets 提供：

```json
{
  "Jwt": { "Issuer": "<app>-api", "Audience": "<app>-web", "Key": "" }
}
```

### 4.2 `/api/v2`

> 只在破壞性變更時使用（規則 26）。

```csharp
var api = app.MapGroup("/api");
api.MapSessions();                 // v1: kept until every client has switched

var v2 = app.MapGroup("/api/v2");
v2.MapSessionsV2();                // only the endpoints with a breaking change
```

- 前端呼叫路徑為 `'/v2/sessions'`（相對於 `VITE_API_BASE_URL=/api`），nginx `location /api/` 自動涵蓋。
- `docs/api-contract.md` 同時列出兩版，舊版標 `deprecated`，並寫明預計移除的版本。
- OpenAPI 的 `WithName` 要不同：`SubmitSession` / `SubmitSessionV2`。

---

## 5. Rate limiting 與 Forwarded headers

> 新專案 MUST（參考專案未實作）。內建於 ASP.NET Core，不需額外套件。
> `UseForwardedHeaders()` 不論是否導入 rate limiting 都要啟用：API 永遠在 nginx 後面，少了它 log、限流與 `Request.Scheme` 看到的都是 nginx 容器。

```csharp
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

// Behind nginx: trust X-Forwarded-For/Proto, otherwise every client IP is the nginx container.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // .NET 10 name is KnownIPNetworks (older: KnownNetworks). Match the real docker network.
    o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("172.16.0.0/12"));
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = async (ctx, cancellationToken) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        }

        var problems = ctx.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx.HttpContext,
            ProblemDetails =
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too Many Requests",
                Detail = "Too many requests. Try again later.",
                Extensions = { ["code"] = "rate_limit.exceeded" },
            },
        });
    };

    o.AddPolicy("auth", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,                    // starting value; tune per project (see 待確認)
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

var app = builder.Build();

app.UseForwardedHeaders();       // must be first
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors(WebCors);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

var api = app.MapGroup("/api");
api.MapAuth().RequireRateLimiting("auth");
```

nginx 需送出 `X-Forwarded-For`（**elf-cicd-docker** 的 `templates/nginx.conf` 已設定）：

```nginx
location /api/ {
    proxy_pass http://api:8080/api/;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
