# elf-domain-modeling 範本

以 `Acme` 代表 `<App>`。所有檔案放在 `server/src/Acme.Api/Models/`。
屬性 → 資料庫欄位對應（snake_case、`timestamptz`、`jsonb`）由 elf-sqlsugar 的 `SqlSugarSetup` 統一處理。

## 1. `Models/EntityContracts.cs` — 介面與基底類別

```csharp
using SqlSugar;

namespace Acme.Api.Models;

/// <summary>Marker for SqlSugar entities. Only these get snake_case table/column names.</summary>
public interface IEntity
{
    int Id { get; set; }
}

/// <summary>Filled by the DataExecuting AOP in SqlSugarSetup; never set by hand.</summary>
public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    int? CreatedBy { get; set; }
    DateTime? UpdatedAt { get; set; }
    int? UpdatedBy { get; set; }
}

/// <summary>Row belongs to exactly one company. A global filter scopes every query to it.</summary>
public interface ICompanyEntity
{
    int CompanyId { get; set; }
}

/// <summary>Row is hidden, not removed. A global filter hides IsDeleted rows.</summary>
public interface ISoftDelete
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}

public abstract class EntityBase : IEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
}

public abstract class AuditedEntity : EntityBase, IAuditable
{
    // IsOnlyIgnoreUpdate: a whole-entity Updateable(entity) must never rewrite creation data.
    [SugarColumn(ColumnDataType = "timestamptz", IsOnlyIgnoreUpdate = true)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [SugarColumn(IsNullable = true, IsOnlyIgnoreUpdate = true)]
    public int? CreatedBy { get; set; }

    [SugarColumn(ColumnDataType = "timestamptz", IsNullable = true)]
    public DateTime? UpdatedAt { get; set; }

    [SugarColumn(IsNullable = true)]
    public int? UpdatedBy { get; set; }
}

/// <summary>
/// Default base for business data: audited, company-scoped, soft-deletable.
/// </summary>
public abstract class CompanyEntity : AuditedEntity, ICompanyEntity, ISoftDelete
{
    [SugarColumn(IsOnlyIgnoreUpdate = true)]
    public int CompanyId { get; set; }

    public bool IsDeleted { get; set; }

    [SugarColumn(ColumnDataType = "timestamptz", IsNullable = true)]
    public DateTime? DeletedAt { get; set; }
}
```

> `CreatedAt` / `CreatedBy` 都標 `IsOnlyIgnoreUpdate = true`：整筆 `Updateable(entity)`（例如 elf-dotnet 的 `MapCrud<T>` PUT）不會覆寫建立資料。

## 2. `Models/Order.cs` — 聚合根 + 子實體

```csharp
using SqlSugar;

namespace Acme.Api.Models;

public enum OrderStatus
{
    Draft = 0,
    Placed = 1,
    Cancelled = 2,
}

/// <summary>Aggregate root. OrderLine rows are only changed through this aggregate's service.</summary>
[SugarTable("Orders")]
[SugarIndex("ix_orders_company_created", nameof(CompanyId), OrderByType.Asc, nameof(CreatedAt), OrderByType.Desc)]
public class Order : CompanyEntity
{
    [SugarColumn(Length = 128)]
    public string Name { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Draft;

    [SugarColumn(Length = 18, DecimalDigits = 2)]
    public decimal TotalAmount { get; set; }

    [SugarColumn(Length = 3)]
    public string Currency { get; set; } = "TWD";

    /// <summary>
    /// Free-form attributes whose keys come from the storefront, always read and written as a whole
    /// and never filtered on, so jsonb rather than columns (elf-domain-modeling rule 29).
    /// </summary>
    [SugarColumn(IsJson = true, ColumnDataType = "jsonb", IsNullable = true)]
    public Dictionary<string, string>? Attributes { get; set; }

    [Navigate(NavigateType.OneToMany, nameof(OrderLine.OrderId))]
    public List<OrderLine>? Lines { get; set; }

    /// <summary>Value-object view over the two money columns.</summary>
    [SugarColumn(IsIgnore = true)]
    public Money Total => new(TotalAmount, Currency);

    public static Order Create(string name, int quantity)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);

        return new Order { Name = name.Trim(), Quantity = quantity, Status = OrderStatus.Draft };
    }

    /// <summary>
    /// State transition with its rule in one place. Returns false for an expected
    /// business refusal (the service maps it to 409); it does not throw.
    /// </summary>
    public bool TryPlace()
    {
        if (Status != OrderStatus.Draft)
        {
            return false;
        }

        Status = OrderStatus.Placed;
        return true;
    }

    public void SetTotal(Money total)
    {
        TotalAmount = total.Amount;
        Currency = total.Currency;
    }
}

/// <summary>Child of Order. Carries CompanyId too, so a direct query is still tenant-scoped.</summary>
[SugarTable("OrderLines")]
[SugarIndex("ix_order_lines_order", nameof(OrderId), OrderByType.Asc)]
public class OrderLine : CompanyEntity
{
    public int OrderId { get; set; }

    [SugarColumn(Length = 64)]
    public string Sku { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public static OrderLine Create(int orderId, string sku, int quantity)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sku);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);

        return new OrderLine { OrderId = orderId, Sku = sku, Quantity = quantity };
    }
}
```

## 3. `Models/Money.cs` — 值物件

```csharp
namespace Acme.Api.Models;

/// <summary>Immutable; equality by value. Persisted as two columns on the owning entity.</summary>
public readonly record struct Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(amount);
        if (currency is not { Length: 3 })
        {
            throw new ArgumentException("Currency must be a 3-letter ISO 4217 code.", nameof(currency));
        }

        Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        Currency = currency.ToUpperInvariant();
    }

    public Money Add(Money other)
    {
        if (other.Currency != Currency)
        {
            throw new InvalidOperationException($"Cannot add {other.Currency} to {Currency}.");
        }

        return new Money(Amount + other.Amount, Currency);
    }
}
```

## 4. 非租戶的參照資料

全公司共用的參照資料（例如國家代碼、系統內建範本）**不**實作 `ICompanyEntity`：

```csharp
using SqlSugar;

namespace Acme.Api.Models;

[SugarTable("Countries")]
[SugarIndex("ux_countries_code", nameof(Code), OrderByType.Asc, true)]
public class Country : AuditedEntity
{
    [SugarColumn(Length = 2)]
    public string Code { get; set; } = string.Empty;

    [SugarColumn(Length = 128)]
    public string Name { get; set; } = string.Empty;
}
```

## 5. 聚合的載入與儲存（服務內）

```csharp
using Acme.Api.Models;
using SqlSugar;

namespace Acme.Api.Services;

public sealed class OrderPlacementService(ISqlSugarClient db)
{
    public async Task<Order?> LoadAsync(int id, CancellationToken ct) =>
        await db.Queryable<Order>()
            .Includes(o => o.Lines)
            .Where(o => o.Id == id)
            .FirstAsync(ct);

    public async Task<PlaceResult> PlaceAsync(int id, CancellationToken ct)
    {
        var order = await LoadAsync(id, ct);
        if (order is null)
        {
            return PlaceResult.NotFound;
        }

        if (!order.TryPlace()) // the rule lives on the aggregate
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

/// <summary>Service outcome; the endpoint maps it to 204 / 404 / 409 ProblemDetails (elf-dotnet §3.2).</summary>
public enum PlaceResult
{
    Placed = 0,
    NotFound = 1,
    InvalidState = 2,
}
```
