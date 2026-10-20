'use strict';
// elf-guard.cjs 的測試：每個案例用暫存目錄組出假 repo 與核准目錄，不依賴任何外部狀態。

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const guard = require('./elf-guard.cjs');
const sessionStart = require('./elf-sessionstart.cjs');

const tmpRoots = [];

// 建立暫存根目錄，測試結束時統一清除。
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elf-guard-'));
  tmpRoots.push(dir);
  return dir;
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// 建立假 repo。branch 為 null 時 HEAD 寫裸 SHA；worktree 為 true 時 .git 是指向另一個目錄的檔案。
function mkRepo({ branch = 'e-377', worktree = false, stateFile = 'E-367.yaml', state = null } = {}) {
  const tmp = mkTmp();
  const repo = path.join(tmp, 'repo');
  const approvalsDir = path.join(tmp, 'approvals');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(approvalsDir, { recursive: true });
  const head = branch ? `ref: refs/heads/${branch}\n` : '0123456789abcdef0123456789abcdef01234567\n';
  if (worktree) {
    const gitdir = path.join(tmp, 'gitdir');
    writeFile(path.join(gitdir, 'HEAD'), head);
    writeFile(path.join(repo, '.git'), `gitdir: ${gitdir.replace(/\\/g, '/')}\n`);
  } else {
    writeFile(path.join(repo, '.git', 'HEAD'), head);
  }
  if (state !== null) {
    writeFile(path.join(repo, 'docs', 'superpowers', 'state', stateFile), state);
  }
  return { repo, approvalsDir };
}

const STATE_E377 = 'ticket: E-367\nphase: plan\nplan: E-377\n';
const APPROVAL_FULL = 'ticket: E-377\napproved_at: 2026-10-21T10:00:00+08:00\nauditor: Eddie\nlinear_comment_id: 1a2b3c\n';

function write(repo, ...segments) {
  return { tool_name: 'Write', tool_input: { file_path: path.join(repo, ...segments) } };
}

function run(payload, approvalsDir) {
  return guard.decide(payload, { approvalsDir });
}

// 往上找不到 .git 的位置，供「repo 外」案例使用。
function findDirWithoutGit() {
  const hasGitAbove = (start) => {
    let dir = start;
    for (;;) {
      if (fs.existsSync(path.join(dir, '.git'))) return true;
      const parent = path.dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  };
  const candidates = [os.tmpdir(), path.parse(os.tmpdir()).root];
  for (const dir of candidates) {
    if (!hasGitAbove(dir)) return dir;
  }
  throw new Error('找不到往上沒有 .git 的位置，無法執行案例 1.3');
}

const cases = [
  ['1.1 Bash 寫入 approvals 路徑 -> deny', () => {
    const { approvalsDir } = mkRepo();
    const d = run({ tool_name: 'Bash', tool_input: { command: 'echo x > ~/.claude/superpowers/approvals/E-377.yaml' } }, approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.ok(d.reason && d.reason.length > 0);
  }],
  ['1.2 Bash 含 superpowers\\approvals（反斜線）-> deny', () => {
    const { approvalsDir } = mkRepo();
    const d = run({ tool_name: 'Bash', tool_input: { command: 'type nul > C:\\Users\\a\\.claude\\Superpowers\\Approvals\\E-377.yaml' } }, approvalsDir);
    assert.strictEqual(d.decision, 'deny');
  }],
  ['1.3 Write 到 repo 外 -> allow', () => {
    const { approvalsDir } = mkRepo({ state: STATE_E377 });
    const outside = path.join(findDirWithoutGit(), 'elf-guard-no-such-dir', 'x.cjs');
    assert.strictEqual(run({ tool_name: 'Write', tool_input: { file_path: outside } }, approvalsDir).decision, 'allow');
  }],
  ['1.4 branch main 寫實作檔 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'main', state: STATE_E377 });
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.5 branch e-377 沒有狀態檔 -> allow', () => {
    const { repo, approvalsDir } = mkRepo();
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.6 核准檔 auditor 空白 -> deny', () => {
    const { repo, approvalsDir } = mkRepo({ state: STATE_E377 });
    writeFile(path.join(approvalsDir, 'E-377.yaml'), 'ticket: E-377\napproved_at: 2026-10-21\nauditor:\nlinear_comment_id: 1a2b3c\n');
    const d = run(write(repo, 'scripts', 'x.cjs'), approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.match(d.reason, /E-377/);
    assert.match(d.reason, /計畫未核准/);
  }],
  ['1.7 worktree 未核准寫實作檔 -> deny', () => {
    const { repo, approvalsDir } = mkRepo({ worktree: true, state: STATE_E377 });
    assert.strictEqual(guard.readBranch(guard.findGitRoot(repo)), 'e-377');
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'deny');
  }],
  ['1.8 worktree 核准檔齊全 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ worktree: true, state: STATE_E377 });
    writeFile(path.join(approvalsDir, 'E-377.yaml'), APPROVAL_FULL);
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.9 worktree 未核准寫 docs\\superpowers\\plans\\p.md（反斜線）-> allow', () => {
    const { repo, approvalsDir } = mkRepo({ worktree: true, state: STATE_E377 });
    const file = `${repo}\\docs\\superpowers\\plans\\p.md`;
    assert.strictEqual(run({ tool_name: 'Write', tool_input: { file_path: file } }, approvalsDir).decision, 'allow');
  }],
  ['1.10 worktree 未核准 NotebookEdit 實作檔 -> deny', () => {
    const { repo, approvalsDir } = mkRepo({ worktree: true, state: STATE_E377 });
    const payload = { tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(repo, 'src', 'a.ipynb') } };
    assert.strictEqual(run(payload, approvalsDir).decision, 'deny');
  }],
  ['1.11 狀態檔與核准檔 CRLF + BOM -> allow', () => {
    const crlf = (text) => '\uFEFF' + text.replace(/\n/g, '\r\n');
    const { repo, approvalsDir } = mkRepo({ state: crlf(STATE_E377) });
    // 沒有核准檔時必須 deny，證明 CRLF + BOM 的狀態檔確實解析成功。
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'deny');
    writeFile(path.join(approvalsDir, 'E-377.yaml'), crlf(APPROVAL_FULL));
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.12 狀態檔解析不出 ticket/plan -> allow（fail-open）', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'e-367', state: 'this is not yaml\n{{{\n' });
    assert.strictEqual(guard.findState(guard.findGitRoot(repo), 367), 'invalid');
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.13 detached HEAD -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ branch: null, state: STATE_E377 });
    assert.strictEqual(guard.readBranch(guard.findGitRoot(repo)), null);
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.14 branch e-377、狀態檔 plan 是 E-999 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ state: 'ticket: E-367\nphase: plan\nplan: E-999\n' });
    assert.strictEqual(guard.findState(guard.findGitRoot(repo), 377), 'missing');
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.15 branch e-367 Spec 分支、plan 空白 -> deny', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'e-367', state: 'ticket: E-367\nphase: spec\nplan:\n' });
    const d = run(write(repo, 'scripts', 'x.cjs'), approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.match(d.reason, /E-367/);
  }],
  ['1.16 PowerShell 寫入 approvals 路徑 -> deny', () => {
    const { approvalsDir } = mkRepo();
    const command = 'Set-Content $HOME\\.claude\\superpowers\\approvals\\E-377.yaml x';
    assert.strictEqual(run({ tool_name: 'PowerShell', tool_input: { command } }, approvalsDir).decision, 'deny');
  }],
  ['1.17 Write 核准目錄下的檔案 -> deny', () => {
    const { approvalsDir } = mkRepo();
    const file = path.join(os.homedir(), '.claude', 'superpowers', 'approvals', 'E-377.yaml').replace(/\\/g, '/');
    const d = run({ tool_name: 'Write', tool_input: { file_path: file } }, approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.ok(d.reason && d.reason.length > 0);
  }],
  ['1.18 Edit 核准目錄下的檔案（反斜線）-> deny', () => {
    const { approvalsDir } = mkRepo();
    const file = path.join(os.homedir(), '.claude', 'superpowers', 'approvals', 'E-377.yaml').replace(/\//g, '\\');
    assert.strictEqual(run({ tool_name: 'Edit', tool_input: { file_path: file } }, approvalsDir).decision, 'deny');
  }],
  ['2.1 e-377 分支、未核准 -> 狀態摘要含 ticket、phase、未核准、狀態檔路徑', () => {
    const { repo, approvalsDir } = mkRepo({ state: STATE_E377 });
    const text = sessionStart.summarize(repo, { approvalsDir });
    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('ticket=E-367'), text);
    assert.ok(text.includes('phase=plan'), text);
    assert.ok(text.includes('plan=E-377'), text);
    assert.ok(text.includes('未核准'), text);
    assert.ok(text.includes('state/E-367.yaml'), text);
    assert.ok(text.includes('docs/superpowers/state/E-367.yaml'), text);
  }],
  ['2.2 核准檔齊全 -> 狀態摘要含已核准', () => {
    const { repo, approvalsDir } = mkRepo({ state: STATE_E377 });
    writeFile(path.join(approvalsDir, 'E-377.yaml'), APPROVAL_FULL);
    const text = sessionStart.summarize(repo, { approvalsDir });
    assert.ok(text.includes('已核准'), text);
    assert.ok(!text.includes('未核准'), text);
  }],
  ['2.3 branch main -> null', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'main', state: STATE_E377 });
    assert.strictEqual(sessionStart.summarize(repo, { approvalsDir }), null);
  }],
  ['2.4 沒有狀態檔 -> null', () => {
    const { repo, approvalsDir } = mkRepo();
    assert.strictEqual(sessionStart.summarize(repo, { approvalsDir }), null);
  }],
  ['2.5 狀態檔無法解析、detached HEAD、repo 外 -> null', () => {
    const bad = mkRepo({ state: '# 空檔\n' });
    assert.strictEqual(sessionStart.summarize(bad.repo, { approvalsDir: bad.approvalsDir }), null);
    const detached = mkRepo({ branch: null, state: STATE_E377 });
    assert.strictEqual(sessionStart.summarize(detached.repo, { approvalsDir: detached.approvalsDir }), null);
    assert.strictEqual(sessionStart.summarize(path.join(findDirWithoutGit(), 'elf-guard-no-such-dir')), null);
  }],
  ['2.6 從子目錄與 worktree 的 .git 檔案也能摘要', () => {
    const { repo, approvalsDir } = mkRepo({ worktree: true, state: STATE_E377 });
    const sub = path.join(repo, 'docs', 'superpowers');
    const text = sessionStart.summarize(sub, { approvalsDir });
    assert.ok(text && text.includes('ticket=E-367'), String(text));
  }],
  ['2.7 CLI：stdin cwd 有狀態檔 -> 印出摘要並 exit 0；無狀態檔 -> 無輸出並 exit 0', () => {
    const script = path.join(__dirname, 'elf-sessionstart.cjs');
    const withState = mkRepo({ state: STATE_E377 });
    const r1 = childProcess.spawnSync(process.execPath, [script], { input: JSON.stringify({ cwd: withState.repo }), encoding: 'utf8' });
    assert.strictEqual(r1.status, 0);
    assert.ok(r1.stdout.includes('ticket=E-367') && r1.stdout.endsWith('\n'), r1.stdout);
    const noState = mkRepo();
    const r2 = childProcess.spawnSync(process.execPath, [script], { input: JSON.stringify({ cwd: noState.repo }), encoding: 'utf8' });
    assert.strictEqual(r2.status, 0);
    assert.strictEqual(r2.stdout, '');
    const r3 = childProcess.spawnSync(process.execPath, [script], { input: 'not json', encoding: 'utf8' });
    assert.strictEqual(r3.status, 0);
  }],
  ['介面 五個 export 皆為函式', () => {
    for (const name of ['decide', 'findGitRoot', 'readBranch', 'findState', 'readApproval']) {
      assert.strictEqual(typeof guard[name], 'function', name);
    }
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}\n  ${String(err && err.message).split('\n').join('\n  ')}`);
  }
}

for (const dir of tmpRoots) {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
