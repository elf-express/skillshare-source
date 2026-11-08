# global-json-and-testcontainers：RED v2 紀錄（不載入 elf-stack）

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：3/3 個 grader 通過 → **沒有失敗（維持案例）**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示；回覆引用 elf-stack 規則 1、規則 3、§0、4.2、4.3。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制「案例 2、3、4、B1、B2」那一行（`skills` 依 `case.yaml` 展開成路徑），其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-global-json` | 通過 | `global.json` `10.0.403`、`latestFeature` |
| `02-testcontainers-image` | 通過 | `IntegrationFixture.cs:31` `new PostgreSqlBuilder("postgres:18.6")` |
| `03-no-old-values` | 通過 | `grep -rnE '10\.0\.100|postgres:18([^.0-9]|$)'` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
`global.json` 和 Testcontainers fixture 都寫好了，對拋棄式 stub 主專案編譯 0 錯誤，但測試沒跑過，容器也沒實際啟動。編譯時有兩類警告：`CS0108` 已加 `new` 修掉，修完沒有重新編譯；`NU1902`／`NU1903` 還在（見下方「其他」）。

**文件衝突，版本都照 elf-stack**（elf-stack 規則 1 表優先，§0 新 repo 用 v2）：

| 項目 | elf-cicd-backend／elf-integration | elf-stack v2（已採用） |
|---|---|---|
| `global.json` 的 `sdk.version` | 範本 `10.0.100`，規則 1 只說「10.0 的 SDK」 | `10.0.403`；`rollForward: latestFeature` 不變，也沒有 `test.runner` |
| Testcontainers 映像 | 兩份都規定 `postgres:18` | `postgres:18.6`（`postgres:18` 列為常見錯誤） |

這兩份 skill 和 `integration-templates.md` 需要另外修正，否則下一個照抄的人還是會寫成舊值。

**寫入的檔案**（根目錄 `E:/source/e46-scratch/cicd__elf-cicd-backend-workspace/iteration-0-v2/global-json-and-testcontainers/old_skill/work/`）：
- `global.json`
- `server/Directory.Build.props`、`server/Directory.Packages.props`：CPM 專案缺它們無法還原，內容照 elf-stack 4.2、4.3
- `server/tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj`
- 同目錄 `Infrastructure/` 下的 `IntegrationFixture.cs`、`IntegrationCollection.cs`、`ElfApiFactory.cs`、`TestAuthHandler.cs`、`DatabaseReset.cs`

fixture 全部測試共用一個容器，帳密是 `elf` / `elf_test_pw` / `elf_test`，連線字串含 `Timezone=UTC`，也支援 `ELF_TEST_PG_CONNECTION`。

**還沒做，要由專案補上：**
- **專案名稱：** 需求沒有給 App 名稱，所以暫用 `Acme`，要全域替換。
- **主專案：** `server/src/Acme.Api/` 不存在，裡面要有 `Program`、`Auth/ElfClaimTypes`、`SeedData.Seed`。stub 只在暫存目錄用來編譯，已刪除。
- **方案檔：** `server/<App>.slnx` 還沒建，測試專案也還沒加進去。
- **`ElfApiFactory`：** 裡面的 `Translation:Google:ApiKey` 是範本示意，要換成實際的外部服務金鑰。

**其他：**
- **與範本的差異：** `TestAuthHandler.Scheme` 加了 `new`，因為範本寫法會出 `CS0108` 警告（隱藏繼承成員）。這個範本問題也要一起修。
- **弱點警告：** 還原時出現 `NU1902`／`NU1903`，`System.Security.Cryptography.Pkcs` 8.0.1 有中、高嚴重性弱點。主專案 stub 只引用 `SqlSugarCore`，所以應該是它帶進來的。依 elf-stack 規則 3 我沒有升級，要不要處理請 Eddie 決定。
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
