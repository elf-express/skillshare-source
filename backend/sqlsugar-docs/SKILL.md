---
name: sqlsugar-docs
description: Use when writing any SqlSugar ORM code — db.Queryable, Insertable, Updateable, Deleteable, CodeFirst, DbMaintenance, transactions, multi-tenant, or performance code. Trigger before writing implementation, not after. Use when unsure which method signature to use.
---

# SqlSugar Docs

## Iron Rule

**Read the doc BEFORE writing any SqlSugar code. Never guess method names or parameter types.**

This project uses **SQL Server** as the primary database. SQL Server-specific behavior (e.g. `nvarchar(max)` → Length=-1, `MS_Description` duplicates, `ROW_NUMBER()` paging) applies throughout.

## How to Look Up Docs

Use MCP tools in this order:

```
1. search_sqlsugar_docs(keyword)   → find relevant docs by keyword
2. get_sqlsugar_doc(filename)      → read the full doc
3. list_sqlsugar_docs()            → browse all 76 docs if unsure
4. get_sqlsugar_guide()            → AOP auto-fill, Repository, UoW patterns
```

**Examples:**
- Need paging? → `search_sqlsugar_docs("ToPageList")` → read `分頁查詢`
- Need bulk insert? → `search_sqlsugar_docs("BulkCopy")` → read `大數據寫入`
- Need LEFT JOIN? → `get_sqlsugar_doc("聯表查詢")`

## Scenario → Doc Quick Lookup

| I need to… | Read this doc |
|---|---|
| Query list + paging | `分頁查詢` |
| Dynamic WHERE (frontend params) | `Where用法`、`表格查詢WhereDynamicFilter` |
| LEFT JOIN / multi-table | `聯表查詢` |
| One-to-many with sub-records | `導航查詢` |
| UNION / UNION ALL | `並集查詢` |
| Tree / recursive query | `樹型查詢` |
| DB functions (DateDiff, IIF…) | `查詢函數SqlFunc` |
| Upsert (insert or update) | `插入或更新Storageable` |
| Bulk insert (BulkCopy) | `大數據寫入` |
| Optimistic lock / concurrency | `並發控制樂觀鎖` |
| Navigate insert/update/delete | `導航插入`、`導航更新`、`導航刪除` |
| Transaction | `事务用法`、`UnitOfWork工作單元` |
| CodeFirst / schema migration | `庫表管理DbMaintenance`、`實體管理EntityMaintenance` |
| No-entity dynamic CRUD | `動態建類CRUD`、`無實體查詢` |
| Multi-tenant / multi-DB | `多租戶基礎`、`SAAS分庫` |
| Query slow (index miss) | `字元索引優化` |
| High memory usage | `大數據寫入` (分批處理段落) |
| Thread safety / random errors | `偶發性錯誤與執行緒安全` |
| AOP audit / diff log | `AOP日誌` |
| Global soft-delete filter | `查詢過濾器` |
| 2nd-level cache | `二級緩存` |
| Auto sharding by date | `自動分表` |

## Common API Mistakes (SQL Server specific)

| Wrong | Correct |
|---|---|
| `ref int totalCount` (sync) | `RefAsync<int> total = 0` (async) |
| `ToPagedList` (not SqlSugar) | `ToPageList` |
| `GetCreateTableSql()` (doesn't exist) | `get_sqlsugar_doc("庫表管理DbMaintenance")` first |
| `Ado.GetInt()` guessing | `search_sqlsugar_docs("Ado")` to verify |
| `nvarchar(max)` as Length=4000 | Length = -1 for `nvarchar(max)` |

## Before You Write Code

```
□ Did I search/read the relevant SqlSugar doc?
□ Did I verify the method name exists in the doc (not guessed)?
□ Is the parameter type correct (ref vs RefAsync, int vs long)?
□ If SQL Server-specific: did I check for SQL Server behavior?
□ If unsure about anything: get_sqlsugar_doc() before proceeding
```

## Red Flags — Stop and Look Up the Doc

- "I think the method is called..."
- "It's probably similar to Entity Framework..."
- "Let me try and see if it compiles..."
- Writing SqlSugar code without reading the relevant doc first

**All of these mean: look up the doc first. Then write code.**
