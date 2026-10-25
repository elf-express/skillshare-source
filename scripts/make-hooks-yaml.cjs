// 產生器：把 elf-guard.cjs 與 elf-sessionstart.cjs 原文內嵌成 skillshare hooks entry YAML。
// 用法：node scripts/make-hooks-yaml.cjs          寫出 scripts/elf-guard.hooks.yaml
//       node scripts/make-hooks-yaml.cjs --check  比對現有 YAML，不同步則 exit 1
//       同一次執行也寫出／比對 scripts/elf-search-guard.hooks.yaml（內嵌 elf-search-guard.cjs，E-423）
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const OUT_FILE = path.join(SCRIPTS_DIR, 'elf-guard.hooks.yaml');
// 內嵌的來源檔，順序即 YAML 內的順序
const SOURCES = ['elf-guard.cjs', 'elf-sessionstart.cjs'];
const FILE_KEY_INDENT = ' '.repeat(6);
const CONTENT_INDENT = ' '.repeat(8);
// hook command 使用的腳本安裝目錄（由 shell 展開 $HOME）
const HOOK_DIR = '$HOME/.claude/hooks/skillshare/elf-guard';

// 讀取來源並檢查 block scalar 能原樣還原的前提：無 CR、無 BOM、正好一個結尾換行、首行有內容且不以空白開頭
function readSource(name) {
  const text = fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf8');
  if (text.includes('\r')) throw new Error(`${name} 含 CR（\\r），請改為 LF`);
  if (text.charCodeAt(0) === 0xfeff) throw new Error(`${name} 以 BOM 開頭`);
  if (!text.endsWith('\n')) throw new Error(`${name} 必須以一個換行結尾`);
  if (text.endsWith('\n\n')) throw new Error(`${name} 結尾多於一個換行，block scalar 會剪掉多餘的`);
  if (/^[ \t\n]/.test(text)) throw new Error(`${name} 首行為空行或以空白開頭，block scalar 縮排會判錯`);
  return text;
}

// 把內容逐行加上縮排；空行輸出成空行
function indentBlock(text) {
  return text
    .slice(0, -1)
    .split('\n')
    .map((line) => (line === '' ? '' : CONTENT_INDENT + line))
    .join('\n');
}

function generate(sources) {
  const fileBlocks = SOURCES.map((name) => `${FILE_KEY_INDENT}${name}: |\n${indentBlock(sources[name])}\n`).join('');
  return (
    '# 由 scripts/make-hooks-yaml.cjs 產生，請勿手改\n' +
    'description: Superpowers 階段 Guard 與狀態檔注入(E-377)\n' +
    'bindings:\n' +
    '  claude:\n' +
    '    files:\n' +
    fileBlocks +
    '    events:\n' +
    '      PreToolUse:\n' +
    '        - matcher: "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell"\n' +
    '          hooks:\n' +
    '            - type: command\n' +
    `              command: 'node "${HOOK_DIR}/elf-guard.cjs"'\n` +
    '              timeout: 10\n' +
    '      SessionStart:\n' +
    '        - hooks:\n' +
    '            - type: command\n' +
    `              command: 'node "${HOOK_DIR}/elf-sessionstart.cjs"'\n` +
    '              timeout: 10\n'
  );
}

// 依固定格式從 YAML 抽出 block scalar、去掉縮排，還原成原文
function extractBlocks(yaml) {
  const lines = yaml.split('\n');
  const result = {};
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {6}([A-Za-z0-9._-]+): \|$/.exec(lines[i]);
    if (!m) continue;
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j] === '') {
        body.push('');
      } else if (lines[j].startsWith(CONTENT_INDENT)) {
        body.push(lines[j].slice(CONTENT_INDENT.length));
      } else {
        break;
      }
    }
    // block scalar 結尾的空行會被剪成一個換行；本產生器不會產生尾端空行
    while (body.length > 0 && body[body.length - 1] === '') body.pop();
    result[m[1]] = body.join('\n') + '\n';
    i = j - 1;
  }
  return result;
}

// 驗證：從產出字串取回的內容必須逐字等於來源
function verifyRoundTrip(yaml, sources, names = SOURCES) {
  const extracted = extractBlocks(yaml);
  for (const name of names) {
    if (extracted[name] !== sources[name]) {
      throw new Error(`${name} 內嵌後無法原樣取回`);
    }
  }
  const keys = Object.keys(extracted);
  if (keys.length !== names.length) {
    throw new Error(`YAML 內 block scalar 數量為 ${keys.length}，預期 ${names.length}`);
  }
}

// elf-search-guard：擋從根目錄或整顆磁碟遞迴搜尋的 hook，獨立一份 entry
const SEARCH_OUT_FILE = path.join(SCRIPTS_DIR, 'elf-search-guard.hooks.yaml');
const SEARCH_SOURCES = ['elf-search-guard.cjs'];
const SEARCH_HOOK_DIR = '$HOME/.claude/hooks/skillshare/elf-search-guard';

function generateSearchGuard(sources) {
  const fileBlocks = SEARCH_SOURCES.map((name) => `${FILE_KEY_INDENT}${name}: |\n${indentBlock(sources[name])}\n`).join('');
  return (
    '# 由 scripts/make-hooks-yaml.cjs 產生，請勿手改\n' +
    'description: 擋下從根目錄或整顆磁碟遞迴搜尋的命令(E-423)\n' +
    'bindings:\n' +
    '  claude:\n' +
    '    files:\n' +
    fileBlocks +
    '    events:\n' +
    '      PreToolUse:\n' +
    '        - matcher: "Bash|PowerShell"\n' +
    '          hooks:\n' +
    '            - type: command\n' +
    `              command: 'node "${SEARCH_HOOK_DIR}/elf-search-guard.cjs"'\n` +
    '              timeout: 10\n'
  );
}

function main() {
  const check = process.argv.slice(2).includes('--check');
  const sources = {};
  for (const name of [...SOURCES, ...SEARCH_SOURCES]) sources[name] = readSource(name);
  // 每份輸出：檔案、產生的內容、內嵌的來源檔
  const outputs = [
    { file: OUT_FILE, yaml: generate(sources), names: SOURCES },
    { file: SEARCH_OUT_FILE, yaml: generateSearchGuard(sources), names: SEARCH_SOURCES },
  ];
  for (const out of outputs) verifyRoundTrip(out.yaml, sources, out.names);

  if (check) {
    let failed = false;
    for (const out of outputs) {
      const rel = `scripts/${path.basename(out.file)}`;
      if (!fs.existsSync(out.file)) {
        console.error(`FAIL: ${rel} 不存在，請執行 node scripts/make-hooks-yaml.cjs`);
        failed = true;
        continue;
      }
      const current = fs.readFileSync(out.file, 'utf8');
      if (current !== out.yaml) {
        console.error(`FAIL: ${rel} 與來源不同步，請執行 node scripts/make-hooks-yaml.cjs`);
        failed = true;
        continue;
      }
      verifyRoundTrip(current, sources, out.names);
      console.log(`OK: ${rel} 與來源同步`);
    }
    if (failed) process.exit(1);
    return;
  }

  for (const out of outputs) {
    fs.writeFileSync(out.file, out.yaml, { encoding: 'utf8' });
    console.log(`已寫出 ${path.relative(process.cwd(), out.file)}（${out.yaml.length} 字元）`);
  }
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
