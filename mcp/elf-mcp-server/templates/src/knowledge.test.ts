/**
 * knowledge.test.ts — colocated unit tests (team standard: `*.test.ts` next to the source, line coverage >= 55%).
 * Pattern from docs-mcp-server/tests/corpus.test.ts: a temp data root via fs.mkdtempSync + env override,
 * so tests never depend on (or mutate) the bundled data.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { doSearch, doRead, doList, findFiles, truncateIfNeeded, CHARACTER_LIMIT, _clearCaches } from "./knowledge.js";

let root: string;
const ENV = "<ENV_DATA_DIR>";
const original = process.env[ENV];

function write(rel: string, content: string) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "<server-name>-"));
  write("alpha.md", "# Alpha\n\nKeyword one.\n\nKeyword two.\n\nKeyword three.\n");
  write("beta.md", "# Beta\n\nKeyword once. Lambda too.\n");
  write("sub/nested.md", "# Nested\n\nNested Keyword.\n");
  process.env[ENV] = root;
});

afterAll(() => {
  if (original === undefined) delete process.env[ENV];
  else process.env[ENV] = original;
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => _clearCaches());

describe("doSearch", () => {
  it("sorts by hit count (alpha before beta)", () => {
    const out = doSearch("Keyword", 10, 0);
    expect(out.indexOf("alpha.md")).toBeLessThan(out.indexOf("beta.md"));
  });
  it("multiple keywords are AND", () => {
    const out = doSearch("Keyword Lambda", 10, 0);
    expect(out).toMatch(/beta\.md/);
    expect(out).not.toMatch(/alpha\.md/);
  });
  it("miss returns a next-step hint, not an exception", () => {
    expect(doSearch("ZZZ_NOPE", 10, 0)).toMatch(/建議/);
  });
  it("empty query returns an error message", () => {
    expect(doSearch("   ", 10, 0)).toMatch(/至少一個關鍵字/);
  });
});

describe("doRead / findFiles", () => {
  it("reads by filename without .md", () => {
    expect(doRead("alpha")).toMatch(/# Alpha/);
  });
  it("matches nested file by name only", () => {
    expect(findFiles("nested").map((f) => f.filename)).toEqual(["sub/nested.md"]);
  });
  it("never escapes the data root", () => {
    expect(doRead("../../etc/passwd")).toMatch(/找不到/);
  });
});

describe("doList", () => {
  it("filters by substring", () => {
    expect(doList("sub")).toMatch(/sub\/nested\.md/);
  });
});

describe("truncateIfNeeded", () => {
  it("truncates above CHARACTER_LIMIT with a notice", () => {
    const out = truncateIfNeeded("x".repeat(CHARACTER_LIMIT + 10));
    expect(out.length).toBeGreaterThan(CHARACTER_LIMIT);
    expect(out).toMatch(/已截斷/);
  });
});
