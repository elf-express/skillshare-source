'use strict';
// 案例執行器：node run.cjs <tree>，<tree> 是含 scripts/ 的目錄。
// 每個觀察值印一行 key=value；結果符合 GREEN 欄 exit 0、不符 exit 1、缺參數 exit 2。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const treeArg = process.argv[2];
if (!treeArg) {
  process.stderr.write('用法：node run.cjs <tree>\n');
  process.exit(2);
}
const tree = path.resolve(treeArg);
const guard = require(path.resolve(tree, 'scripts', 'elf-guard.cjs'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e58-case-'));
// 任何結束路徑都清掉暫存目錄。
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

// 拋棄式 repo：分支 feat/e-46-x、狀態檔 phase: plan、plan: E-46。
const repo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/feat/e-46-x\n');
fs.mkdirSync(path.join(repo, 'docs', 'superpowers', 'state'), { recursive: true });
fs.writeFileSync(path.join(repo, 'docs', 'superpowers', 'state', 'E-46.yaml'), 'ticket: E-46\nphase: plan\nplan: E-46\n');
const payload = { tool_name: 'Write', tool_input: { file_path: path.join(repo, 'scripts', 'x.cjs') } };
const dirFor = (name) => {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const results = {};
const show = (k, v) => {
  results[k] = v;
  process.stdout.write(`${k}=${v}\n`);
};

// 1. 沒有憑證：確認拋棄式 repo 真的受 Guard 管。
show('no_credential', guard.decide(payload, { approvalsDir: dirFor('none') }).decision);

// 2. 固定憑證（嚴把關為核准者，不經 create）：舊 Guard 拒絕的是名單，不是沒有憑證。
const fixedDir = dirFor('fixed');
fs.copyFileSync(path.join(__dirname, 'credential.yaml'), path.join(fixedDir, 'E-46.yaml'));
show('fixed_credential', guard.decide(payload, { approvalsDir: fixedDir }).decision);

// 3. 串接：用 rules-gatekeeper-approves 的 fixture 跑 create，再判定。
const chainDir = dirFor('chained');
const create = spawnSync(
  process.execPath,
  [
    path.join(tree, 'scripts', 'elf-approval.cjs'), 'create', '--plan', 'E-46',
    '--input', path.join(__dirname, '..', 'rules-gatekeeper-approves', 'fixture.json'),
    '--approvals-dir', chainDir,
  ],
  { encoding: 'utf8' },
);
show('chained_create_exit', create.status);
show('chained_decision', create.status === 0 ? guard.decide(payload, { approvalsDir: chainDir }).decision : 'skipped');

const ok = results.no_credential === 'deny'
  && results.fixed_credential === 'allow'
  && results.chained_create_exit === 0
  && results.chained_decision === 'allow';
process.exit(ok ? 0 : 1);
