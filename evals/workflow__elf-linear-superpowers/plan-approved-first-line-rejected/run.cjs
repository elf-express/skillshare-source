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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e58-case-'));
// 任何結束路徑都清掉暫存目錄。
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const approvalsDir = path.join(tmp, 'approvals');
const create = spawnSync(
  process.execPath,
  [path.join(tree, 'scripts', 'elf-approval.cjs'), 'create', '--plan', 'E-46', '--input', path.join(__dirname, 'fixture.json'), '--approvals-dir', approvalsDir],
  { encoding: 'utf8' },
);
const out = [];
const show = (k, v) => {
  out.push([k, v]);
  process.stdout.write(`${k}=${v}\n`);
};
const get = (k) => (out.find(([key]) => key === k) || [])[1];
show('create_exit', create.status);
const reason = /原因: (.*)/.exec(create.stdout || '');
if (reason) show('reason', reason[1]);
let files = 0;
try {
  files = fs.readdirSync(approvalsDir).length;
} catch {
  files = 0;
}
show('credential_files', files);
// 防退化案例：改前改後都要 create_exit=1、沒有寫出任何憑證，且拒絕原因必須是找不到有效核准留言（排除腳本當掉等其他失敗）。
process.exit(get('create_exit') === 1 && files === 0 && get('reason') === '找不到有效的核准留言' ? 0 : 1);
