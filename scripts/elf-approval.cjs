'use strict';
// Superpowers 核准憑證建立器：依 AI 從 Linear 讀出的 Plan 描述與留言，判斷核准留言、計算 Plan 內容雜湊，
// 並建立（create）、驗證（verify）、撤回（revoke）單一 Plan 的核准憑證。
// 用法：node elf-approval.cjs create|verify --plan E-<N> --input <json>
//       node elf-approval.cjs revoke --plan E-<N> [--reason <文字>]
// exit 0＝成功、1＝驗證不通過、2＝參數錯誤。只用同步 fs 與 crypto，不啟動子行程、不連網路。

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { APPROVER_ID, CREDENTIAL_FIELDS, readCredential } = require('./elf-guard.cjs');

const TICKET_RE = /^E-\d+$/;
// 憑證欄位值不得含換行、# 與引號：單層 YAML 的行級解析會把它們讀成別的意思。
const SAFE_VALUE_RE = /^[^\r\n#"']+$/;

const FENCE_RE = /^[ \t]*```/;
const CHECKED_RE = /^([ \t]*)- \[[xX]\]/;
const MODIFIED_RE = /^計畫已修改 v(\d+)/;
const REVOKED_RE = /^核准撤回/;
const APPROVED_RE = /^計畫已核准(?: v(\d+))?（(\d{4}-\d{2}-\d{2})，審計員：([^）\n]+)）/;

// 正規化 Plan 描述：換行統一為 LF；圍欄外行首的已勾 checkbox 改回未勾；結尾恰好一個 LF。
function normalizeDescription(text) {
  let inFence = false;
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : line.replace(CHECKED_RE, '$1- [ ]');
  });
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

// 正規化後對 UTF-8 位元組算 SHA-256，回傳 `sha256:<hex>`。
function hashDescription(text) {
  return 'sha256:' + crypto.createHash('sha256').update(normalizeDescription(text), 'utf8').digest('hex');
}

// 依 createdAt 由舊到新找出目前有效的核准留言；修改與撤回不限作者，核准只認 APPROVER_ID。
function findApproval(comments) {
  const sorted = (Array.isArray(comments) ? comments : [])
    .filter((c) => c && typeof c.body === 'string')
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  let required = 1;
  let current = null;
  let lastBlock = '';
  for (const c of sorted) {
    const body = c.body.replace(/^\s+/, '');
    const modified = MODIFIED_RE.exec(body);
    if (modified) {
      required = Math.max(required, Number(modified[1]));
      current = null;
      lastBlock = `計畫已修改 v${modified[1]} 之後沒有對應版號的核准留言`;
      continue;
    }
    if (REVOKED_RE.test(body)) {
      current = null;
      lastBlock = '最後一則核准之後有「核准撤回」';
      continue;
    }
    const approved = APPROVED_RE.exec(body);
    if (!approved || !c.author || c.author.id !== APPROVER_ID) continue;
    const version = approved[1] ? Number(approved[1]) : 1;
    if (version < required) continue;
    current = { ok: true, comment: c, auditor: approved[3].trim(), approvedAt: approved[2], version };
  }
  if (current) return current;
  return { ok: false, reason: lastBlock ? `找不到有效的核准留言：${lastBlock}` : '找不到有效的核准留言' };
}

function defaultApprovalsDir() {
  return path.join(os.homedir(), '.claude', 'superpowers', 'approvals');
}

// 檢查 --plan 與輸入 JSON；不通過回 reason 字串，通過回 null。
function checkInput(input, plan) {
  if (typeof plan !== 'string' || !TICKET_RE.test(plan)) return `Plan 編號格式不符：${plan}`;
  if (!input || typeof input !== 'object') return '輸入不是 JSON 物件';
  if (input.plan !== plan) return `輸入的 plan（${input.plan}）與 --plan（${plan}）不同`;
  if (typeof input.spec !== 'string' || !TICKET_RE.test(input.spec)) return `輸入的 spec 格式不符：${input.spec}`;
  if (typeof input.description !== 'string' || input.description === '') return '輸入缺少 Plan 描述';
  if (!Array.isArray(input.comments)) return '輸入缺少留言陣列';
  return null;
}

// 原子寫入：同目錄暫存檔（檔名不符合 E-<數字>.yaml）寫完再 rename。
function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text, { encoding: 'utf8' });
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

// 依有效核准留言建立單一 Plan 的核准憑證。
function createCredential(input, { plan, approvalsDir = defaultApprovalsDir() } = {}) {
  const bad = checkInput(input, plan);
  if (bad) return { ok: false, reason: bad };
  const found = findApproval(input.comments);
  if (!found.ok) return { ok: false, reason: found.reason };
  const credential = {
    ticket: plan,
    plan,
    spec: input.spec,
    approver_id: found.comment.author.id,
    linear_comment_id: String(found.comment.id),
    comment_created_at: String(found.comment.createdAt),
    approved_at: found.approvedAt,
    auditor: found.auditor,
    plan_hash: hashDescription(input.description),
  };
  for (const key of CREDENTIAL_FIELDS) {
    if (!SAFE_VALUE_RE.test(credential[key])) return { ok: false, reason: `欄位 ${key} 的值不能寫入憑證：${credential[key]}` };
  }
  const file = path.join(approvalsDir, plan + '.yaml');
  try {
    fs.mkdirSync(approvalsDir, { recursive: true });
    writeAtomic(file, CREDENTIAL_FIELDS.map((key) => `${key}: ${credential[key]}\n`).join(''));
  } catch (err) {
    return { ok: false, reason: `寫入核准憑證失敗：${err.message}` };
  }
  return { ok: true, credential, file };
}

// 驗證本機憑證仍對應目前有效的核准留言與 Plan 描述；只讀不刪。
function verifyCredential(input, { plan, approvalsDir = defaultApprovalsDir() } = {}) {
  const bad = checkInput(input, plan);
  if (bad) return { ok: false, reason: bad, action: 'stop' };
  const credential = readCredential(approvalsDir, plan);
  if (!credential) return { ok: false, reason: '沒有有效的核准憑證（不存在、損壞或欄位不符）', action: 'stop' };
  if (credential.spec !== input.spec) return { ok: false, reason: `憑證的 spec（${credential.spec}）與輸入不同`, action: 'stop' };
  const found = findApproval(input.comments);
  if (!found.ok) return { ok: false, reason: found.reason, action: 'revoke' };
  if (!input.comments.some((c) => c && String(c.id) === credential.linear_comment_id)) {
    return { ok: false, reason: `憑證引用的核准留言 ${credential.linear_comment_id} 已不在 Plan 上`, action: 'revoke' };
  }
  if (String(found.comment.id) !== credential.linear_comment_id) {
    return { ok: false, reason: `目前有效的核准留言是 ${found.comment.id}，不是憑證引用的那則`, action: 'recreate' };
  }
  const hash = hashDescription(input.description);
  if (hash !== credential.plan_hash) {
    return { ok: false, reason: `Plan 描述雜湊不符（憑證 ${credential.plan_hash}，目前 ${hash}）`, action: 'stop' };
  }
  return { ok: true, credential };
}

// 刪除單一 Plan 的核准憑證；檔案本來就不存在時 removed 為 false。
function revokeCredential({ plan, approvalsDir = defaultApprovalsDir() } = {}) {
  if (typeof plan !== 'string' || !TICKET_RE.test(plan)) return { removed: false };
  const file = path.join(approvalsDir, plan + '.yaml');
  if (!fs.existsSync(file)) return { removed: false };
  fs.rmSync(file);
  return { removed: true };
}

const NEXT_STEP = {
  revoke: '執行 revoke 刪除憑證、停止實作，並在 Plan 留言',
  recreate: '依目前有效的核准留言重新執行 create',
  stop: '停下回報 Eddie，不開工、不自行重建憑證',
};

function parseArgs(argv) {
  const args = { mode: argv[0] };
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i];
    if (!/^--(plan|input|approvals-dir|reason)$/.test(key) || i + 1 >= argv.length) return null;
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

function printSummary(mode, plan, spec, credential, result) {
  const lines = [`[elf-approval] ${mode} ${plan}${spec ? `（Spec ${spec}）` : ''}：${result}`];
  if (credential) {
    lines.push(`  linear_comment_id: ${credential.linear_comment_id}`);
    lines.push(`  核准者: ${credential.approver_id}`);
    lines.push(`  留言時間: ${credential.comment_created_at}`);
    lines.push(`  審計員: ${credential.auditor}（${credential.approved_at}）`);
    lines.push(`  plan_hash: ${credential.plan_hash}`);
    lines.push(`  檔案: ${plan}.yaml`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args || !['create', 'verify', 'revoke'].includes(args.mode) || !args.plan || (args.mode !== 'revoke' && !args.input)) {
    process.stderr.write('用法：node elf-approval.cjs create|verify --plan E-<N> --input <json>\n      node elf-approval.cjs revoke --plan E-<N> [--reason <文字>]\n');
    return 2;
  }
  const opts = { plan: args.plan, approvalsDir: args['approvals-dir'] || defaultApprovalsDir() };
  if (args.mode === 'revoke') {
    if (!TICKET_RE.test(args.plan)) {
      process.stderr.write(`Plan 編號格式不符：${args.plan}\n`);
      return 2;
    }
    const { removed } = revokeCredential(opts);
    printSummary('revoke', args.plan, '', null, removed ? '已刪除核准憑證' : '沒有核准憑證可刪');
    if (args.reason) process.stdout.write(`  原因: ${args.reason}\n`);
    return 0;
  }
  let input;
  try {
    input = JSON.parse(fs.readFileSync(args.input, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    printSummary(args.mode, args.plan, '', null, '失敗');
    process.stdout.write(`  原因: 讀不到輸入 JSON（${err.message}）\n  建議動作: ${NEXT_STEP.stop}\n`);
    return 1;
  }
  const result = args.mode === 'create' ? createCredential(input, opts) : verifyCredential(input, opts);
  if (result.ok) {
    printSummary(args.mode, args.plan, input.spec, result.credential, args.mode === 'create' ? '已建立核准憑證' : '驗證通過');
    return 0;
  }
  printSummary(args.mode, args.plan, input && input.spec, null, '失敗');
  process.stdout.write(`  原因: ${result.reason}\n  建議動作: ${NEXT_STEP[result.action || 'stop']}\n`);
  return 1;
}

module.exports = {
  normalizeDescription,
  hashDescription,
  findApproval,
  createCredential,
  verifyCredential,
  revokeCredential,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
