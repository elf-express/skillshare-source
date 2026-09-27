# 契約測試範本

目的：讓「C# DTO 改了、`types.ts` 沒改」在測試階段就失敗，而不是上線後前端顯示空白。

- .NET 契約測試放在整合測試專案 `server/tests/<App>.Api.IntegrationTests/Contract/`（需要 Docker），與 endpoint 整合測試共用 **elf-integration** 的 `IntegrationFixture` / `ElfApiFactory`：
  factory 只以 `UseSetting` 覆寫 `ConnectionStrings:Default`，**不**替換 `ISqlSugarClient`，所以序列化設定與正式環境完全相同。
- 前端測試與被測檔案同目錄（`foo.ts` → `foo.test.ts`）。
- line coverage 門檻 55% 以**合併後**的整體覆蓋率計算（`coverlet.msbuild`，見 elf-cicd-backend），不要求單一測試專案各自達標。

---

## 1. .NET：DTO 線上欄位名

用 **應用程式實際註冊的** JSON 設定序列化 DTO，逐一比對與 `types.ts` 相同的欄位順序與名稱。

`server/tests/<App>.Api.IntegrationTests/Contract/WireShape.cs`

```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace <App>.Api.IntegrationTests.Contract;

public static class WireShape
{
    /// <summary>Serializes with the options Program.cs registered, so the output matches real responses.</summary>
    public static JsonElement Serialize<T>(WebApplicationFactory<Program> factory, T dto)
    {
        var options = factory.Services.GetRequiredService<IOptions<HttpJsonOptions>>().Value.SerializerOptions;
        return JsonSerializer.SerializeToElement(dto, options);
    }

    public static string[] Names(JsonElement element) =>
        element.EnumerateObject().Select(p => p.Name).ToArray();
}
```

`server/tests/<App>.Api.IntegrationTests/Contract/LibraryContractTests.cs`

```csharp
using <App>.Api.IntegrationTests.Infrastructure;
using static <App>.Api.Api.CategoryEndpoints;
using static <App>.Api.Api.SessionEndpoints;
using static <App>.Api.Api.TextEndpoints;

namespace <App>.Api.IntegrationTests.Contract;

/// <summary>Mirrors apps/src/api/types.ts — update both together.</summary>
[Collection(IntegrationCollection.Name)]
public class LibraryContractTests(IntegrationFixture fixture)
{
    [Fact]
    public void CategoryDto_matches_types_ts()
    {
        var json = WireShape.Serialize(fixture.Factory, new CategoryDto(1, "basic", "Basics", "#8a9a5b"));

        Assert.Equal(new[] { "id", "code", "name", "color" }, WireShape.Names(json));
    }

    [Fact]
    public void TextDto_matches_types_ts()
    {
        var json = WireShape.Serialize(fixture.Factory, new TextDto(1, "Home row", "basic", "A1", 120, null, null, "asdf"));

        Assert.Equal(
            new[] { "id", "title", "category", "level", "chars", "best", "lastPractisedAt", "content" },
            WireShape.Names(json));
    }

    [Fact]
    public void TextDto_omits_content_when_null_so_ts_can_mark_it_optional()
    {
        var json = WireShape.Serialize(fixture.Factory, new TextDto(1, "Home row", "basic", "A1", 120, null, null, null));

        Assert.DoesNotContain("content", WireShape.Names(json));
        Assert.Contains("best", WireShape.Names(json));   // nullable but always written → TS `number | null`
    }

    [Fact]
    public void Enums_are_written_as_the_strings_types_ts_expects()
    {
        var json = WireShape.Serialize(fixture.Factory, new HistoryItemDto(1, "basic", 58, SpeedUnit.Wpm, 97.2, DateTime.UtcNow));

        Assert.Equal("wpm", json.GetProperty("unit").GetString());
    }
}
```

> `SpeedUnit` enum 與 `'wpm' | 'cpm'` 聯集對應；依 elf-api-design 規則 41，enum 以 camelCase 字串輸出。
> `IntegrationFixture` 需公開 `Factory`（elf-integration 範本已有）。

---

## 2. .NET：錯誤與健康檢查形狀

`server/tests/<App>.Api.IntegrationTests/Contract/ErrorContractTests.cs`

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using <App>.Api.IntegrationTests.Infrastructure;

namespace <App>.Api.IntegrationTests.Contract;

[Collection(IntegrationCollection.Name)]
public class ErrorContractTests(IntegrationFixture fixture)
{
    [Fact]
    public async Task Unknown_id_returns_problem_details_with_code()
    {
        var client = fixture.CreateClient();

        var res = await client.GetAsync("/api/categories/999999");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.Equal(404, body.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("category.not_found", body.RootElement.GetProperty("code").GetString());
        Assert.True(body.RootElement.TryGetProperty("traceId", out _));
    }

    [Fact]
    public async Task Validation_failure_lists_camelCase_fields_and_code()
    {
        var client = fixture.CreateClient();

        var res = await client.PostAsJsonAsync("/api/translate/locales", new { text = "", sourceLocale = "en" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        using var body = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.Equal("validation.failed", body.RootElement.GetProperty("code").GetString());
        Assert.True(body.RootElement.GetProperty("errors").TryGetProperty("text", out _));
    }

    [Fact]
    public async Task Health_is_anonymous_and_reports_ok()
    {
        var client = fixture.CreateClient();

        var res = await client.GetAsync("/api/health");

        res.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.Equal("ok", body.RootElement.GetProperty("status").GetString());
    }
}
```

`fixture.CreateClient()` 不帶使用者即為匿名請求（elf-integration 的 `TestAuthHandler`）；受保護 endpoint 的契約測試改用 `fixture.CreateClient(user: ..., companyId: ..., roles: ...)`。
`Program` 需在 `Program.cs` 結尾宣告 `public partial class Program;`（見 elf-api-design §3.1）。

---

## 3. 前端：store 在 mock 模式下的資料流

Vitest 執行時沒有設定 `VITE_USE_MOCK`，`USE_MOCK` 為 `true`，store 會拿到 fixtures——這正好驗證「fixture 形狀 = store 預期形狀」。

`apps/src/stores/library.test.ts`

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CATEGORIES } from '@/api/mock/fixtures'
import { useLibraryStore } from './library'

describe('library store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads categories and texts through the api layer', async () => {
    const store = useLibraryStore()

    await store.load()

    expect(store.categories).toEqual(CATEGORIES)
    expect(store.loading).toBe(false)
  })
})
```

## 4. 前端：型別層的保護

- `fixtures.ts` 以 wire type 標註，`pnpm typecheck`（`vue-tsc --noEmit`）即為第一道契約檢查。
- 需要讓 fixture 保留字面型別又要檢查形狀時，用 `satisfies`：

```ts
export const SUMMARY = {
  englishWpm: 62,
  englishDelta: 3,
  accuracy: 96.4,
  personalBest: 78,
  personalBestOn: '2026-09-20T09:12:00Z',
} satisfies StatsSummaryDto
```
