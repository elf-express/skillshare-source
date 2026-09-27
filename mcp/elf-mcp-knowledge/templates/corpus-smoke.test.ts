/**
 * <corpus-id>.test.ts — smoke test for a newly added corpus (uses the REAL bundled corpus, no fixtures).
 * Copy to docs-mcp-server/tests/<corpus-id>.test.ts and replace every <...> placeholder.
 * Assertions must use real headings / keywords from the corpus (see evidence E7: no loosened matching).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  _clearCaches,
  getCorpus,
  listMarkdownFiles,
  doListCorpora,
  doSearch,
  doOutline,
  doCheatsheet,
  doSymbol,
  doCodeSearch,
} from "../src/corpus.js";

const ID = "<corpus-id>";

beforeEach(() => _clearCaches());

describe(`corpus ${ID} — discovery`, () => {
  it("is discovered with title and declared capabilities", () => {
    const c = getCorpus(ID);
    expect(c).toBeDefined();
    expect(c!.title).toBe("<CORPUS_TITLE>");
    expect(c!.capabilities).toEqual({ cheatsheet: false, examples: false, symbol: false }); // match corpus.json exactly
  });

  it("has the expected number of markdown documents", () => {
    expect(listMarkdownFiles(getCorpus(ID)!).length).toBe(<DOC_COUNT>);
  });

  it("docs_list_corpora scoped to this corpus lists only it", () => {
    const out = doListCorpora({ onlyId: ID });
    // Literal match, not a RegExp: ids contain "-" and a template-string RegExp
    // silently loses its backslashes, turning "[id]" into a character class that
    // matches almost anything (a test that can never fail — evidence E7).
    expect(out).toContain(`## ${ID}`);
    expect(out).toMatch(/docs_outline/);
  });
});

describe(`corpus ${ID} — core tools`, () => {
  it("docs_search finds a real keyword", () => {
    const out = doSearch(ID, "<REAL_KEYWORD>", 5, 1);
    expect(out).not.toMatch(/找不到/);
    expect(out).toContain(`[${ID}]`);
  });

  it("docs_outline lists a real category", () => {
    expect(doOutline(ID, undefined, false)).toMatch(/<REAL_CATEGORY_OR_FILE>/);
  });
});

// Keep ONLY the blocks for capabilities this corpus enables, and keep the gating test for the ones it does not.
describe(`corpus ${ID} — capability gating`, () => {
  it("cheatsheet: disabled corpus returns the friendly hint", () => {
    expect(doCheatsheet(ID, "<ANY_FILE>")).toMatch(/未啟用速查表/);
  });
  it("symbol: disabled corpus returns the friendly hint", () => {
    expect(doSymbol(ID, "<ANY_NAME>", 8)).toMatch(/未啟用 symbol/);
  });
  it("examples: disabled corpus returns the friendly hint", () => {
    expect(doCodeSearch(ID, "", 10, 2)).toMatch(/未啟用 examples|無代碼範例/);
  });
});
