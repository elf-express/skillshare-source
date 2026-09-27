---
name: elf-domain-modeling
description: |
  Elf Express 領域建模規範（C# + SqlSugar 實體）。當任務涉及設計或修改 Entity、Value Object、聚合（Aggregate）、
  主鍵型別、審計欄位（CreatedAt / CreatedBy / UpdatedAt / UpdatedBy）、多租戶邊界（ICompanyEntity / CompanyId）、
  軟刪除（ISoftDelete / IsDeleted）、enum 與狀態轉換、工廠方法、領域事件、Repository / UnitOfWork 取捨時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 領域建模規範（elf-domain-modeling）

依據：參考專案 `TypingTrainer` 的 `server/<App>.Api/Models/Entities.cs`（SqlSugar CodeFirst 實體即資料表定義），
加上團隊標準的多租戶、審計、軟刪除介面。實體即 SqlSugar 持久化模型；**不另建一套 ORM 以外的 domain model**。

相關 skill：**elf-sqlsugar**（標註、AOP、過濾器實作）、**elf-postgresql**（欄位型別、索引）、
**elf-dotnet**（服務層、結果回傳慣例）、**elf-api-contract**（實體與 API DTO 的對應）。

## 1. 何時使用

- 新增資料表 / 實體，或為實體加欄位、索引、關聯。
- 判斷一個概念該是實體、值物件、還是 JSON 欄位。
- 設計狀態轉換、業務不變條件（invariant）。
- 決定資料是否屬於某公司（租戶）、是否要軟刪除。

## 2. 固定規則

### 2.1 基底類別與介面（定義見 references §1）

1. **MUST** 所有實體實作 `IEntity`（透過繼承 `EntityBase`）；snake_case 轉換只作用於 `IEntity`。
2. **MUST** 依資料性質選基底類別：

| 資料性質 | 基底類別 | 取得的欄位 |
|----------|----------|------------|
| 公司的業務資料（訂單、客戶、出貨…）**預設** | `CompanyEntity` | Id、審計 4 欄、CompanyId、IsDeleted、DeletedAt |
| 全公司共用的參照資料（國家、系統內建範本） | `AuditedEntity` | Id、審計 4 欄 |
| 純技術性、只增不改的記錄（keystroke log 類、多對多連結表） | `EntityBase` | Id |

3. **MUST** 主鍵為 `int Id`、`IsPrimaryKey = true, IsIdentity = true`（參考專案作法；PostgreSQL 為 identity 欄位）。
4. **MUST** 外鍵屬性命名 `<Entity>Id`（`OrderId`、`CompanyId`），型別與對方主鍵一致（`int`）。
5. **MUST NOT** 使用 `required` 成員；所有非 null 屬性給預設值（`string.Empty`、`DateTime.UtcNow`、enum 預設成員）。
6. **MUST** 屬性為 `public get; set;`（SqlSugar 需要可寫屬性來物化資料）。不變條件由**工廠方法與行為方法**守護，服務層**MUST NOT** 直接改狀態欄位繞過行為方法。

### 2.2 審計欄位

7. **MUST** 審計欄位名稱固定：`CreatedAt`、`CreatedBy`、`UpdatedAt`、`UpdatedBy`（`IAuditable`）。
8. **MUST** 審計欄位由 `SqlSugarSetup` 的 `DataExecuting` AOP 自動填入；**MUST NOT** 在服務中手動賦值（BulkCopy 例外，見 elf-sqlsugar）。
9. **MUST** 時間一律 UTC（`DateTime.UtcNow`），欄位 `timestamptz`。**MUST NOT** 使用 `DateTime.Now`。
10. `CreatedBy` / `UpdatedBy` 為 `int?` 使用者 Id；系統 / 背景工作寫入時為 `null`。

### 2.3 多租戶邊界（`ICompanyEntity`）

11. **MUST** 任何屬於某公司的資料列實作 `ICompanyEntity`（含聚合內的**子實體**，例如 `OrderLine` 也要有 `CompanyId`），
    讓直接查子表時仍被租戶過濾器保護。
12. **MUST** `CompanyId` 由 AOP 在新增時填入、標 `IsOnlyIgnoreUpdate = true`；**MUST NOT** 從 request body 接收 `CompanyId`。
13. **MUST** 租戶資料表的查詢索引以 `CompanyId` 為第一欄（例：`ix_orders_company_created (company_id, created_at desc)`）。
14. **MUST** 唯一鍵在租戶內唯一時，唯一索引包含 `CompanyId`（例：`ux_customers_company_code (company_id, code)`）。
15. **MUST NOT** 讓一個聚合跨越多個公司；跨公司的關聯只能指向非租戶的參照資料。

### 2.4 軟刪除（`ISoftDelete`）

16. **MUST** 使用者可「刪除」的業務資料實作 `ISoftDelete`（`IsDeleted` + `DeletedAt`）；全域過濾器自動隱藏已刪除列。
17. **MUST** 刪除以 elf-sqlsugar §3.5 的 `SoftDeleteAsync<T>` 執行；**MUST NOT** 對 `ISoftDelete` 實體用 `Deleteable`。
18. 軟刪除實體上的唯一索引會把已刪除的列也算進去；需要「刪除後可重建同代碼」時，唯一索引改為 PostgreSQL partial index（`WHERE is_deleted = false`），以手寫 SQL 建立（見 elf-postgresql）。

### 2.5 聚合

19. **MUST** 一個聚合一個檔案，檔名 = 聚合根名稱（`Models/Order.cs` 內含 `Order`、`OrderLine`、`OrderStatus`）。
20. **MUST** 子實體只透過聚合根的服務修改；**MUST NOT** 為子實體另開可直接寫入的 endpoint。
21. **MUST** 聚合根到子實體用 `[Navigate(NavigateType.OneToMany, nameof(Child.ParentId))] public List<Child>? Children { get; set; }`（參考專案寫法），載入用 `.Includes(...)`。
22. **MUST** 修改聚合（根 + 子）的多個寫入包在同一個交易（elf-sqlsugar §3.3）。
23. **MUST** 聚合之間只以 Id 參照（`CustomerId`），**MUST NOT** 在一個聚合裡放另一個聚合根的導覽屬性並一起寫入。

### 2.6 工廠方法與行為方法

24. **MUST** 每個聚合根與子實體提供 `public static T Create(...)`，在其中驗證必要參數（`ArgumentException.ThrowIfNullOrWhiteSpace`、`ArgumentOutOfRangeException.ThrowIfNegativeOrZero`）並設定初始狀態。
25. **MUST** 狀態轉換寫成實體上的方法；**預期中的拒絕**（狀態不允許）回傳 `bool`（`TryPlace()`），由服務轉成結果 enum → endpoint 以 ProblemDetails 回 409（elf-dotnet §2.5）。只有「程式錯誤」才 throw。
26. enum：封閉集合用 C# enum，**MUST** 每個成員明寫數值（`Draft = 0, Placed = 1`），只可新增、不可重排或改值。
    這條同時適用於**存進資料庫的 enum** 與**服務回傳的結果 enum**（`PlaceResult`、`CreateXResult`）——後者雖不入庫，
    但會出現在 log 與測試斷言中，明寫數值可避免重排後意義悄悄改變。
    可由使用者或資料擴充的分類用 `string` 代碼（`Length = 32`），如參考專案 `Category.Kind`。

### 2.7 值物件

27. **MUST** 值物件為不可變型別：`readonly record struct`（小、無身分）或 `sealed record`；建構子驗證，運算回傳新實例。
28. **MUST** 值物件持久化為擁有者實體上的**原始欄位**（`Money` → `TotalAmount` + `Currency`），並在實體上提供 `[SugarColumn(IsIgnore = true)]` 的組合屬性與 `SetX(ValueObject)` 方法。
29. **MUST** 預設以**欄位或子表**建模，不用 `jsonb`。只有同時符合下列三項時才用 `jsonb`（`IsJson = true, ColumnDataType = "jsonb"`）：
    (a) 鍵 / 結構由外部來源或使用者決定，無法事先列成欄位；
    (b) 程式碼中**沒有**以其內容篩選、排序、join 或建索引的查詢；
    (c) 永遠整包讀、整包寫。
    任何一項不符 → 拆成欄位或子表。之後若出現以其內容查詢的需求，先改為欄位；確實無法時才依 elf-postgresql 規則 18 建 GIN 索引。

### 2.8 Repository、領域事件

30. **MUST** 服務直接注入 `ISqlSugarClient` 存取資料（參考專案作法）；**MUST NOT** 新增泛型 `IRepository<T>` / `UnitOfWork` 包裝層。
31. 領域事件：**目前不採用**。副作用（寄信、通知、寫其他聚合）由服務在交易 **commit 之後**顯式呼叫。**MUST NOT** 自行引入 MediatR 或事件匯流排（見待確認）。

## 3. 標準範本

完整可編譯範本見 [`references/entity-templates.md`](references/entity-templates.md)：
`EntityContracts.cs`（介面 + 三個基底類別）、`Order.cs`（聚合根 + 子實體 + enum + jsonb + 工廠 / 行為方法）、
`Money.cs`（值物件）、`Country`（非租戶參照資料）、聚合載入與狀態轉換服務。
（已於 net10.0 + SqlSugarCore 5.1.4.221 編譯通過。）

最小範例（租戶業務資料）：

```csharp
using SqlSugar;

namespace Acme.Api.Models;

[SugarTable("Customers")]
[SugarIndex("ux_customers_company_code", nameof(CompanyId), OrderByType.Asc, nameof(Code), OrderByType.Asc, true)]
public class Customer : CompanyEntity
{
    [SugarColumn(Length = 32)]
    public string Code { get; set; } = string.Empty;

    [SugarColumn(Length = 128)]
    public string Name { get; set; } = string.Empty;

    [SugarColumn(Length = 256, IsNullable = true)]
    public string? Email { get; set; }

    public static Customer Create(string code, string name, string? email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new Customer { Code = code.Trim(), Name = name.Trim(), Email = email?.Trim() };
    }
}
```

新增後務必：加入 `SqlSugarSetup.Entities`、寫測試（`Create` 的驗證、行為方法的狀態轉換）。

## 4. 檢查清單

- [ ] 繼承正確的基底類別（業務資料預設 `CompanyEntity`）
- [ ] `[SugarTable("PluralPascal")]`；已加入 `SqlSugarSetup.Entities`
- [ ] 沒有 `required`；非 null 屬性都有預設值
- [ ] 字串都有 `Length` 或 `text`；nullable 欄位有 `?` + `IsNullable = true`
- [ ] 時間欄位 UTC + `timestamptz`
- [ ] 子實體也有 `CompanyId`（若聚合屬於租戶）
- [ ] 索引以 `CompanyId` 開頭；租戶內唯一鍵包含 `CompanyId`
- [ ] 有 `Create(...)` 工廠方法；狀態轉換在實體方法中，預期拒絕回 `bool`
- [ ] enum 成員明寫數值（含服務回傳的結果 enum）
- [ ] 值物件不可變，持久化為原始欄位 + `IsIgnore` 組合屬性
- [ ] 沒有新增泛型 Repository / UnitOfWork / MediatR
- [ ] 實體沒有被直接當作 API request / response（改用 DTO，見 elf-api-contract）
- [ ] 有單元測試（elf-unit）與租戶 / 軟刪除整合測試（elf-integration）

## 5. 常見錯誤

| 錯誤 | 正確 |
|------|------|
| `public required string Name { get; set; }` | `public string Name { get; set; } = string.Empty;` |
| 屬性名 `Word` 放在 class `Word` 裡 | C# 不允許成員與型別同名；改 `Text`（參考專案實例） |
| `OrderLine` 沒有 `CompanyId`，靠 join `Order` 判斷租戶 | 子實體也繼承 `CompanyEntity` |
| request DTO 帶 `CompanyId` 並寫入 | `CompanyId` 由 AOP 從目前租戶填入 |
| `CreatedAt = DateTime.Now` | 交給 AOP；需要時用 `DateTime.UtcNow` |
| `order.Status = OrderStatus.Placed;` 寫在服務裡 | `order.TryPlace()`，規則在實體 |
| 狀態不允許時 `throw new InvalidOperationException` | 回傳 `false` / 結果 enum，endpoint 回 409 |
| enum 不寫值，後來在中間插入新成員 | 每個成員明寫數值，只在尾端新增 |
| `ux_customers_code (code)` 在租戶資料上 | `ux_customers_company_code (company_id, code)` |
| 把可查詢的欄位塞進 `jsonb` | 需要查詢 / 索引的拆成欄位 |
| 為了「以後可能會加欄位」先用 `jsonb` | 預設欄位 / 子表；只在規則 29 三項都成立時用 `jsonb` |
| 新增 `IRepository<T>`、`UnitOfWork` | 服務直接用 `ISqlSugarClient` |

## 6. 待確認

- 主鍵型別：目前 `int` identity（參考專案）；大量資料表是否改 `long`，或採 `Guid`（PostgreSQL 18 內建 `uuidv7()`）。
- `CompanyId` 型別（目前 `int`）。租戶來源的 Claim 名稱已定為 `ElfClaimTypes.CompanyId = "company_id"`（見 elf-sqlsugar references §1）；JWT 簽發方式仍取決於 elf-dotnet 的認證設計。
- 軟刪除是否需要 `DeletedBy` 欄位；已刪除資料的保留 / 清除期限。
- 領域事件機制（是否導入、採 in-process 或 outbox）。
- SqlSugar `IsOwnsOne`（5.1.4.221 已有此屬性）是否可取代「值物件拆原始欄位」作法——需實測後決定。
- SqlSugar 是否支援 `private set` 物化；若支援，是否改為私有 setter 強化封裝。
- 何時從單一 `<App>.Api` 拆出獨立 Domain 專案（見 elf-dotnet）。
