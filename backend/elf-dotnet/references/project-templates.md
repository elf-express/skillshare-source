# elf-dotnet 專案範本

以下以 `Acme` 代表 `<App>`。版本號以 **elf-stack** 為準；此處只示範結構。
本檔所有 C# / MSBuild 範本已於 2026-09 以 .NET SDK 10.0.4xx + `SqlSugarCore 5.1.4.221` 實際建置通過
（唯一的警告是 `MapCrud<T>` 觸發的 `AD0001`，見 §10 說明）。

## 1. `global.json`（repo 根目錄）

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

## 2. `server/Directory.Build.props`

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>

  <!-- Test projects: everything under server/tests -->
  <PropertyGroup Condition="$(MSBuildProjectName.EndsWith('Tests'))">
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
</Project>
```

> 條件用 `EndsWith('Tests')`，同時涵蓋 `<Project>.Tests` 與 `<App>.Api.IntegrationTests`。

## 3. `server/Directory.Packages.props`

見 elf-stack §4.3（唯一版本來源，不要在這裡複製版本號）。

## 4. `server/Acme.slnx`

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="src/Acme.Api/Acme.Api.csproj" />
  </Folder>
  <Folder Name="/tests/">
    <Project Path="tests/Acme.Api.Tests/Acme.Api.Tests.csproj" />
    <Project Path="tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj" />
  </Folder>
</Solution>
```

建立指令：

```bash
cd server
dotnet new sln -n Acme --format slnx
dotnet new web -n Acme.Api -o src/Acme.Api
dotnet new xunit -n Acme.Api.Tests -o tests/Acme.Api.Tests
dotnet sln Acme.slnx add src/Acme.Api/Acme.Api.csproj --solution-folder src
dotnet sln Acme.slnx add tests/Acme.Api.Tests/Acme.Api.Tests.csproj --solution-folder tests
dotnet add tests/Acme.Api.Tests reference src/Acme.Api
```

`dotnet new` 產生的 csproj 會帶 `TargetFramework` 與套件 `Version`，**建立後必須刪除**，改成下方內容。
整合測試專案 `tests/Acme.Api.IntegrationTests`（需要 Docker；WebApplicationFactory / contract 測試也放這裡）的 csproj 見 **elf-integration**。

## 5. `server/src/Acme.Api/Acme.Api.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <Version>0.1.0</Version>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
    <PackageReference Include="SqlSugarCore" />
  </ItemGroup>

  <!-- Lets tests call internal types without making them public. -->
  <ItemGroup>
    <InternalsVisibleTo Include="Acme.Api.Tests" />
  </ItemGroup>

</Project>
```

## 6. `server/tests/Acme.Api.Tests/Acme.Api.Tests.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <ItemGroup>
    <PackageReference Include="coverlet.msbuild" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio" />
  </ItemGroup>

  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\Acme.Api\Acme.Api.csproj" />
  </ItemGroup>

</Project>
```

- 沒有 `Version=`、沒有 `TargetFramework`：版本來自 `Directory.Packages.props`，TFM 來自 `Directory.Build.props`。
- 覆蓋率一律用 `coverlet.msbuild`；**MUST NOT** 用 `coverlet.collector` / `--collect:"XPlat Code Coverage"`。

覆蓋率門檻（line 55% 強制、branch 50% 建議）看的是**所有測試專案合併後**的總覆蓋率，不要求每個測試專案單獨達標。
本機只有單元測試專案時，下列指令即為門檻檢查：

```bash
dotnet test server/Acme.slnx -c Release \
  -p:CollectCoverage=true -p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total
```

`coverlet.msbuild` 是逐個測試專案套用 `Threshold` 的；有多個測試專案（含 `IntegrationTests`）時，CI 以合併報告（`MergeWith`）後再判斷門檻，
確切寫法由 **elf-cicd-backend** 擁有。測試撰寫規範見 elf-unit / elf-integration。

## 7. `server/src/Acme.Api/Program.cs`

```csharp
using Acme.Api.Api;
using Acme.Api.Data;
using Acme.Api.Infrastructure;
using Acme.Api.Models;
using Acme.Api.Options;
using Acme.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Errors: RFC 9457 ProblemDetails + "code" (elf-api-design owns the format).
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
    ctx.ProblemDetails.Extensions.TryAdd("traceId", ctx.HttpContext.TraceIdentifier);
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Data: SqlSugarScope singleton over PostgreSQL (see elf-sqlsugar).
builder.Services.AddSqlSugar(builder.Configuration, builder.Environment);

// Business services are scoped: they may read the current user / tenant.
builder.Services.AddScoped<IOrderService, OrderService>();

builder.Services.AddOptions<CorsOptions>()
    .Bind(builder.Configuration.GetSection(CorsOptions.Section))
    .ValidateOnStart();

// TLS ends at the reverse proxy (nginx in elf-cicd-docker); the API is only reachable on the
// internal compose network, so the proxy's X-Forwarded-* headers are trusted.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

const string WebCors = "web";
builder.Services.AddCors(o => o.AddPolicy(WebCors, p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseForwardedHeaders();   // first: everything after sees the client's scheme / IP
app.UseExceptionHandler();   // exceptions -> ProblemDetails
app.UseStatusCodePages();    // empty 401/403/404 -> ProblemDetails

app.Services.InitDatabase();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// No UseHttpsRedirection: HTTPS is terminated by the reverse proxy.
app.UseCors(WebCors);
// When auth is added: app.UseAuthentication(); app.UseAuthorization();

var api = app.MapGroup("/api");

api.MapGet("/health", () => TypedResults.Ok(new { status = "ok", utc = DateTime.UtcNow }))
    .WithName("Health");

api.MapOrders();
api.MapCrud<Country>("/countries"); // reference data only (references §10)

app.Run();

// Exposes the entry point to WebApplicationFactory<Program> in integration tests.
public partial class Program;
```

- 順序：`UseForwardedHeaders` → `UseExceptionHandler` → `UseStatusCodePages` → `UseCors` →（導入後）`UseAuthentication` / `UseAuthorization`。
- **不**呼叫 `UseHttpsRedirection`：HTTPS 在反向代理（elf-cicd-docker 的 nginx）終止，容器內只聽 HTTP 8080。
- `GlobalExceptionHandler` 與 `ApiValidation` 的程式碼見 elf-api-design references §1（錯誤格式的擁有者）。

## 8. `appsettings.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=acme;Username=acme;Password=acme_dev;Timezone=UTC"
  },
  "Database": {
    "RunCodeFirst": false
  },
  "Cors": {
    "Origins": ["http://localhost:5173", "http://tauri.localhost", "https://tauri.localhost"]
  }
}
```

- 上面的連線字串**只**對應 elf-postgresql 本機開發 compose 的帳密（非機密，本機 `docker/.env` 填相同值）。
- 正式 / 測試環境一律以環境變數 `ConnectionStrings__Default` 覆寫；連線字串**一定**帶 `Timezone=UTC`。
- `Database:RunCodeFirst` 只在 Production 有意義（見 elf-sqlsugar references §2 `InitDatabase`）。
- 第三方 API key 等機密一律寫空字串占位，例如 `"Translation": { "Google": { "ApiKey": "" } }`。

## 9. `appsettings.Development.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Acme.Api.Data": "Debug"
    }
  }
}
```

`Acme.Api.Data` 設為 Debug 時，elf-sqlsugar 的 SQL AOP log 才會輸出。

## 10. 通用 CRUD plumbing（`Api/CrudEndpoints.cs`）

只用於**沒有業務規則、沒有多租戶、沒有軟刪除、沒有額外授權需求**的參照資料表（例：`Country`）；其餘一律手寫 endpoint + 服務。
與參考專案版本相比已修正：Location 含 `/api`、PUT 以路由 id 為準（body id 不符回 400）、全部傳 `CancellationToken`、
列表回 `PagedResult<T>`、對 `ICompanyEntity` / `ISoftDelete` 實體啟動即失敗。

```csharp
using Acme.Api.Infrastructure;
using Acme.Api.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using SqlSugar;

namespace Acme.Api.Api;

/// <summary>
/// Generic CRUD for plain reference data only: no business rules, no tenant, no soft delete,
/// no authorization beyond the group's. Everything else gets a hand-written endpoint + service.
/// Must be mapped on the "/api" group (rule 9), which the Location header assumes.
/// </summary>
public static class CrudEndpoints
{
    public static RouteGroupBuilder MapCrud<T>(this IEndpointRouteBuilder api, string prefix)
        where T : class, IEntity, new()
    {
        // Fail at startup rather than silently bypassing tenant / soft-delete semantics.
        if (typeof(ICompanyEntity).IsAssignableFrom(typeof(T)) || typeof(ISoftDelete).IsAssignableFrom(typeof(T)))
        {
            throw new InvalidOperationException(
                $"MapCrud<{typeof(T).Name}> is only for reference data; tenant or soft-delete entities need a service.");
        }

        var group = api.MapGroup(prefix).WithTags(typeof(T).Name);

        group.MapGet("/", ListAsync<T>);
        group.MapGet("/{id:int}", GetAsync<T>);
        group.MapPost("/", (ISqlSugarClient db, T body, CancellationToken ct) => CreateAsync(db, body, prefix, ct));
        group.MapPut("/{id:int}", UpdateAsync<T>);
        group.MapDelete("/{id:int}", DeleteAsync<T>);

        return group;
    }

    private static async Task<Ok<PagedResult<T>>> ListAsync<T>(
        ISqlSugarClient db, int? page, int? size, CancellationToken ct)
        where T : class, IEntity, new()
    {
        var (p, s) = Paging.Normalize(page, size);
        RefAsync<int> total = 0;
        var rows = await db.Queryable<T>().OrderBy(e => e.Id).ToPageListAsync(p, s, total, ct);
        return TypedResults.Ok(new PagedResult<T>(total.Value, p, s, rows));
    }

    private static async Task<Results<Ok<T>, NotFound>> GetAsync<T>(ISqlSugarClient db, int id, CancellationToken ct)
        where T : class, IEntity, new()
    {
        var row = await db.Queryable<T>().In(id).FirstAsync(ct);
        return row is null ? TypedResults.NotFound() : TypedResults.Ok(row);
    }

    private static async Task<Created<T>> CreateAsync<T>(ISqlSugarClient db, T body, string prefix, CancellationToken ct)
        where T : class, IEntity, new()
    {
        body.Id = 0; // identity column: never trust a client-supplied id
        body.Id = await db.Insertable(body).ExecuteReturnIdentityAsync(ct);
        return TypedResults.Created($"/api{prefix}/{body.Id}", body);
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> UpdateAsync<T>(
        ISqlSugarClient db, int id, T body, CancellationToken ct)
        where T : class, IEntity, new()
    {
        // The route id is authoritative (elf-api-design rule 14).
        if (body.Id != 0 && body.Id != id)
        {
            return Problems.BadRequest("request.id_mismatch", $"Body id {body.Id} does not match route id {id}.");
        }

        body.Id = id;
        var affected = await db.Updateable(body).ExecuteCommandAsync(ct);
        return affected > 0 ? TypedResults.NoContent() : TypedResults.NotFound();
    }

    private static async Task<Results<NoContent, NotFound>> DeleteAsync<T>(ISqlSugarClient db, int id, CancellationToken ct)
        where T : class, IEntity, new()
    {
        var affected = await db.Deleteable<T>().In(id).ExecuteCommandAsync(ct);
        return affected > 0 ? TypedResults.NoContent() : TypedResults.NotFound();
    }
}
```

- PUT 是整筆 `Updateable(body)`；`CreatedAt` / `CreatedBy` 靠實體上的 `IsOnlyIgnoreUpdate = true` 保護（elf-domain-modeling references §1）。
- 已知：SDK 10.0.4xx 的 `RouteHandlerAnalyzer` 對泛型 `T` 的 route handler 會丟 `AD0001` 警告（分析器本身的 NullReferenceException，參考專案原版也會出現，不影響執行）。
  若專案開啟 `TreatWarningsAsErrors`，在 `Acme.Api.csproj` 加 `<NoWarn>$(NoWarn);AD0001</NoWarn>` 並註明原因。

## 11. `Infrastructure/Problems.cs` — 結果 → ProblemDetails

服務回傳結果 enum 或 `T?`；endpoint 用這個 helper 轉成帶 `code` 的 RFC 9457 ProblemDetails。
驗證失敗（400 + `errors`）用 elf-api-design 的 `ApiValidation.Problem(...)`。

唯一定義在 **elf-api-design** [`references/server-templates.md` §1.1](../../../api/elf-api-design/references/server-templates.md)（`server/src/<App>.Api/Infrastructure/Problems.cs`：`BadRequest` / `Forbidden` / `NotFound` / `Conflict`，皆回 `ProblemHttpResult` 並帶 `code` extension）。本 skill 不另寫一份，**MUST NOT** 複製到其他位置。

## 12. Claim 名稱（`ElfClaimTypes`）

唯一定義在 **elf-sqlsugar** references §1（`server/src/<App>.Api/Auth/ElfClaimTypes.cs`，namespace `<App>.Api.Auth`：`UserId = "sub"`、`CompanyId = "company_id"`、`Role = "role"`），
與租戶 / 使用者解析器放在一起。JWT 簽發端、`HttpCurrentTenant` / `HttpCurrentUser`、整合測試的 `TestAuthHandler`（elf-integration）都只引用這些常數，**MUST NOT** 另寫字串。

## 13. docker（API 映像）

API Dockerfile **只有一份**，由 **elf-cicd-docker** 維護：`cicd/elf-cicd-docker/templates/api.Dockerfile`（放到 repo 的 `docker/api.Dockerfile`）。
它依本 skill 的版面：先 COPY `global.json`、`server/Directory.Build.props`、`server/Directory.Packages.props` 與各 csproj → restore → 再 COPY 原始碼 → publish；
最終映像設 `TZ=UTC`、以 `curl` 做 `/api/health` healthcheck。本 skill 不另外提供 Dockerfile。

新增 `ProjectReference` 時，記得在該 Dockerfile 補上對應的 `COPY <csproj>` 行（elf-cicd-docker 檢查清單）。
`ConnectionStrings__Default` 由 compose / 部署平台注入，不寫進 Dockerfile。
