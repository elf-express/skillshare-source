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

// 引號字串的佔位字：內容是一般文字，不當命令。
const PLACEHOLDER = '__QUOTED__';
// 命令文字切段的分隔：||、&&、;、|、換行。
const SPLIT_RE = /\|\||&&|[;|\r\n]/;
// 引號前緊接這些旗標時，引號內容是要執行的命令（bash -c、cmd /c、pwsh -Command 等）。
const COMMAND_FLAG_RE = /(?:^|\s)(?:-[A-Za-z]*c|\/[ck]|-command)\s*$/i;
// 巢狀命令（-c 內再 -c）最多展開幾層。
const MAX_DEPTH = 3;

// 根目錄與磁碟根的寫法。
const POSIX_ROOT = String.raw`(?:\/|\/[a-zA-Z]\/?|\/mnt\/[a-zA-Z]\/?|\/cygdrive\/[a-zA-Z]\/?)`;
const WIN_ROOT = String.raw`(?:[a-zA-Z]:[\\/]?|\\)`;
// tree 的 /f、/a 是選項，單獨的 /<字母> 不算根。
const TREE_ROOT = String.raw`(?:\/|\/[a-zA-Z]\/|\/mnt\/[a-zA-Z]\/?|\/cygdrive\/[a-zA-Z]\/?)`;
const END = String.raw`(?=\s|$|\))`;
const CMD_START = String.raw`(?:^|[\s({])`;

const FIND = new RegExp(
  CMD_START + String.raw`find(?:\.exe)?\s+(?:-[HLP]\s+)*(?:${POSIX_ROOT}|${WIN_ROOT})(?=\s*$|\s+[-(!\\\d]|\))`,
);
const ANY_ROOT = new RegExp(String.raw`(?:^|\s)(?:${POSIX_ROOT}|${WIN_ROOT})` + END);
const ANY_TREE_ROOT = new RegExp(String.raw`(?:^|\s)(?:${TREE_ROOT}|${WIN_ROOT})` + END);
const WIN_OR_SLASH_ROOT = new RegExp(String.raw`(?:^|[\s:])(?:\/|${WIN_ROOT})` + END);
const WIN_ROOT_ONLY = new RegExp(String.raw`(?:^|\s)${WIN_ROOT}` + END);
// 磁碟根目錄下的檔名樣式，如 C:\altcha.css、C:\*.css。
const WIN_ROOT_PATTERN = new RegExp(String.raw`(?:^|[\s:])[a-zA-Z]:[\\/][^\\/\s]*[.*?][^\\/\s]*` + END);
// PowerShell 的 -Recurse 與其前綴（-r、-re…，可帶 :$true），以及 -Depth。
const PS_RECURSE = /\s-(?:r(?:e(?:c(?:u(?:r(?:s(?:e)?)?)?)?)?)?(?::\S*)?|depth)(?=\s|$)/i;
// ls 在 bash 的 -r 是反向排序，只認 -Rec… 與 -Depth。
const PS_LS_RECURSE = /\s-(?:rec\w*(?::\S*)?|depth)(?=\s|$)/i;

const RULES = [
  // R1 find 起點是根。
  (s) => FIND.test(s),
  // R2 ls -R 加根參數。
  (s) => new RegExp(CMD_START + String.raw`ls\s`).test(s) && /\s-[a-zA-Z]*R/.test(s) && ANY_ROOT.test(s),
  // R3 Get-ChildItem／gci／dir（PowerShell）遞迴加根或磁碟根樣式。
  (s) =>
    ((/\b(?:Get-ChildItem|gci|dir)\b/i.test(s) && PS_RECURSE.test(s)) ||
      (new RegExp(CMD_START + 'ls\\b').test(s) && PS_LS_RECURSE.test(s))) &&
    (WIN_OR_SLASH_ROOT.test(s) || WIN_ROOT_PATTERN.test(s)),
  // R4 cmd dir /s 加 Windows 根或磁碟根樣式。
  (s) =>
    new RegExp(CMD_START + 'dir\\b', 'i').test(s) &&
    /\s\/s\b/i.test(s) &&
    (WIN_ROOT_ONLY.test(s) || WIN_ROOT_PATTERN.test(s)),
  // R5 where /r 加 Windows 根。
  (s) => new RegExp(CMD_START + String.raw`where(?:\.exe)?\b`, 'i').test(s) && /\s\/r\b/i.test(s) && WIN_ROOT_ONLY.test(s),
  // R6、R7、R9 rg、fd、du 加根參數。
  (s) => new RegExp(CMD_START + String.raw`(?:rg|fd|fdfind|du)(?:\.exe)?(?=\s)`).test(s) && ANY_ROOT.test(s),
  // R8 tree 加根參數。
  (s) => new RegExp(CMD_START + String.raw`tree(?:\.com|\.exe)?(?=\s)`, 'i').test(s) && ANY_TREE_ROOT.test(s),
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

// 處理引號與命令替換：一般文字換成佔位字，要執行的命令放進 extras。
function scanQuotes(text, isBash, extras) {
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
    if (ch === '`' || COMMAND_FLAG_RE.test(out)) {
      extras.push(content);
      out += ` ${PLACEHOLDER} `;
      continue;
    }
    if (ch === '"') {
      const inner = isBash ? /\$\(([^)]*)\)|`([^`]*)`/g : /\$\(([^)]*)\)/g;
      for (const m of content.matchAll(inner)) extras.push(m[1] !== undefined ? m[1] : m[2]);
    }
    out += /\s/.test(content) ? PLACEHOLDER : content;
  }
  return out;
}

// 把命令文字展開成要逐段比對的命令片段。
function collectSegments(command, isBash, depth) {
  const extras = [];
  const segments = scanQuotes(stripHereDocs(command), isBash, extras).split(SPLIT_RE);
  if (depth < MAX_DEPTH) {
    for (const extra of extras) segments.push(...collectSegments(extra, isBash, depth + 1));
  }
  return segments;
}

function decideUnsafe(payload) {
  const toolName = payload.tool_name;
  if (toolName !== undefined && toolName !== 'Bash' && toolName !== 'PowerShell') return ALLOW;
  const command = payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string' || command === '') return ALLOW;
  const segments = collectSegments(command, toolName !== 'PowerShell', 0);
  if (segments.some((segment) => RULES.some((rule) => rule(segment)))) {
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
