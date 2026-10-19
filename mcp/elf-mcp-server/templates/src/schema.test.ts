import { describe, expect, it } from "vitest";
import { ListInputSchema, SearchInputSchema, ReadInputSchema } from "./schemas.js";

describe("input schema migration", () => {
  it("reports v4 invalid_type issue", () => {
    const result = SearchInputSchema.safeParse({ query: 123 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected invalid query");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "invalid_type", expected: "string", path: ["query"] });
    expect(result.error.issues[0].message.length).toBeGreaterThan(0);
    expect("errors" in result.error).toBe(false);
  });

  it("keeps the empty-query message and v4 origin", () => {
    const result = SearchInputSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected empty query rejection");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({
      code: "too_small", minimum: 1, inclusive: true, origin: "string",
      path: ["query"], message: "查詢字串不可為空",
    });
    expect("errors" in result.error).toBe(false);
  });

  it("keeps the long-query message and v4 origin", () => {
    const result = SearchInputSchema.safeParse({ query: "x".repeat(201) });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected long query rejection");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({
      code: "too_big", maximum: 200, origin: "string", path: ["query"], message: "查詢字串不可超過 200 字元",
    });
    expect("errors" in result.error).toBe(false);
  });

  it("rejects number bounds and fractions", () => {
    const cases = [
      { field: "limit", value: 0, code: "too_small" },
      { field: "limit", value: 51, code: "too_big" },
      { field: "limit", value: 1.5, code: "invalid_type" },
      { field: "context_lines", value: -1, code: "too_small" },
      { field: "context_lines", value: 6, code: "too_big" },
      { field: "context_lines", value: 1.5, code: "invalid_type" },
    ];
    for (const { field, value, code } of cases) {
      const result = SearchInputSchema.safeParse({ query: "x", [field]: value });
      expect(result.success, `${field}=${value}`).toBe(false);
      if (result.success) throw new Error("expected number rejection");
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject({ code, path: [field] });
    }
  });

  it("keeps filter and filename bounds", () => {
    const cases = [
      { schema: ListInputSchema, input: { filter: "x".repeat(101) }, issue: { code: "too_big", path: ["filter"], maximum: 100 } },
      { schema: ReadInputSchema, input: { filename: "" }, issue: { code: "too_small", path: ["filename"], minimum: 1, message: "filename 不可為空" } },
      { schema: ReadInputSchema, input: { filename: "x".repeat(301) }, issue: { code: "too_big", path: ["filename"], maximum: 300 } },
    ];
    for (const { schema, input, issue } of cases) {
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected string boundary rejection");
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject(issue);
    }
  });

  it("keeps defaults and accepted boundary values", () => {
    expect(SearchInputSchema.parse({ query: "x" })).toEqual({ query: "x", limit: 15, context_lines: 1 });
    expect(SearchInputSchema.parse({ query: "x".repeat(200), limit: 1, context_lines: 0 }))
      .toEqual({ query: "x".repeat(200), limit: 1, context_lines: 0 });
    expect(SearchInputSchema.parse({ query: "x", limit: 50, context_lines: 5 }))
      .toEqual({ query: "x", limit: 50, context_lines: 5 });
    expect(ListInputSchema.parse({ filter: "x".repeat(100) })).toEqual({ filter: "x".repeat(100) });
    expect(ReadInputSchema.parse({ filename: "x".repeat(300) })).toEqual({ filename: "x".repeat(300) });
  });

  it("rejects unknown keys using v4 issues", () => {
    const cases = [
      { schema: ListInputSchema, input: { typo: true } },
      { schema: SearchInputSchema, input: { query: "x", typo: true } },
      { schema: ReadInputSchema, input: { filename: "alpha", typo: true } },
    ];
    for (const { schema, input } of cases) {
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected unknown-key rejection");
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject({ code: "unrecognized_keys", keys: ["typo"], path: [] });
      expect(result.error.issues[0].message).toContain("typo");
      expect("errors" in result.error).toBe(false);
    }
  });

  it("keeps every field description", () => {
    expect(ListInputSchema.shape.filter.description).toBe("選填:只列出檔名包含此字串的文件(不分大小寫)");
    expect(SearchInputSchema.shape.query.description).toBe("關鍵字,以空白分隔可指定多個關鍵字 (AND,需全部出現於同一篇文件)");
    expect(SearchInputSchema.shape.limit.description).toBe("最多回傳幾篇命中的文件 (預設 15)");
    expect(SearchInputSchema.shape.context_lines.description).toBe("每個命中片段前後附帶的上下文行數 (預設 1)");
    expect(ReadInputSchema.shape.filename.description).toBe('文件檔名或相對路徑,可省略 .md。支援模糊比對 (結尾 / 包含)。例如 "<real-file>" 或 "<category>/<real-file>.md"');
  });
});
