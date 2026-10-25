# 搜尋 Guard（elf-search-guard）

elf-search-guard 是 Claude Code 的 PreToolUse hook：AI 用 Bash 或 PowerShell 工具下「從根目錄或整顆磁碟遞迴搜尋」的命令時當場擋下，並在理由裡給替代做法。其他 AI 工具沒有這個 hook，靠 `tools/elf-file-search` skill 規範（E-422／E-423）。

- `scripts/elf-search-guard.cjs`：PreToolUse，matcher 為 `Bash|PowerShell`。只用同步程式碼、不啟動子行程、永遠 exit 0；擋下時在 stdout 印 `permissionDecision: deny` 的 JSON，放行時不輸出；自身發生例外時放行。
- `scripts/elf-search-guard.hooks.yaml`：skillshare hooks entry，名稱 `elf-search-guard`，由 `scripts/make-hooks-yaml.cjs` 產生（與 `elf-guard.hooks.yaml` 同一支產生器）。
- `scripts/elf-search-guard.test.cjs`：測試。

## 判斷規則

先把命令文字前處理，再依 `;`、`|`、`||`、`&&`、換行切段，任一段符合下表任一條就擋。

「根」指：`/`、`/<槽>`、`/<槽>/`、`/mnt/<槽>`、`/cygdrive/<槽>`（尾斜線可有可無）、`<槽>:`、`<槽>:\`、`<槽>:/`、單獨的 `\`，結尾可再接 `*`（如 `/*`、`/c/*`、`C:\*`）；可帶引號。「磁碟根樣式」指 `<槽>:\` 後直接接含 `*`／`?`／`.` 的檔名（如 `C:\*.css`、`C:\altcha.css`）。命令名稱前可帶路徑（如 `/usr/bin/find`）。

| # | 命令 | 條件 |
| -- | -- | -- |
| R1 | `find`（可帶 `-H`／`-L`／`-P`） | Bash 工具（Git Bash 的 `find` 是 GNU find）：第一個選項之前的任一起點是根就擋，包括 `find /c "x" f`、`find /tmp / …`。PowerShell 工具與 `cmd /c`、`cmd /k` 內（Windows 內建 find）：起點是根，且後面是結尾、`-`、`(`、`!`、`\`、數字（重導向）或 `&`、`<`、`>`；`find /i "x"` 這類用法因後接一般文字而放行（E-422 第 17 點） |
| R2 | `ls` | 有含 `R` 的短旗標（`-R`、`-laR`）或 `--recursive`，且有根參數 |
| R3 | `Get-ChildItem`／`gci`／`dir`（在命令開頭） | 有 `-Recurse` 或其前綴（`-r`、`-re`…，可帶 `:$true`）或 `-Depth`，且有根（含 `/`）或磁碟根樣式；PowerShell 工具的 `ls` 同樣規則；Bash 工具的 `ls` 只認 `-Rec…`／`-Depth`（bash 的 `ls -r` 是反向排序） |
| R4 | cmd `dir` | 有 `/s`，且有 Windows 根或磁碟根樣式 |
| R5 | `where` | 有 `/r`，且有 Windows 根 |
| R6 | `rg` | 搜尋路徑有根：第一個位置參數是搜尋樣式，不算路徑（`rg / src` 放行）；`--files` 時所有位置參數都是路徑 |
| R7 | `fd`／`fdfind` | 同 R6（第一個位置參數是樣式） |
| R8 | `tree` | 有根參數；單獨的 `/<字母>`（`tree /f`、`/a`）不算根 |
| R9 | `du` | 有根參數 |

前處理：

- 引號字串內容含空白 → 換成佔位字，不當命令；不含空白（如 `"/"`、`"D:\"`、`'C:\'`）→ 去掉引號當參數；以 `-` 開頭的（如 `"-x"`）當一般參數，不當選項。
- `-c`、`-<字母>c`（如 `-lc`）、`/c`、`/k`、`-Command` 後面緊接的引號內容 → 另成一段命令；`/c`、`/k` 的內容依 cmd 解讀，`powershell -c`／`pwsh -c`／`-Command` 依 PowerShell，其餘 `-c` 依 bash。
- 反引號內容（只限 Bash 工具；PowerShell 的反引號是跳脫字元）、`$(…)` 內容（含雙引號裡的）→ 另成一段命令。
- bash heredoc（`<<WORD`、`<<-WORD`、`<<'WORD'`、`<<"WORD"`）到結束行之間、PowerShell here-string（`@'`…`'@`、`@"`…`"@`）本文 → 不當命令。
- 引號沒關 → 其後全部當引號內容。
- `tool_name` 存在且不是 `Bash`／`PowerShell` → 放行。

例：`find / -name x`、`find / &`、`/usr/bin/find /* -name x`、Bash 工具的 `find /c "error" log.txt`、`Get-ChildItem C:\ -Recurse`、`dir /s /b C:\*.css`、`bash -c "find / -name x"`、`rg --files /` 會被擋；`find . -name x`、`find E:/x -name y`、PowerShell 工具的 `tasklist | find /i "node"`、`dir /s E:\mssql\*.sql`、`git commit -m "說明 find / 的寫法"`、`es -n 20 x` 放行。完整案例見測試檔。

## 擋下訊息

```text
elf-search-guard：已擋下從根目錄或整顆磁碟遞迴搜尋的命令。這種命令會跑很久、拖慢整台電腦，放到背景執行也一樣。改用：① Windows 有 Everything 時用 es -n 20 <關鍵字>（限定範圍加 -path <資料夾>）；② 沒有 es 時把範圍限在專案目錄，用 Glob／Grep 工具或 rg；③ macOS 用 mdfind -name <關鍵字>（限定範圍加 -onlyin <資料夾>）。說明見 skillshare-source 的 docs/search-guard.md。
```

## 已知限制

- 以文字規則判斷，擋不到變數展開（`find $ROOT`）、別名、函式，以及寫在腳本檔裡再執行的命令。
- 只認上表的命令。其他工具的同類寫法會放行，例如 `grep -r x /`、`eval "…"`、PowerShell 的 `Invoke-Expression "…"`、`Start-Process cmd -ArgumentList '/c dir /s C:\'`。
- Bash 工具下叫不到 Windows 內建 find（Git Bash 的 `find` 是 GNU find），所以 `tasklist | find /i "node"` 這類寫法在 Bash 工具會被擋；改用 `grep -i`，或在 PowerShell 工具、`cmd /c` 裡執行。
- `-c`、`/c`、`-Command` 後的引號內容一律當命令，所以 `grep -c "find / -x" f` 這類寫法會被誤擋；改成不帶 `-c` 或把內容放進檔案。
- 引號外直接寫出的範例文字仍會被當命令，例如 `echo find / -name x`（沒加引號）會被擋。
- 只有 Claude Code 有這個 hook；Codex、Gemini、Qwen 等工具靠 `tools/elf-file-search` skill。
- 已經在跑的孤兒行程不會被處理。

## 安裝與回滾

所有 `skillshare hooks` 指令都要明確指定 `-g`（全域）或 `-p`（專案）；本文件一律用 `-g`。在 skillshare-source 的 clone 目錄執行。

先預覽：

```bash
skillshare hooks add elf-search-guard --file scripts/elf-search-guard.hooks.yaml --dry-run --json -g
```

預覽顯示 `blocked: true` 時停下，處理方式比照 `docs/superpowers/guard.md` 的衝突說明，不要自己加 `--replace`。

安裝：

```bash
skillshare hooks add elf-search-guard --file scripts/elf-search-guard.hooks.yaml --sync -g
```

安裝後 hook command 為 `node "$HOME/.claude/hooks/skillshare/elf-search-guard/elf-search-guard.cjs"`，新開的 Claude Code session 才會載入。

回滾（擇一）：

```bash
skillshare hooks disable elf-search-guard --sync -g   # 停用 entry
skillshare hooks restore <backup-id> -g               # 還原到指定備份
```

改過 `scripts/elf-search-guard.cjs` 後，依序執行：

```bash
node scripts/make-hooks-yaml.cjs                                                            # 重新產生兩份 YAML
node scripts/make-hooks-yaml.cjs --check                                                    # 不同步時 exit 1
skillshare hooks edit elf-search-guard --file scripts/elf-search-guard.hooks.yaml --sync -g # 更新已安裝的 hook
```

## 測試

```bash
node scripts/elf-search-guard.test.cjs
```
