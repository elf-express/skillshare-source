/**
 * knowledge.ts — pure logic module (no MCP SDK, no zod, no transport). Every exported do* returns a string.
 * Generalised from elf-express/mcp-library docs-mcp-server/src/corpus.ts. Keep the four safety nets:
 *   1. files are only ever resolved from a directory LISTING (never path.join(root, userInput))
 *   2. content cache invalidated by mtime (edit a file → effective without restart)
 *   3. every output goes through truncateIfNeeded (CHARACTER_LIMIT)
 *   4. every miss / bad input returns a friendly message WITH the next step to take
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CHARACTER_LIMIT = 25000;
const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);

export interface DataFile {
  filename: string; // path relative to the data root, "/" separated
  fullPath: string;
}

const contentCache = new Map<string, { content: string; mtimeMs: number }>();

/** Test hook: clear every module-level cache. */
export function _clearCaches(): void {
  contentCache.clear();
}

/** Data root resolution: <ENV_DATA_DIR> → bundled <data-dir>/ next to dist/ → server root's parent. */
export function resolveDataDir(): string {
  const envDir = process.env.<ENV_DATA_DIR>;
  if (envDir && envDir.trim().length > 0) return path.resolve(envDir);
  const serverRoot = path.resolve(__dirname, "..");
  const bundled = path.join(serverRoot, "<data-dir>");
  try {
    if (fs.statSync(bundled).isDirectory()) return bundled;
  } catch {
    /* ignore */
  }
  return path.resolve(serverRoot, "..");
}

export function listFiles(root = resolveDataDir()): DataFile[] {
  const out: DataFile[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name), rel ? rel + "/" + e.name : e.name);
      } else if (e.name.toLowerCase().endsWith(".md")) {
        const r = rel ? rel + "/" + e.name : e.name;
        out.push({ filename: r, fullPath: path.join(dir, e.name) });
      }
    }
  };
  walk(root, "");
  return out.sort((a, b) => a.filename.localeCompare(b.filename, "zh-Hant"));
}

export function readContent(file: DataFile): string {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(file.fullPath).mtimeMs;
  } catch {
    return "";
  }
  const cached = contentCache.get(file.fullPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.content;
  let content = fs.readFileSync(file.fullPath, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
  contentCache.set(file.fullPath, { content, mtimeMs });
  return content;
}

/** Match order: exact relative path → path ending (filename only) → substring. Only within listFiles(). */
export function findFiles(query: string): DataFile[] {
  const files = listFiles();
  const q = query.trim().toLowerCase();
  const qNoExt = q.endsWith(".md") ? q.slice(0, -3) : q;
  let m = files.filter((f) => f.filename.toLowerCase() === q || f.filename.toLowerCase() === qNoExt + ".md");
  if (m.length) return m;
  m = files.filter((f) => f.filename.toLowerCase().endsWith("/" + qNoExt + ".md"));
  if (m.length) return m;
  return files.filter((f) => f.filename.toLowerCase().includes(qNoExt));
}

export function truncateIfNeeded(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n…(內容已截斷,超過 " + CHARACTER_LIMIT + " 字元。請用更精確的關鍵字或讀取特定檔案。)"
  );
}

/** Keyword AND search; results sorted by hit count; snippets carry line numbers. */
export function doSearch(query: string, limit: number, ctx: number): string {
  const keywords = query.split(/\s+/).map((k) => k.trim()).filter((k) => k.length > 0);
  if (keywords.length === 0) return "錯誤:請提供至少一個關鍵字。";
  const lower = keywords.map((k) => k.toLowerCase());

  interface Hit { filename: string; hitCount: number; snippets: string[] }
  const hits: Hit[] = [];
  for (const file of listFiles()) {
    const content = readContent(file);
    if (!lower.every((k) => content.toLowerCase().includes(k))) continue;
    const lines = content.split(/\r?\n/);
    const idx: number[] = [];
    lines.forEach((l, i) => { if (lower.some((k) => l.toLowerCase().includes(k))) idx.push(i); });
    if (idx.length === 0) continue;
    const ranges: Array<[number, number]> = [];
    for (const i of idx) {
      const lo = Math.max(0, i - ctx), hi = Math.min(lines.length - 1, i + ctx);
      const last = ranges[ranges.length - 1];
      if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
      else ranges.push([lo, hi]);
    }
    const snippets = ranges.slice(0, 4).map(([lo, hi]) => {
      const block: string[] = [];
      for (let i = lo; i <= hi; i++) block.push(String(i + 1).padStart(4) + ": " + lines[i]);
      return block.join("\n");
    });
    hits.push({ filename: file.filename, hitCount: idx.length, snippets });
  }
  if (hits.length === 0) {
    return `找不到同時包含 [${keywords.join(", ")}] 的文件。\n建議:減少關鍵字數量,或用 <domain>_list 瀏覽。`;
  }
  hits.sort((a, b) => b.hitCount - a.hitCount);
  const shown = hits.slice(0, limit);
  const out = [
    `# 搜尋結果:[${keywords.join(", ")}]`, "",
    `共 ${hits.length} 篇命中` + (hits.length > shown.length ? `(顯示前 ${shown.length} 篇)` : "") + "。", "",
  ];
  for (const h of shown) {
    out.push(`## ${h.filename} (${h.hitCount} 處命中)`, "");
    for (const s of h.snippets) out.push("```", s, "```");
    out.push(`> 用 <domain>_read 讀取完整內容:filename="${h.filename}"`, "");
  }
  return truncateIfNeeded(out.join("\n"));
}

export function doList(filter: string | undefined): string {
  const f = filter?.trim().toLowerCase();
  const files = listFiles().filter((x) => !f || x.filename.toLowerCase().includes(f));
  if (files.length === 0) {
    return f ? `沒有檔名包含 "${filter}" 的文件。請改用 <domain>_search 全文搜尋。` : "目前沒有任何文件。資料目錄:" + resolveDataDir();
  }
  return truncateIfNeeded([`# 文件清單 (共 ${files.length} 篇)`, "", ...files.map((x) => "- " + x.filename)].join("\n"));
}

export function doRead(filename: string): string {
  const matches = findFiles(filename);
  if (matches.length === 0) return `找不到符合 "${filename}" 的文件。請用 <domain>_search 或 <domain>_list 查可用檔名。`;
  if (matches.length > 1) {
    return `"${filename}" 符合多篇,請指定更精確的路徑:\n\n` + matches.map((m) => "- " + m.filename).join("\n");
  }
  return truncateIfNeeded(`# ${matches[0].filename}\n\n` + readContent(matches[0]));
}
