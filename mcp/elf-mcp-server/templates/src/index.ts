#!/usr/bin/env node
/**
 * <Server Title> — MCP server (template generalised from elf-express/mcp-library docs-mcp-server/src/index.ts)
 *
 * Tools (all read-only; KEEP THIS LIST IN SYNC — evidence E8/E9: stale tool lists were shipped twice):
 *   - <domain>_list    list documents (optional filter)
 *   - <domain>_search  keyword AND search with line-numbered snippets
 *   - <domain>_read    read one document (fuzzy filename match)
 *
 * Transports: stdio (default) or http (TRANSPORT=http, Streamable HTTP).
 * Data dir: <ENV_DATA_DIR> → bundled <data-dir>/ → server root's parent.
 * Auth (http): if MCP_AUTH_TOKEN is set, /mcp* requires "Authorization: Bearer <token>". /health is always public.
 * Logging: stderr ONLY (console.error). stdout belongs to the stdio JSON-RPC stream.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runHttp } from "./http.js";
import { listFiles, resolveDataDir, doList, doSearch, doRead } from "./knowledge.js";

const LOG = "[<server-name>]";

// ---------------------------------------------------------------------------
// zod schemas — module level (NOT inside createServer; see dd4853a), all .strict(), every field bounded + described.
// ---------------------------------------------------------------------------

const ListInputSchema = z
  .object({
    filter: z.string().max(100).optional().describe("選填:只列出檔名包含此字串的文件(不分大小寫)"),
  })
  .strict();

const SearchInputSchema = z
  .object({
    query: z.string().min(1, "查詢字串不可為空").max(200, "查詢字串不可超過 200 字元")
      .describe("關鍵字,以空白分隔可指定多個關鍵字 (AND,需全部出現於同一篇文件)"),
    limit: z.number().int().min(1).max(50).default(15).describe("最多回傳幾篇命中的文件 (預設 15)"),
    context_lines: z.number().int().min(0).max(5).default(1).describe("每個命中片段前後附帶的上下文行數 (預設 1)"),
  })
  .strict();

const ReadInputSchema = z
  .object({
    filename: z.string().min(1, "filename 不可為空").max(300)
      .describe('文件檔名或相對路徑,可省略 .md。支援模糊比對 (結尾 / 包含)。例如 "<real-file>" 或 "<category>/<real-file>.md"'),
  })
  .strict();

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function createServer(_scope?: string): McpServer {
  const server = new McpServer({ name: "<server-name>", version: "1.0.0" });

  server.registerTool(
    "<domain>_list",
    {
      title: "列出 <Domain> 文件",
      description:
        "列出本 server 所有 <Domain> 文件的檔名(含分類路徑)。\n\n" +
        "用途:還不知道有哪些文件時的入口;知道關鍵字時改用 <domain>_search。\n\n" +
        "參數:\n  - filter (string,選填):只列出檔名包含此字串的文件。\n\n" +
        "回傳:Markdown 檔名清單。\n\n" +
        '範例:filter="<real-keyword>"',
      inputSchema: ListInputSchema.shape,
      annotations: READ_ONLY,
    },
    async (p) => textResult(doList(p.filter))
  );

  server.registerTool(
    "<domain>_search",
    {
      title: "搜尋 <Domain> 文件",
      description:
        "對所有 <Domain> 文件做關鍵字全文搜尋,回傳命中的檔名與片段。\n\n" +
        "用途:當你需要知道「<Domain> 怎麼做某件事」時,先用此工具找出相關文件。\n\n" +
        "參數:\n" +
        "  - query (string):關鍵字,空白分隔多個關鍵字時全部出現才命中 (AND)。\n" +
        "  - limit (number):最多回傳幾篇,1-50,預設 15。\n" +
        "  - context_lines (number):片段上下文行數,0-5,預設 1。\n\n" +
        "回傳:Markdown,依命中次數排序,列出檔名、命中次數與含關鍵字片段 (附行號)。\n\n" +
        '範例:query="<real-keyword-1>" / query="<real-keyword-2> <real-keyword-3>"',
      inputSchema: SearchInputSchema.shape,
      annotations: READ_ONLY,
    },
    async (p) => textResult(doSearch(p.query, p.limit, p.context_lines))
  );

  server.registerTool(
    "<domain>_read",
    {
      title: "讀取 <Domain> 文件全文",
      description:
        "依檔名回傳一篇 <Domain> 文件的完整 markdown 內容。\n\n" +
        "參數:\n  - filename (string):檔名或相對路徑,.md 可省略,支援模糊比對。\n\n" +
        "回傳:該文件完整內容。多筆符合時回傳候選清單;無符合時回傳提示。\n\n" +
        '範例:filename="<real-file>"',
      inputSchema: ReadInputSchema.shape,
      annotations: READ_ONLY,
    },
    async (p) => textResult(doRead(p.filename))
  );

  return server;
}

function logStartupInfo(): void {
  const files = listFiles();
  console.error(LOG + " data dir: " + resolveDataDir());
  console.error(LOG + " loaded " + files.length + " documents");
  if (files.length === 0) console.error(LOG + " WARNING: no documents found. Set <ENV_DATA_DIR>.");
}

async function runStdio(): Promise<void> {
  logStartupInfo();
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error(LOG + " started over stdio");
}

const transport = (process.env.TRANSPORT || "stdio").toLowerCase();
const boot =
  transport === "http"
    ? runHttp(createServer, {
        healthInfo: () => ({ docs: listFiles().length }),
        hasScope: () => false, // no scoped endpoints in this template; /mcp/<x> → 404
      })
    : runStdio();
boot.catch((err) => {
  console.error(LOG + " failed to start:", err);
  process.exit(1);
});
