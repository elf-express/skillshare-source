'use strict';
// Superpowers 階段 Guard：Claude Code SessionStart hook。
// e-<數字> 或 <類型>/e-<數字>-<短名> 分支且有狀態檔時，把 ticket、phase、plan 與核准狀態印到 stdout 供新 session 續跑。
// 只用同步 fs，不啟動子行程；hook 永遠 exit 0。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { findGitRoot, readBranch, findState, readApproval, branchTicket } = require('./elf-guard.cjs');

// 路徑統一成正斜線。
function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

// 狀態檔路徑相對 repo 根（正斜線）；不在 repo 底下時原樣回傳。
function relativeFile(gitRoot, file) {
  const prefix = gitRoot.endsWith('/') ? gitRoot : gitRoot + '/';
  const posix = toPosix(file);
  return posix.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase() ? posix.slice(prefix.length) : posix;
}

function summarizeUnsafe(cwd, opts) {
  const approvalsDir = opts.approvalsDir || path.join(os.homedir(), '.claude', 'superpowers', 'approvals');
  const gitRoot = findGitRoot(path.resolve(String(cwd)));
  if (!gitRoot) return null;

  const n = branchTicket(readBranch(gitRoot));
  if (!n) return null;

  const state = findState(gitRoot, n);
  if (state === 'missing' || state === 'invalid') return null;

  const approval = readApproval(approvalsDir, state.plan) ? '已核准' : '未核准';
  const file = relativeFile(gitRoot, state.file);
  return `[superpowers 狀態] ticket=${state.ticket} phase=${state.phase} plan=${state.plan} 核准=${approval}。續跑:讀 ${file} 與 Linear 票。`;
}

// 產生 SessionStart 要注入的狀態摘要；沒有可用狀態時回 null。
function summarize(cwd, opts = {}) {
  try {
    return summarizeUnsafe(cwd, opts || {});
  } catch {
    return null;
  }
}

function main() {
  try {
    let cwd = process.cwd();
    try {
      const payload = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
      if (payload && typeof payload.cwd === 'string' && payload.cwd) cwd = payload.cwd;
    } catch {
      // stdin 無法解析時改用目前目錄。
    }
    const text = summarize(cwd);
    if (text !== null) process.stdout.write(text + '\n');
  } catch {
    // 失敗時不輸出任何內容。
  }
  process.exitCode = 0;
}

module.exports = { summarize };

if (require.main === module) {
  main();
}
