'use strict';
// Superpowers 核准憑證建立器：依 AI 從 Linear 讀出的 Plan 描述與留言，判斷核准留言、計算 Plan 內容雜湊。
// 只用同步 fs 與 crypto，不啟動子行程、不連網路。

const crypto = require('node:crypto');

const { APPROVER_ID } = require('./elf-guard.cjs');

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

module.exports = { normalizeDescription, hashDescription, findApproval };
