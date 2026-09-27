---
name: elf-unit
description: |
  Elf Express 單元測試規範（xUnit + coverlet / Vitest + @vue/test-utils）：規定測試檔放哪、怎麼命名、AAA 結構、
  Fake 與 vi.mock 的用法、邊界與例外測試、覆蓋率門檻（line 55%）。
  當任務涉及撰寫或修改單元測試、新增 `*.test.ts` 或 `server/tests/<Project>.Tests/`、選擇 mock 方式、
  測試命名、覆蓋率設定或「這段該不該寫單元測試」的判斷時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 單元測試規範

> 相關 skill：`elf-stack`（版本定本）、`elf-dotnet`、`elf-vue`、`elf-integration`（碰 DB / HTTP 管線時改看它）、
> `elf-e2e`（焦點、IME、版面等瀏覽器行為）、`elf-cicd-frontend` / `elf-cicd-backend`（CI 上跑測試與門檻）。
>
> 參考專案：`TypingTrainer`（`server/TypeLab.Api.Tests/`、`apps/src/**/*.test.ts`、`apps/vite.config.ts`）。

## 1. 何時使用

- 為純函式、Service、composable、Pinia store、Vue 元件新增或修改單元測試
- 修 bug：先寫一個會紅的測試，再修
- 設定 Vitest / xUnit 專案、覆蓋率門檻
- 判斷某段邏輯該寫單元測試、整合測試還是 E2E（見 §2.6）

## 2. 固定規則

### 2.1 測試檔放置位置

#### 前端（Vue）：與元件同資料夾

```
components/
├── OrderCard.vue
└── OrderCard.test.ts
```

- 測試檔與被測檔**放在同一個資料夾**，檔名 = 被測檔名 + `.test.ts`
- 副檔名必須是 `.test.ts`，**不可寫成 `.test.vue`**：Vitest 預設只收
  `*.{test,spec}.{js,ts,jsx,tsx}`，`.test.vue` 會被忽略，測試不會執行、也不計入覆蓋率
- 元件以 `@vue/test-utils` 的 `mount()` / `shallowMount()` 測試；
  composable、store、純函式同樣以 `xxx.test.ts` 放在原檔旁
- `*.spec.ts` 保留給 Playwright E2E（放 repo 根目錄 `e2e/`），單元測試**一律** `.test.ts`

#### 後端（.NET）：獨立 `server/tests/` 目錄

```
server/
├── Acme.slnx
├── src/
│   └── Acme.Api/
└── tests/
    ├── Acme.Api.Tests/               ← 單元測試，參照 server/src/Acme.Api
    └── Acme.Api.IntegrationTests/    ← 整合測試（需要 Docker），見 elf-integration
```

- 每個主專案對應一個 `<主專案名>.Tests` 測試專案，一律放在 `server/tests/` 底下（主專案在 `server/src/`），並加入 `server/<App>.slnx`
- 測試專案內的資料夾結構比照主專案（例如 `Services/OrderPricingServiceTests.cs`）
- 框架：xUnit；涵蓋率收集：`coverlet.msbuild`（**不用** `coverlet.collector`）
- 測試類別名 = 被測類別名 + `Tests`，一個被測類別一個測試檔

### 2.2 命名

1. **MUST**（.NET）測試方法名用 `MethodName_Scenario_ExpectedResult`，三段以底線分隔，每段 PascalCase：
   `CalculateTotal_WithExpiredCoupon_IgnoresDiscount`、`TryCancel_WhenAlreadyShipped_ReturnsFalse`。
2. **MUST**（前端）`describe('<被測單元名>')` + `it('<預期行為的英文句子>')`，句子描述行為而非實作：
   `it('returns null for empty input')`、`it('does not advance in strict mode until the right key comes')`。
3. **MUST NOT** 用 `Test1`、`ShouldWork`、`it('works')` 這類不說明情境與結果的名字。
4. 參考專案的 .NET 測試用 `ResolveLocale_honours_q_values` 這種「方法名 + 小寫句子」寫法；
   **新測試一律照第 1 條**，舊測試不必為改名而改名。

### 2.3 AAA 結構

1. **MUST** 每個測試依序為 Arrange → Act → Assert，三段之間空一行。
   測試本體（不含方法簽章與大括號）**超過 10 行**時 **MUST** 寫 `// Arrange`、`// Act`、`// Assert` 三個註解；
   10 行以內 **MUST NOT** 寫（以空行分段即可）。
2. **MUST** Act 只有一個動作（一次方法呼叫 / 一次使用者操作）。要測兩個動作就拆兩個測試。
3. **MUST** 每個測試至少一個 assert；**MUST NOT** 只呼叫方法不驗證（為了衝覆蓋率）。
4. **MUST NOT** 在測試內寫 `if` / `for` 決定要不要 assert。多組輸入用 `[Theory]` + `[InlineData]` 或 `it.each`。
5. **MUST NOT** 測試之間共用可變狀態。.NET 每個測試會 new 一個測試類別實例；
   前端用 `beforeEach` 重建（例如 `setActivePinia(createPinia())`）。

### 2.4 Mock / Stub / Fake 取捨

| 情境 | .NET | 前端 |
|------|------|------|
| 依賴是介面，需要可控回傳值 / 記錄呼叫次數 | **手寫 `private sealed class FakeXxx : IXxx`**（放在測試類別內） | `vi.fn()` |
| 依賴是整個模組（API client、Tauri plugin、第三方 SDK） | — | `vi.mock('<module>', factory)` + `vi.hoisted` |
| `ILogger<T>` | `NullLogger<T>.Instance` | — |
| `IOptions<T>` | `Options.Create(new T { ... })` | — |
| `IConfiguration` | `new ConfigurationBuilder().AddInMemoryCollection(...)` | — |
| 時間 | 注入 `TimeProvider`，測試用手寫 `FixedTimeProvider`（見 §3.2） | `vi.useFakeTimers()`，測完 `vi.useRealTimers()` |
| `ISqlSugarClient` / 資料庫 | **不要 mock**，改寫整合測試（`elf-integration`）；團隊**沒有** repository 層，不要為了單元測試新增 | — |

1. **MUST**（.NET）依參考專案做法，用**手寫 Fake**（見 §3.2 範本）。**MUST NOT** 自行引入 Moq 或
   NSubstitute —— 是否導入 mock 函式庫尚未決定（見 §6）。
2. **MUST** Fake 只實作測試需要的行為，用建構子參數切換（`succeeds: false`），並公開 `Calls` 之類的計數讓測試驗證。
3. **MUST**（前端）`vi.mock` 的 factory 內要引用的 `vi.fn()` 一律用 `vi.hoisted()` 宣告，避免 hoisting 後讀到未初始化變數。
4. **MUST**（前端）`beforeEach(() => vi.clearAllMocks())`；有改 `window` / 全域的測試在 `afterEach` 還原。
5. **MUST** 模組在載入時就讀取環境（例如 `const IS_DESKTOP = '__TAURI_INTERNALS__' in window`）時，
   先設好環境再 `vi.resetModules()` + 動態 `await import('./xxx')`（參考 `apps/src/api/desktop.test.ts`）。
6. **MUST NOT** mock 被測物件自己，也不要 mock 純函式 / 值物件 —— 直接用真的。

### 2.5 邊界與例外測試

每個公開方法的**每個參數**，依型別 **MUST** 覆蓋下表全部列出的情況（不適用者須在測試類別註解寫明原因）：

| 參數型別 | 必測情況 |
|----------|----------|
| `string` / `string?` | `null`、`""`、`"   "`（空白）、長度剛好等於上限、上限 + 1；有格式時加非正規輸入（`"ZH-tw"`，參考 `CatalogueLocalizerTests`） |
| 整數 / `decimal` | `0`、`1`、`-1`（或最小負數）、上限、上限 + 1 |
| 集合 / 陣列 | `null`（可為 null 時）、空集合、單一元素、多個元素（含重複） |
| 分頁（`page` / `size`） | 第一頁、最後一頁、超過最後一頁、`size` 為 0 與上限 + 1 |
| 時間 / 日期 | 剛好等於到期時間、到期前 1 tick、到期後；跨日 / 時區邊界（以 UTC 斷言） |
| enum | 每個已定義值各一次（`[Theory]` / `it.each`），加一個未定義值（`(Status)999`） |
| 可為 null 的物件 | `null` 與非 null 各一次 |

1. 空值類輸入用 `[Theory]` + `[InlineData(null)] [InlineData("")] [InlineData("   ")]`（前端 `it.each`）。
2. **領域拒絕不丟例外**：業務規則不允許的操作（已出貨不能取消、庫存不足）回傳 `false` 或結果 enum，
   測試斷言回傳值與狀態**未改變**，**MUST NOT** 期待例外（錯誤回應由 endpoint 對應成 ProblemDetails，見 `elf-dotnet`）。
3. 例外只用於程式錯誤 / 前置條件（`null` 引數、負數金額）：**MUST** 同時斷言例外型別與參數名或關鍵訊息。
   - .NET 同步：`var ex = Assert.Throws<ArgumentException>(() => sut.Do(x));`
   - .NET 非同步：`await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => sut.DoAsync(x));`
   - 前端：`expect(() => fn(x)).toThrow('message')`；非同步 `await expect(p).rejects.toThrow(...)`
4. 失敗後的降級行為（fallback、重試、回傳預設值）要驗證「有降級」也要驗證「沒呼叫不該呼叫的依賴」
   （參考 `TranslationServiceTests.Falls_back_to_the_next_provider_when_one_fails`）。
5. 平台差異：路徑、換行用 `OperatingSystem.IsWindows()` 分支準備輸入值，**MUST NOT** 寫死 `C:\`。

### 2.6 不該寫單元測試的情境

| 情境 | 改寫什麼 |
|------|----------|
| SqlSugar 查詢、CodeFirst、交易、多租戶過濾 | `elf-integration`（真 PostgreSQL 18） |
| Endpoint 路由、model binding、認證授權、middleware 順序 | `elf-integration`（`WebApplicationFactory<Program>`） |
| 焦點、IME 組字、捲軸 / 版面是否溢出、真實事件順序 | `elf-e2e`（jsdom 觀察不到） |
| DI 註冊是否齊全、設定檔綁定 | `elf-integration`（啟動整個 host 即可涵蓋） |
| 純 DTO / 自動屬性 / 產生的程式碼 / 第三方套件本身 | 不寫 |

判斷原則：**如果要 mock 的東西比被測邏輯還多，就不是單元測試的對象。**

## 3. 標準範本

### 3.1 .NET：測試專案 csproj

`server/tests/Acme.Api.Tests/Acme.Api.Tests.csproj`。團隊採 Central Package Management：
`TargetFramework` / `ImplicitUsings` / `Nullable` 由 `server/Directory.Build.props` 提供，
套件版本一律在 `server/Directory.Packages.props`（定本見 `elf-stack`），csproj **不寫** `Version=`、**不寫**自己的 `TargetFramework`。

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

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

建立並加入方案：

```bash
dotnet new xunit -n Acme.Api.Tests -o server/tests/Acme.Api.Tests
dotnet sln server/Acme.slnx add server/tests/Acme.Api.Tests/Acme.Api.Tests.csproj
dotnet add server/tests/Acme.Api.Tests reference server/src/Acme.Api/Acme.Api.csproj
```

`dotnet new xunit` 產生的 csproj 帶有 `TargetFramework`、`Version=` 與 `coverlet.collector`：**MUST** 改成上面的內容
（刪掉 `TargetFramework` / `ImplicitUsings` / `Nullable` 與所有 `Version=`，`coverlet.collector` 換成 `coverlet.msbuild`），
否則 CPM 會報 `NU1008`，覆蓋率門檻也不會生效。

### 3.2 .NET：Service 單元測試（手寫 Fake + AAA + Theory + 例外 + 領域拒絕）

被測的是不碰資料庫的邏輯：價格計算與外部匯率服務（typed `HttpClient` 背後的介面）。
碰 `ISqlSugarClient` 的查詢改寫整合測試（`elf-integration`），**不要**為了能 mock 而加 repository 層。

`server/tests/Acme.Api.Tests/Services/OrderPricingServiceTests.cs`：

```csharp
using Acme.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Acme.Api.Tests.Services;

public class OrderPricingServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 0, 0, 0, TimeSpan.Zero);

    /// <summary>Stand-in for the external exchange-rate API; records how often it was called.</summary>
    private sealed class FakeExchangeRateClient(decimal? rate = 0.031m) : IExchangeRateClient
    {
        public int Calls { get; private set; }

        public Task<decimal?> GetRateAsync(string from, string to, CancellationToken ct = default)
        {
            Calls++;
            return Task.FromResult(rate);
        }
    }

    /// <summary>A clock that never moves.</summary>
    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static OrderPricingService Build(IExchangeRateClient? rates = null)
    {
        return new OrderPricingService(
            rates ?? new FakeExchangeRateClient(),
            Options.Create(new PricingOptions { BaseCurrency = "TWD" }),
            new FixedTimeProvider(Now),
            NullLogger<OrderPricingService>.Instance);
    }

    [Fact]
    public void CalculateTotal_WithValidCoupon_AppliesDiscount()
    {
        var sut = Build();

        var total = sut.CalculateTotal(subtotal: 1000m, new Coupon("SAVE10", 0.1m, ExpiresAt: Now.AddDays(1)));

        Assert.Equal(900m, total);
    }

    [Fact]
    public void CalculateTotal_WithCouponExpiringExactlyNow_IgnoresDiscount()
    {
        var sut = Build();

        var total = sut.CalculateTotal(subtotal: 1000m, new Coupon("EDGE", 0.1m, ExpiresAt: Now));

        Assert.Equal(1000m, total);
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(-1000)]
    public void CalculateTotal_WithNegativeSubtotal_ThrowsArgumentOutOfRange(double subtotal)
    {
        var sut = Build();

        var ex = Assert.Throws<ArgumentOutOfRangeException>(() => sut.CalculateTotal((decimal)subtotal, coupon: null));

        Assert.Equal("subtotal", ex.ParamName);
    }

    [Fact]
    public async Task ConvertAsync_ToBaseCurrency_SkipsRateLookup()
    {
        var rates = new FakeExchangeRateClient();
        var sut = Build(rates);

        var converted = await sut.ConvertAsync(1000m, to: "TWD");

        Assert.Equal(1000m, converted);
        Assert.Equal(0, rates.Calls);
    }

    [Fact]
    public async Task ConvertAsync_WhenRateUnavailable_ReturnsNull()
    {
        var sut = Build(new FakeExchangeRateClient(rate: null));

        var converted = await sut.ConvertAsync(1000m, to: "USD");

        Assert.Null(converted);
    }
}
```

領域拒絕回傳 `false`、狀態不變（不丟例外）：

```csharp
[Fact]
public void TryCancel_WhenAlreadyShipped_ReturnsFalse()
{
    var order = new Order { Status = OrderStatus.Shipped };

    var cancelled = order.TryCancel();

    Assert.False(cancelled);
    Assert.Equal(OrderStatus.Shipped, order.Status);
}
```

- 上面為節錄，示範寫法；實際測試類別仍須依 §2.5 表格補齊每個參數的必測情況（例：`subtotal` 為 `0` / `1`、`coupon` 為 `null`、
  到期前 1 tick），`ConvertAsync` 的 `to` 也要測 `null` / `""` / `"   "`

### 3.3 前端：`apps/vite.config.ts` 的 test 區塊（含覆蓋率門檻）

```ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Tests sit next to the file they cover: foo.ts -> foo.test.ts
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main.ts', 'src/api/mock/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 55 },
    },
  },
})
```

安裝在前端 app（`apps/`），**不是** repo 根目錄；`-E` 釘死版本，`vitest` 與 `@vitest/coverage-v8` **MUST** 是完全相同的版本：

```bash
pnpm --filter @<scope>/web add -D -E vitest@<VITEST_VERSION> @vitest/coverage-v8@<VITEST_VERSION> @vue/test-utils jsdom
```

`apps/package.json` scripts：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- `globals: false`：**MUST** 從 `vitest` 明確 import `describe / it / expect / vi`
- `@vitest/coverage-v8` 的版本 **MUST** 與 `vitest` 完全相同（exact，不是只對主版號）
- `coverage.exclude` 固定排除測試檔、`.d.ts`、`main.ts`、`src/api/mock/**`（mock fixture 不計入覆蓋率），與 `elf-cicd-frontend` 一致

### 3.4 前端：純函式 / store / 元件 / vi.mock 範本

完整可複製的四個範本放在 [`references/vitest-templates.md`](references/vitest-templates.md)：

- `analyze.test.ts` —— 純函式（邊界、`it.each`）
- `order.test.ts` —— Pinia setup store（`setActivePinia(createPinia())`、fake timers）
- `OrderCard.test.ts` —— 元件（`mount`、props、emit、`data-testid`）
- `orderApi.test.ts` —— `vi.hoisted` + `vi.mock` 模組替身、`vi.resetModules` 動態載入

## 覆蓋率目標

| 指標 | 門檻 | 說明 |
|------|------|------|
| Line | **55%**（強制） | 低於門檻 CI 不通過 |
| Branch | 50%（建議） | 暫不強制，作為觀察指標 |

量測指令：

```bash
# 前端（Vitest）
pnpm exec vitest run --coverage

# 後端（.NET）：coverlet.msbuild，對整個方案跑（單元 + 整合測試合併計算）
dotnet test server/<App>.slnx -p:CollectCoverage=true -p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total
```

- 門檻套用在整個專案，不要求每個檔案都達標
- 不要為了衝數字寫沒有 assert 的測試；覆蓋率是下限，不是目標
- 前端門檻由 §3.3 的 `coverage.thresholds.lines: 55` 強制（未達標時 `vitest run --coverage` 以非 0 結束）
- Branch 門檻**不要**寫進 `thresholds`（僅觀察）
- .NET 由 `coverlet.msbuild` 的 `-p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total` 強制；
  門檻看**合併後**的整體覆蓋率，不要求每個測試專案單獨達到 55%（合併方式與 CI 指令以 `elf-cicd-backend` 為準）
- **MUST NOT** 用 `coverlet.collector` / `--collect:"XPlat Code Coverage"`：它不讀 `-p:Threshold`，門檻會靜默失效

## 4. 檢查清單

- [ ] 前端測試檔是 `Xxx.test.ts`，與 `Xxx.vue` / `xxx.ts` 同資料夾（不是 `.test.vue`、不是 `.spec.ts`）
- [ ] .NET 測試在 `server/tests/<Project>.Tests/`、已加入 `server/<App>.slnx`，資料夾結構比照主專案
- [ ] 測試 csproj 沒有 `Version=`、沒有自己的 `TargetFramework`，用 `coverlet.msbuild`（沒有 `coverlet.collector`）
- [ ] .NET 方法名 `MethodName_Scenario_ExpectedResult`；前端 `it('<行為句子>')`
- [ ] 每個測試 AAA、單一 Act、至少一個 assert
- [ ] .NET 依賴用手寫 Fake；沒有新增 Moq / NSubstitute
- [ ] 前端 `vi.mock` 引用的 fn 用 `vi.hoisted`；`beforeEach` 有 `vi.clearAllMocks()`
- [ ] 每個參數依 §2.5 表格覆蓋必測情況；例外測試有斷言型別 + 參數名 / 訊息
- [ ] 領域拒絕斷言回傳 `false` / 結果 enum，沒有期待例外；沒有為了測試新增 repository
- [ ] 沒有 mock `ISqlSugarClient`（改寫整合測試）
- [ ] 修 bug 的測試：**把修正暫時改回去，確認測試會紅**，再改回來（參考專案曾兩次出現「測試綠但程式早已壞」）
- [ ] `pnpm exec vitest run --coverage` 與 §覆蓋率目標 的 `dotnet test` 指令本機皆通過，line ≥ 55%

## 5. 常見錯誤

| 錯誤 | 後果 | 正確做法 |
|------|------|----------|
| 寫成 `OrderCard.test.vue` | Vitest 不收，測試沒跑也不算覆蓋率 | `OrderCard.test.ts` |
| `vi.mock` factory 直接引用上方 `const fn = vi.fn()` | hoisting 後可能 `ReferenceError` | `const { fn } = vi.hoisted(() => ({ fn: vi.fn() }))` |
| 用 `vi.useFakeTimers()` 沒還原 | 後續測試的 `setTimeout` 全部卡住 | `afterEach(() => vi.useRealTimers())` |
| mock `ISqlSugarClient` 的 `Queryable<T>()` 鏈 | 測到的是 mock 設定，不是 SQL | 整合測試跑真 PostgreSQL |
| 斷言「中文字不存在」而頁面實際渲染英文 | 永遠通過的假測試 | 先確認被測環境語系，斷言實際會出現的字串 |
| 一個測試驗證三件事並有三次 Act | 失敗時不知道哪步壞 | 拆成三個測試 |
| 依賴 CWD 的路徑（`File.ReadAllText("data.json")`） | 測試在 bin 目錄通過、`dotnet run` 時失敗 | 用 `AppContext.BaseDirectory` 組路徑 |
| 為衝覆蓋率呼叫方法不 assert | 覆蓋率假象 | 刪掉，或補上有意義的 assert |
| 保留 `dotnet new xunit` 的 `coverlet.collector` / `Version=` | CPM 報 `NU1008`；覆蓋率門檻不生效，CI 永遠綠 | 照 §3.1 改成 `coverlet.msbuild`、刪 `Version=` |
| 領域拒絕寫成丟例外並用 `Assert.Throws` 測 | 業務結果被當成程式錯誤，endpoint 回 500 | 回傳 `false` / 結果 enum，測回傳值 |

## 6. 待確認

- [ ] .NET 是否導入 mock 函式庫（Moq 或 NSubstitute）；決定前一律手寫 Fake
- [ ] 參考專案用 xUnit 2.9.3；是否升級 xUnit v3（`xunit.v3`）
- [ ] pnpm 版本 11.x 或 12（指令寫法相同；`packageManager` 以 `pnpm@<PNPM_VERSION>` 佔位）
- [ ] 前端覆蓋率 `exclude` 除了已固定的 `src/api/mock/**`，是否再排除 `src/router/**`、`src/locales/**` 等

已決定、不再列入待確認：.NET line 55% 以 `coverlet.msbuild`（`-p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total`）
強制並以合併後整體覆蓋率判定；測試專案放 `server/tests/`；CPM（csproj 無版本號）。
