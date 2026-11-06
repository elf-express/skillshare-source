# global-json-and-testcontainers：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：3/3 個 grader 通過 → **沒有失敗（維持案例）**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-global-json` | 通過 | `global.json` `10.0.403`、`latestFeature` |
| `02-testcontainers-image` | 通過 | `IntegrationFixture.cs:32` `new PostgreSqlBuilder("postgres:18.6")` |
| `03-no-old-values` | 通過 | `grep` 零筆 |

## 子代理最後回覆（逐字）

`````markdown
已寫好 `global.json`（`10.0.403`、`rollForward: latestFeature`、無 `test.runner`）與 Testcontainers fixture（`postgres:18.6`、`elf`／`elf_test_pw`／`elf_test`、`Timezone=UTC`）；用暫時的 stub API 實跑 3 個測試全過，SDK 解析為 10.0.403，容器實際回報 18.6、UTC，coverlet.msbuild 有產出報告。stub 與 smoke test 已刪。
專案名還沒定，先用範本的 `Acme`，建主專案時全域替換；主專案要提供 `Program`、`SeedData.Seed`、`ElfClaimTypes` 與 `AddHttpContextAccessor`，否則編譯不過或 `AsCompanyAsync` 會失敗。

**文件與實際不符（已照 elf-stack 規則 1 以版本表為準）**
- `elf-cicd-backend` 的 `templates/global.json` 寫 `10.0.100`，該 skill 的待確認也說版本未定；elf-stack 3.1 定為 `10.0.403`，我用 `10.0.403`。
- `elf-cicd-backend` 規則 16、17 與 `elf-integration` 範本、檢查清單（還有 `elf-postgresql`）都寫 `postgres:18`；elf-stack 3.1 定為 `postgres:18.6`，且 compose 與 Testcontainers 要同 tag，我用 `18.6`。這幾份文件要開單對齊。

**實跑才看到的問題**
- `TestAuthHandler` 範本的 `public const string Scheme` 會產生 CS0108 警告，我改成 `public new const string Scheme`；範本本身也要修。
- `SqlSugarCore 5.1.4.221` 經 `Oracle.ManagedDataAccess.Core` 間接帶入 `System.Security.Cryptography.Pkcs 8.0.1`，restore 報 NU1902／NU1903（GHSA-2fmv-rv2c-59x7、GHSA-846f-f764-76mx）。依規則 3 我沒有自行升版，是否處理要照 elf-stack 第 6 節決定。

**沒驗到的**：`ELF_TEST_PG_CONNECTION` 分支、`AsCompanyAsync`、CodeFirst 建表（stub 沒有這些）、`.slnx` 與 CI job（沒建）。

除了你要的兩項，另加 `server/Directory.Build.props`、`server/Directory.Packages.props`（elf-stack 4.2、4.3 的值）與整合測試 csproj，否則 fixture 無法還原；還有 fixture 依賴的 `ElfApiFactory`、`TestAuthHandler`、`DatabaseReset`、`IntegrationCollection`。
`````

## 產出檔案（逐字）

`global.json`

`````
{
  "sdk": {
    "version": "10.0.403",
    "rollForward": "latestFeature"
  }
}
`````

`server/Directory.Build.props`

`````
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
</Project>
`````

`server/Directory.Packages.props`

`````
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- Web -->
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.14" />
    <!-- Data -->
    <PackageVersion Include="SqlSugarCore" Version="5.1.4.221" />
    <!-- Tests -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="18.11.0" />
    <PackageVersion Include="xunit" Version="2.9.3" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="4.0.1" />
    <PackageVersion Include="coverlet.msbuild" Version="10.1.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.14" />
    <PackageVersion Include="Testcontainers.PostgreSql" Version="4.16.0" />
  </ItemGroup>
</Project>
`````

`server/tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj`

`````
<Project Sdk="Microsoft.NET.Sdk">

  <!-- TargetFramework / ImplicitUsings / Nullable come from server/Directory.Build.props. -->
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <!-- Central Package Management: versions live in server/Directory.Packages.props (elf-stack). No Version= here. -->
  <ItemGroup>
    <PackageReference Include="coverlet.msbuild">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
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
`````

`server/tests/Acme.Api.IntegrationTests/Infrastructure/DatabaseReset.cs`

`````
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
`````

`server/tests/Acme.Api.IntegrationTests/Infrastructure/ElfApiFactory.cs`

`````
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
        // builder.UseSetting("<Service>:ApiKey", "");

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
`````

`server/tests/Acme.Api.IntegrationTests/Infrastructure/IntegrationCollection.cs`

`````
namespace Acme.Api.IntegrationTests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class IntegrationCollection : ICollectionFixture<IntegrationFixture>
{
    public const string Name = "integration";
}
`````

`server/tests/Acme.Api.IntegrationTests/Infrastructure/IntegrationFixture.cs`

`````
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
            // Same tag as compose (elf-stack 3.1).
            _container = new PostgreSqlBuilder("postgres:18.6")
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
`````

`server/tests/Acme.Api.IntegrationTests/Infrastructure/TestAuthHandler.cs`

`````
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
    public new const string Scheme = "Test";
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
`````
