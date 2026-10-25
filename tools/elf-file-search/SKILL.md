---
name: elf-file-search
description: |
  Elf Express 團隊 AI 找檔案規範：不知道檔案在哪時先用 Everything 命令列 es（一律加 -n），已知在專案內用 Glob／Grep 或 rg，
  禁止從根目錄或整顆磁碟遞迴搜尋（放背景執行也不行），長命令設逾時、背景命令結束前確認已停止。
  當任務涉及找檔案、「檔案在哪」、「不知道在哪個資料夾」、要下 find／Get-ChildItem -Recurse／dir /s／where /r、
  搜尋整台電腦或整顆磁碟、Everything、es、mdfind，或要把搜尋命令放到背景執行時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 找檔案規範（elf-file-search）

> 起因：2026-10-25 06:31，一個 Claude Code 子代理在 Git Bash 背景執行 `find / -iname "altcha*.css"`。
> 子代理結束後它成了孤兒行程，掃整台電腦 2 個多小時，CPU 飆高、電腦變卡，最後由 Eddie 手動結束（E-422）。
> 同樣的檔案用 Everything 的 `es` 查，約 240 ms。

Claude Code 另有團隊 hook `elf-search-guard` 在執行前擋下這類命令（說明見 skillshare-source 的 `docs/search-guard.md`）；
其他 AI 工具沒有 hook，只靠本 skill。hook 擋下時照本 skill 改做法，不要換個寫法繞過。

## 1. 何時使用

- 使用者要找一個檔案，但沒說在哪個資料夾
- 你準備下 `find`、`Get-ChildItem -Recurse`、`dir /s`、`where /r`、`rg --files`、`fd`、`tree`、`du`
- 你準備把搜尋命令或任何可能跑很久的命令放到背景
- `elf-search-guard` 擋下了你的命令

## 2. 固定規則

1. 不知道檔案在哪個資料夾時，Windows MUST 先用 Everything 命令列 `es`，且 MUST 加 `-n` 限制筆數（例 `es -n 20 altcha*.css`）；知道大概範圍時加 `-path <資料夾>`。
   為什麼：Everything 讀的是 NTFS 索引，查整台電腦不到一秒；沒有 `-n` 時結果可能上萬筆，整串灌進對話。
2. 已知檔案在目前專案內時，MUST 用內建的檔案搜尋工具（Glob／Grep）或 `rg`，範圍限在專案目錄。
   為什麼：專案目錄小、結果可預期；`rg` 預設尊重 `.gitignore`，不會掃進 `node_modules`、`bin/`、`obj/`。
3. MUST NOT 從根目錄或整顆磁碟遞迴搜尋：`find /`、`find /c`、`find /mnt/c`、`find C:\`、`ls -R /`、`Get-ChildItem C:\ -Recurse`（含 `C:\*.css`、`-Depth`）、`dir /s C:\`、`where /r C:\`、`rg --files /`、`fd … /`、`tree /`、`du -a /`。放到背景執行也一樣不行。
   為什麼：整顆磁碟動輒幾百萬個檔案，會跑幾十分鐘到幾小時、吃滿 CPU 與磁碟；放背景不會比較輕，只是你看不到它還在跑。
4. 沒有 `es` 時，MUST NOT 改成掃整顆磁碟。依序：用 `where es`（cmd）或 `Get-Command es`（PowerShell）找完整路徑；仍沒有就把範圍限在專案目錄或使用者提過的資料夾；macOS 用 `mdfind -name <關鍵字>`（`-onlyin <資料夾>` 限範圍）。都找不到就照實回報已搜尋的範圍，請使用者給大概的資料夾，不編造路徑。
   為什麼：「只掃一次」正是這次事故的做法；使用者不在時更不能留下一個沒人看管的長命令。
5. 可能超過 2 分鐘的命令 MUST 設逾時（工具的 timeout 參數，或 `timeout <秒> <命令>`）。
   為什麼：沒有逾時的命令卡住時沒有上限，子代理被收掉後它還會一直跑。
6. 放到背景的命令，在你的工作結束（含子代理回報結束）前 MUST 確認已停止：等它完成並讀結果，或明確結束它（例如 Claude Code 的 TaskStop、`kill <PID>`）。MUST NOT 回報「已啟動」就離開。
   為什麼：本次事故的行程就是子代理結束後留下的孤兒；沒人會再讀它的輸出，它只剩拖慢電腦。
7. `elf-search-guard` 擋下命令時，MUST 照拒絕訊息改用 `es`／`rg`／限定範圍，MUST NOT 換寫法繞過（改用變數、別名、寫進腳本檔再執行）。
   為什麼：hook 只看命令文字，繞得過；繞過等於重做一次這次事故。

## 3. 標準範本

```bash
# Windows：不知道在哪（Git Bash／PowerShell／cmd 都可用）
es -n 20 altcha*.css
es -n 20 -path E:\source altcha          # 限定在某個資料夾底下

# es 不在 PATH：先找完整路徑
where es                                 # cmd
Get-Command es                           # PowerShell

# 已知在專案內
rg --files E:/source/my-project | rg altcha
rg -n "關鍵字" E:/source/my-project

# macOS
mdfind -name altcha.css
mdfind -name altcha -onlyin ~/source

# 可能跑很久：設逾時
timeout 600 rg -n "關鍵字" E:/big-repo > out.txt
```

安裝 Everything 與命令列 `es`（Windows，選用；團隊 README 第一次安裝的選用步驟）：

```bash
winget install voidtools.Everything voidtools.Everything.Cli
```

## 4. 禁止簡化

- MUST NOT 拿掉 `es` 的 `-n`，即使只想「看一下有幾筆」。
- MUST NOT 因為「趕時間」「只跑一次」「使用者不在」「放背景沒關係」而掃根目錄或整顆磁碟。
- MUST NOT 把背景命令丟著就結束工作。
- MUST NOT 刪掉第 2 節第 3 點列出的任何一種寫法。

## 5. 檢查清單

- [ ] 不知道位置時先用了 `es -n`（或照第 4 點的退路），沒有掃根目錄或整顆磁碟
- [ ] 專案內的搜尋範圍限在專案目錄
- [ ] 可能超過 2 分鐘的命令設了逾時
- [ ] 背景命令在結束前已完成並讀過結果，或已明確停止
- [ ] 被 `elf-search-guard` 擋下時照訊息改做法，沒有換寫法繞過

## 6. 常見錯誤

| 現象 | 原因 | 正確做法 |
| -- | -- | -- |
| 電腦變卡、CPU 滿載，`find` 跑了 2 小時（2026-10-25） | 子代理在背景跑 `find / -iname …`，子代理結束後成了孤兒行程 | 用 `es -n 20 <關鍵字>`；背景命令結束前確認已停止 |
| `es` 回 `command not found` | 沒裝 Everything 命令列，或安裝位置不在 PATH | `where es`／`Get-Command es` 找完整路徑；沒有就限在專案目錄，或請使用者安裝（第 3 節 winget） |
| `es` 一次吐出上萬筆 | 沒加 `-n` | 一律加 `-n 20`，需要時用 `-path` 縮小範圍 |
| Git Bash 裡 `find /c "error" log.txt` 掃了整顆 C: | Git Bash 的 `find` 是 GNU find（`type -a find` 第一個是 `/usr/bin/find`），`/c` 被當成起點，不是 Windows find 的選項 | 文字搜尋用 `grep`／`rg`；真的要用 Windows find，在 PowerShell 或 `cmd /c` 裡執行 |
| 以為 `tree /f` 會被擋 | `/f`、`/a` 是 Windows `tree` 的選項，不是磁碟根 | 照常使用；`tree /` 或 `tree C:\` 才是從根目錄遞迴 |
| commit 訊息或文件裡寫到 `find /` 範例被擋 | 範例文字沒加引號，被當成命令 | 放在引號字串或 heredoc 裡；`git commit -F <檔案>` 也可以 |

## 7. 待確認

1. `winget install voidtools.Everything.Cli` 安裝的 `es` 是否自動進 PATH：Eddie 的電腦上 Git Bash 找得到 `es`（位於 `%LOCALAPPDATA%\Microsoft\WinGet\Packages\voidtools.Everything.Cli_…\es.exe`），但 Eddie 的個人規範另記「`es` 不在 PATH 時用完整路徑」，可見不一定每個 shell 都找得到。隊友的電腦尚未實測。
2. Everything 主程式沒在執行時，`es` 的錯誤訊息原文：尚未實測，不寫推測的訊息。
3. Linux 的替代工具（`locate`／`plocate` 是否可用、索引是否最新）：團隊目前沒有 Linux 開發機的實測紀錄。
