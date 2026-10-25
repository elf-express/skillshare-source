'use strict';
// elf-search-guard.cjs 的測試：擋與放行的命令各列一表，再測 decide() 的邊界輸入與 hook 子行程的輸出。

const assert = require('node:assert');
const childProcess = require('node:child_process');
const path = require('node:path');

const guard = require('./elf-search-guard.cjs');

const REASON =
  'elf-search-guard：已擋下從根目錄或整顆磁碟遞迴搜尋的命令。這種命令會跑很久、拖慢整台電腦，放到背景執行也一樣。' +
  '改用：① Windows 有 Everything 時用 es -n 20 <關鍵字>（限定範圍加 -path <資料夾>）；' +
  '② 沒有 es 時把範圍限在專案目錄，用 Glob／Grep 工具或 rg；' +
  '③ macOS 用 mdfind -name <關鍵字>（限定範圍加 -onlyin <資料夾>）。' +
  '說明見 skillshare-source 的 docs/search-guard.md。';

const BASH = 'Bash';
const PS = 'PowerShell';

// [編號, tool_name, 命令]；B01–B19 為 Eddie 個人版的擋下案例。
const BLOCK = [
  ['B01', BASH, 'find / -iname "altcha*.css" 2>/dev/null | head -3'],
  ['B02', BASH, 'cd x; ls; find / -iname altcha*.css'],
  ['B03', BASH, 'find /c -name foo.txt'],
  ['B04', BASH, 'find /e/ -type f'],
  ['B05', BASH, 'find "/" -name x'],
  ['B06', BASH, 'find / 2>/dev/null'],
  ['B07', BASH, 'find /'],
  ['B08', BASH, 'find -L / -name x'],
  ['B09', BASH, String.raw`find C:\ -name x`],
  ['B10', BASH, 'find /mnt/c -name x'],
  ['B11', BASH, 'ls -laR /'],
  ['B12', PS, String.raw`Get-ChildItem C:\ -Recurse -Filter *.css`],
  ['B13', PS, String.raw`Get-ChildItem -Path "D:\" -Recurse`],
  ['B14', PS, String.raw`gci -Recurse E:\ | Select-Object -First 3`],
  ['B15', BASH, String.raw`dir /s C:\altcha.css`],
  ['B16', BASH, 'cmd /c dir /s /b C:\\'],
  ['B17', BASH, String.raw`dir /s /b C:\*.css`],
  ['B18', PS, String.raw`Get-ChildItem C:\*.css -Recurse`],
  ['B19', BASH, String.raw`where /r C:\ es.exe`],
  ['B20', BASH, 'bash -c "find / -name x"'],
  ['B21', BASH, String.raw`cmd /c "dir /s /b C:\"`],
  ['B22', BASH, 'echo `find / -name x`'],
  ['B23', BASH, 'echo "$(find / -name x)"'],
  ['B24', PS, 'gci -r C:\\'],
  ['B25', PS, String.raw`Get-ChildItem -Path C:\ -Depth 2`],
  ['B26', PS, String.raw`pwsh -Command "Get-ChildItem C:\ -Recurse"`],
  ['B27', BASH, 'rg --files /'],
  ['B28', PS, 'rg altcha C:\\'],
  ['B29', BASH, 'fd altcha /'],
  ['B30', BASH, 'tree /'],
  ['B31', BASH, 'du -a /'],
  ['B32', BASH, 'du -sh /c/'],
  ['B33', BASH, 'find /cygdrive/c -name x'],
  ['B34', PS, 'dir -Recurse C:\\'],
  // 最終審查補的漏擋：背景、重導向、路徑前綴、/*、多個起點、PowerShell 的 ls -r。
  ['B35', BASH, 'find / &'],
  ['B36', BASH, 'nohup find / -name x > out.txt &'],
  ['B37', BASH, 'find / > out.txt'],
  ['B38', BASH, '/usr/bin/find / -name x'],
  ['B39', BASH, 'find /* -name x'],
  ['B40', BASH, 'find /c/* -name x'],
  ['B41', BASH, 'find /tmp / -name x'],
  ['B42', PS, 'ls -r C:\\'],
  // E-422 第 17 點：Git Bash 的 find 是 GNU find，Windows find 的寫法在 Bash 工具下會掃整顆磁碟。
  ['B43', BASH, 'find /c "error" log.txt'],
  ['B44', BASH, 'tasklist | find /i "node"'],
  ['B45', BASH, 'find /v /c "x" a.txt'],
  ['B46', BASH, 'ls --recursive /'],
  ['B47', BASH, 'du -sh /*'],
];

// [編號, tool_name, 命令]；A01–A18 為 Eddie 個人版的放行案例。
const ALLOW = [
  ['A01', PS, String.raw`Get-ChildItem -Path E:\mssql\*.sql -Recurse`],
  ['A02', BASH, String.raw`dir /s E:\mssql\*.sql`],
  ['A03', BASH, String.raw`dir /s E:\mssql`],
  ['A04', BASH, 'find . -name "*.sql"'],
  ['A05', BASH, 'find ./src -type f -newer x 2>/dev/null'],
  ['A06', BASH, 'find /c/Users/EDDIE/project -name x'],
  ['A07', BASH, 'find E:/mssql -name "*.sql"'],
  ['A08', PS, 'tasklist | find /i "node"'],
  ['A09', PS, 'find /c "error" log.txt'],
  ['A10', PS, 'find /v /c "x" a.txt'],
  ['A11', BASH, 'es -n 20 altcha*.css'],
  ['A12', PS, String.raw`Get-ChildItem E:\mssql -Recurse -Filter *.sql`],
  ['A13', PS, String.raw`Get-ChildItem C:\ `],
  ['A14', BASH, 'dir /s *.sql'],
  ['A15', BASH, 'where /r . es.exe'],
  ['A16', BASH, 'ls -la /'],
  ['A17', BASH, 'git log --oneline'],
  ['A18', BASH, 'rg --files | rg altcha'],
  ['A19', BASH, 'git commit -m "修正 find / -name x 的說明"'],
  ['A20', BASH, 'echo "find / -iname altcha*.css"'],
  ['A21', BASH, 'rg "find /" docs'],
  ['A22', BASH, "cat <<'EOF' > a.md\nfind / -name x\nEOF"],
  ['A23', BASH, 'tree /f'],
  ['A24', BASH, 'rg altcha src'],
  ['A25', BASH, 'du -sh ./node_modules'],
  ['A26', BASH, 'ls -r /'],
  ['A27', PS, String.raw`Get-ChildItem C:\Users\me -Depth 2`],
  ['A28', BASH, 'fd altcha .'],
  ['A29', PS, "@'\n" + String.raw`Get-ChildItem C:\ -Recurse` + "\n'@ | Set-Content a.md"],
  ['A30', 'Write', 'find /'],
  // Windows find 在 cmd /c 內仍是 Windows 內建 find；最終審查的少見誤擋。
  ['A31', BASH, 'cmd /c find /c "error" log.txt'],
  ['A32', PS, 'Copy-Item -Recurse .\\dir D:\\'],
  ['A33', BASH, 'rg / src'],
  ['A34', PS, 'find /n "-x" a.txt'],
];

function payload(toolName, command) {
  return { tool_name: toolName, tool_input: { command } };
}

const script = path.join(__dirname, 'elf-search-guard.cjs');
function spawn(input) {
  return childProcess.spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
}

const cases = [
  ...BLOCK.map(([id, tool, command]) => [
    `${id} 擋 ${JSON.stringify(command)}`,
    () => {
      const result = guard.decide(payload(tool, command));
      assert.strictEqual(result.decision, 'deny');
      assert.strictEqual(result.reason, REASON);
    },
  ]),
  ...ALLOW.map(([id, tool, command]) => [
    `${id} 放行 ${JSON.stringify(command)}`,
    () => {
      assert.deepStrictEqual(guard.decide(payload(tool, command)), { decision: 'allow' });
    },
  ]),
  ['邊界 decide(null)、decide({})、缺 command 都放行', () => {
    assert.deepStrictEqual(guard.decide(null), { decision: 'allow' });
    assert.deepStrictEqual(guard.decide({}), { decision: 'allow' });
    assert.deepStrictEqual(guard.decide({ tool_name: BASH, tool_input: {} }), { decision: 'allow' });
  }],
  ['子行程 非 JSON 輸入：exit 0、stdout 為空', () => {
    const r = spawn('not json');
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
  }],
  ['子行程 B07：exit 0、stdout 為 PreToolUse deny JSON', () => {
    const r = spawn(JSON.stringify(payload(BASH, 'find /')));
    assert.strictEqual(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'deny');
    const reason = out.hookSpecificOutput.permissionDecisionReason;
    for (const word of ['es -n 20', '-path', 'rg', 'mdfind']) {
      assert.ok(reason.includes(word), `理由缺 ${word}`);
    }
  }],
  ['子行程 A17：exit 0、stdout 為空', () => {
    const r = spawn(JSON.stringify(payload(BASH, 'git log --oneline')));
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
  }],
  ['介面 decide 為函式', () => {
    assert.strictEqual(typeof guard.decide, 'function');
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

console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
