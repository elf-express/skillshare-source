---
name: elf-dotnet
description: |
  Elf Express ASP.NET Core 10 後端規範（minimal API + SqlSugar + PostgreSQL）。
  當任務涉及建立或修改 server/ 下的 .NET 方案、專案結構（.slnx、.csproj、Directory.*.props）、Program.cs、
  minimal API endpoint、服務層、依賴注入生命週期（Singleton/Scoped/Transient）、appsettings 與環境變數、
  連線字串、例外處理、ILogger 記錄、async/await 與 CancellationToken、C# 命名慣例時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express .NET 後端規範（elf-dotnet）

依據：參考專案 `TypingTrainer/server`（ASP.NET Core 10 minimal API + SqlSugar），
轉換為團隊標準（PostgreSQL 18、`server/src/` + `server/tests/` 版面、Central Package Management、ProblemDetails 錯誤格式）。

相關 skill：
- 版本號 → **elf-stack**（本 skill 不寫版本號）
- 資料存取 → **elf-sqlsugar**；資料庫 → **elf-postgresql**；Entity 設計 → **elf-domain-modeling**
- URL / 回應格式 / 錯誤格式 → **elf-api-design**、**elf-api-contract**
- 測試 → **elf-unit**、**elf-integration**；CI → **elf-cicd-backend**

## 1. 何時使用

- 建立新的後端方案或新專案。
- 新增 endpoint、服務、設定項目。
- 修改 `Program.cs`、DI 註冊、設定檔、例外處理、記錄方式。
- 審查 C# 後端程式碼。

## 2. 固定規則

### 2.1 方案結構

1. **MUST** 後端全部放在 repo 的 `server/` 下，方案檔為 `server/<App>.slnx`（XML 格式 `.slnx`，不用舊 `.sln`）。
2. **MUST** 產品程式碼放 `server/src/<Project>/`；單元測試放 `server/tests/<Project>.Tests/`（一個主專案對應一個測試專案，見 elf-unit）；
   整合測試（需要 Docker，含 WebApplicationFactory / contract 測試）另放 `server/tests/<App>.Api.IntegrationTests/`（見 elf-integration）。
3. **MUST** Web 專案命名 `<App>.Api`，使用 `Microsoft.NET.Sdk.Web`。
4. **MUST** 預設**單一** `<App>.Api` 專案，以資料夾分層（見 2.2）。**MUST NOT** 自行拆出 `<App>.Domain` / `<App>.Infrastructure` / `<App>.Application`，除非使用者要求（拆分準則「待確認」）。
5. 可跨產品重用的模組放 `server/framework/<Vendor>.Framework.<Module>/`，介面放同名 `.Abstractions` 專案、每個 provider 一個專案（參考專案 `XiHan.Framework.Translation*` 模式）。只有在使用者明確說「做成可重用模組」時才建立。
6. **MUST** 共用 MSBuild 屬性放 `server/Directory.Build.props`，套件版本放 `server/Directory.Packages.props`（見 elf-stack）；`.csproj` 不寫 `TargetFramework`、`Nullable`、`ImplicitUsings`、套件 `Version`。

### 2.2 `<App>.Api` 內部資料夾

| 資料夾 | 內容 | 命名 |
|--------|------|------|
| `Api/` | minimal API endpoint 群組（static class + extension method） | `<Feature>Endpoints.cs`，方法 `Map<Feature>()` |
| `Services/` | 業務邏輯；endpoint 只呼叫服務 | `<Feature>Service.cs`（介面 `I<Feature>Service`） |
| `Data/` | SqlSugar 註冊、CodeFirst 實體清單、種子資料、目前使用者 / 租戶 | `SqlSugarSetup.cs`、`<Name>Seeds.cs` |
| `Models/` | SqlSugar 實體（見 elf-domain-modeling） | 一個聚合一個檔案，如 `Order.cs` |
| `Options/` | 強型別設定類別 | `<Section>Options.cs` |
| `Infrastructure/` | 跨 feature 的 HTTP 基礎：`Problems`、`ApiValidation`、`GlobalExceptionHandler`、`AppException`、`PagedResult<T>` / `Paging` | `Problems` 見 references §11；其餘見 elf-api-design references |
| `Auth/` | 認證相關常數與處理：`ElfClaimTypes`（claim 名稱唯一定義） | `Auth/ElfClaimTypes.cs`，見 elf-sqlsugar references §1 |
| `Program.cs` | 組裝：DI 註冊、middleware、`MapGroup("/api")` | — |

7. **MUST** 分層方向：`Api/`（endpoint）→ `Services/` → `ISqlSugarClient`。endpoint 內**只**做參數繫結、輸入驗證、呼叫服務、把結果轉成 HTTP 結果。
   - 唯一例外：純參照資料（非租戶、非軟刪除、無業務規則）可用 `MapCrud<T>` plumbing（見 references §10），它直接用 `ISqlSugarClient`。
8. **MUST** 使用 minimal API；**MUST NOT** 新增 MVC Controller（參考專案全部為 minimal API）。
9. **MUST** 所有路由掛在 `app.MapGroup("/api")` 底下；每個 feature `MapGroup(prefix).WithTags("<Feature>")`，每個 endpoint `.WithName("<Verb><Resource>")`。
10. **MUST** 提供 `GET /api/health` 回 `{ status = "ok", utc = DateTime.UtcNow }`（docker healthcheck 依賴它）。
11. OpenAPI：`builder.Services.AddOpenApi()`；`app.MapOpenApi()` **只在 Development** 對外（參考專案作法）。

### 2.3 依賴注入生命週期

12. **MUST** `ISqlSugarClient` 註冊為 **Singleton**，實作為 `SqlSugarScope`（執行緒安全）。**MUST NOT** 把 `SqlSugarClient` 註冊為 Singleton。
13. **MUST** 依下表選生命週期：

| 條件 | 生命週期 |
|------|----------|
| 無狀態，或狀態只來自設定 / 環境（如參考專案 `ModelStorage`） | `AddSingleton` |
| 被 Singleton 依賴、又需要讀當前請求 → 透過 `IHttpContextAccessor` 讀取（如 `ICurrentTenant`） | `AddSingleton` |
| 業務服務（`<Feature>Service`）預設 | `AddScoped` |
| `DelegatingHandler`（`AddHttpClient(...).AddHttpMessageHandler<T>()` 要求每次新實例） | `AddTransient` |

`AddTransient` **只**用於上表最後一列，以及 ASP.NET Core 文件明確要求 Transient 的擴充點；其他情況 **MUST NOT** 使用（無狀態用 Singleton，需要請求範圍用 Scoped）。

14. **MUST NOT** 讓 Singleton 依賴 Scoped（captive dependency）。Development 預設會驗證 scope，啟動失敗時修生命週期，不要關驗證。
15. **MUST** 每個模組提供 `Add<Module>(this IServiceCollection, ...)` extension，放在該模組內（如 `Data/SqlSugarSetup.cs` 的 `AddSqlSugar`）；`Program.cs` 只呼叫 extension。

### 2.4 設定與連線字串

16. **MUST** 連線字串名稱固定為 `ConnectionStrings:Default`，以 `config.GetConnectionString("Default")` 讀取。
17. **MUST** 非本機環境以環境變數覆寫：`ConnectionStrings__Default`、`<Section>__<Key>`（雙底線）。
18. **MUST NOT** 在 `appsettings*.json` commit 任何正式密碼、API key、正式連線字串。`appsettings.json` 只放**空字串占位**（參考專案 `Translation:Google:ApiKey` 寫成 `"Translation": { "Google": { "ApiKey": "" } }`）與本機 docker 開發用的非機密預設值。
19. **MUST** 連線字串缺失時啟動即失敗（`?? throw new InvalidOperationException(...)`）。**MUST NOT** 在程式碼寫 fallback 連線字串（參考專案 SQLite 的 `?? "DataSource=app.db"` 不可沿用）。
20. **MUST** 以 Options pattern 讀取區段：`AddOptions<XOptions>().Bind(config.GetSection(XOptions.Section)).ValidateOnStart()`；服務注入 `IOptions<XOptions>`。**MUST NOT** 在服務裡散落 `config["A:B"]`。
21. CORS 允許來源從 `Cors:Origins`（字串陣列）讀取（參考專案模式）；**MUST NOT** `AllowAnyOrigin()`。

### 2.5 例外處理與回應

22. **MUST** 服務的預期失敗只有兩種回傳方式：
    - **查詢單筆**：回 `T?`，`null` 由 endpoint 轉 404。
    - **命令（新增 / 修改 / 狀態轉換）有預期失敗時**：回**結果 enum**（`PlaceResult.Placed / NotFound / InvalidState`，成員明寫數值），endpoint 以 `switch` 對應每個成員。沒有預期失敗的命令直接回結果值（如新 Id）。

    **MUST NOT** 用 `bool` 表示失敗原因、**MUST NOT** 用 throw 當流程控制；服務層 **MUST NOT** 丟 `AppException` 或建立任何 HTTP 結果。
23. **MUST** 未預期的例外交給全域處理：`AddProblemDetails(...)` + `AddExceptionHandler<GlobalExceptionHandler>()` + `app.UseExceptionHandler()` + `app.UseStatusCodePages()`（elf-api-design §2.3）；**MUST NOT** 在 endpoint 內 `catch (Exception)` 吞例外，或把 `ex.Message` / stack trace 回給用戶端。
24. **MUST** 錯誤回應一律為 RFC 9457 ProblemDetails 並帶 `code`（`<resource>.<reason>`，格式由 **elf-api-design** 擁有）。endpoint 以 `Problems.NotFound / Conflict / BadRequest / Forbidden(code, detail)`（references §11，內部為 `TypedResults.Problem`）轉換服務結果；驗證失敗用 `ApiValidation.Problem(...)`。
    `AppException` 只允許在 endpoint 層（endpoint filter、共用 endpoint helper）丟出。**MUST NOT** 回 `new { message = ... }` 等自訂錯誤形狀。
25. **MUST** 程式錯誤（不該發生的參數）用 `ArgumentNullException.ThrowIfNull(x)`、`ArgumentException.ThrowIfNullOrWhiteSpace(x)`、`ArgumentOutOfRangeException.ThrowIfNegativeOrZero(x)`。

### 2.6 記錄（Logging）

26. **MUST** 注入 `ILogger<T>`；使用 message template 具名占位：`logger.LogWarning("Provider {Provider} failed for {Target}", name, target)`。
27. **MUST NOT** 用 `$"..."` 組 log 訊息；**MUST NOT** 記錄密碼、token、連線字串、完整個資。
28. **MUST NOT** 用 `Console.WriteLine`；SQL log 只在 Development 經 `db.Aop.OnLogExecuting` 寫到 `ILogger`（Debug）。
29. 等級：`Information` 業務事件、`Warning` 可恢復的外部失敗、`Error` 需人處理的失敗。`appsettings.json` 的 `Microsoft.AspNetCore` 設 `Warning`（參考專案設定）。

### 2.7 async

30. **MUST** 所有 I/O（DB、HTTP、檔案）使用 async API；方法名以 `Async` 結尾，回傳 `Task` / `Task<T>`。
31. **MUST** endpoint 宣告 `CancellationToken ct` 參數並一路傳到服務與 SqlSugar / HttpClient（參數名統一 `ct`）。
32. **MUST NOT** 使用 `.Result`、`.Wait()`、`GetAwaiter().GetResult()`、`async void`。
33. `ConfigureAwait(false)`：`server/framework/*` 函式庫 **MUST** 使用（參考專案 XiHan 模組如此）；`<App>.Api` **不需要**（ASP.NET Core 無 SynchronizationContext）。
34. 獨立的外部呼叫可用 `Task.WhenAll` 平行；**MUST NOT** 對同一個 SqlSugar 交易平行下指令。

### 2.8 命名與風格

35. **MUST** file-scoped namespace（`namespace Acme.Api.Services;`），namespace = 專案名 + 資料夾路徑。
36. **MUST** 型別 / 方法 / 屬性 PascalCase；區域變數 / 參數 camelCase；private 欄位 `_camelCase`；常數 PascalCase。縮寫當單字寫（`HttpClient`、`OrderId`）。
37. **MUST** DTO 使用 `record`，命名 `<Verb><Resource>Request` / `<Resource>Dto`。只給單一 endpoint 群組用的 DTO 可巢狀在 `<Feature>Endpoints` 內（參考專案 `PromptEndpoints.PromptDto`）；跨檔共用的放 `Api/Contracts/`。
38. **MUST NOT** 把 SqlSugar 實體直接當 request body 接收（mass assignment）；回應也轉 DTO（`MapCrud<T>` 除外）。
39. 服務用 primary constructor 注入（`public sealed class OrderService(ISqlSugarClient db) : IOrderService`）；不打算被繼承的類別加 `sealed`。
40. 註解寫「為什麼」，不寫「做什麼」。

## 3. 標準範本

完整可複製檔案見 [`references/project-templates.md`](references/project-templates.md)：
`global.json`、`Directory.Build.props`、`<App>.slnx` 與建立指令、`<App>.Api.csproj`、`<App>.Api.Tests.csproj`（`coverlet.msbuild`）、
`Program.cs`、`appsettings*.json`、`MapCrud<T>`、`Problems`。
API Dockerfile 只有一份，由 **elf-cicd-docker** 維護（`templates/api.Dockerfile`），本 skill 不另提供。
（本節與 references 的 C# 範本已於 2026-09 以 net10.0 + SqlSugarCore 5.1.4.221 實際建置通過。）

### 3.1 目錄骨架

```
<repo>/
├── global.json
└── server/
    ├── Acme.slnx
    ├── Directory.Build.props
    ├── Directory.Packages.props
    ├── src/
    │   └── Acme.Api/
    │       ├── Acme.Api.csproj
    │       ├── Program.cs
    │       ├── appsettings.json
    │       ├── appsettings.Development.json
    │       ├── Api/OrderEndpoints.cs
    │       ├── Services/OrderService.cs
    │       ├── Data/SqlSugarSetup.cs
    │       ├── Models/Order.cs
    │       ├── Options/CorsOptions.cs
    │       ├── Auth/ElfClaimTypes.cs
    │       └── Infrastructure/Problems.cs
    └── tests/
        ├── Acme.Api.Tests/
        │   ├── Acme.Api.Tests.csproj
        │   └── Services/OrderServiceTests.cs
        └── Acme.Api.IntegrationTests/      # needs Docker (Testcontainers), see elf-integration
            └── Acme.Api.IntegrationTests.csproj
```

### 3.2 Endpoint 群組

endpoint 只做：繫結 → 驗證輸入 → 呼叫服務 → 把 `T?` / 結果 enum 轉成 HTTP 結果（`TypedResults` + `Problems`）。

```csharp
using Acme.Api.Infrastructure;
using Acme.Api.Models;
using Acme.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Acme.Api.Api;

public static class OrderEndpoints
{
    public record CreateOrderRequest(string Name, int Quantity);
    public record OrderDto(int Id, string Name, int Quantity, DateTime CreatedAt);
    public record CreatedIdDto(int Id);

    /// <summary>Route under the /api group; used again to build Location headers.</summary>
    private const string Prefix = "/orders";

    public static RouteGroupBuilder MapOrders(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(Prefix).WithTags("Orders");

        group.MapGet("/{id:int}", GetAsync).WithName("GetOrder");
        group.MapPost("/", CreateAsync).WithName("CreateOrder");
        group.MapPost("/{id:int}/place", PlaceAsync).WithName("PlaceOrder");

        return group;
    }

    // Lookup: the service returns T?; null becomes 404 ProblemDetails.
    private static async Task<Results<Ok<OrderDto>, ProblemHttpResult>> GetAsync(
        IOrderService orders, int id, CancellationToken ct)
    {
        var dto = await orders.GetAsync(id, ct);
        return dto is null
            ? Problems.NotFound("order.not_found", $"Order {id} was not found.")
            : TypedResults.Ok(dto);
    }

    private static async Task<Results<Created<CreatedIdDto>, ValidationProblem>> CreateAsync(
        IOrderService orders, CreateOrderRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || body.Quantity <= 0)
        {
            return ApiValidation.Problem(
                ("name", "Name is required."),
                ("quantity", "Quantity must be positive."));
        }

        var id = await orders.CreateAsync(body, ct);
        return TypedResults.Created($"/api{Prefix}/{id}", new CreatedIdDto(id));
    }

    // Command: the service returns a result enum; the endpoint maps every member.
    private static async Task<Results<NoContent, ProblemHttpResult>> PlaceAsync(
        IOrderService orders, int id, CancellationToken ct) =>
        await orders.PlaceAsync(id, ct) switch
        {
            PlaceResult.Placed => TypedResults.NoContent(),
            PlaceResult.NotFound => Problems.NotFound("order.not_found", $"Order {id} was not found."),
            PlaceResult.InvalidState => Problems.Conflict("order.invalid_state", $"Order {id} is not a draft."),
            var other => throw new ArgumentOutOfRangeException(nameof(other), other, null),
        };
}
```

### 3.3 服務

```csharp
using Acme.Api.Data;
using Acme.Api.Models;
using SqlSugar;
using static Acme.Api.Api.OrderEndpoints;

namespace Acme.Api.Services;

public interface IOrderService
{
    Task<OrderDto?> GetAsync(int id, CancellationToken ct);
    Task<int> CreateAsync(CreateOrderRequest request, CancellationToken ct);
    Task<PlaceResult> PlaceAsync(int id, CancellationToken ct);
}

public sealed class OrderService(ISqlSugarClient db, ILogger<OrderService> logger) : IOrderService
{
    public async Task<OrderDto?> GetAsync(int id, CancellationToken ct)
    {
        var order = await db.Queryable<Order>().Where(o => o.Id == id).FirstAsync(ct);
        return order is null
            ? null
            : new OrderDto(order.Id, order.Name, order.Quantity, UtcTime.Normalize(order.CreatedAt));
    }

    public async Task<int> CreateAsync(CreateOrderRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);

        var order = Order.Create(request.Name, request.Quantity);
        var id = await db.Insertable(order).ExecuteReturnIdentityAsync(ct);

        logger.LogInformation("Order {OrderId} created", id);
        return id;
    }

    public async Task<PlaceResult> PlaceAsync(int id, CancellationToken ct)
    {
        var order = await db.Queryable<Order>().Where(o => o.Id == id).FirstAsync(ct);
        if (order is null)
        {
            return PlaceResult.NotFound;
        }

        if (!order.TryPlace()) // the rule lives on the aggregate (elf-domain-modeling)
        {
            return PlaceResult.InvalidState;
        }

        var status = order.Status;
        await db.Updateable<Order>()
            .SetColumns(o => new Order { Status = status }, true)
            .Where(o => o.Id == id)
            .ExecuteCommandAsync(ct);

        return PlaceResult.Placed;
    }
}
```

註冊：`builder.Services.AddScoped<IOrderService, OrderService>();`
`Order.Create(...)`、`TryPlace()`、`PlaceResult` 見 elf-domain-modeling references；`UtcTime.Normalize` 見 elf-postgresql §3.4；
`ApiValidation` 見 elf-api-design references §1；SqlSugar 簽章不確定時先查 **sqlsugar-docs**。

### 3.4 強型別設定

```csharp
namespace Acme.Api.Options;

public sealed class CorsOptions
{
    public const string Section = "Cors";
    public string[] Origins { get; set; } = [];
}
```

## 4. 檢查清單

- [ ] 方案檔是 `server/<App>.slnx`，產品碼在 `server/src/`、單元測試在 `server/tests/<Project>.Tests/`、整合測試在 `server/tests/<App>.Api.IntegrationTests/`
- [ ] `.csproj` 沒有 `Version=`、`TargetFramework`（由 Directory.*.props 提供）
- [ ] 新 endpoint 掛在 `/api` group 下，有 `.WithTags` 與 `.WithName`
- [ ] endpoint 只做繫結 → 呼叫服務 → 回結果；業務邏輯在 `Services/`
- [ ] 服務預期失敗回 `T?` 或結果 enum；沒有用 `bool` 表示失敗原因、沒有 throw 當流程控制、沒有丟 `AppException`
- [ ] 所有錯誤是 ProblemDetails 且帶 `code`（`Problems.*` / `ApiValidation.Problem`）；沒有 `new { message }`
- [ ] 所有 async 方法接收並傳遞 `CancellationToken ct`
- [ ] 沒有 `.Result` / `.Wait()` / `async void`
- [ ] `ISqlSugarClient` 是 Singleton 的 `SqlSugarScope`；業務服務為 Scoped；沒有 Singleton 依賴 Scoped
- [ ] 連線字串來自 `ConnectionStrings:Default`，缺失即啟動失敗；沒有 commit 機密
- [ ] 有 `AddProblemDetails()` + `AddExceptionHandler<GlobalExceptionHandler>()` + `UseExceptionHandler()` + `UseStatusCodePages()`；沒有吞例外、沒有回傳 stack trace
- [ ] `UseForwardedHeaders()` 在 `UseCors` 之前；沒有 `UseHttpsRedirection()`
- [ ] 只有 `DelegatingHandler` 用 `AddTransient`
- [ ] log 使用 message template，無 `$"..."`、無機密
- [ ] request 用 `record` DTO，不直接接收實體
- [ ] 新服務有測試（elf-unit）；`coverlet.msbuild` 合併後 line coverage ≥ 55%（指令見 references §6，CI 門檻寫法見 elf-cicd-backend）

## 5. 常見錯誤

| 錯誤 | 正確 |
|------|------|
| `services.AddSingleton<ISqlSugarClient>(new SqlSugarClient(...))` | Singleton 必須用 `SqlSugarScope` |
| endpoint 裡 20 行 `db.Queryable...` 加業務判斷 | 移到 `Services/<Feature>Service` |
| `var x = service.GetAsync(id).Result;` | `await service.GetAsync(id, ct)` |
| `GetConnectionString("Default") ?? "Host=localhost;..."` | `?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.")` |
| appsettings.json 放正式密碼 | 空字串占位，部署時以 `ConnectionStrings__Default` 等環境變數注入 |
| `logger.LogInformation($"Order {id} created")` | `logger.LogInformation("Order {OrderId} created", id)` |
| `catch (Exception ex) { return Results.BadRequest(ex.Message); }` | 交給全域 exception handler |
| 服務丟 `InvalidOperationException` / `AppException` 表示「狀態不允許」 | 回傳結果 enum，endpoint 以 `Problems.Conflict(code, detail)` 回 409 |
| `Results.BadRequest(new { message = "..." })` | `ApiValidation.Problem(...)` 或 `Problems.BadRequest(code, detail)`（ProblemDetails + `code`） |
| 服務回 `bool`，endpoint 猜 false 是 404 還是 409 | 查詢回 `T?`；命令回結果 enum |
| `app.UseHttpsRedirection()` | 移除；HTTPS 在反向代理終止，改用 `app.UseForwardedHeaders()`（在 `UseCors` 前） |
| 在專案裡另寫一份 API Dockerfile | 用 elf-cicd-docker 的 `templates/api.Dockerfile` |
| 使用 Furion / `Oops` / `AppFriendlyException` | 團隊不採用；用結果 enum + `Problems` |
| 新增 `Controllers/OrderController.cs` | `Api/OrderEndpoints.cs` minimal API |
| 另建 `Acme.Domain`、`Acme.Infrastructure` | 預設單一 `Acme.Api`；拆分需使用者同意 |
| 測試專案放 `server/Acme.Api.Tests`（參考專案舊版面） | `server/tests/Acme.Api.Tests`；整合測試 `server/tests/Acme.Api.IntegrationTests` |
| 測試 csproj 引用 `coverlet.collector`、寫 `Version=` 或 `TargetFramework` | `coverlet.msbuild`，版本 / TFM 由 Directory.*.props 提供 |
| 實體用 `required` 屬性 | SqlSugar 以 `Activator.CreateInstance` 建物件會丟例外；用預設值 |

## 6. 待確認

- 何時允許拆出 `<App>.Domain` / `<App>.Infrastructure`（專案規模門檻）。
- 認證授權：api-contract 註明 bearer JWT，但參考專案尚未實作；JWT 簽發方式（自簽 / 外部 IdP）、角色與權限模型待定。
  （Claim 名稱已決定為 `ElfClaimTypes`；它與 `ICurrentUser` / `ICurrentTenant` 範本都在 elf-sqlsugar references §1。）
- 背景工作：Hangfire / `BackgroundService` / 其他（參考專案沒有背景工作）。
- 結構化記錄提供者（Serilog 等）與集中式 log 目的地。
- 是否啟用 `<TreatWarningsAsErrors>`。
- 本機開發機密管理：`dotnet user-secrets` 或 `.env`。
- 輸入驗證方式（手寫檢查、DataAnnotations、FluentValidation）。
