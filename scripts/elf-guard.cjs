'use strict';
// Superpowers 階段 Guard：Claude Code PreToolUse hook。
// 計畫未核准前，檔案寫入工具禁止修改 docs/superpowers/ 以外的檔案；Bash／PowerShell 指令與檔案工具都禁止碰核准目錄。
// 只用同步 fs，不啟動子行程；hook 永遠 exit 0，以 stdout JSON 表達 deny。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WHITELIST_PREFIX = 'docs/superpowers/';
// 核准憑證的九個欄位（E-399）；舊 E-377 的四欄位核准檔缺欄位，一律視為未核准。
const CREDENTIAL_FIELDS = [
  'ticket',
  'plan',
  'spec',
  'approver_id',
  'linear_comment_id',
  'comment_created_at',
  'approved_at',
  'auditor',
  'plan_hash',
];
// 核准留言認可的核准者 id：Linear user（Eddie）與 Multica 的 Gatekeeper agent。
const APPROVER_IDS = [
  'f7c5792e-6252-49dd-8210-b15b30c5229d', // Linear user（Eddie）
  '2c8a076b-e4c0-4fc7-81b9-3ea21cd3ac82', // Multica Gatekeeper agent
];
// Linear 核准者 id，供既有呼叫端與測試沿用。
const APPROVER_ID = APPROVER_IDS[0];
const TICKET_RE = /^E-\d+$/;
const PLAN_HASH_RE = /^sha256:[0-9a-f]{64}$/;

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

// 從分支名稱取出單號：Orca 的 e-<N>，或團隊規範的 <類型>/e-<N>-<英文短名>
// （elf-team-rule 規則 10：類型 feat、fix、docs、chore、test、hotfix；短名小寫英數字，以 - 連接）。其餘回 null。
const BRANCH_RE = /^(?:e-(\d+)|(?:feat|fix|docs|chore|test|hotfix)\/e-(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*)$/;

function branchTicket(branch) {
  if (typeof branch !== 'string') return null;
  const m = BRANCH_RE.exec(branch);
  return m ? m[1] || m[2] : null;
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

// 讀核准憑證 <dir>/<plan>.yaml：九欄皆非空、ticket 與 plan 等於檔名、spec 為 E-<數字>、
// approver_id 在核准者名單內、plan_hash 為 sha256 格式才回傳欄位物件；其餘回 null。
function readCredential(dir, plan) {
  if (typeof plan !== 'string' || !TICKET_RE.test(plan)) return null;
  try {
    const text = readText(path.join(dir, plan + '.yaml'));
    const cred = {};
    for (const key of CREDENTIAL_FIELDS) {
      const value = readField(text, key);
      if (value === '') return null;
      cred[key] = value;
    }
    if (cred.ticket !== plan || cred.plan !== plan) return null;
    if (!TICKET_RE.test(cred.spec) || !APPROVER_IDS.includes(cred.approver_id) || !PLAN_HASH_RE.test(cred.plan_hash)) return null;
    return cred;
  } catch {
    return null;
  }
}

// 該 Plan 有格式正確的核准憑證才算已核准。
function readApproval(dir, plan) {
  return readCredential(dir, plan) !== null;
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
    return deny('Superpowers 階段 Guard：禁止用 Bash 或 PowerShell 存取 superpowers/approvals 核准目錄。核准憑證只能用核准憑證建立器（elf-approval.cjs）建立。');
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
    return deny('Superpowers 階段 Guard：禁止用檔案工具寫入 superpowers/approvals 核准目錄。核准憑證只能用核准憑證建立器（elf-approval.cjs）建立。');
  }
  // 找出 repo 根。
  const gitRoot = findGitRoot(target);
  if (!gitRoot) return ALLOW;

  // 3. 只管 e-<數字> 與 <類型>/e-<數字>-<短名> 分支。
  const n = branchTicket(readBranch(gitRoot));
  if (!n) return ALLOW;

  // 4. 沒有對應狀態檔或狀態檔無法解析：放行。
  const state = findState(gitRoot, n);
  if (state === 'missing' || state === 'invalid') return ALLOW;

  // 5. 計畫已核准：放行。
  if (readApproval(approvalsDir, state.plan)) return ALLOW;

  // 6. 未核准時只允許 docs/superpowers/ 底下的檔案。
  const rel = relativeToRoot(gitRoot, target);
  if (rel !== null && rel.toLowerCase().startsWith(WHITELIST_PREFIX)) return ALLOW;
  const id = state.plan || state.ticket;
  return deny(
    `Superpowers 階段 Guard：${id} 計畫未核准，目前只能修改 docs/superpowers/ 底下的檔案。` +
      '請先完成 spec／plan，由審計員在 Linear 或 Multica 留言核准後，用核准憑證建立器建立核准憑證，再繼續實作。',
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

module.exports = {
  decide,
  findGitRoot,
  readBranch,
  findState,
  readApproval,
  readCredential,
  branchTicket,
  APPROVER_ID,
  APPROVER_IDS,
  CREDENTIAL_FIELDS,
};

if (require.main === module) {
  main();
}
