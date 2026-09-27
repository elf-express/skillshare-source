# `Data/SqlSugarSetup.cs` 完整範本（PostgreSQL 18）

以 `Acme` 代表 `<App>`。依賴 elf-domain-modeling 定義的 `IEntity`、`IAuditable`、`ICompanyEntity`、`ISoftDelete`，
以及下方 `ElfClaimTypes`、`ICurrentUser` / `ICurrentTenant`（claim 名稱已決定；JWT 簽發方式仍待認證設計）。

所有用到的 SqlSugar API 均已在 `SqlSugarCore 5.1.4.221` 以反射確認存在：
`ConnMoreSettings.{PgSqlIsAutoToLower, PgSqlIsAutoToLowerCodeFirst, EnableJsonb, PostgresIdentityStrategy, IsAutoDeleteQueryFilter, IsAutoUpdateQueryFilter}`、
`ConfigureExternalServices.{EntityNameService, EntityService}`、`UtilMethods.ToUnderLine(string, bool)`、
`AopProvider.{DataExecuting, OnLogExecuting}`、`DataFilterModel.{OperationType, PropertyName, EntityValue, SetValue}`、
`DataFilterType.{InsertByObject, UpdateByObject, DeleteByObject}`、`QueryFilterProvider.AddTableFilter<T>`。

## 1. Claim 名稱、目前使用者 / 租戶

### 1.1 `Auth/ElfClaimTypes.cs` — claim 名稱的唯一定義

路徑固定 `server/src/<App>.Api/Auth/ElfClaimTypes.cs`、namespace `<App>.Api.Auth`。JWT 簽發端、下方解析器、
整合測試的 `TestAuthHandler`（elf-integration）都只引用這些常數；**MUST NOT** 在任何地方另寫 claim 字串或用 `ClaimTypes.*`。

```csharp
namespace Acme.Api.Auth;

/// <summary>
/// The only place claim names are spelled. The JWT issuer, the tenant/user resolvers in
/// Data/CurrentContext.cs and the integration tests' TestAuthHandler all use these constants.
/// </summary>
public static class ElfClaimTypes
{
    public const string UserId = "sub";
    public const string CompanyId = "company_id";
    public const string Role = "role";
}
```

### 1.2 `Data/CurrentContext.cs` — 介面與實作

實作必須是 **Singleton**、內部透過 `IHttpContextAccessor` 讀取當前請求（因為 `SqlSugarScope` 是 Singleton，
configAction 捕捉的物件也必須是 Singleton）：

```csharp
using Acme.Api.Auth;

namespace Acme.Api.Data;

/// <summary>Who is making the request. Null when anonymous or a background job.</summary>
public interface ICurrentUser
{
    int? UserId { get; }
}

/// <summary>
/// The company the request acts for. Throws when there is none, so a missing tenant
/// fails the query instead of silently returning every company's rows.
/// </summary>
public interface ICurrentTenant
{
    int CompanyId { get; }
}

public sealed class HttpCurrentTenant(IHttpContextAccessor accessor) : ICurrentTenant
{
    public int CompanyId
    {
        get
        {
            var value = accessor.HttpContext?.User.FindFirst(ElfClaimTypes.CompanyId)?.Value;
            return int.TryParse(value, out var id)
                ? id
                : throw new InvalidOperationException("No company in the current request.");
        }
    }
}

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public int? UserId =>
        int.TryParse(accessor.HttpContext?.User.FindFirst(ElfClaimTypes.UserId)?.Value, out var id) ? id : null;
}
```

## 2. `SqlSugarSetup.cs`

```csharp
using Acme.Api.Models;
using SqlSugar;

namespace Acme.Api.Data;

public static class SqlSugarSetup
{
    /// <summary>
    /// Every entity CodeFirst manages. A type missing here never gets its table.
    /// </summary>
    public static readonly Type[] Entities =
    [
        typeof(Order),
        typeof(OrderLine),
    ];

    public static IServiceCollection AddSqlSugar(
        this IServiceCollection services, IConfiguration config, IHostEnvironment env)
    {
        var connection = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, HttpCurrentUser>();
        services.AddSingleton<ICurrentTenant, HttpCurrentTenant>();

        // SqlSugarScope is the thread-safe wrapper, so a singleton is correct.
        services.AddSingleton<ISqlSugarClient>(sp =>
        {
            var currentUser = sp.GetRequiredService<ICurrentUser>();
            var currentTenant = sp.GetRequiredService<ICurrentTenant>();
            var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Acme.Api.Data.Sql");

            return new SqlSugarScope(
                new ConnectionConfig
                {
                    DbType = DbType.PostgreSQL,
                    ConnectionString = connection,
                    IsAutoCloseConnection = true,
                    InitKeyType = InitKeyType.Attribute,
                    MoreSettings = new ConnMoreSettings
                    {
                        PgSqlIsAutoToLower = true,
                        PgSqlIsAutoToLowerCodeFirst = true,
                        EnableJsonb = true,
                        PostgresIdentityStrategy = PostgresIdentityStrategy.Identity,
                        IsAutoDeleteQueryFilter = true,
                        IsAutoUpdateQueryFilter = true,
                    },
                    ConfigureExternalServices = new ConfigureExternalServices
                    {
                        // PascalCase entity names -> snake_case tables and columns.
                        // DTOs are skipped: converting them breaks projections.
                        EntityNameService = (type, entity) =>
                        {
                            if (typeof(IEntity).IsAssignableFrom(type))
                            {
                                entity.DbTableName = UtilMethods.ToUnderLine(entity.DbTableName, false);
                            }
                        },
                        EntityService = (property, column) =>
                        {
                            var owner = property.ReflectedType ?? property.DeclaringType;
                            if (owner is not null && typeof(IEntity).IsAssignableFrom(owner))
                            {
                                column.DbColumnName = UtilMethods.ToUnderLine(column.DbColumnName, false);
                            }
                        },
                    },
                },
                db =>
                {
                    ConfigureAudit(db, currentUser, currentTenant);
                    ConfigureFilters(db, currentTenant);

                    if (env.IsDevelopment())
                    {
                        db.Aop.OnLogExecuting = (sql, _) => logger.LogDebug("SQL {Sql}", sql);
                    }
                });
        });

        return services;
    }

    private static void ConfigureAudit(SqlSugarClient db, ICurrentUser currentUser, ICurrentTenant currentTenant)
    {
        db.Aop.DataExecuting = (_, info) =>
        {
            switch (info.OperationType)
            {
                case DataFilterType.InsertByObject:
                    switch (info.PropertyName)
                    {
                        case nameof(IAuditable.CreatedAt):
                            info.SetValue(DateTime.UtcNow);
                            break;
                        case nameof(IAuditable.CreatedBy):
                            info.SetValue(currentUser.UserId);
                            break;
                        case nameof(ICompanyEntity.CompanyId) when info.EntityValue is ICompanyEntity:
                            info.SetValue(currentTenant.CompanyId);
                            break;
                    }
                    break;

                case DataFilterType.UpdateByObject:
                    switch (info.PropertyName)
                    {
                        case nameof(IAuditable.UpdatedAt):
                            info.SetValue(DateTime.UtcNow);
                            break;
                        case nameof(IAuditable.UpdatedBy):
                            info.SetValue(currentUser.UserId);
                            break;
                    }
                    break;
            }
        };
    }

    private static void ConfigureFilters(SqlSugarClient db, ICurrentTenant currentTenant)
    {
        // currentTenant.CompanyId is read when each query is translated, not once here.
        db.QueryFilter.AddTableFilter<ICompanyEntity>(e => e.CompanyId == currentTenant.CompanyId);
        db.QueryFilter.AddTableFilter<ISoftDelete>(e => e.IsDeleted == false);
    }

    /// <summary>Config flag that lets a Production run apply CodeFirst (see InitDatabase).</summary>
    public const string RunCodeFirstKey = "Database:RunCodeFirst";

    /// <summary>
    /// Creates missing tables and columns, then runs seeds in dependency order.
    /// Outside Production this always runs. In Production it runs only when
    /// Database:RunCodeFirst=true, because the app's own account has no DDL rights
    /// (elf-postgresql rule 28); schema changes there are a deliberate, owner-credentialed run.
    /// </summary>
    public static void InitDatabase(this IServiceProvider services)
    {
        var env = services.GetRequiredService<IHostEnvironment>();
        var config = services.GetRequiredService<IConfiguration>();

        if (env.IsProduction() && !config.GetValue<bool>(RunCodeFirstKey))
        {
            return;
        }

        var db = services.GetRequiredService<ISqlSugarClient>();

        // Production databases are provisioned by ops; only dev creates its own.
        if (env.IsDevelopment())
        {
            db.DbMaintenance.CreateDatabase();
        }

        db.CodeFirst.InitTables(Entities);

        // Seeds: parents before the rows that reference their ids.
        // ReferenceDataSeeds.Seed(db);
    }
}
```

### 2.1 CodeFirst 在正式環境（已決定）

| 環境 | `InitDatabase` 行為 | 連線帳號 |
|------|---------------------|----------|
| Development | `CreateDatabase()` + `InitTables` + seeds | 本機開發帳號 |
| 其他非 Production（Testing、Staging…） | `InitTables` + seeds | 該環境帳號 |
| Production，預設 | **不執行**（直接 return） | 應用程式專屬帳號，**沒有 DDL 權限**（elf-postgresql 規則 28） |
| Production，`Database__RunCodeFirst=true` | `InitTables` + seeds | 部署流程以 **owner 帳號**的 `ConnectionStrings__Default` 跑一次（一次性 job / 部署步驟），完成後以一般帳號重啟 |

CodeFirst 做不到的變更（刪欄位、改型別、partial / GIN 索引）一律走 elf-postgresql §2.5 的手寫遷移 SQL。

> 本檔、elf-dotnet 與 elf-domain-modeling 的 C# 範本已於 2026-09 以 `net10.0` + `SqlSugarCore 5.1.4.221` 實際建置通過
> （唯一警告為 elf-dotnet `MapCrud<T>` 觸發的分析器 `AD0001`，說明見 elf-dotnet references §10）；
> 執行期行為（下節）因無 PostgreSQL 環境尚未實測。

## 3. 需要以整合測試驗證的行為（elf-integration）

1. 租戶 A 的請求查不到租戶 B 的資料；無租戶時查詢拋 `InvalidOperationException`。
2. 軟刪除後 `Queryable<T>()` 查不到；`.ClearFilter<ISoftDelete>()` 查得到。
3. 以欄位級 `Updateable().SetColumns(..., true).Where(...)` 更新時，其他租戶的同 Id 資料不受影響（`IsAutoUpdateQueryFilter`）。
4. 寫入 `DateTime.UtcNow` 後讀回，`Kind` 與數值仍代表同一個 UTC 時刻（Npgsql 5 讀 `timestamptz` 可能回傳本機時間，見 elf-postgresql）。
5. 產生的 DDL：表名 / 欄位 / 索引皆為 snake_case，`jsonb` 欄位型別正確。

測試用資料庫：`postgres:18` 容器，一律以 **Testcontainers** 啟動（elf-integration 擁有範本與帳密），不可用 SQLite 代替 PostgreSQL 行為測試。
