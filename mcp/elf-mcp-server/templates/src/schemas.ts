import { z } from "zod";

// ---------------------------------------------------------------------------
// zod schemas — module level (NOT inside createServer; see dd4853a), all .strict(), every field bounded + described.
// ---------------------------------------------------------------------------

export const ListInputSchema = z
  .object({
    filter: z.string().max(100).optional().describe("選填:只列出檔名包含此字串的文件(不分大小寫)"),
  })
  .strict();

export const SearchInputSchema = z
  .object({
    query: z.string().min(1, "查詢字串不可為空").max(200, "查詢字串不可超過 200 字元")
      .describe("關鍵字,以空白分隔可指定多個關鍵字 (AND,需全部出現於同一篇文件)"),
    limit: z.number().int().min(1).max(50).default(15).describe("最多回傳幾篇命中的文件 (預設 15)"),
    context_lines: z.number().int().min(0).max(5).default(1).describe("每個命中片段前後附帶的上下文行數 (預設 1)"),
  })
  .strict();

export const ReadInputSchema = z
  .object({
    filename: z.string().min(1, "filename 不可為空").max(300)
      .describe('文件檔名或相對路徑,可省略 .md。支援模糊比對 (結尾 / 包含)。例如 "<real-file>" 或 "<category>/<real-file>.md"'),
  })
  .strict();
