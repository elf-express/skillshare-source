# 路線 B：為 docs-mcp-server 新增一種 capability（＋一個 `docs_*` 工具）

> 依據：`docs/superpowers/specs/2026-06-27-docs-mcp-domain-tools-design.md`（`bc6760c`）與實作 commit
> `c69d80e` → `a474fee` → `98ce198` → `10597a8` → `90e015d` → `824fab2`。照這個順序做，一個 capability 一組 commit。

## 前提（全部成立才走路線 B）

1. 既有 8 個工具（`docs_list_corpora` / `docs_search` / `docs_read` / `docs_outline` / `docs_cheatsheet` / `docs_code_search` / `docs_code_read` / `docs_symbol`）都做不到。
2. 新能力對「任何具備某種結構的語料」都有意義（不是只為一本書寫的特例）。
3. 已寫 spec（`docs/superpowers/specs/<date>-<topic>-design.md`）並經使用者確認。

## 步驟

| # | 檔案 | 做什麼 | 對照既有實作 |
|---|---|---|---|
| 1 | `src/corpus.ts` | `CorpusCapabilities` 加 `<cap>?: boolean`＋JSDoc 說明語料需具備什麼 | `examples?` / `symbol?` |
| 2 | `src/corpus.ts` | 純函式 `do<Cap>(corpusId: string \| undefined, ...): string`，第一段是 gate | `requireExamples` + `doCodeSearch` |
| 3 | `src/corpus.ts` | 若需索引：`Map<corpusDir, {mtimeMs, index}>` 快取，並加進 `_clearCaches()` | `symbolIndexCache` |
| 4 | `src/corpus.ts` | `doListCorpora` 加 badge 與「可用工具」提示行 | `符號查` / `代碼範例` |
| 5 | `src/index.ts` | 模組層級 zod schema（**不可**放在 `createServer` 內，見 `dd4853a`） | `SymbolInputSchema` |
| 6 | `src/index.ts` | `server.registerTool(...)`：title、完整 description、`inputSchema`、`annotations: READ_ONLY`、handler 一行呼叫 `scope ?? p.corpus` | `docs_search` 的描述格式 |
| 7 | `src/index.ts` | 檔頭註解的工具清單與「工具數恆為 N」 | `dd4853a` 修過一次 |
| 8 | `tests/<cap>.test.ts` | gating（未開能力的真實語料回提示）＋命中＋未命中＋邊界 | `tests/symbol.test.ts` |
| 9 | 語料 | 目標語料 `corpus.json` 開新能力 | — |
| 10 | 文件 | 根 `CLAUDE.md` 能力清單、`docs-mcp-server/README.md` 工具表、`servers/<id>.json` description | 證據 E9、E10 |

## 程式碼範本（完整貼上後替換 `<...>`）

### corpus.ts — gate ＋ 邏輯

```ts
/** <cap> capability gate: returns the Corpus or a friendly message string. */
function require<Cap>(corpusId: string | undefined): Corpus | string {
  if (!corpusId || !corpusId.trim()) {
    return `請指定 corpus(用 docs_list_corpora 查看可用語料:${corpusIdList()}),或改用單書端點 /mcp/<corpus>。`;
  }
  const c = getCorpus(corpusId);
  if (!c) return `找不到語料 "${corpusId}"。可用語料:${corpusIdList()}。`;
  if (!c.capabilities.<cap>) {
    return `語料 "${corpusId}" 未啟用 <cap>(<缺什麼>)。請改用 <替代工具,如 docs_search / docs_outline>。`;
  }
  return c;
}

export function do<Cap>(corpusId: string | undefined, <param>: string, limit: number): string {
  const c = require<Cap>(corpusId);
  if (typeof c === "string") return c;
  const q = <param>.trim();
  if (!q) return "請提供 <param 的意義>。";
  // ... pure logic over listMarkdownFiles(c) / readNoteContent(f) only (never path.join(c.dir, userInput))
  const out: string[] = [];
  if (out.length === 0) {
    return `語料 "${c.id}" 找不到 "${<param>}"。建議改用 docs_search(corpus="${c.id}", query="${<param>}")。`;
  }
  return truncateIfNeeded(out.join("\n"));
}
```

### index.ts — schema ＋ 註冊

```ts
const <Cap>InputSchema = z
  .object({
    corpus: z.string().max(100).optional().describe("語料 id。單書端點/DOCS_SCOPE 下可省。"),
    <param>: z.string().min(1).max(120).describe("<意義、比對方式(精確→包含)、範例值>"),
    limit: z.number().int().min(1).max(30).default(8).describe("候選上限(預設 8)"),
  })
  .strict();

// inside createServer(scope):
server.registerTool(
  "docs_<cap>",
  {
    title: "<中文標題>",
    description:
      "<一句話:做什麼,比哪個既有工具更適合什麼情境>。\n\n" +
      "僅對啟用 <cap> 能力的語料有效(否則提示改用 <替代工具>)。\n\n" +
      "參數:\n" +
      "  - corpus (string,選填):語料 id。單書端點或 DOCS_SCOPE 下可省。\n" +
      "  - <param> (string):<意義>。\n" +
      "  - limit (number):1-30,預設 8。\n\n" +
      "回傳:<Markdown 格式說明:命中時 / 多命中時 / 未命中時>。\n\n" +
      '範例:<param>="<真實值1>" / <param>="<真實值2>"' +
      scopeNote,
    inputSchema: <Cap>InputSchema.shape,
    annotations: READ_ONLY,
  },
  async (p) => textResult(do<Cap>(scope ?? p.corpus, p.<param>, p.limit))
);
```

> 描述**必須**有「參數」逐項、「回傳」、「範例」三段（證據 E6：現有 `docs_code_*` / `docs_symbol` 描述偏短，新增的工具不得比照短版）。

### tests/<cap>.test.ts

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { do<Cap>, _clearCaches } from "../src/corpus.js";

beforeEach(() => _clearCaches());

describe("docs_<cap> gating", () => {
  it("corpus without <cap> returns the friendly hint", () => {
    expect(do<Cap>("<a corpus that does NOT enable it>", "<x>", 8)).toMatch(/未啟用 <cap>/);
  });
  it("missing corpus asks to pick one", () => {
    expect(do<Cap>(undefined, "<x>", 8)).toMatch(/docs_list_corpora/);
  });
});

describe("do<Cap>(<corpus>) — real data", () => {
  it("hits a REAL heading/value from the corpus", () => {
    const out = do<Cap>("<corpus>", "<真實存在的值>", 8);
    expect(out).not.toMatch(/找不到/);
    expect(out).toMatch(/\[<corpus>\]/);
  });
  it("miss suggests docs_search", () => {
    expect(do<Cap>("<corpus>", "絕對不存在xyz", 8)).toMatch(/docs_search/);
  });
});
```

## 完成條件

- `grep -c 'registerTool(' src/index.ts` = 舊值 + 1；`.strict()`、`annotations: READ_ONLY` 同步 +1
- `npm test` 通過，測試數只增不減
- 檔頭註解、CLAUDE.md、README、servers/*.json 全部寫到新工具
