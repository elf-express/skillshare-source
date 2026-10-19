import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Literal expectations copied from the pre-migration tool contract, not the server response.
const descriptions = [
  "列出本 server 所有 <Domain> 文件的檔名(含分類路徑)。\n\n" +
    "用途:還不知道有哪些文件時的入口;知道關鍵字時改用 <domain>_search。\n\n" +
    "參數:\n  - filter (string,選填):只列出檔名包含此字串的文件。\n\n" +
    '回傳:Markdown 檔名清單。\n\n範例:filter="<real-keyword>"',
  "對所有 <Domain> 文件做關鍵字全文搜尋,回傳命中的檔名與片段。\n\n" +
    "用途:當你需要知道「<Domain> 怎麼做某件事」時,先用此工具找出相關文件。\n\n" +
    "參數:\n  - query (string):關鍵字,空白分隔多個關鍵字時全部出現才命中 (AND)。\n" +
    "  - limit (number):最多回傳幾篇,1-50,預設 15。\n" +
    "  - context_lines (number):片段上下文行數,0-5,預設 1。\n\n" +
    "回傳:Markdown,依命中次數排序,列出檔名、命中次數與含關鍵字片段 (附行號)。\n\n" +
    '範例:query="<real-keyword-1>" / query="<real-keyword-2> <real-keyword-3>"',
  "依檔名回傳一篇 <Domain> 文件的完整 markdown 內容。\n\n" +
    "參數:\n  - filename (string):檔名或相對路徑,.md 可省略,支援模糊比對。\n\n" +
    "回傳:該文件完整內容。多筆符合時回傳候選清單;無符合時回傳提示。\n\n" +
    '範例:filename="<real-file>"',
];

async function withStdio(run: (client: Client) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), "<server-name>-protocol-"));
  writeFileSync(path.join(dir, "alpha.md"), "# Alpha\n\nKeyword one.\n");
  const client = new Client({ name: "template-regression", version: "1.0.0" });
  const exitFile = path.join(dir, "exit.json");
  const launcher = `import { writeFileSync } from 'node:fs';
    process.on('exit', code => writeFileSync(${JSON.stringify(exitFile)}, JSON.stringify({ code })));
    await import(${JSON.stringify(pathToFileURL(path.resolve("dist/index.js")).href)});`;
  let exitStatus: unknown;
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["--input-type=module", "-e", launcher],
    env: { "<ENV_DATA_DIR>": dir, TRANSPORT: "stdio" }, stderr: "pipe",
  });
  const errors: Error[] = [];
  let stderr = "";
  client.onerror = (error) => errors.push(error);
  transport.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
  try {
    await client.connect(transport, { timeout: 3000 });
    expect(transport.pid).toBeGreaterThan(0);
    await run(client);
  } finally {
    await client.close();
    await transport.close();
    try { exitStatus = JSON.parse(readFileSync(exitFile, "utf8")); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  }
  // SDK parsing errors expose any non-JSON-RPC stdout; startup messages belong to stderr.
  expect(errors).toEqual([]);
  expect(stderr).toContain("started over stdio");
  expect(stderr).not.toContain("failed to start");
  expect(transport.pid).toBeNull();
  expect(exitStatus).toEqual({ code: 0 });
}

describe("stdio protocol migration", () => {
  it("serves three described read-only tools over stdio", async () => {
    await withStdio(async (client) => {
      const { tools } = await client.listTools({}, { timeout: 3000 });
      expect(tools.map((tool) => tool.name)).toEqual(["<domain>_list", "<domain>_search", "<domain>_read"]);
      for (const [i, tool] of tools.entries()) {
        expect(tool.description).toBe(descriptions[i]);
        expect(tool.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.additionalProperties).toBe(false);
      }
      expect(tools[0].inputSchema.properties).toEqual({
        filter: { type: "string", maxLength: 100, description: "選填:只列出檔名包含此字串的文件(不分大小寫)" },
      });
      expect(tools[1].inputSchema.required).toContain("query");
      expect(tools[1].inputSchema.properties).toMatchObject({
        query: { type: "string", minLength: 1, maxLength: 200, description: "關鍵字,以空白分隔可指定多個關鍵字 (AND,需全部出現於同一篇文件)" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 15, description: "最多回傳幾篇命中的文件 (預設 15)" },
        context_lines: { type: "integer", minimum: 0, maximum: 5, default: 1, description: "每個命中片段前後附帶的上下文行數 (預設 1)" },
      });
      expect(tools[2].inputSchema.required).toEqual(["filename"]);
      expect(tools[2].inputSchema.properties).toEqual({
        filename: { type: "string", minLength: 1, maxLength: 300, description: '文件檔名或相對路徑,可省略 .md。支援模糊比對 (結尾 / 包含)。例如 "<real-file>" 或 "<category>/<real-file>.md"' },
      });
      const read = await client.callTool({ name: "<domain>_read", arguments: { filename: "alpha" } }, undefined, { timeout: 3000 });
      expect(read.isError).not.toBe(true);
      expect(read.content).toEqual([{ type: "text", text: expect.stringContaining("# Alpha") }]);
      console.info(JSON.stringify({ tools: tools.map((tool) => tool.name), read }));
    });
  }, 15000);

  it("rejects invalid tool calls without losing the session", async () => {
    await withStdio(async (client) => {
      const cases = [
        { name: "<domain>_search", args: { query: 123 }, field: "query" },
        { name: "<domain>_search", args: { query: "" }, field: "query" },
        { name: "<domain>_search", args: { query: "x".repeat(201) }, field: "query" },
        { name: "<domain>_search", args: { query: "x", limit: 0 }, field: "limit" },
        { name: "<domain>_search", args: { query: "x", limit: 51 }, field: "limit" },
        { name: "<domain>_search", args: { query: "x", context_lines: -1 }, field: "context_lines" },
        { name: "<domain>_search", args: { query: "x", context_lines: 6 }, field: "context_lines" },
        { name: "<domain>_search", args: { query: "x", typo: true }, field: "typo" },
        { name: "<domain>_list", args: { typo: true }, field: "typo" },
        { name: "<domain>_read", args: { filename: "alpha", typo: true }, field: "typo" },
      ];
      for (const { name, args, field } of cases) {
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 3000 });
        expect(result.isError, JSON.stringify(args)).toBe(true);
        expect(result.content).toEqual([{ type: "text", text: expect.stringContaining(field) }]);
      }
      const result = await client.callTool({ name: "<domain>_search", arguments: { query: "Keyword" } }, undefined, { timeout: 3000 });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{ type: "text", text: expect.stringContaining("alpha.md") }]);
    });
  }, 15000);
});
