---
name: elf-integration
description: |
  Elf Express 後端整合測試規範：以 `WebApplicationFactory<Program>` 啟動真 ASP.NET Core 管線，
  透過 Testcontainers 跑真 PostgreSQL 18，SqlSugar 建表 / 清資料，HttpClient 打 API，TestAuthHandler 模擬登入。
  當任務涉及 API endpoint 測試、SqlSugar 查詢 / 交易 / 多租戶過濾的測試、測試資料庫建立與清除、
  認證授權測試、替換外部 HTTP 服務、或新增 `server/tests/<App>.Api.IntegrationTests/` 時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 整合測試規範

> 相關 skill：`elf-unit`（不碰 DB / HTTP 的邏輯）、`elf-e2e`（瀏覽器行為）、`elf-dotnet`、`elf-sqlsugar`、
> `elf-api-design`（錯誤回應格式）、`elf-stack`（版本定本）、`elf-cicd-backend`（CI 上的 Docker / DB）。
>
> 參考專案：`TypingTrainer/server/TypeLab.Api.Tests/`。**差異說明**：參考專案用 SQLite `:memory:`
> （`TestDb.cs`）測 SqlSugar，且沒有 `WebApplicationFactory` 測試。團隊正式環境是 **PostgreSQL 18**，
> SQLite 與 PostgreSQL 的型別、大小寫、`ILIKE`、JSON、交易行為都不同，因此本規範**改用真 PostgreSQL 18**，
> 不沿用 SQLite 做法。

## 1. 何時使用

- 測試任何 API endpoint（路由、model binding、驗證、狀態碼、回應 JSON）
- 測試 SqlSugar 查詢、CodeFirst 建表、交易、多租戶（`ICompanyEntity`）過濾、軟刪除
- 測試認證授權（未登入 401、無權限 403、跨租戶看不到資料）
- 測試 DI 註冊與設定綁定是否正確（啟動 host 即涵蓋）
- 測試呼叫外部 HTTP 服務的程式（以替身 handler 取代真服務）

## 2. 固定規則

### 2.1 專案與結構

1. **MUST** 整合測試放在獨立專案 `server/tests/<App>.Api.IntegrationTests/`，與單元測試 `server/tests/<Project>.Tests/` 分開
   （整合測試需要 Docker，單元測試不需要）；contract / `WebApplicationFactory` 測試也放在這個專案。
   主專案在 `server/src/<App>.Api/`，兩者都要加進 `server/<App>.slnx`。
2. **MUST** 目錄結構固定為：

```
server/tests/Acme.Api.IntegrationTests/
├── Acme.Api.IntegrationTests.csproj
├── Infrastructure/
│   ├── IntegrationFixture.cs      ← 啟動 PostgreSQL 18 容器 + WebApplicationFactory
│   ├── ElfApiFactory.cs           ← WebApplicationFactory<Program>，覆寫連線字串、替換認證 / 外部服務
│   ├── TestAuthHandler.cs         ← 以 header 模擬登入身分
│   ├── DatabaseReset.cs           ← 每個測試前清空資料表
│   └── IntegrationCollection.cs   ← [CollectionDefinition]
└── Api/
    └── OrdersEndpointTests.cs     ← 比照主專案 endpoint / controller 分資料夾
```

3. **MUST** 測試方法命名同 `elf-unit`：`MethodName_Scenario_ExpectedResult`；endpoint 測試的 MethodName 用
   `Get_Orders`、`Post_Order` 這類「HTTP 動詞_資源」形式，例如 `Post_Order_WithoutToken_Returns401`。

### 2.2 資料庫（PostgreSQL 18 + SqlSugar）

1. **MUST** 使用 Testcontainers 啟動 `postgres:18` 映像（本機與 CI 皆同），**MUST NOT** 連本機或共用的開發資料庫
   （唯一例外是第 7 條的 `ELF_TEST_PG_CONNECTION`，且只能指向拋棄式資料庫）。
2. **MUST NOT** 用 SQLite / in-memory 取代 PostgreSQL 測 SqlSugar 程式（方言不同，會出現「測試綠、上線壞」）。
3. **MUST** 整個測試執行共用**一個**容器（xUnit collection fixture），**MUST NOT** 每個測試類別各起一個容器。
4. **MUST** 只以 `UseSetting("ConnectionStrings:Default", ...)` 把連線字串指向容器，讓主專案的
   `AddSqlSugar(builder.Configuration, builder.Environment)` 照常建立 client。
   **MUST NOT** 在 `ConfigureTestServices` 移除或重新註冊 `ISqlSugarClient` —— 那會丟掉主專案的完整 SqlSugar 設定
   （snake_case 命名、AOP 審計欄位、多租戶 / 軟刪除全域過濾器），測試就不再測到上線的行為。
5. **MUST** 建表沿用主專案的 CodeFirst（host 啟動時的 `InitDatabase()` / `CodeFirst.InitTables(...)`），
   **MUST NOT** 在測試專案另寫一份 DDL。
6. **MUST** 每個測試開始前（`InitializeAsync`）呼叫 `DatabaseReset.ResetAsync()`：
   `TRUNCATE ... RESTART IDENTITY CASCADE` 清空 `public` schema 所有表，再重跑種子資料。
   **MUST NOT** 依賴前一個測試留下的資料或執行順序。
7. **MUST** 測試資料庫一律用同一組拋棄式帳密：使用者 `elf`、密碼 `elf_test_pw`、資料庫 `elf_test`；連線字串 **MUST** 含 `Timezone=UTC`。
   預設由 Testcontainers 啟動（CI 亦同）；要改連既有的拋棄式資料庫時設環境變數 `ELF_TEST_PG_CONNECTION`（同一組帳密、同樣含 `Timezone=UTC`）。
8. **MUST** Arrange 階段用主專案的 `ISqlSugarClient` 寫入測試資料；Assert 階段除了檢查 HTTP 回應，
   寫入類 API **MUST** 再用它查資料庫確認實際落地。碰到租戶表時包在 `fixture.AsCompanyAsync(companyId, db => ...)` 內
   （client 的租戶過濾器與 `CompanyId` 填值讀當前 `HttpContext`，請求之外沒有身分會直接丟例外）。

### 2.3 WebApplicationFactory 與 HTTP

1. **MUST** 使用 `WebApplicationFactory<Program>`；若編譯出現 `Program` 無法存取（CS0122），
   在 `Program.cs` 最後加一行 `public partial class Program;`。
2. **MUST** `UseEnvironment("Testing")`，並在主專案需要時提供 `appsettings.Testing.json`（不放任何真實密鑰）。
3. **MUST** 用 `factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false })`，
   讓任何 3xx 被斷言到而不是被默默跟隨。
4. **MUST** 用 `System.Net.Http.Json`（`GetFromJsonAsync`、`PostAsJsonAsync`、`ReadFromJsonAsync<T>`），
   **MUST NOT** 手動字串拼 JSON。
5. **MUST** 每個 endpoint 測試同時斷言：狀態碼 → 回應 body（錯誤回應斷言 RFC 9457 ProblemDetails 的 `code`，見 `elf-api-design`）
   → 寫入類 endpoint 再回查資料庫狀態（§2.2 第 8 條）。
6. **MUST** 外部服務的 API key 在測試中一律設為空字串（`UseSetting`），並以替身 `HttpMessageHandler`
   取代真呼叫（範本見 `references/integration-templates.md` §6）。**MUST NOT** 在測試中呼叫真實第三方服務。

### 2.4 認證授權

1. **MUST** 以 `TestAuthHandler` 取代 JWT 驗證：請求帶 `X-Test-User` header 即視為登入，沒帶就回 401。
   發出的 claim 名稱 **MUST** 使用主專案共用的常數類別 `ElfClaimTypes`（`UserId = "sub"`、`CompanyId = "company_id"`、
   `Role = "role"`），與 SqlSugar 租戶解析器（`elf-sqlsugar`）讀的是同一份；**MUST NOT** 在測試端另寫字串或用 `ClaimTypes.*`。
2. **MUST** 以 `PostConfigure<AuthenticationOptions>` 同時覆寫 `DefaultScheme`、`DefaultAuthenticateScheme`、
   `DefaultChallengeScheme`，否則主專案明確設定的 `JwtBearer` 預設會蓋過測試 scheme。
3. **MUST** 每個需授權的 endpoint 至少三個測試：未登入 → 401、登入但無權限 → 403、有權限 → 2xx。
4. **MUST** 多租戶資源多一個測試：以 A 公司身分建立的資料，B 公司身分查不到（404 或空列表）。
5. 需要驗證「真的 JWT 發放 / 驗簽流程」時，另寫一組不替換認證的測試打登入 API，其他測試一律用 `TestAuthHandler`。

### 2.5 平行與隔離

1. **MUST** 所有整合測試類別標記 `[Collection(IntegrationCollection.Name)]`：同一 collection 內依序執行，共用同一容器與 host。
2. **MUST NOT** 在整合測試中使用 `static` 可變狀態。
3. **MUST NOT** 在測試中 `Thread.Sleep` 等待背景工作；背景工作（Hangfire 等）在 `Testing` 環境關閉，
   改為直接呼叫其 Job 方法測試。

## 3. 標準範本

完整可複製的檔案在 [`references/integration-templates.md`](references/integration-templates.md)：

| § | 檔案 | 內容 |
|---|------|------|
| 1 | `Acme.Api.IntegrationTests.csproj` | 套件（CPM，無版本號） |
| 2 | `Infrastructure/IntegrationFixture.cs` + `IntegrationCollection.cs` | 容器 + host 生命週期、`AsCompanyAsync` |
| 3 | `Infrastructure/ElfApiFactory.cs` | 覆寫連線字串、替換認證、外部 HTTP |
| 4 | `Infrastructure/TestAuthHandler.cs` | header 模擬身分（claim 用 `ElfClaimTypes`） |
| 5 | `Infrastructure/DatabaseReset.cs` | TRUNCATE + 重跑種子 |
| 6 | `Infrastructure/StubHttpMessageHandler.cs` | 外部服務替身 |
| 7 | `Api/OrdersEndpointTests.cs` | endpoint 測試（401/403/200/400/跨租戶） |
| 8 | GitHub Actions 片段 | CI 執行（job 名稱固定 `server (build · tests)`） |

最小骨架（細節以 references 為準）：

```csharp
[Collection(IntegrationCollection.Name)]
public class OrdersEndpointTests(IntegrationFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient _client = fixture.CreateClient();

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Get_Orders_WithoutUser_Returns401()
    {
        var response = await _client.GetAsync("/api/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
```

執行：

```bash
# 需要 Docker（本機 Docker Desktop / CI 的 ubuntu-latest 內建）
dotnet test server/tests/Acme.Api.IntegrationTests --configuration Release

# 只跑單元測試（不需要 Docker）
dotnet test server/tests/Acme.Api.Tests
```

## 4. 檢查清單

- [ ] 測試在 `server/tests/<App>.Api.IntegrationTests/`，已加入 `server/<App>.slnx`，Infrastructure 五個檔案齊全
- [ ] 容器映像是 `postgres:18`，全部測試共用一個容器
- [ ] 只用 `UseSetting("ConnectionStrings:Default", ...)` 覆寫連線字串；**沒有** `RemoveAll<ISqlSugarClient>()` 或重新註冊 client
- [ ] 帳密為 `elf` / `elf_test_pw` / `elf_test`，連線字串含 `Timezone=UTC`
- [ ] `TestAuthHandler` 的 claim 使用 `ElfClaimTypes`
- [ ] 沒有使用 SQLite / in-memory 資料庫
- [ ] 每個測試 `InitializeAsync` 會重設資料庫
- [ ] 需授權 endpoint 有 401 / 403 / 2xx 三個測試；多租戶資源有跨租戶測試
- [ ] 寫入類 API 有回查資料庫
- [ ] 外部服務 key 為空、使用替身 handler，沒有真實對外呼叫
- [ ] 所有類別都有 `[Collection(IntegrationCollection.Name)]`
- [ ] 修 bug 時把修正改回去確認測試會紅
- [ ] 本機 `dotnet test` 通過（Docker 已啟動）；CI job 名稱仍是 `server (build · tests)`

## 5. 常見錯誤

| 錯誤 | 後果 | 正確做法 |
|------|------|----------|
| 用 SQLite `:memory:` 代替 PostgreSQL | 大小寫、型別、`ILIKE`、JSON 差異讓測試失真 | Testcontainers `postgres:18` |
| 只用 `ConfigureAppConfiguration` 覆寫連線字串 | Minimal hosting 下 Program 在覆寫前就讀了設定，仍連到正式設定的 DB | `builder.UseSetting("ConnectionStrings:Default", ...)` |
| 在 `ConfigureTestServices` 重新註冊 `ISqlSugarClient` | 丟失 snake_case、AOP、多租戶 / 軟刪除過濾器；測試綠但上線行為不同 | 不動 client，只覆寫連線字串 |
| TestAuthHandler 發 `ClaimTypes.NameIdentifier` / `"CompanyId"` | 租戶解析器讀 `company_id` 讀不到，全部查詢失敗或跨租戶測試失真 | 一律用 `ElfClaimTypes` |
| 在請求之外直接 `fixture.Db.Queryable<租戶實體>()` / `Insertable(...)` | 租戶過濾器 / `CompanyId` 填值找不到當前公司，丟 `InvalidOperationException` | 包在 `fixture.AsCompanyAsync(companyId, db => ...)` 內 |
| 每個測試類別 `new PostgreSqlBuilder(...)` | 測試時間暴增、Docker 資源耗盡 | collection fixture 共用一個容器 |
| 只 `AddAuthentication("Test")` | 主專案設定的 `DefaultAuthenticateScheme = JwtBearer` 仍生效，全部 401 | `PostConfigure<AuthenticationOptions>` 三個預設都覆寫 |
| 容器還沒起來就 `CreateClient()` | host 啟動時 `InitDatabase()` 連不到 DB | fixture 先 `StartAsync()` 容器再建立 factory |
| 測試間依賴資料順序 | 單獨跑某測試會失敗 | 每個測試前 `ResetDatabaseAsync()` |
| 預設 `AllowAutoRedirect = true` | 307 被跟隨，斷言到錯誤的回應 | `AllowAutoRedirect = false` |

## 6. 待確認

- [ ] 外部 HTTP 替身是否導入 WireMock.Net（目前規定手寫 `StubHttpMessageHandler`）
- [ ] 前端對 API 的整合測試是否導入 MSW（本 skill 目前只涵蓋後端）
- [ ] 參考專案用 xUnit 2.9.3；是否升級 xUnit v3（`xunit.v3`）—— 與 `elf-unit` 一起決定

已決定、不再列入待確認：CI 測試資料庫用 Testcontainers；claim 名稱用 `ElfClaimTypes`；
`Microsoft.AspNetCore.Mvc.Testing`、`Testcontainers.PostgreSql`、`coverlet.msbuild` 版本收在 `elf-stack` 的
`Directory.Packages.props`；整合測試計入 line 55% 門檻（以合併後的整體覆蓋率判定，見 `elf-cicd-backend`）；
不採用 Furion（`WebApplicationFactory<Program>` 直接適用）。
