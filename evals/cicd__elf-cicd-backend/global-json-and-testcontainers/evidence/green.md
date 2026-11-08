# global-json-and-testcontainers：GREEN 紀錄

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive c86619e609094e26817647d6c00eb8376d6709ae`（Task 7 的 commit）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：3/3 個 grader 通過 → **全部通過**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示，回覆寫明版本依 elf-stack。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制的那一行（案例 1、5 含 elf-stack；案例 2、3、4、B1、B2 不含），其餘逐字照 `prompt.md`，和 RED 同一個模型。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-global-json` | 通過 | `global.json` `10.0.403`、`latestFeature` |
| `02-testcontainers-image` | 通過 | `IntegrationFixture.cs:31` `new PostgreSqlBuilder("postgres:18.6")` |
| `03-no-old-values` | 通過 | `grep` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
`global.json` 和 Testcontainers fixture 都寫好了，但只驗到編譯，容器沒真的跑過。編譯用暫存複本加臨時 stub 主專案（已刪），0 錯誤、8 個警告；本機 Docker 沒開，所以測試也沒跑，repo 目前也還沒有主專案。

**偏離範本／決定**
- **SDK 版本：** `global.json` 是 `10.0.403` + `rollForward: latestFeature`，沒有 `test.runner`，本機確實解析到 10.0.403。
- **容器設定：** `postgres:18.6`，帳密 `elf` / `elf_test_pw` / `elf_test`，連線字串帶 `Timezone=UTC`，全部測試共用一個容器，也保留 `ELF_TEST_PG_CONNECTION` 切換。
- **App 名稱：** 需求沒給，先沿用範本的 `Acme`，要全域替換成實際名稱。
- **範圍外的補檔：** 依 elf-stack 加了 `Directory.Build.props`、`Directory.Packages.props`，並依規則 7 加了 `Acme.slnx`，否則測試專案無法還原。
- **`TestAuthHandler.Scheme` 改成 `public new const`：** 範本原寫法會出 CS0108，蓋住基底類別的 `Scheme`，而團隊範本（`elf-integration/references/integration-templates.md` §4）還是舊寫法，建議一併修。
- **`ElfApiFactory` 範例行：** `Translation:Google:ApiKey` 改成註解，因為新 repo 沒有這個服務。
- **`StubHttpMessageHandler`：** 沒放，等有外部服務再加。

**還沒解決**
- **弱點警告：** 8 個警告都是 NU1902／NU1903，`System.Security.Cryptography.Pkcs` 8.0.1 有已知弱點（GHSA-846f-f764-76mx 高、GHSA-2fmv-rv2c-59x7 中）。我沒查依賴樹，來源待確認（stub 只有 `SqlSugarCore`，它最可疑），版本表歸 elf-stack，所以沒動。
- **主專案要先補：** `server/src/Acme.Api/` 要有下列項目，測試專案才能還原和建置：
  - `public partial class Program;`
  - `Acme.Api.Auth.ElfClaimTypes`
  - `SeedData.Seed`
  - `AddHttpContextAccessor`
  - 從 `ConnectionStrings:Default` 讀連線字串的 `AddSqlSugar`
  - 主專案本身也要加進 `.slnx`

檔案都在 `E:/source/e46-scratch/cicd__elf-cicd-backend-workspace/iteration-1/global-json-and-testcontainers/with_skill/work/`：
- `global.json`
- `server/Acme.slnx`
- `server/Directory.Build.props`
- `server/Directory.Packages.props`
- `server/tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj`
- `server/tests/Acme.Api.IntegrationTests/Infrastructure/`：`IntegrationFixture.cs`、`IntegrationCollection.cs`、`ElfApiFactory.cs`、`TestAuthHandler.cs`、`DatabaseReset.cs`
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

`server/Acme.slnx`

`````
<Solution>
  <Folder Name="/tests/">
    <Project Path="tests/Acme.Api.IntegrationTests/Acme.Api.IntegrationTests.csproj" />
  </Folder>
</Solution>
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
        // builder.UseSetting("Translation:Google:ApiKey", "");

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
