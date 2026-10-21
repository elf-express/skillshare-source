'use strict';
// Superpowers 階段 Guard：Claude Code PreToolUse hook。
// 計畫未核准前，檔案寫入工具禁止修改 docs/superpowers/ 以外的檔案；Bash／PowerShell 指令與檔案工具都禁止碰核准目錄。
// 只用同步 fs，不啟動子行程；hook 永遠 exit 0，以 stdout JSON 表達 deny。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WHITELIST_PREFIX = 'docs/superpowers/';
const APPROVAL_FIELDS = ['ticket', 'approved_at', 'auditor', 'linear_comment_id'];

const ALLOW = { decision: 'allow' };

// 路徑統一成正斜線。
function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function isAbsolutePosix(p) {
  return /^([A-Za-z]:)?\//.test(p);
}

// 讀 UTF-8 文字並去掉 BOM。
function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

// 取單層 YAML 欄位的值（行級解析，容忍 CRLF）；欄位不存在或空白回空字串。
function readField(text, key) {
  const m = new RegExp('^[ \\t]*' + key + '[ \\t]*:[ \\t]*([^\\r\\n]*)', 'm').exec(text);
  if (!m) return '';
  return m[1]
    .replace(/(^|[ \t])#.*$/, '')
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();
}

// 從 startPath 往上逐層找 .git（目錄或檔案），回傳正斜線的 repo 根；找不到回 null。
function findGitRoot(startPath) {
  let dir = path.posix.normalize(toPosix(startPath));
  for (;;) {
    if (fs.existsSync(dir + '/.git')) return dir;
    const parent = path.posix.dirname(dir);
    if (parent === dir || parent === '.') return null;
    dir = parent;
  }
}

// 讀目前 branch 名稱；.git 是檔案時跟隨 gitdir 指標；detached 或讀取失敗回 null。
function readBranch(gitRoot) {
  try {
    let gitDir = gitRoot + '/.git';
    if (fs.statSync(gitDir).isFile()) {
      const m = /^gitdir:[ \t]*([^\r\n]+)/m.exec(readText(gitDir));
      if (!m) return null;
      const target = toPosix(m[1].trim());
      gitDir = isAbsolutePosix(target) ? target : path.posix.join(gitRoot, target);
    }
    const head = /^ref:[ \t]*refs\/heads\/([^\r\n]+)/m.exec(readText(gitDir + '/HEAD'));
    return head ? head[1].trim() : null;
  } catch {
    return null;
  }
}

// 解析單一狀態檔；ticket 與 plan 都解析不出值回 null。
function parseState(file) {
  try {
    const text = readText(file);
    const ticket = readField(text, 'ticket');
    const plan = readField(text, 'plan');
    if (!ticket && !plan) return null;
    return { file, ticket, phase: readField(text, 'phase'), plan };
  } catch {
    return null;
  }
}

// 找 E-<n> 對應的狀態檔：先讀 state/E-<n>.yaml，沒有就掃 state/*.yaml 取 plan 等於 E-<n> 的第一份。
function findState(gitRoot, n) {
  const stateDir = gitRoot + '/docs/superpowers/state';
  const id = 'E-' + n;
  const direct = stateDir + '/' + id + '.yaml';
  if (fs.existsSync(direct)) return parseState(direct) || 'invalid';
  let names;
  try {
    names = fs.readdirSync(stateDir).filter((name) => name.endsWith('.yaml')).sort();
  } catch {
    return 'missing';
  }
  for (const name of names) {
    const state = parseState(stateDir + '/' + name);
    if (state && state.plan === id) return state;
  }
  return 'missing';
}

// 核准檔 <dir>/<plan>.yaml 的四個欄位都非空才算已核准；其餘一律視為未核准。
function readApproval(dir, plan) {
  if (!plan || path.basename(plan) !== plan) return false;
  try {
    const text = readText(path.join(dir, plan + '.yaml'));
    return APPROVAL_FIELDS.every((key) => readField(text, key) !== '');
  } catch {
    return false;
  }
}

// 目標路徑相對 repo 根的位置（正斜線）；不在 repo 底下回 null。
function relativeToRoot(root, target) {
  const prefix = root.endsWith('/') ? root : root + '/';
  if (target.length < prefix.length || target.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) {
    return null;
  }
  return target.slice(prefix.length);
}

function deny(reason) {
  return { decision: 'deny', reason };
}

function decideUnsafe(payload, opts) {
  const approvalsDir = opts.approvalsDir || path.join(os.homedir(), '.claude', 'superpowers', 'approvals');
  const toolName = payload.tool_name;
  const input = payload.tool_input || {};

  // 1. Bash／PowerShell 碰核准目錄：核准前後都擋。
  if ((toolName === 'Bash' || toolName === 'PowerShell') && /superpowers[\\/]approvals/i.test(String(input.command || ''))) {
    return deny('Superpowers 階段 Guard：禁止用 Bash 或 PowerShell 存取 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。');
  }

  // 2. 取檔案類工具的目標路徑；目標在核准目錄底下一律擋。
  const rawTarget = input.file_path || input.notebook_path;
  if (!rawTarget) return ALLOW;
  let target = toPosix(rawTarget);
  if (!isAbsolutePosix(target)) {
    target = path.posix.join(toPosix(payload.cwd || process.cwd()), target);
  }
  target = path.posix.normalize(target);
  if (/superpowers\/approvals/i.test(target)) {
    return deny('Superpowers 階段 Guard：禁止用檔案工具寫入 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。');
  }
  // 找出 repo 根。
  const gitRoot = findGitRoot(target);
  if (!gitRoot) return ALLOW;

  // 3. 只管 e-<數字> 分支。
  const branch = readBranch(gitRoot);
  const m = branch && /^e-(\d+)$/.exec(branch);
  if (!m) return ALLOW;

  // 4. 沒有對應狀態檔或狀態檔無法解析：放行。
  const state = findState(gitRoot, m[1]);
  if (state === 'missing' || state === 'invalid') return ALLOW;

  // 5. 計畫已核准：放行。
  if (readApproval(approvalsDir, state.plan)) return ALLOW;

  // 6. 未核准時只允許 docs/superpowers/ 底下的檔案。
  const rel = relativeToRoot(gitRoot, target);
  if (rel !== null && rel.toLowerCase().startsWith(WHITELIST_PREFIX)) return ALLOW;
  const id = state.plan || state.ticket;
  return deny(
    `Superpowers 階段 Guard：${id} 計畫未核准，目前只能修改 docs/superpowers/ 底下的檔案。` +
      '請先完成 spec／plan，由審計員在 Linear 核准後建立核准檔，再繼續實作。',
  );
}

// 判斷單次工具呼叫；Guard 自身發生例外時放行。
function decide(payload, opts = {}) {
  try {
    return decideUnsafe(payload || {}, opts || {});
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
    // Guard 自身失敗時不輸出任何內容，等同放行。
  }
  process.exitCode = 0;
}

module.exports = { decide, findGitRoot, readBranch, findState, readApproval };

if (require.main === module) {
  main();
}
