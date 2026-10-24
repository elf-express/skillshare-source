'use strict';
// elf-guard.cjs 的測試：每個案例用暫存目錄組出假 repo 與核准目錄，不依賴任何外部狀態。

const assert = require('node:assert');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const guard = require('./elf-guard.cjs');
const sessionStart = require('./elf-sessionstart.cjs');
const approval = require('./elf-approval.cjs');

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
// 新格式核准憑證（E-399，九個欄位）；overrides 的值為 null 時省略該欄。
function credentialText(plan, spec, overrides = {}) {
  const values = {
    ticket: plan,
    plan,
    spec,
    approver_id: guard.APPROVER_ID,
    linear_comment_id: '1a2b3c',
    comment_created_at: '2026-10-21T02:00:00.000Z',
    approved_at: '2026-10-21',
    auditor: 'Codex',
    plan_hash: approval.hashDescription('# ' + plan),
    ...overrides,
  };
  return Object.entries(values)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}\n`)
    .join('');
}
// 舊 E-377 四欄位核准檔，新版 Guard 一律視為未核准。
const OLD_APPROVAL = 'ticket: E-377\napproved_at: 2026-10-21T10:00:00+08:00\nauditor: Eddie\nlinear_comment_id: 1a2b3c\n';
const APPROVAL_FULL = credentialText('E-377', 'E-367');
// 團隊流程（elf-linear-superpowers 步驟 2）：狀態檔用 Spec 編號，分支用 Plan 編號。
const STATE_E372 = 'ticket: E-369\nphase: plan\nplan: E-372\n';
const APPROVAL_E372 = credentialText('E-372', 'E-369', { linear_comment_id: '4d5e6f', auditor: 'Fable 5.1' });

function write(repo, ...segments) {
  return { tool_name: 'Write', tool_input: { file_path: path.join(repo, ...segments) } };
}

function run(payload, approvalsDir) {
  return guard.decide(payload, { approvalsDir });
}

const OTHER_ID = '00000000-0000-0000-0000-000000000000';

// 組一則留言；createdAt 以分鐘偏移產生，方便排序案例。
function comment(id, body, minute, authorId = guard.APPROVER_ID) {
  const createdAt = new Date(Date.UTC(2026, 9, 25, 0, minute)).toISOString();
  return { id, body, createdAt, author: { id: authorId } };
}

const APPROVE_V1 = '計畫已核准（2026-10-25，審計員：Codex）';
const PLAN_DESC = '# [Plan] E-399\n\n- [ ] 步驟 1.1：寫測試\n- [ ] 步驟 1.2：跑測試\n';

// 建立器的輸入：形狀同 Linear MCP 的 get_issue／list_comments。
function planInput(overrides = {}) {
  return { plan: 'E-399', spec: 'E-397', description: PLAN_DESC, comments: [comment('c1', APPROVE_V1, 1)], ...overrides };
}

// 建立獨立的暫存根目錄與其中的 approvals 目錄。
function mkApprovalsDir() {
  const dir = path.join(mkTmp(), 'approvals');
  fs.mkdirSync(dir);
  return dir;
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
    writeFile(path.join(approvalsDir, 'E-377.yaml'), credentialText('E-377', 'E-367', { auditor: '' }));
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
  ['1.19 Write 路徑含 ./approvals（未正規化）-> deny', () => {
    const { approvalsDir } = mkRepo();
    const file = path.join(os.homedir(), '.claude', 'superpowers').replace(/\\/g, '/') + '/./approvals/E-377.yaml';
    const d = run({ tool_name: 'Write', tool_input: { file_path: file } }, approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.ok(d.reason && d.reason.length > 0);
  }],
  ['1.20 Write 路徑含 superpowers//approvals（重複斜線）-> deny', () => {
    const { approvalsDir } = mkRepo();
    const file = path.join(os.homedir(), '.claude', 'superpowers').replace(/\\/g, '/') + '//approvals/E-377.yaml';
    assert.strictEqual(run({ tool_name: 'Write', tool_input: { file_path: file } }, approvalsDir).decision, 'deny');
  }],
  ['1.21 團隊分支 feat/e-372-superpowers-v7 未核准寫實作檔 -> deny；寫 docs/superpowers -> allow；核准檔齊全 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'feat/e-372-superpowers-v7', stateFile: 'E-369.yaml', state: STATE_E372 });
    const d = run(write(repo, 'scripts', 'x.cjs'), approvalsDir);
    assert.strictEqual(d.decision, 'deny');
    assert.match(d.reason, /E-372/);
    assert.strictEqual(run(write(repo, 'docs', 'superpowers', 'plans', 'p.md'), approvalsDir).decision, 'allow');
    writeFile(path.join(approvalsDir, 'E-372.yaml'), APPROVAL_E372);
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.22 單一開發工作單分支 fix/e-361-powershell-home-guard、沒有對應的狀態檔 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'fix/e-361-powershell-home-guard', state: STATE_E377 });
    assert.strictEqual(guard.findState(guard.findGitRoot(repo), 361), 'missing');
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
  }],
  ['1.23 branchTicket 認 e-<N> 與 <類型>/e-<N>-<短名>，其餘回 null', () => {
    const hits = [
      ['e-377', '377'],
      ['feat/e-32-fx-rate-sync', '32'],
      ['fix/e-361-powershell-home-guard', '361'],
      ['docs/e-12-guard-doc', '12'],
      ['chore/e-7-ci', '7'],
      ['test/e-8-guard-cases', '8'],
      ['hotfix/e-5-a', '5'],
    ];
    for (const [branch, n] of hits) assert.strictEqual(guard.branchTicket(branch), n, branch);
    const misses = [null, undefined, '', 'main', 'release', 'dev', 'feature/e-1-x', 'e-1-x', 'feat/e-1', 'feat/e-1-', 'feat/e-1--x',
      'feat/e-1-X', 'Feat/e-1-x', 'feat/E-1-x', 'feat/e-x-y', 'refs/heads/feat/e-1-x', 'pr/e-1-x', 'feat/e-1-x/y'];
    for (const branch of misses) assert.strictEqual(guard.branchTicket(branch), null, String(branch));
  }],
  ['1.24 worktree（.git 是指標檔）加團隊分支 feat/e-372-superpowers-v7：未核准寫實作檔 -> deny；核准檔齊全 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'feat/e-372-superpowers-v7', worktree: true, stateFile: 'E-369.yaml', state: STATE_E372 });
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'deny');
    writeFile(path.join(approvalsDir, 'E-372.yaml'), APPROVAL_E372);
    assert.strictEqual(run(write(repo, 'scripts', 'x.cjs'), approvalsDir).decision, 'allow');
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
    assert.ok(text.includes('讀 docs/superpowers/state/E-367.yaml 與 Linear 票。'), text);
    assert.ok(!text.includes(repo) && !text.includes(repo.replace(/\\/g, '/')), text);
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
  ['2.8 團隊分支 feat/e-372-superpowers-v7 有狀態檔 -> 摘要含 ticket=E-369、plan=E-372', () => {
    const { repo, approvalsDir } = mkRepo({ branch: 'feat/e-372-superpowers-v7', stateFile: 'E-369.yaml', state: STATE_E372 });
    const text = sessionStart.summarize(repo, { approvalsDir });
    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('ticket=E-369'), text);
    assert.ok(text.includes('plan=E-372'), text);
    assert.ok(text.includes('未核准'), text);
    assert.ok(text.includes('docs/superpowers/state/E-369.yaml'), text);
  }],
  ['3.1 CLI：deny 輸出 hookSpecificOutput JSON；allow 與亂碼 stdin 無輸出，皆 exit 0', () => {
    const script = path.join(__dirname, 'elf-guard.cjs');
    const spawn = (input) => childProcess.spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
    const denied = spawn(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'cat ~/.claude/superpowers/approvals/E-377.yaml' } }));
    assert.strictEqual(denied.status, 0);
    const out = JSON.parse(denied.stdout);
    assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.strictEqual(typeof out.hookSpecificOutput.permissionDecisionReason, 'string');
    assert.ok(out.hookSpecificOutput.permissionDecisionReason.length > 0);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /核准憑證建立器/);
    const allowed = spawn(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }));
    assert.strictEqual(allowed.status, 0);
    assert.strictEqual(allowed.stdout, '');
    const garbage = spawn('not json');
    assert.strictEqual(garbage.status, 0);
    assert.strictEqual(garbage.stdout, '');
  }],
  ['4.1 CRLF、CR 與 LF 同雜湊', () => {
    const h = approval.hashDescription('a\nb');
    assert.strictEqual(approval.hashDescription('a\r\nb'), h);
    assert.strictEqual(approval.hashDescription('a\rb'), h);
  }],
  ['4.2 結尾 0、1、3 個換行同雜湊', () => {
    const h = approval.hashDescription('a\nb');
    assert.strictEqual(approval.hashDescription('a\nb\n'), h);
    assert.strictEqual(approval.hashDescription('a\nb\n\n\n'), h);
  }],
  ['4.3 行首 checkbox 勾選狀態不影響雜湊（含前導空白）', () => {
    for (const unchecked of ['- [ ] 步驟 1.1', '  - [ ] 步驟 1.1']) {
      const base = approval.hashDescription(`前文\n${unchecked}\n後文`);
      const checked = [unchecked.replace('[ ]', '[x]'), unchecked.replace('[ ]', '[X]')];
      for (const line of checked) assert.strictEqual(approval.hashDescription(`前文\n${line}\n後文`), base, line);
    }
  }],
  ['4.4 程式碼區塊內的 - [x] 改成 - [ ] 雜湊不同', () => {
    const a = approval.hashDescription('前文\n```\n- [x] 步驟 1.1\n```\n');
    const b = approval.hashDescription('前文\n```\n- [ ] 步驟 1.1\n```\n');
    assert.notStrictEqual(a, b);
  }],
  ['4.5 一般文字的 [x] 改成 [ ] 雜湊不同', () => {
    assert.notStrictEqual(approval.hashDescription('見 [x] 欄'), approval.hashDescription('見 [ ] 欄'));
  }],
  ['4.6 新增、刪除、改文字的 checkbox 雜湊不同', () => {
    const base = approval.hashDescription('- [ ] 步驟 1.1\n- [ ] 步驟 1.2\n');
    assert.notStrictEqual(approval.hashDescription('- [ ] 步驟 1.1\n- [ ] 步驟 1.2\n- [ ] 步驟 1.3\n'), base);
    assert.notStrictEqual(approval.hashDescription('- [ ] 步驟 1.1\n'), base);
    assert.notStrictEqual(approval.hashDescription('- [ ] 步驟 1.1\n- [ ] 步驟 1.2 改\n'), base);
  }],
  ['4.7 hashDescription 為 a\\n 的 SHA-256', () => {
    const h = approval.hashDescription('a');
    assert.strictEqual(h, 'sha256:' + crypto.createHash('sha256').update('a\n', 'utf8').digest('hex'));
    assert.match(h, /^sha256:[0-9a-f]{64}$/);
  }],
  ['5.1 沒有留言 -> 不通過', () => {
    const r = approval.findApproval([]);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /找不到有效的核准留言/);
  }],
  ['5.2 作者不是固定 user ID -> 不通過', () => {
    assert.strictEqual(approval.findApproval([comment('c1', APPROVE_V1, 1, OTHER_ID)]).ok, false);
  }],
  ['5.3 文字不符 -> 不通過', () => {
    for (const body of ['計畫已核准', '計畫核准（2026-10-25，審計員：Codex）', '計畫已核准（2026/10/25，審計員：Codex）']) {
      assert.strictEqual(approval.findApproval([comment('c1', body, 1)]).ok, false, body);
    }
  }],
  ['5.4 有效核准留言 -> 通過並取出審計員、日期、版號', () => {
    const r = approval.findApproval([comment('c1', APPROVE_V1 + '\n\n附註', 1)]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.auditor, 'Codex');
    assert.strictEqual(r.approvedAt, '2026-10-25');
    assert.strictEqual(r.version, 1);
    assert.strictEqual(r.comment.id, 'c1');
  }],
  ['5.5 核准之後有核准撤回 -> 不通過', () => {
    const r = approval.findApproval([comment('c1', APPROVE_V1, 1), comment('c2', '核准撤回', 2)]);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /核准撤回/);
  }],
  ['5.6 計畫已修改 v2 之後要有計畫已核准 v2', () => {
    const list = [comment('c1', APPROVE_V1, 1), comment('c2', '計畫已修改 v2（加一步）', 2), comment('c3', APPROVE_V1, 3)];
    assert.strictEqual(approval.findApproval(list).ok, false);
    list.push(comment('c4', '計畫已核准 v2（2026-10-26，審計員：Codex）', 4));
    const r = approval.findApproval(list);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.comment.id, 'c4');
    assert.strictEqual(r.version, 2);
  }],
  ['5.7 依 createdAt 排序，不依陣列順序', () => {
    assert.strictEqual(approval.findApproval([comment('c2', '核准撤回', 2), comment('c1', APPROVE_V1, 1)]).ok, false);
  }],
  ['5.8 撤回之後再核准 -> 通過，取最後那則', () => {
    const r = approval.findApproval([comment('c1', APPROVE_V1, 1), comment('c2', '核准撤回', 2), comment('c3', APPROVE_V1, 3)]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.comment.id, 'c3');
  }],
  ['6.1 有效輸入 -> 建立九欄位憑證、不留暫存檔', () => {
    const dir = mkApprovalsDir();
    const r = approval.createCredential(planInput(), { plan: 'E-399', approvalsDir: dir });
    assert.strictEqual(r.ok, true, r.reason);
    const cred = guard.readCredential(dir, 'E-399');
    assert.deepStrictEqual(cred, {
      ticket: 'E-399',
      plan: 'E-399',
      spec: 'E-397',
      approver_id: guard.APPROVER_ID,
      linear_comment_id: 'c1',
      comment_created_at: comment('c1', APPROVE_V1, 1).createdAt,
      approved_at: '2026-10-25',
      auditor: 'Codex',
      plan_hash: approval.hashDescription(PLAN_DESC),
    });
    assert.deepStrictEqual(fs.readdirSync(dir), ['E-399.yaml']);
  }],
  ['6.2 --plan 與輸入的 plan 不同 -> 拒絕、不寫檔', () => {
    const dir = mkApprovalsDir();
    assert.strictEqual(approval.createCredential(planInput({ plan: 'E-398' }), { plan: 'E-399', approvalsDir: dir }).ok, false);
    assert.deepStrictEqual(fs.readdirSync(dir), []);
  }],
  ['6.3 plan 格式不合 -> 拒絕、目錄外沒有新檔', () => {
    const dir = mkApprovalsDir();
    const parent = path.dirname(dir);
    for (const plan of ['E-1/../x', '399', '']) {
      assert.strictEqual(approval.createCredential(planInput({ plan }), { plan, approvalsDir: dir }).ok, false, plan);
    }
    assert.deepStrictEqual(fs.readdirSync(dir), []);
    assert.deepStrictEqual(fs.readdirSync(parent), ['approvals']);
  }],
  ['6.4 無留言、錯誤作者、已撤回 -> 拒絕，原有憑證不變', () => {
    const dir = mkApprovalsDir();
    assert.strictEqual(approval.createCredential(planInput(), { plan: 'E-399', approvalsDir: dir }).ok, true);
    const before = fs.readFileSync(path.join(dir, 'E-399.yaml'), 'utf8');
    const bad = [
      [],
      [comment('c1', APPROVE_V1, 1, OTHER_ID)],
      [comment('c1', APPROVE_V1, 1), comment('c2', '核准撤回', 2)],
    ];
    for (const comments of bad) {
      assert.strictEqual(approval.createCredential(planInput({ comments }), { plan: 'E-399', approvalsDir: dir }).ok, false);
    }
    assert.strictEqual(fs.readFileSync(path.join(dir, 'E-399.yaml'), 'utf8'), before);
  }],
  ['6.5 驗證：只改勾選 -> 通過；多一行文字 -> 雜湊不符、stop', () => {
    const dir = mkApprovalsDir();
    approval.createCredential(planInput(), { plan: 'E-399', approvalsDir: dir });
    const checked = PLAN_DESC.replace('- [ ] 步驟 1.1', '- [X] 步驟 1.1');
    assert.strictEqual(approval.verifyCredential(planInput({ description: checked }), { plan: 'E-399', approvalsDir: dir }).ok, true);
    const r = approval.verifyCredential(planInput({ description: PLAN_DESC + '多一行\n' }), { plan: 'E-399', approvalsDir: dir });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.action, 'stop');
    assert.match(r.reason, /雜湊不符/);
  }],
  ['6.6 驗證：撤回、留言消失 -> revoke；有 v2 核准 -> recreate', () => {
    const dir = mkApprovalsDir();
    approval.createCredential(planInput(), { plan: 'E-399', approvalsDir: dir });
    const base = planInput().comments;
    const check = (comments) => approval.verifyCredential(planInput({ comments }), { plan: 'E-399', approvalsDir: dir });
    assert.strictEqual(check([...base, comment('c2', '核准撤回', 2)]).action, 'revoke');
    assert.strictEqual(check([comment('c9', '其他留言', 2)]).action, 'revoke');
    const v2 = [...base, comment('c2', '計畫已修改 v2（加一步）', 2), comment('c3', '計畫已核准 v2（2026-10-26，審計員：Codex）', 3)];
    assert.strictEqual(check(v2).action, 'recreate');
  }],
  ['6.7 驗證：沒有憑證、憑證損壞 -> stop', () => {
    const dir = mkApprovalsDir();
    const r1 = approval.verifyCredential(planInput(), { plan: 'E-399', approvalsDir: dir });
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.action, 'stop');
    writeFile(path.join(dir, 'E-399.yaml'), 'garbage\n');
    assert.strictEqual(approval.verifyCredential(planInput(), { plan: 'E-399', approvalsDir: dir }).action, 'stop');
  }],
  ['6.8 撤回：刪除憑證；再撤回一次 removed 為 false', () => {
    const dir = mkApprovalsDir();
    approval.createCredential(planInput(), { plan: 'E-399', approvalsDir: dir });
    assert.strictEqual(approval.revokeCredential({ plan: 'E-399', approvalsDir: dir }).removed, true);
    assert.strictEqual(fs.existsSync(path.join(dir, 'E-399.yaml')), false);
    assert.strictEqual(approval.revokeCredential({ plan: 'E-399', approvalsDir: dir }).removed, false);
  }],
  ['6.9 Guard：舊四欄位、格式不合、暫存檔名 -> deny；建立器產生的憑證 -> allow', () => {
    const { repo, approvalsDir } = mkRepo({ state: STATE_E377 });
    const target = write(repo, 'scripts', 'x.cjs');
    const file = path.join(approvalsDir, 'E-377.yaml');
    const bad = [
      OLD_APPROVAL,
      credentialText('E-377', 'E-367', { plan_hash: 'sha256:xyz' }),
      credentialText('E-377', 'E-367', { ticket: 'E-378' }),
      credentialText('E-377', 'E-367', { approver_id: OTHER_ID }),
      credentialText('E-377', 'E-367', { spec: null }),
    ];
    for (const text of bad) {
      writeFile(file, text);
      assert.strictEqual(run(target, approvalsDir).decision, 'deny', text);
    }
    fs.rmSync(file);
    writeFile(path.join(approvalsDir, '.E-377.yaml.123.tmp'), APPROVAL_FULL);
    assert.strictEqual(run(target, approvalsDir).decision, 'deny');
    const r = approval.createCredential(planInput({ plan: 'E-377', spec: 'E-367' }), { plan: 'E-377', approvalsDir });
    assert.strictEqual(r.ok, true, r.reason);
    assert.strictEqual(run(target, approvalsDir).decision, 'allow');
  }],
  ['6.10 CLI：create exit 0、無效輸入 exit 1、缺 --plan exit 2、revoke exit 0', () => {
    const dir = mkApprovalsDir();
    const script = path.join(__dirname, 'elf-approval.cjs');
    const spawn = (args) => childProcess.spawnSync(process.execPath, [script, ...args, '--approvals-dir', dir], { encoding: 'utf8' });
    const good = path.join(path.dirname(dir), 'good.json');
    const bad = path.join(path.dirname(dir), 'bad.json');
    writeFile(good, JSON.stringify(planInput()));
    writeFile(bad, JSON.stringify(planInput({ comments: [] })));
    const created = spawn(['create', '--plan', 'E-399', '--input', good]);
    assert.strictEqual(created.status, 0, created.stdout + created.stderr);
    assert.ok(created.stdout.includes('E-399') && created.stdout.includes('c1'), created.stdout);
    assert.strictEqual(spawn(['create', '--plan', 'E-399', '--input', bad]).status, 1);
    assert.strictEqual(spawn(['create', '--input', good]).status, 2);
    assert.strictEqual(spawn(['revoke', '--plan', 'E-399']).status, 0);
    assert.strictEqual(fs.existsSync(path.join(dir, 'E-399.yaml')), false);
  }],
  ['介面 六個 export 皆為函式', () => {
    for (const name of ['decide', 'findGitRoot', 'readBranch', 'findState', 'readApproval', 'branchTicket']) {
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
