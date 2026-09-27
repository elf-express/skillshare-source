---
name: elf-sqlsugar
description: |
  Elf Express SqlSugar 5.x ORM 使用規範（PostgreSQL 18，DbType.PostgreSQL）。
  當代碼涉及 SqlSugarScope 註冊、ConnectionConfig、db.Queryable / Insertable / Updateable / Deleteable、
  CodeFirst / InitTables / DbMaintenance、SugarTable / SugarColumn / SugarIndex、snake_case 命名轉換、
  交易（BeginTranAsync / UseTranAsync）、多租戶（ICompanyEntity）、軟刪除、審計欄位 AOP、分頁 ToPageListAsync、
  WhereIF 動態條件、批次寫入 / BulkCopy、N+1 效能問題時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express SqlSugar 使用規範（elf-sqlsugar）

依據：參考專案 `TypingTrainer` 的 `server/<App>.Api/Data/SqlSugarSetup.cs`（SQLite）轉換為 PostgreSQL 18；
API 簽章已對 `SqlSugarCore 5.1.4.221` 反射驗證（2026-09）。

相關 skill：
- **sqlsugar-docs**：API 參考（方法名 / 參數不確定時**先查它**）。注意：它寫「本專案使用 SQL Server」，
  那是第三方預設；**Elf 團隊資料庫是 PostgreSQL 18**，其中 SQL Server 專屬內容（`nvarchar(max)`、`Length=-1` 等）不適用。
- **elf-postgresql**：欄位型別、命名、索引、時間、JSONB 的資料庫端規則。
- **elf-domain-modeling**：實體、基底類別、`ICompanyEntity`、`ISoftDelete` 的定義。
- **elf-dotnet**：DI、設定、async 規則。**elf-stack**：SqlSugarCore 版本。

## 1. 何時使用

撰寫或審查任何會碰到 `ISqlSugarClient` 的程式碼、新增實體 / 欄位 / 索引、設計查詢或交易時。

## 2. 固定規則

### 2.1 註冊與連線

1. **MUST** 註冊 `services.AddSingleton<ISqlSugarClient>(sp => new SqlSugarScope(...))`；**MUST NOT** 把 `SqlSugarClient` 註冊為 Singleton。
2. **MUST** `ConnectionConfig` 設定：`DbType = DbType.PostgreSQL`、`IsAutoCloseConnection = true`、`InitKeyType = InitKeyType.Attribute`。
3. **MUST** `MoreSettings`：`PgSqlIsAutoToLower = true`、`PgSqlIsAutoToLowerCodeFirst = true`（預設值，寫明）、
   `EnableJsonb = true`、`PostgresIdentityStrategy = PostgresIdentityStrategy.Identity`、
   `IsAutoDeleteQueryFilter = true`、`IsAutoUpdateQueryFilter = true`。
4. **MUST** 以 `ConfigureExternalServices.EntityNameService` / `EntityService` 呼叫 `UtilMethods.ToUnderLine` 把**實體**的表名 / 欄位名轉 snake_case；
   只轉實作 `IEntity` 的型別（DTO 不轉，官方文件警告 DTO 被轉換會出錯）。
5. **MUST** 連線字串來自 `ConnectionStrings:Default`，缺失即 throw（見 elf-dotnet）。
6. **MUST** 所有 AOP / 過濾器（審計、租戶、軟刪除、SQL log）集中在 `Data/SqlSugarSetup.cs` 的 configAction 中設定，不可在服務內臨時加。

### 2.2 實體標註（CodeFirst）

7. **MUST** 每個實體加 `[SugarTable("PluralPascalName")]`（例：`[SugarTable("Orders")]` → 表 `orders`）。名稱用 PascalCase 寫，由 ToUnderLine 統一轉換；**不要**在屬性裡手寫 snake_case。
8. **MUST** 縮寫視為一般單字：`HttpStatus`、`OrderId`、`I18nKey`；**MUST NOT** `HTTPStatus`（會變成 `h_t_t_p_status`，已驗證）。
9. **MUST** 主鍵：`[SugarColumn(IsPrimaryKey = true, IsIdentity = true)] public int Id { get; set; }`（型別見 elf-domain-modeling）。
10. **MUST** 字串一律標長度：有上限用 `Length = n`（→ `varchar(n)`）；無上限用 `ColumnDataType = "text"`。
11. **MUST** 可為 null 的欄位同時寫 C# `?` 與 `IsNullable = true`（參考專案作法）。非 null 字串以 `= string.Empty` 初始化。
12. **MUST** 時間欄位 `DateTime`（UTC）＋ `ColumnDataType = "timestamptz"`（原因與限制見 elf-postgresql §時間）。
13. **MUST** `decimal` 一律標精度，依用途使用下列預設值（偏離時在屬性上以註解寫明理由）：

| 用途 | 標註 | PostgreSQL |
|------|------|------------|
| 金額（總額、小計、稅額） | `Length = 18, DecimalDigits = 2` | `numeric(18,2)` |
| 單價 | `Length = 18, DecimalDigits = 4` | `numeric(18,4)` |
| 數量（可有小數，如重量、長度） | `Length = 18, DecimalDigits = 4` | `numeric(18,4)` |
| 匯率、比率、百分比（以小數存，`0.05` = 5%） | `Length = 18, DecimalDigits = 6` | `numeric(18,6)` |

   整數數量用 `int`，不用 `decimal`。
14. **MUST** JSON 欄位 `[SugarColumn(IsJson = true, ColumnDataType = "jsonb")]`，C# 型別為可序列化物件（非 `string`）。
15. **MUST** 索引用 `[SugarIndex]`，命名 `ux_<table>_<cols>`（唯一）、`ix_<table>_<cols>`（一般），全小寫 snake_case（參考專案慣例）。
16. **MUST** 新實體加入 `SqlSugarSetup.Entities` 陣列，否則表不會被建立（參考專案 CLAUDE.md 記錄的坑）。
17. **MUST NOT** 在實體使用 `required` 成員（SqlSugar 用 `Activator.CreateInstance` 建立物件會丟例外）。
18. **MUST NOT** 依賴 CodeFirst 做刪欄位、改型別；改名用 `[SugarColumn(OldColumnName = "<db 上的舊 snake_case 名>")]`，並檢查 schema diff（見 elf-postgresql §遷移）。
18a. **MUST** CodeFirst（`InitDatabase`）只在**非 Production** 環境自動執行；Production 只有在明確設定 `Database__RunCodeFirst=true` 且使用 owner 帳號連線時才執行（一次性部署步驟），平常應用程式帳號沒有 DDL 權限（elf-postgresql 規則 28）。範本與對照表見 references §2、§2.1。

### 2.3 查詢

19. **MUST** 使用 async API 並傳 `CancellationToken`：`ToListAsync(ct)`、`FirstAsync(ct)`、`AnyAsync(ct)`、`ToPageListAsync(page, size, total, ct)`（皆已驗證存在）。
20. **MUST** 分頁用 `RefAsync<int> total = 0;` ＋ `ToPageListAsync(page, size, total, ct)`；page / size 一律先經 `Paging.Normalize(page, size)`（page ≥ 1、size 預設 50、上限 500），
    回傳 `PagedResult<T>`。`PagedResult<T>` / `Paging` **只有一份定義**：elf-api-design references §2.1 的 `Infrastructure/Paging.cs`
    （`public sealed record PagedResult<T>(int Total, int Page, int Size, IReadOnlyList<T> Rows);`，JSON 為 `{ total, page, size, rows }`）；**MUST NOT** 在服務或測試裡另宣告。
21. **MUST** 動態條件用 `WhereIF(condition, expr)`；**MUST NOT** 用字串拼接 SQL 或 `$"... {input}"`。
22. **MUST** 原生 SQL 只能用參數化：`db.Ado.SqlQueryAsync<T>("... where id = @id", new { id })`。
23. **MUST** 查詢只取需要的欄位時用 `.Select(x => new XDto { ... })`；列表 API 不回傳整個實體圖。
24. **MUST NOT** 在迴圈中查詢（N+1）。子資料用 `.Includes(x => x.Children)` 或先收集 id 再 `.In(ids)` 一次查回、用 `ToDictionary` / `ToLookup` 組裝。
25. **MUST NOT** 在查詢中呼叫 `.ToList()` 後再用 LINQ `Where` 過濾大量資料；過濾放在 SQL 端。

### 2.4 寫入

26. 單筆新增：`await db.Insertable(entity).ExecuteReturnIdentityAsync(ct)`（`int` Id）；`long` Id 用 `ExecuteReturnBigIdentityAsync(ct)`。
27. 更新：優先用**欄位級更新** `db.Updateable<T>().SetColumns(x => new T { ... }, true).Where(x => x.Id == id).ExecuteCommandAsync(ct)`；
    整筆實體 `Updateable(entity)` 只能用在「先查出來、改完、再存回」的情況（避免把未載入的欄位覆寫成預設值）。
28. **MUST** `SetColumns(..., true)` 第二參數給 `true`，讓 `DataExecuting` 審計欄位（`UpdatedAt` / `UpdatedBy`）一起更新。
29. 刪除：實作 `ISoftDelete` 的實體 **MUST** 軟刪除（範本見 references）；**MUST NOT** 對其使用 `Deleteable`。
30. 批次：< 1000 筆用 `Insertable(list)`；≥ 1000 筆用 `db.Fastest<T>().BulkCopyAsync(list)`。**BulkCopy 預設不走 AOP**：
    必須呼叫 `.EnableDataAop()` 或自行設定審計 / 租戶欄位。

### 2.5 交易

31. **MUST** 需要多個寫入同成敗時使用交易，寫法固定為 `BeginTranAsync` / `CommitTranAsync` / `RollbackTranAsync` ＋ **rethrow**（範本見 §3.3）。
32. **MUST NOT** 使用 `UseTranAsync` 而不檢查回傳的 `DbResult.IsSuccess`：它會吞掉例外、只回傳結果物件，容易讓失敗被忽略。
33. **MUST NOT** 在交易中呼叫外部 HTTP / 寄信 / 長時間運算；**MUST NOT** 在交易內 `Task.WhenAll` 平行執行 SqlSugar 指令。
34. 交易由**服務層**開啟；endpoint 不開交易。

### 2.6 多租戶與軟刪除（全域過濾器）

35. **MUST** 實作 `ICompanyEntity` 的實體由全域過濾器自動加 `company_id = 當前公司`；新增時由 `DataExecuting` 自動填 `CompanyId`；`CompanyId` 欄位標 `IsOnlyIgnoreUpdate = true`，更新不得改變所屬公司。
36. **MUST** 無法取得當前公司時**拋例外**（fail closed），不可回傳 0 或 null 讓查詢跑下去。
36a. **MUST** 租戶 / 使用者解析器讀 claim 時只用 `ElfClaimTypes.CompanyId`（`"company_id"`）/ `ElfClaimTypes.UserId`（`"sub"`）；定義在 `Auth/ElfClaimTypes.cs`（references §1.1）。
37. **MUST** 實作 `ISoftDelete` 的實體由全域過濾器自動加 `is_deleted = false`。
38. 需要跨租戶 / 含已刪除資料（後台工作、管理報表）時，**MUST** 在單一查詢上顯式 `.ClearFilter<ICompanyEntity>()` / `.ClearFilter<ISoftDelete>()`，並在程式碼註解寫明原因。**MUST NOT** 呼叫 `db.QueryFilter.Clear()` 清掉整個 context 的過濾器。

### 2.7 記錄與偵錯

39. SQL log 只在 Development 透過 `db.Aop.OnLogExecuting` 寫入 `ILogger`（Debug 等級）；**MUST NOT** `Console.WriteLine`。

## 3. 標準範本

完整 `Data/SqlSugarSetup.cs`（PostgreSQL、snake_case、審計 AOP、租戶 / 軟刪除過濾器、`InitDatabase`）
在 [`references/sqlsugar-setup.md`](references/sqlsugar-setup.md)。實體基底類別與介面在 **elf-domain-modeling**。

### 3.1 分頁 + 動態條件

```csharp
using Acme.Api.Data;
using Acme.Api.Infrastructure;
using Acme.Api.Models;
using SqlSugar;

namespace Acme.Api.Services;

public record OrderQuery(string? Keyword, OrderStatus? Status, int? Page, int? Size);

public class OrderListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class OrderSearchService(ISqlSugarClient db)
{
    public async Task<PagedResult<OrderListItemDto>> SearchAsync(OrderQuery query, CancellationToken ct)
    {
        var (page, size) = Paging.Normalize(query.Page, query.Size);
        RefAsync<int> total = 0;

        var rows = await db.Queryable<Order>()
            .WhereIF(!string.IsNullOrWhiteSpace(query.Keyword), o => o.Name.Contains(query.Keyword!))
            .WhereIF(query.Status.HasValue, o => o.Status == query.Status!.Value)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderListItemDto { Id = o.Id, Name = o.Name, Status = o.Status, CreatedAt = o.CreatedAt })
            .ToPageListAsync(page, size, total, ct);

        rows.ForEach(r => r.CreatedAt = UtcTime.Normalize(r.CreatedAt)); // Npgsql 5 returns local time, see elf-postgresql

        return new PagedResult<OrderListItemDto>(total.Value, page, size, rows);
    }
}
```

> `PagedResult<T>` / `Paging` 來自 `Infrastructure/Paging.cs`（elf-api-design references §2.1，唯一定義），這裡不重複宣告。
> `Select` 投影目標用可 `new` 的 class；record 投影請先查 sqlsugar-docs 確認支援度。

### 3.2 避免 N+1

```csharp
// Wrong: one query per order.
foreach (var order in orders)
{
    order.Lines = await db.Queryable<OrderLine>().Where(l => l.OrderId == order.Id).ToListAsync(ct);
}

// Right: one query for all lines.
var ids = orders.Select(o => o.Id).ToList();
var lines = (await db.Queryable<OrderLine>().In(l => l.OrderId, ids).ToListAsync(ct))
    .ToLookup(l => l.OrderId);
foreach (var order in orders)
{
    order.Lines = lines[order.Id].ToList();
}

// Or: navigation include (requires [Navigate] on Order.Lines).
var withLines = await db.Queryable<Order>().Includes(o => o.Lines).Where(o => ids.Contains(o.Id)).ToListAsync(ct);
```

### 3.3 交易

```csharp
public async Task<int> PlaceAsync(PlaceOrderRequest request, CancellationToken ct)
{
    var order = Order.Create(request.Name, request.Quantity);

    await db.Ado.BeginTranAsync();
    try
    {
        var id = await db.Insertable(order).ExecuteReturnIdentityAsync(ct);

        var lines = request.Lines.Select(l => OrderLine.Create(id, l.Sku, l.Quantity)).ToList();
        await db.Insertable(lines).ExecuteCommandAsync(ct);

        await db.Updateable<Stock>()
            .SetColumns(s => new Stock { Available = s.Available - request.Quantity }, true)
            .Where(s => s.Sku == request.Sku)
            .ExecuteCommandAsync(ct);

        await db.Ado.CommitTranAsync();
        return id;
    }
    catch
    {
        await db.Ado.RollbackTranAsync();
        throw;
    }
}
```

### 3.4 欄位級更新

```csharp
var affected = await db.Updateable<Order>()
    .SetColumns(o => new Order { Name = request.Name, Status = request.Status }, true)
    .Where(o => o.Id == id)
    .ExecuteCommandAsync(ct);

return affected > 0;
```

### 3.5 軟刪除

```csharp
public async Task<bool> SoftDeleteAsync<T>(int id, CancellationToken ct)
    where T : EntityBase, ISoftDelete, new()
{
    var now = DateTime.UtcNow;
    var affected = await db.Updateable<T>()
        .SetColumns(e => new T { IsDeleted = true, DeletedAt = now }, true)
        .Where(e => e.Id == id)
        .ExecuteCommandAsync(ct);

    return affected > 0;
}
```

### 3.6 大量寫入

```csharp
await db.Fastest<Order>()
    .EnableDataAop() // BulkCopy skips DataExecuting unless enabled: audit + CompanyId would stay empty.
    .BulkCopyAsync(orders);
```

## 4. 檢查清單

- [ ] `DbType.PostgreSQL`、`SqlSugarScope` Singleton、`MoreSettings` 如 §2.1
- [ ] 新實體：`[SugarTable]`、繼承基底類別、已加入 `SqlSugarSetup.Entities`
- [ ] 所有字串有 `Length` 或 `ColumnDataType = "text"`；nullable 欄位有 `IsNullable = true`
- [ ] 時間欄位 `ColumnDataType = "timestamptz"`；值為 `DateTime.UtcNow`
- [ ] JSON 欄位 `IsJson = true, ColumnDataType = "jsonb"`
- [ ] 索引名稱 `ux_` / `ix_` 前綴、全小寫
- [ ] 查詢都是 async 並傳 `CancellationToken`；沒有迴圈內查詢
- [ ] 沒有字串拼接 SQL；原生 SQL 全部參數化
- [ ] 多筆寫入有交易，catch 內 rollback 並 rethrow
- [ ] `ISoftDelete` 實體沒有用 `Deleteable`
- [ ] 使用 `ClearFilter<...>()` 的地方有註解說明原因
- [ ] BulkCopy 有 `.EnableDataAop()` 或手動填審計 / 租戶欄位
- [ ] 啟動後以 `pg_dump --schema-only` 檢查產生的 DDL（表名 / 欄位 / 索引皆 snake_case，見 elf-postgresql）
- [ ] 有整合測試（elf-integration）驗證：租戶隔離、軟刪除過濾、`timestamptz` 讀回仍為 UTC
- [ ] `decimal` 欄位依 §2.2 規則 13 的預設精度標註
- [ ] 分頁回 `PagedResult<T>`（唯一定義），沒有自行宣告的分頁型別
- [ ] claim 名稱只透過 `ElfClaimTypes` 讀取
- [ ] Production 不會自動跑 CodeFirst（除非 `Database__RunCodeFirst=true` 的一次性部署步驟）

## 5. 常見錯誤

| 錯誤 | 正確 |
|------|------|
| `DbType = DbType.Sqlite`（照抄參考專案） | `DbType = DbType.PostgreSQL` |
| `new SqlSugarClient(...)` 註冊成 Singleton | `SqlSugarScope` |
| `[SugarTable("order_lines")]` 手寫 snake_case、另一個表又寫 PascalCase | 一律寫 `[SugarTable("OrderLines")]`，交給 ToUnderLine |
| 沒有 ToUnderLine，表變成 `orderlines`、欄位 `createdat` | 設定 `EntityNameService` / `EntityService`（§3 references） |
| `ref int total` + `ToPageList` 同步版 | `RefAsync<int> total = 0` + `ToPageListAsync(..., total, ct)` |
| `ToPagedList` | 方法名是 `ToPageList` / `ToPageListAsync` |
| `Where($"name = '{input}'")` | `Where(o => o.Name == input)` 或參數化 SQL |
| `await db.Ado.UseTranAsync(...)` 後不看結果 | 用 Begin/Commit/Rollback + rethrow，或檢查 `result.IsSuccess` |
| `Updateable(new Order { Id = id, Name = x })` | 會把其他欄位覆寫成預設值；用 `SetColumns` |
| `db.Deleteable<Order>().In(id)` 刪軟刪除實體 | 用 §3.5 軟刪除 |
| `db.QueryFilter.Clear()` 取跨租戶資料 | 單一查詢 `.ClearFilter<ICompanyEntity>()` ＋註解 |
| `BulkCopyAsync` 後 `created_at` / `company_id` 為空 | `.EnableDataAop()` |
| 新增 `Repository<T>` / `SimpleClient<T>` / UnitOfWork 包裝 | 服務直接注入 `ISqlSugarClient`（已決定，無 repository 層，見 elf-domain-modeling 規則 30） |
| 照 sqlsugar-docs 的 SQL Server 提示設 `Length = -1` | PostgreSQL 無上限字串用 `ColumnDataType = "text"` |
| 服務裡再寫一個 `record PagedResult<T>(..., List<T> Rows)` | 用 `Infrastructure/Paging.cs` 的唯一定義（`IReadOnlyList<T>`） |
| `decimal` 沒標精度，或單價用 `(18,2)` 失去精度 | 依規則 13 的預設精度表 |
| `User.FindFirst("CompanyId")` / `ClaimTypes.NameIdentifier` | `ElfClaimTypes.CompanyId` / `ElfClaimTypes.UserId` |
| Production 啟動時以應用程式帳號自動跑 CodeFirst | 預設跳過；以 owner 帳號 + `Database__RunCodeFirst=true` 一次性執行 |

## 6. 待確認

- SqlSugarCore 確切版本（參考專案 5.1.4.221；見 elf-stack）。
- 是否顯式引用較新版 Npgsql（目前由 SqlSugarCore 帶入 5.0.18）；若升級到 Npgsql 6+，SqlSugar 預設會開 `Npgsql.EnableLegacyTimestampBehavior`，時間行為需重新驗證。
- JWT 簽發方式（elf-dotnet 待確認）。claim 名稱已決定為 `ElfClaimTypes`，租戶來源為 JWT 的 `company_id` claim。
- `[SugarIndex]` 的欄位名是否會套用 ToUnderLine 轉換（需以產生的 DDL 驗證；若不會，索引需改為手寫 SQL）。
- `IsJson` + `ColumnDataType = "jsonb"` 與 `EnableJsonb = true` 在 5.1.4.221 + PostgreSQL 18 的實際 DDL（需以整合測試驗證）。
- 批次門檻 1000 筆是否需依實測調整。
