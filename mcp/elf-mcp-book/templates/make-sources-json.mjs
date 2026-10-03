#!/usr/bin/env node
// 從語料裡每篇 md 的 YAML front matter 抽 source:，產生 sources.json。
//
// 為什麼不靠 docs-mcp 的自動抽取:自動抽取只認 `> Source: url` 與
// `> 📖 官方文件:[文字](url)`,front matter 的 `source: "https://…"` 會把結尾的 `"`
// 一起吃進網址(見 corpora/README.md 第五節)。
//
// 用法(在語料資料夾的上一層或任何位置):
//   node make-sources-json.mjs <語料目錄> > <語料目錄>/sources.json
//
// 鍵是「相對語料根的路徑」,與 docs-mcp 的 sources.json 格式一致。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("用法: node make-sources-json.mjs <語料目錄>");
  process.exit(1);
}

const SKIP_DIRS = new Set(["examples", "images", "node_modules", ".git"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

// 只讀開頭的 front matter 區塊(--- 到 ---),取第一個 source:。
function extractSource(content) {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const front = content.slice(3, end);
  const m = front.match(/^\s*source:\s*["']?(https?:\/\/[^"'\s]+)["']?\s*$/m);
  return m ? m[1] : null;
}

const sources = {};
let missing = 0;
for (const file of walk(root).sort()) {
  const url = extractSource(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const key = relative(root, file).split(sep).join("/");
  if (url) sources[key] = url;
  else missing++;
}

console.log(JSON.stringify(sources, null, 2));
console.error(`[make-sources-json] ${Object.keys(sources).length} 篇有 source,${missing} 篇沒有`);
