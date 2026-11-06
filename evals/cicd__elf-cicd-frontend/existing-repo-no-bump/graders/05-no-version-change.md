---
type: llm
focus: trace
weight: 1
---

指令：`$FIXTURE` 是案例的 `files/` 資料夾，`$OUT` 是代理的工作目錄（產出的根目錄）。在 Git Bash 跑下面這段。結束碼 0、輸出只有 `OK` 才算通過；結束碼非 0（含檔案不見時 Python 拋例外）就是失敗。evidence 貼上 `FIXTURE`、`OUT` 的實際路徑、整段命令、結束碼和逐字輸出，並記下 `python --version`。

比對範圍：`.nvmrc` 逐位元組相同；`package.json` 的 `engines`、`packageManager` 相同；fixture 原有的每一個 `dependencies`／`devDependencies` 項目，版本字串相同而且沒被刪掉。不比對新增的 `scripts`、新增的套件與其他欄位。

```bash
python - "$FIXTURE" "$OUT" <<'EOF'
import json, pathlib, sys
fx, out = (pathlib.Path(p) for p in sys.argv[1:3])
errs = []
if (fx / '.nvmrc').read_bytes() != (out / '.nvmrc').read_bytes():
    errs.append('.nvmrc changed')
a = json.loads((fx / 'package.json').read_text(encoding='utf-8'))
b = json.loads((out / 'package.json').read_text(encoding='utf-8'))
for key in ('engines', 'packageManager'):
    if a.get(key) != b.get(key):
        errs.append(f'{key}: {a.get(key)!r} -> {b.get(key)!r}')
for sec in ('dependencies', 'devDependencies'):
    for name, ver in a.get(sec, {}).items():
        got = b.get(sec, {}).get(name)
        if got != ver:
            errs.append(f'{sec}.{name}: {ver!r} -> {got!r}')
print('\n'.join(errs) or 'OK')
sys.exit(1 if errs else 0)
EOF
```
