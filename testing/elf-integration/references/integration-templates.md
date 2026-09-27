# 整合測試範本（ASP.NET Core + PostgreSQL 18 + SqlSugar）

> 由 [`../SKILL.md`](../SKILL.md) §3 連結。以 `Acme.Api`（`server/src/Acme.Api/`）為示意主專案，複製時全域替換
> `Acme` → 實際 `<App>` 名稱，`SeedData.Seed(db)` → 主專案實際的種子方法。

## 1. `server/tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <!-- TargetFramework / ImplicitUsings / Nullable come from server/Directory.Build.props. -->
  <PropertyGroup>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <!-- Central Package Management: versions live in server/Directory.Packages.props (elf-stack). No Version= here. -->
  <ItemGroup>
    <PackageReference Include="coverlet.msbuild" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="Testcontainers.PostgreSql" />
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

- 啟用 Central Package Management：`PackageReference` **不寫** `Version=`，也**不寫**自己的 `TargetFramework`；
  版本（含 `coverlet.msbuild`、`Microsoft.AspNetCore.Mvc.Testing`、`Testcontainers.PostgreSql`）一律在 `elf-stack` 的 `Directory.Packages.props`
- 覆蓋率用 `coverlet.msbuild`，**不要**用 `coverlet.collector` / `--collect:"XPlat Code Coverage"`
- `SqlSugarCore` 由主專案傳遞進來，**不要**在測試專案重複引用
- 建立後加入方案：`dotnet sln server/Acme.slnx add server/tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj`

## 2. `Infrastructure/IntegrationFixture.cs` + `IntegrationCollection.cs`

```csharp
using System.Security.Claims;
using Acme.Api.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using SqlSugar;
using Testcontainers.PostgreSql;

namespace Acme.Api.IntegrationTests.Infrastructure;

/// <summary>
/// One PostgreSQL 18 container and one running host for the whole test run.
/// Set ELF_TEST_PG_CONNECTION to point at an existing throwaway database instead
/// (same credentials: elf / elf_test_pw / elf_test, and it must contain Timezone=UTC).
/// </summary>
public sealed class IntegrationFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public ElfApiFactory Factory { get; private set; } = null!;

    public string ConnectionString { get; private set; } = "";

    public ISqlSugarClient Db => Factory.Services.GetRequiredService<ISqlSugarClient>();

    public async Task InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable("ELF_TEST_PG_CONNECTION");
        if (string.IsNullOrWhiteSpace(external))
        {
            _container = new PostgreSqlBuilder("postgres:18")
                .WithDatabase("elf_test")
                .WithUsername("elf")
                .WithPassword("elf_test_pw")
                .Build();
            await _container.StartAsync();
            // Same session time zone as production connection strings (elf-postgresql).
            ConnectionString = _container.GetConnectionString() + ";Timezone=UTC";
        }
        else
        {
            ConnectionString = external;
        }

        // The container must be up before the host starts: Program runs CodeFirst on start (non-Production env).
        Factory = new ElfApiFactory(ConnectionString);
        _ = Factory.Server;
    }

    public HttpClient CreateClient(string? user = null, string? companyId = null, string[]? roles = null)
    {
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if (user is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, user);
            if (companyId is not null) client.DefaultRequestHeaders.Add(TestAuthHandler.CompanyHeader, companyId);
            if (roles is { Length: > 0 }) client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(',', roles));
        }
        return client;
    }

    /// <summary>
    /// Runs Arrange / Assert database work as one company. The app's client keeps its tenant filter and
    /// CompanyId audit, which read the current HttpContext, so outside a request there must be one.
    /// </summary>
    public async Task<T> AsCompanyAsync<T>(int companyId, Func<ISqlSugarClient, Task<T>> work)
    {
        var accessor = Factory.Services.GetRequiredService<IHttpContextAccessor>();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ElfClaimTypes.UserId, "0"), new Claim(ElfClaimTypes.CompanyId, companyId.ToString())],
            TestAuthHandler.Scheme));
        accessor.HttpContext = new DefaultHttpContext { User = principal };
        try
        {
            return await work(Db);
        }
        finally
        {
            accessor.HttpContext = null;
        }
    }

    public Task ResetDatabaseAsync() => DatabaseReset.ResetAsync(Db);

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        if (_container is not null) await _container.DisposeAsync();
    }
}
```

```csharp
namespace Acme.Api.IntegrationTests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class IntegrationCollection : ICollectionFixture<IntegrationFixture>
{
    public const string Name = "integration";
}
```

## 3. `Infrastructure/ElfApiFactory.cs`

```csharp
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Acme.Api.IntegrationTests.Infrastructure;

public sealed class ElfApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // UseSetting lands before Program reads configuration; ConfigureAppConfiguration does not.
        // This is the ONLY database override: the app's own AddSqlSugar(builder.Configuration, builder.Environment)
        // still builds the client, so snake_case naming, AOP audit fields and tenant / soft-delete filters stay on.
        builder.UseSetting("ConnectionStrings:Default", connectionString);
        // Every third-party key blank: nothing in a test may reach a real external service.
        builder.UseSetting("Translation:Google:ApiKey", "");

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.Scheme, _ => { });
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = TestAuthHandler.Scheme;
                o.DefaultAuthenticateScheme = TestAuthHandler.Scheme;
                o.DefaultChallengeScheme = TestAuthHandler.Scheme;
            });

            // External HTTP: replace the primary handler of each typed client the app registers.
            // services.AddHttpClient<IShippingClient, ShippingClient>()
            //     .ConfigurePrimaryHttpMessageHandler(() => StubHttpMessageHandler.Json(HttpStatusCode.OK, new { trackingNo = "T123" }));
        });
    }
}
```

- **MUST NOT** 在 `ConfigureTestServices` 裡 `RemoveAll<ISqlSugarClient>()` 或另外 `new SqlSugarScope(...)`：
  測試端自建的 client 不會有主專案的 `ConfigureExternalServices`、AOP、全域過濾器，測到的就不是上線行為
- 若 `UseSetting` 看起來沒生效，代表主專案在 `builder.Configuration` 之外另讀設定（例如 static 欄位），
  應修主專案改從 `builder.Configuration` 讀，而不是在測試端替換 client

## 4. `Infrastructure/TestAuthHandler.cs`

Claim 名稱來自主專案共用的常數類別（與 `elf-sqlsugar` 的租戶解析器同一份；定義在主專案，**不要**在測試端複製）：

```csharp
namespace Acme.Api.Auth;

/// <summary>JWT claim names the API reads. Shared by the tenant resolver and the integration TestAuthHandler.</summary>
public static class ElfClaimTypes
{
    public const string UserId = "sub";
    public const string CompanyId = "company_id";
    public const string Role = "role";
}
```

```csharp
using System.Security.Claims;
using System.Text.Encodings.Web;
using Acme.Api.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Acme.Api.IntegrationTests.Infrastructure;

/// <summary>Authenticates a request from test headers; no header means anonymous (401).</summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "Test";
    public const string UserHeader = "X-Test-User";
    public const string CompanyHeader = "X-Test-Company";
    public const string RolesHeader = "X-Test-Roles";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserHeader, out var user) || string.IsNullOrWhiteSpace(user))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new List<Claim> { new(ElfClaimTypes.UserId, user.ToString()) };

        if (Request.Headers.TryGetValue(CompanyHeader, out var company))
        {
            claims.Add(new Claim(ElfClaimTypes.CompanyId, company.ToString()));
        }
        if (Request.Headers.TryGetValue(RolesHeader, out var roles))
        {
            claims.AddRange(roles.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(r => new Claim(ElfClaimTypes.Role, r.Trim())));
        }

        // roleType must be ElfClaimTypes.Role, otherwise [Authorize(Roles = ...)] / IsInRole look for ClaimTypes.Role.
        var identity = new ClaimsIdentity(claims, Scheme, nameType: ElfClaimTypes.UserId, roleType: ElfClaimTypes.Role);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

## 5. `Infrastructure/DatabaseReset.cs`

```csharp
using SqlSugar;

namespace Acme.Api.IntegrationTests.Infrastructure;

public static class DatabaseReset
{
    /// <summary>Empties every table in the public schema, then restores the seed rows the app relies on.</summary>
    public static async Task ResetAsync(ISqlSugarClient db)
    {
        var tables = await db.Ado.SqlQueryAsync<string>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'");

        if (tables.Count > 0)
        {
            var list = string.Join(", ", tables.Select(t => $"\"public\".\"{t}\""));
            await db.Ado.ExecuteCommandAsync($"TRUNCATE TABLE {list} RESTART IDENTITY CASCADE");
        }

        // Same seeding the app runs on start. Replace with the project's own seed entry point.
        SeedData.Seed(db);
    }
}
```

## 6. `Infrastructure/StubHttpMessageHandler.cs`

```csharp
using System.Net;
using System.Net.Http.Json;

namespace Acme.Api.IntegrationTests.Infrastructure;

/// <summary>Answers every request with a fixed response and records what was sent.</summary>
public sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    public static StubHttpMessageHandler Json(HttpStatusCode status, object body) =>
        new(_ => new HttpResponseMessage(status) { Content = JsonContent.Create(body) });

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Requests.Add(request);
        return Task.FromResult(respond(request));
    }
}
```

## 7. `Api/OrdersEndpointTests.cs`

```csharp
using System.Net;
using System.Net.Http.Json;
using Acme.Api.IntegrationTests.Infrastructure;
using Acme.Api.Models;

namespace Acme.Api.IntegrationTests.Api;

[Collection(IntegrationCollection.Name)]
public class OrdersEndpointTests(IntegrationFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Get_Orders_WithoutUser_Returns401()
    {
        var client = fixture.CreateClient();

        var response = await client.GetAsync("/api/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Delete_Order_WithoutAdminRole_Returns403()
    {
        var client = fixture.CreateClient(user: "u1", companyId: "1", roles: ["Staff"]);

        var response = await client.DeleteAsync("/api/orders/1");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Post_Order_WithValidBody_Returns201AndPersists()
    {
        var client = fixture.CreateClient(user: "u1", companyId: "1", roles: ["Staff"]);

        var response = await client.PostAsJsonAsync("/api/orders", new { code = "ORD-0001", total = 1250m });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var saved = await fixture.AsCompanyAsync(1, db => db.Queryable<OrderEntity>().FirstAsync(o => o.Code == "ORD-0001"));
        Assert.NotNull(saved);
        Assert.Equal(1250m, saved.Total);
        Assert.Equal(1, saved.CompanyId);
    }

    [Fact]
    public async Task Post_Order_WithNegativeTotal_Returns400()
    {
        var client = fixture.CreateClient(user: "u1", companyId: "1", roles: ["Staff"]);

        var response = await client.PostAsJsonAsync("/api/orders", new { code = "ORD-0002", total = -1m });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        Assert.Equal("validation.failed", problem?.Code);
        Assert.Equal(0, await fixture.AsCompanyAsync(1, db => db.Queryable<OrderEntity>().CountAsync()));
    }

    [Fact]
    public async Task Get_Orders_FromAnotherCompany_ReturnsNone()
    {
        // CompanyId is filled by the app's insert AOP from the current company (1), not by the test.
        await fixture.AsCompanyAsync(1, db => db.Insertable(new OrderEntity { Code = "ORD-A", Total = 10m }).ExecuteCommandAsync());
        var otherCompany = fixture.CreateClient(user: "u2", companyId: "2", roles: ["Staff"]);

        var page = await otherCompany.GetFromJsonAsync<PagedResult<OrderDto>>("/api/orders?page=1&size=20");

        Assert.NotNull(page);
        Assert.Equal(0, page.Total);
        Assert.Empty(page.Rows);
    }

    /// <summary>The RFC 9457 fields a test asserts on; `code` is the machine-readable reason.</summary>
    private sealed record ProblemBody(int Status, string? Code);
}
```

- Arrange / Assert 碰到 `ICompanyEntity` 的資料**一律**包在 `fixture.AsCompanyAsync(companyId, db => ...)` 裡：
  主專案的 client 保留了租戶過濾器與 `CompanyId` 自動填值，兩者都從當前 `HttpContext` 讀 `ElfClaimTypes.CompanyId`，
  在請求之外直接用 `fixture.Db` 查租戶表會丟 `InvalidOperationException("No company in the current request.")`
- 不碰租戶表的操作（`DatabaseReset` 的 `TRUNCATE`、`pg_tables` 查詢）可直接用 `fixture.Db`；
  種子若寫入租戶表，`SeedData.Seed` 自己要設定所屬公司（與主專案啟動時的做法相同）
- `OrderEntity`、`OrderDto` 與路由為示意，換成主專案實際型別；`PagedResult<T>` 的形狀固定為
  `{ Total, Page, Size, Rows }`（`elf-sqlsugar` / `elf-api-design`）
- 錯誤回應斷言 ProblemDetails 的 `code`（上例 `validation.failed` 為示意，以主專案實際定義的 code 為準），**不要**斷言訊息文字

## 8. GitHub Actions 片段

CI 測試資料庫一律用 Testcontainers（ubuntu-latest 內建 Docker），**不**另起 `services: postgres`。
整合測試與單元測試在同一個 job、同一次 solution 層級的 `dotnet test` 執行，覆蓋率以合併後的整體計算。
job id / 名稱**固定**為 `server` / `server (build · tests)`（branch protection 的 required check 以名稱比對，不可改名）。

```yaml
  server:
    name: server (build · tests)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-dotnet@v5
        with:
          global-json-file: global.json

      - name: Restore
        run: dotnet restore server/<App>.slnx

      - name: Build
        run: dotnet build server/<App>.slnx --no-restore --configuration Release

      # Unit + integration tests together; Testcontainers starts postgres:18 by itself.
      - name: Test
        run: >-
          dotnet test server/<App>.slnx --no-build --configuration Release
          -p:CollectCoverage=true -p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total
```

- 覆蓋率屬性、報告合併方式與 branch 50% advisory step 以 `elf-cicd-backend` 為準（本片段只示意整合測試在 CI 的位置）；
  門檻看的是合併後的整體 line 覆蓋率，**不**要求整合測試專案自己單獨達到 55%
- **MUST NOT** 用 `coverlet.collector` / `--collect:"XPlat Code Coverage"`（它不讀 `-p:Threshold`，門檻會靜默失效）
- 只有本機要改連既有的拋棄式資料庫時才設 `ELF_TEST_PG_CONNECTION`（帳密 `elf` / `elf_test_pw` / `elf_test`，含 `Timezone=UTC`）；CI 不設

完整 workflow 由 `elf-cicd-backend` 維護。
