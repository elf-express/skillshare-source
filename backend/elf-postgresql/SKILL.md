---
name: elf-postgresql
description: |
  Elf Express PostgreSQL 18 資料庫規範。當任務涉及資料表 / 欄位 / 索引命名（snake_case）、C# 型別對應 PostgreSQL 型別、
  timestamptz 與 UTC 時間處理、jsonb、連線字串格式（Npgsql）、本機 docker compose postgres:18、
  CodeFirst 結構變更與手寫遷移 SQL、schema 匯出審查、索引設計、備份還原（pg_dump / pg_restore）時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express PostgreSQL 18 規範（elf-postgresql）

背景：參考專案 `TypingTrainer` 使用 SQLite；團隊標準資料庫為 **PostgreSQL 18**。本 skill 定義資料庫端規則；
C# 端寫法見 **elf-sqlsugar**，實體設計見 **elf-domain-modeling**，版本見 **elf-stack**。
本 skill 只寫得出理由的規則；無法驗證的列在「待確認」。

## 1. 何時使用

- 新增 / 修改資料表、欄位、索引。
- 設定連線字串、本機資料庫、CI 測試資料庫。
- 處理時間、JSON、金額欄位。
- 需要改名、刪欄位、改型別等 CodeFirst 做不到的結構變更。
- 備份、還原、匯出 schema。

## 2. 固定規則

### 2.1 命名

1. **MUST** 資料表、欄位、索引名稱全部**小寫 snake_case**。
   理由：PostgreSQL 會把未加引號的識別字轉小寫；大小寫混用的名稱之後每次手寫 SQL 都得加雙引號。
2. **MUST** 表名為複數：`orders`、`order_lines`。由 C# `[SugarTable("OrderLines")]` 經 SqlSugar `ToUnderLine` 自動產生（elf-sqlsugar §2.1）。
3. **MUST** 主鍵欄位 `id`；外鍵欄位 `<單數表名>_id`（`order_id`、`company_id`）。
4. **MUST** 索引命名：唯一 `ux_<table>_<cols>`、一般 `ix_<table>_<cols>`、partial / 特殊用途同規則再加描述（`ux_customers_company_code_active`）。
5. **MUST NOT** 使用 PostgreSQL 保留字當名稱（`user`、`order`、`group`、`table`）；表名因為是複數（`users`、`orders`）通常可避開，欄位遇到時改名（`order` → `sort_order`）。
6. **MUST** 使用預設 schema `public`（多 schema 規劃「待確認」）。

### 2.2 型別對應

| C# | SqlSugar 標註 | PostgreSQL |
|----|---------------|------------|
| `int` | — | `integer` |
| `int` 主鍵 | `IsPrimaryKey = true, IsIdentity = true` | `integer generated ... as identity`（`PostgresIdentityStrategy.Identity`） |
| `long` | — | `bigint` |
| `bool` | — | `boolean` |
| `string`（有上限） | `Length = n` | `varchar(n)` |
| `string`（無上限） | `ColumnDataType = "text"` | `text` |
| `decimal`（金額） | `Length = 18, DecimalDigits = 2` | `numeric(18,2)` |
| `decimal`（單價、可小數的數量） | `Length = 18, DecimalDigits = 4` | `numeric(18,4)` |
| `decimal`（匯率、比率） | `Length = 18, DecimalDigits = 6` | `numeric(18,6)` |
| `DateTime`（時間點） | `ColumnDataType = "timestamptz"` | `timestamptz` |
| enum | — | `integer`（成員明寫數值，見 elf-domain-modeling） |
| 物件 / 集合 | `IsJson = true, ColumnDataType = "jsonb"` | `jsonb` |
| `Guid` | — | `uuid` |

7. **MUST** 金額用 `numeric`，**MUST NOT** 用 `real` / `double precision`（浮點誤差）。
8. **MUST** JSON 用 `jsonb`，**MUST NOT** 用 `json` 或把 JSON 存成 `text`（`jsonb` 可建 GIN 索引、可用 `@>` 查詢）。
9. **MUST NOT** 用 `varchar` 無長度；要無上限就明確用 `text`。

### 2.3 時間

10. **MUST** 表示「某個時刻」的欄位一律 `timestamptz`，應用程式寫入 **UTC**（`DateTime.UtcNow`）。
11. **MUST** 連線字串帶 `Timezone=UTC`，讓 session 時區為 UTC。
    理由：SqlSugar 傳 `DateTime` 參數時，PostgreSQL 若把它當 `timestamp` 轉成 `timestamptz`，會依 session 時區解讀；session 為 UTC 才不會位移。
12. **MUST** 從資料庫讀出的 `DateTime` 在轉成 DTO 前經過 `UtcTime.Normalize(...)`（§3.4）。
    理由：目前 SqlSugarCore 帶入的 **Npgsql 5.0.18** 讀 `timestamptz` 會依 **.NET 行程所在時區**回傳本機時間（`Kind = Local`）；
    Windows 開發機（UTC+8）與 UTC 容器會得到不同值。`Normalize` 在兩種情況下都回傳正確的 UTC。
13. **MUST** API 容器設定 `TZ=UTC`（elf-cicd-docker 的 `api.Dockerfile` 與 compose 已設定）；注意 Windows 上 .NET **不讀** `TZ` 環境變數，所以規則 12 不可省略。
14. 只有「日期」沒有時刻的欄位（生日、會計日）用 `date`（C# `DateOnly` 支援度「待確認」，先以 `DateTime` + `ColumnDataType = "date"`）。

### 2.4 索引與約束

15. **MUST** 每個外鍵欄位建立索引。理由：PostgreSQL **不會**自動為外鍵欄位建索引，join 與父列刪除都會掃全表。
16. **MUST** 租戶資料表的索引以 `company_id` 為第一欄；租戶內唯一鍵包含 `company_id`。
17. **MUST** 軟刪除表若需「刪除後可重建同代碼」，唯一索引用 partial index：`... WHERE is_deleted = false`（手寫 SQL，§2.5）。
18. **MUST** `jsonb` 的 GIN 索引依下列規則決定，**MUST NOT** 預先為所有 `jsonb` 建索引：
    - 程式碼中**有**以 `@>`（包含）查詢該欄位 → 建 `USING gin (<col> jsonb_path_ops)`；
    - 有以 `?` / `?|` / `?&`（鍵存在）查詢 → 建 `USING gin (<col>)`（預設 `jsonb_ops`，`jsonb_path_ops` 不支援這些運算子）；
    - 只以單一路徑等值查詢（`<col> ->> 'key' = @v`）→ 不建 GIN，改建運算式 B-tree 索引 `((<col> ->> 'key'))`；
    - 沒有上述任何查詢 → 不建。
    GIN / 運算式索引 CodeFirst 建不出來，一律寫手寫遷移 SQL（§2.5、§3.5）。依 elf-domain-modeling 規則 29，出現這類查詢時應先考慮把該鍵改成一般欄位。
19. 注意：SqlSugar CodeFirst **不建立外鍵約束**（參考專案產生的 DDL 中沒有任何 FOREIGN KEY）；是否以手寫 SQL 補外鍵約束「待確認」。

### 2.5 結構變更（遷移）

20. **MUST** 新增表 / 新增欄位 / 一般索引：交給 CodeFirst（`db.CodeFirst.InitTables(Entities)`，見 elf-sqlsugar）。
    CodeFirst 只在**非 Production** 啟動時自動執行；Production 由部署步驟以 owner 帳號 + `Database__RunCodeFirst=true` 一次性執行（elf-sqlsugar references §2.1），應用程式平常的帳號沒有 DDL 權限（規則 28）。
21. **MUST** 欄位改名：`[SugarColumn(OldColumnName = "old_snake_name")]`，上線並確認後再移除該標註。
22. **MUST NOT** 期待 CodeFirst 刪欄位、改型別、縮短長度、建 partial / GIN 索引、建外鍵約束；這些寫成**手寫 SQL 腳本**：
    `server/db/migrations/<yyyyMMdd>_<nn>_<snake_description>.sql`，腳本必須可重複執行（`IF NOT EXISTS` / `IF EXISTS`）。
23. **MUST** 每次實體有變動，重新匯出 schema 並 commit：`server/db/schema.sql`（§3.3 指令）。PR review 以此檔 diff 審查結構變更（參考專案 `npm run db:schema` 的作法）。該檔**只能由指令產生，不可手改**。
24. **MUST NOT** 在正式環境讓應用程式執行 `CREATE DATABASE`；`DbMaintenance.CreateDatabase()` 只在 Development 執行（elf-sqlsugar references）。

### 2.6 連線與帳號

25. **MUST** 連線字串格式（Npgsql）：
    `Host=<host>;Port=5432;Database=<app>;Username=<app>;Password=<secret>;Timezone=UTC`
26. **MUST** 連線字串經 `ConnectionStrings__Default` 環境變數注入；只有本機 docker 開發帳密可以出現在 `appsettings.json`（elf-dotnet §2.4）。
27. **MUST** 資料庫名稱與帳號名稱 = 產品代號小寫（`acme`）。
28. **MUST NOT** 在非本機環境以 `postgres` 超級使用者連線。Production 分兩個帳號：
    - **owner 帳號**（擁有 schema，可 DDL）：只給部署步驟使用（CodeFirst 一次性執行、手寫遷移 SQL）；
    - **應用程式帳號**（`ConnectionStrings__Default` 平常用的）：只有資料表的 `SELECT / INSERT / UPDATE / DELETE`，**沒有** `CREATE` 與任何 DDL 權限。
    確切 GRANT 腳本與是否用多 schema 仍「待確認」。

### 2.7 備份

29. **MUST** 邏輯備份使用自訂格式：`pg_dump -Fc`；還原用 `pg_restore`（§3.6）。
30. **MUST** 備份檔不得放在與資料庫同一個 volume。
31. 排程、保留期限、是否啟用 WAL 歸檔 / PITR：「待確認」。

## 3. 標準範本

### 3.1 本機開發 `docker/docker-compose.dev.yml`

只給本機開發用（只有資料庫，API 在 IDE 跑）。服務名與帳密來源和部署 compose 一致：服務 `postgres`、帳密取自 `docker/.env` 的 `POSTGRES_*`。

```yaml
# Local PostgreSQL for development only (the API runs from the IDE).
# Run from the repo root; docker/.env is git-ignored (copy docker/.env.example):
#   docker compose --env-file docker/.env -f docker/docker-compose.dev.yml up -d
services:
  postgres:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?set POSTGRES_DB in docker/.env}
      POSTGRES_USER: ${POSTGRES_USER:?set POSTGRES_USER in docker/.env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in docker/.env}
      TZ: UTC
    ports:
      - '5432:5432'
    volumes:
      # postgres:18 images keep data under /var/lib/postgresql/18/docker;
      # mount the parent so the major-version subdirectory is included.
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

本機的 `docker/.env` 填本機開發值（非機密），與 `appsettings.json` 的本機連線字串一致：

```ini
POSTGRES_DB=acme
POSTGRES_USER=acme
POSTGRES_PASSWORD=acme_dev
```

```json
"ConnectionStrings": {
  "Default": "Host=localhost;Port=5432;Database=acme;Username=acme;Password=acme_dev;Timezone=UTC"
}
```

本機值若不同，以環境變數 `ConnectionStrings__Default` 覆寫，不要改 commit 進去的 `appsettings.json`。

### 3.2 部署（API + DB 一起跑）

部署用 compose **只有一份**：elf-cicd-docker 的 `docker/docker-compose.yml`（服務 `postgres` / `api` / `web`，帳密同樣來自 `docker/.env` 的 `POSTGRES_*`，
api 連線字串 `Host=postgres;...;Timezone=UTC`、api 容器 `TZ=UTC`）。本 skill 不另提供部署 compose；資料庫端規則（volume 路徑、healthcheck、帳號）以本 skill 為準。

### 3.3 匯出 schema（review 用）

```bash
docker compose --env-file docker/.env -f docker/docker-compose.dev.yml exec -T postgres \
  pg_dump -U acme -d acme --schema-only --no-owner --no-privileges \
  > server/db/schema.sql
```

先啟動 API 一次（讓 CodeFirst 建好表）再匯出。檢查重點：表 / 欄位 / 索引皆 snake_case、時間欄位為 `timestamp with time zone`、JSON 欄位為 `jsonb`。

### 3.4 `UtcTime.Normalize`（放 `server/src/<App>.Api/Data/UtcTime.cs`）

```csharp
namespace Acme.Api.Data;

/// <summary>
/// Npgsql 5 returns timestamptz values converted to the process's local zone (Kind = Local).
/// Everything this app writes is UTC, so Unspecified is treated as UTC too.
/// </summary>
public static class UtcTime
{
    public static DateTime Normalize(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    public static DateTime? Normalize(DateTime? value) => value is null ? null : Normalize(value.Value);
}
```

使用：`new OrderDto(o.Id, o.Name, o.Quantity, UtcTime.Normalize(o.CreatedAt))`。

### 3.5 手寫遷移腳本範例 `server/db/migrations/20260927_01_customers_code_partial_unique.sql`

```sql
-- Allow a soft-deleted customer's code to be reused within the same company.
DROP INDEX IF EXISTS ux_customers_company_code;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_company_code_active
    ON customers (company_id, code)
    WHERE is_deleted = false;
```

> 若改用 partial index，須同時移除實體上的 `[SugarIndex("ux_customers_company_code", ...)]`，否則下次啟動 CodeFirst 會把舊索引建回來。

### 3.6 備份與還原

```bash
# Backup (custom format, compressed)
docker compose --env-file docker/.env -f docker/docker-compose.dev.yml exec -T postgres \
  pg_dump -U acme -d acme -Fc > backup/acme_$(date +%Y%m%d_%H%M).dump

# Restore into an empty database
docker compose --env-file docker/.env -f docker/docker-compose.dev.yml exec -T postgres \
  pg_restore -U acme -d acme --clean --if-exists --no-owner < backup/acme_20260927_0300.dump
```

## 4. 檢查清單

- [ ] 表 / 欄位 / 索引名稱皆小寫 snake_case（以 `schema.sql` 確認）
- [ ] 表名複數；外鍵 `<x>_id` 且有索引
- [ ] 時間欄位 `timestamptz`；連線字串含 `Timezone=UTC`；讀出轉 DTO 時經 `UtcTime.Normalize`
- [ ] 金額 `numeric(18,2)`；JSON 為 `jsonb`；沒有無長度 `varchar`
- [ ] 租戶表索引以 `company_id` 開頭
- [ ] CodeFirst 做不到的變更已寫成可重複執行的 `server/db/migrations/*.sql`
- [ ] `server/db/schema.sql` 已重新匯出並 commit
- [ ] 本機 / CI 使用 `postgres:18`，volume 掛在 `/var/lib/postgresql`
- [ ] 沒有把正式密碼寫進 compose 或 appsettings（compose 用 `${POSTGRES_PASSWORD:?}` 取自 `docker/.env`；API 用 `ConnectionStrings__Default` 環境變數）
- [ ] 本機 / 部署 compose 的資料庫服務名都是 `postgres`
- [ ] `jsonb` GIN 索引只在有 `@>` / `?` 查詢時建立（規則 18）
- [ ] Production 應用程式帳號沒有 DDL 權限；CodeFirst 只由部署步驟以 owner 帳號執行
- [ ] 整合測試跑在真的 PostgreSQL 18（不可用 SQLite 代替），涵蓋時間讀寫往返

## 5. 常見錯誤

| 錯誤 | 正確 |
|------|------|
| 表名 `"OrderLines"`（帶引號、大小寫混用） | `order_lines` |
| 欄位 `createdat`（只轉小寫、沒加底線） | 設定 ToUnderLine → `created_at` |
| `DateTime.Now` 寫入 | `DateTime.UtcNow` |
| 讀出的時間直接序列化給前端，開發機差 8 小時 | `UtcTime.Normalize` |
| 連線字串沒有 `Timezone=UTC` | 加上 |
| `volumes: - pgdata:/var/lib/postgresql/data`（沿用 17 以前的寫法） | `postgres:18` 掛 `/var/lib/postgresql` |
| `image: postgres:latest` | `postgres:18` |
| 刪掉實體屬性，以為欄位會被刪 | CodeFirst 不刪欄位；寫遷移 SQL |
| 外鍵欄位沒有索引 | PostgreSQL 不會自動建，必須加 `[SugarIndex]` |
| 金額用 `double` | `decimal` + `numeric(18,2)` |
| 用 SQLite in-memory 測 PostgreSQL 行為 | 用 Testcontainers 啟動的 `postgres:18`（elf-integration） |
| 本機 compose 服務叫 `db`、帳密寫死在 yml | 服務 `postgres`，帳密取自 `docker/.env` 的 `POSTGRES_*` |
| 為每個 `jsonb` 欄位先建 GIN 索引 | 依規則 18：有 `@>` / `?` 查詢才建 |

## 6. 待確認

- 遷移腳本的執行方式（部署流程手動執行、啟動時由程式執行、或採用 migration 工具）與版本紀錄表。
- 是否以手寫 SQL 補外鍵約束（CodeFirst 不建立）。
- 正式環境帳號的確切 GRANT 腳本、是否使用多個 schema（owner / 應用程式帳號分離本身已決定，見規則 28）。
- 備份排程、保留期限、WAL 歸檔 / PITR、還原演練頻率；託管平台（自架或雲端）。
- `postgres:18` 是否釘 minor 或 OS 變體（見 elf-stack）。
- 是否升級 Npgsql（6+ 的時間行為不同，規則 11–13 需重新驗證；SqlSugar 在 Npgsql 6+ 會預設開啟 `Npgsql.EnableLegacyTimestampBehavior`）。
- `DateOnly` / `TimeOnly` 在 SqlSugarCore 5.1.4.x + Npgsql 5 的支援度。
- 連線池大小（`Maximum Pool Size`）等效能參數的團隊預設值。
- 本 skill 的 postgres:18 volume 路徑與 Npgsql 5 時間行為是依官方文件 / 版本說明撰寫，尚未在團隊環境實測；首次導入時以整合測試確認。
