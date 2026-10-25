'use strict';
// elf-search-guard：Claude Code PreToolUse hook（Bash／PowerShell）。
// 擋下從根目錄或整顆磁碟遞迴搜尋的命令，理由附替代做法（es、Glob／Grep／rg、mdfind）。
// 只用同步程式碼，不啟動子行程；hook 永遠 exit 0，以 stdout JSON 表達 deny。

const fs = require('node:fs');

const REASON =
  'elf-search-guard：已擋下從根目錄或整顆磁碟遞迴搜尋的命令。這種命令會跑很久、拖慢整台電腦，放到背景執行也一樣。' +
  '改用：① Windows 有 Everything 時用 es -n 20 <關鍵字>（限定範圍加 -path <資料夾>）；' +
  '② 沒有 es 時把範圍限在專案目錄，用 Glob／Grep 工具或 rg；' +
  '③ macOS 用 mdfind -name <關鍵字>（限定範圍加 -onlyin <資料夾>）。' +
  '說明見 skillshare-source 的 docs/search-guard.md。';

const ALLOW = { decision: 'allow' };

// 引號字串的佔位字：內容是一般文字，不當命令；也加在以 - 開頭的引號參數前，讓它不被當成選項。
const PLACEHOLDER = '__QUOTED__';
// 命令文字切段的分隔：||、&&、;、|、換行。
const SPLIT_RE = /\|\||&&|[;|\r\n]/;
// 引號前緊接這些旗標時，引號內容是要執行的命令；依旗標決定內容由哪種 shell 解讀。
const CMD_FLAG_RE = /(?:^|\s)\/[ck]\s*$/i;
const PS_FLAG_RE = /(?:^|\s)(?:-command|(?:powershell|pwsh)(?:\.exe)?\s+-[A-Za-z]*c)\s*$/i;
const BASH_FLAG_RE = /(?:^|\s)-[A-Za-z]*c\s*$/;
// 巢狀命令（-c 內再 -c）最多展開幾層。
const MAX_DEPTH = 3;

// 根目錄與磁碟根的寫法；結尾可接 *（如 /*、/c/*、C:\*）。
const POSIX_ROOT = String.raw`(?:\/|\/[a-zA-Z]\/?|\/mnt\/[a-zA-Z]\/?|\/cygdrive\/[a-zA-Z]\/?)`;
const WIN_ROOT = String.raw`(?:[a-zA-Z]:[\\/]?|\\)`;
const ROOT = String.raw`(?:${POSIX_ROOT}|${WIN_ROOT})\*?`;
// tree 的 /f、/a 是選項，單獨的 /<字母> 不算根。
const TREE_ROOT = String.raw`(?:\/|\/[a-zA-Z]\/|\/mnt\/[a-zA-Z]\/?|\/cygdrive\/[a-zA-Z]\/?|${WIN_ROOT})\*?`;
const END = String.raw`(?=\s|$|[)&<>])`;
// 命令開頭：行首、空白、括號或大括號之後；可帶路徑前綴（如 /usr/bin/find）。
const CMD_START = String.raw`(?:^|[\s({])(?:[^\s'"(){}]*[\\/])?`;

const ROOT_TOKEN = new RegExp(String.raw`^${ROOT}$`);
const ANY_ROOT = new RegExp(String.raw`(?:^|\s)${ROOT}` + END);
const ANY_TREE_ROOT = new RegExp(String.raw`(?:^|\s)${TREE_ROOT}` + END);
const WIN_OR_SLASH_ROOT = new RegExp(String.raw`(?:^|[\s:])(?:\/|${WIN_ROOT})\*?` + END);
const WIN_ROOT_ONLY = new RegExp(String.raw`(?:^|\s)${WIN_ROOT}\*?` + END);
// 磁碟根目錄下的檔名樣式，如 C:\altcha.css、C:\*.css。
const WIN_ROOT_PATTERN = new RegExp(String.raw`(?:^|[\s:])[a-zA-Z]:[\\/][^\\/\s]*[.*?][^\\/\s]*` + END);
// PowerShell 的 -Recurse 與其前綴（-r、-re…，可帶 :$true），以及 -Depth。
const PS_RECURSE = /\s-(?:r(?:e(?:c(?:u(?:r(?:s(?:e)?)?)?)?)?)?(?::\S*)?|depth)(?=\s|$)/i;
// bash 的 ls -r 是反向排序，只認 -Rec… 與 -Depth。
const PS_LS_RECURSE = /\s-(?:rec\w*(?::\S*)?|depth)(?=\s|$)/i;

const FIND_START = new RegExp(CMD_START + String.raw`find(?:\.exe)?(?=\s|$)`);
// Windows 內建 find 的語境（PowerShell、cmd）：起點是根，且後面是結尾、選項、括號、驚嘆號、反斜線、數字或 & < >。
const WIN_FIND = new RegExp(
  CMD_START + String.raw`find(?:\.exe)?\s+(?:-[HLP]\s+)*${ROOT}(?=\s*$|\s*[&<>)]|\s+[-(!\\\d])`,
);
const CMD_C_RE = /(?:^|[\s(])cmd(?:\.exe)?\s+\/[ck]\s/i;
const LS_START = new RegExp(CMD_START + String.raw`ls(?=\s)`);
const PS_LIST_START = /(?:^|[\s({])(?:Get-ChildItem|gci|dir)(?=\s|$)/i;
const CMD_DIR_START = new RegExp(CMD_START + String.raw`dir(?:\.exe)?(?=\s|$)`, 'i');
const WHERE_START = new RegExp(CMD_START + String.raw`where(?:\.exe)?(?=\s|$)`, 'i');
const PATTERN_TOOL_START = new RegExp(CMD_START + String.raw`(?:rg|fd|fdfind)(?:\.exe)?(?=\s)`);
const DU_START = new RegExp(CMD_START + String.raw`du(?:\.exe)?(?=\s)`);
const TREE_START = new RegExp(CMD_START + String.raw`tree(?:\.com|\.exe)?(?=\s)`, 'i');

// 命令名稱之後的參數（以空白切開）。
function argsAfter(segment, startRe) {
  const m = segment.match(startRe);
  if (!m) return null;
  return segment
    .slice(m.index + m[0].length)
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '')
    .map((token) => token.replace(/\)+$/, ''));
}

// R1 find。bash 的 find 是 GNU find：起點（第一個選項之前的參數）有根就擋；PowerShell 與 cmd 是 Windows 內建 find。
function findRule(segment, shell) {
  if (shell === 'bash' && !CMD_C_RE.test(segment)) {
    const args = argsAfter(segment, FIND_START);
    if (args === null) return false;
    for (const arg of args) {
      if (/^-[HLP]$/.test(arg)) continue;
      if (/^[-(!]/.test(arg)) return false;
      if (ROOT_TOKEN.test(arg)) return true;
    }
    return false;
  }
  return WIN_FIND.test(segment);
}

// R6、R7 rg、fd：第一個位置參數是搜尋樣式，其餘位置參數是路徑；rg --files 時全部都是路徑。
function patternToolRule(segment) {
  const args = argsAfter(segment, PATTERN_TOOL_START);
  if (args === null) return false;
  const positional = args.filter((arg) => !arg.startsWith('-'));
  const paths = args.includes('--files') ? positional : positional.slice(1);
  return paths.some((arg) => ROOT_TOKEN.test(arg));
}

const RULES = [
  findRule,
  // R2 ls -R 或 --recursive 加根參數。
  (s) => LS_START.test(s) && (/\s-[a-zA-Z]*R/.test(s) || /\s--recursive\b/.test(s)) && ANY_ROOT.test(s),
  // R3 Get-ChildItem／gci／dir（PowerShell）與 PowerShell 的 ls 遞迴，加根或磁碟根樣式。
  (s, shell) =>
    ((PS_LIST_START.test(s) && PS_RECURSE.test(s)) ||
      (LS_START.test(s) && (shell === 'ps' ? PS_RECURSE : PS_LS_RECURSE).test(s))) &&
    (WIN_OR_SLASH_ROOT.test(s) || WIN_ROOT_PATTERN.test(s)),
  // R4 cmd dir /s 加 Windows 根或磁碟根樣式。
  (s) => CMD_DIR_START.test(s) && /\s\/s\b/i.test(s) && (WIN_ROOT_ONLY.test(s) || WIN_ROOT_PATTERN.test(s)),
  // R5 where /r 加 Windows 根。
  (s) => WHERE_START.test(s) && /\s\/r\b/i.test(s) && WIN_ROOT_ONLY.test(s),
  patternToolRule,
  // R9 du 加根參數。
  (s) => DU_START.test(s) && ANY_ROOT.test(s),
  // R8 tree 加根參數。
  (s) => TREE_START.test(s) && ANY_TREE_ROOT.test(s),
];

// 去掉 bash heredoc 與 PowerShell here-string 的本文，只留命令所在的行。
function stripHereDocs(command) {
  const lines = command.split(/\r?\n/);
  const kept = [];
  const pending = [];
  let hereString = null;
  for (const line of lines) {
    if (hereString !== null) {
      if (line.startsWith(hereString + '@')) {
        kept.push(line.slice(2));
        hereString = null;
      }
      continue;
    }
    if (pending.length > 0) {
      const { word, dash } = pending[0];
      if ((dash ? line.replace(/^\t+/, '') : line) === word) pending.shift();
      continue;
    }
    const here = line.match(/@(['"])\s*$/);
    if (here) {
      kept.push(line.slice(0, here.index));
      hereString = here[1];
      continue;
    }
    for (const m of line.matchAll(/(?<!<)<<(?!<)(-?)\s*(['"]?)([A-Za-z_][\w.-]*)\2/g)) {
      pending.push({ word: m[3], dash: m[1] === '-' });
    }
    kept.push(line);
  }
  return kept.join('\n');
}

// -c、/c、-Command 後的引號內容由哪種 shell 解讀；不是命令旗標回 null。
function flagShell(before) {
  if (CMD_FLAG_RE.test(before)) return 'cmd';
  if (PS_FLAG_RE.test(before)) return 'ps';
  if (BASH_FLAG_RE.test(before)) return 'bash';
  return null;
}

// 處理引號與命令替換：一般文字換成佔位字，要執行的命令連同解讀它的 shell 放進 extras。
function scanQuotes(text, shell, extras) {
  const isBash = shell === 'bash';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "'" && ch !== '"' && !(isBash && ch === '`')) {
      out += ch;
      continue;
    }
    let end = text.indexOf(ch, i + 1);
    if (end === -1) end = text.length;
    const content = text.slice(i + 1, end);
    i = end;
    if (ch === '`') {
      extras.push({ text: content, shell });
      out += ` ${PLACEHOLDER} `;
      continue;
    }
    const inner = flagShell(out);
    if (inner !== null) {
      extras.push({ text: content, shell: inner });
      out += ` ${PLACEHOLDER} `;
      continue;
    }
    if (ch === '"') {
      const sub = isBash ? /\$\(([^)]*)\)|`([^`]*)`/g : /\$\(([^)]*)\)/g;
      for (const m of content.matchAll(sub)) extras.push({ text: m[1] !== undefined ? m[1] : m[2], shell });
    }
    if (/\s/.test(content)) out += PLACEHOLDER;
    else out += content.startsWith('-') ? PLACEHOLDER + content : content;
  }
  return out;
}

// 把命令文字展開成要逐段比對的 { text, shell } 片段。
function collectSegments(command, shell, depth) {
  const extras = [];
  const segments = scanQuotes(stripHereDocs(command), shell, extras)
    .split(SPLIT_RE)
    .map((text) => ({ text, shell }));
  if (depth < MAX_DEPTH) {
    for (const extra of extras) segments.push(...collectSegments(extra.text, extra.shell, depth + 1));
  }
  return segments;
}

function decideUnsafe(payload) {
  const toolName = payload.tool_name;
  if (toolName !== undefined && toolName !== 'Bash' && toolName !== 'PowerShell') return ALLOW;
  const command = payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string' || command === '') return ALLOW;
  const segments = collectSegments(command, toolName === 'PowerShell' ? 'ps' : 'bash', 0);
  if (segments.some(({ text, shell }) => RULES.some((rule) => rule(text, shell)))) {
    return { decision: 'deny', reason: REASON };
  }
  return ALLOW;
}

// 判斷單次工具呼叫；hook 自身發生例外時放行。
function decide(payload) {
  try {
    return decideUnsafe(payload || {});
  } catch {
    return ALLOW;
  }
}

function main() {
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
    const result = decide(payload);
    if (result.decision === 'deny') {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: result.reason,
          },
        }),
      );
    }
  } catch {
    // hook 自身失敗時不輸出任何內容，等同放行。
  }
  process.exitCode = 0;
}

module.exports = { decide };

if (require.main === module) {
  main();
}
