# git-guard

本機 pre-push 檢查：AI 或人推錯 `release`、`main`、`dev` 時當場擋下，並印出照規範該怎麼做。規則來源是 `workflow/elf-team-rule`（規則 7–9、18、19、25、26、28）；GitHub 端另有組織 ruleset 把關。

## 安裝

Mac 或 Windows 的 Git Bash，在 skillshare source 目錄執行：

```bash
sh scripts/git-guard/install.sh            # 安裝或更新，設定全機 core.hooksPath
sh scripts/git-guard/install.sh --check .  # 確認已安裝、版本最新、目前 repo 沒有蓋掉設定
sh scripts/git-guard/install.sh --repo .   # repo 自己設了 core.hooksPath（husky）時用
```

安裝後 repo 自己的 hook 照常執行：git-guard 跑完會接著執行 `.git/hooks/<同名>`，或 `--repo` 記下的原路徑（例如 `.husky/_`）。`pnpm install` 會把 husky repo 的設定改回去，`--check .` 會報出來，重跑 `--repo` 即可。

## 擋什麼

| 推送 | 放行條件 |
| -- | -- |
| 刪除 `release`／`main`／`dev` | 一律擋下 |
| `release` | 剛好等於 `origin/dev` 或某個 `origin/hotfix/*`，而且該提交的 check runs 全部通過（`gh` 查詢） |
| `main` | 第 1 種＝`upstream/<上游主線>`、第 2 種＝`upstream/release`、第 3 種＝`origin/release`（類型讀 `BRANCHING.md` 第一行） |
| `dev` | 只接受規則 18、26：在 `origin/dev` 上合併 `origin/main`、`upstream/*`、`origin/release`，或快轉到它們 |
| 其他分支、其他 remote | 不檢查 |

遠端還沒有該分支時（初次建立）放行。沒有 `BRANCHING.md` 的 repo 推 `release`／`main` 會被擋下。

## 例外放行

只有 Eddie 對某個提交明確同意例外時（例如專案沒有 CI），才可以：

```bash
ELF_ALLOW=<要推送提交的 SHA 前 8 碼以上> git push origin <分支>
```

只對開頭相符的那一個提交有效，刪除受保護分支不能放行；回報時要寫明原因。

## 測試

```bash
sh scripts/git-guard/tests/run.sh
```

## 和其他 hook 工具並用

- **husky**：`pnpm install` 會把 repo 的 `core.hooksPath` 改回 `.husky/_`，git-guard 就不會執行。`install.sh --check .` 會報出來，重跑 `install.sh --repo .` 即可。
- **Git LFS**：git-guard 佔用了全機 hooks 目錄，`git lfs install` 會說 hook 已存在而略過。不用處理：repo 的 `.gitattributes` 有 `filter=lfs` 時，git-guard 會代為執行 `git lfs pre-push` 等 hook。不要用 `git lfs install --force`，那會蓋掉 git-guard。
- **Python pre-commit**：`pre-commit install` 看到 `core.hooksPath` 就拒絕安裝。做法：
  ```bash
  git config --global --unset core.hooksPath
  pre-commit install                    # 裝進 .git/hooks/，git-guard 會接著執行它
  sh scripts/git-guard/install.sh       # 再把全機設定改回 git-guard
  ```
- **repo 自己的 hook 安裝腳本**（例如 `postinstall` 執行的 `install-git-hooks.mjs`、simple-git-hooks）：它們把 hook 寫進 `git rev-parse --git-path hooks`，裝了 git-guard 之後那就是全機目錄，會蓋掉 git-guard 的 hook，讓所有 repo 都受影響。`install.sh --check` 會報出「hook 被改過」；先重跑 `install.sh` 還原，再修那個腳本：repo 沒有自己設定 `core.hooksPath` 時，改寫到 `$(git rev-parse --git-common-dir)/hooks`，git-guard 會照常串接執行。
- **原本的全機 hooks 目錄**：安裝前若已設定全機 `core.hooksPath`，原路徑記在 `elfguard.previousHooksPath`；repo 沒有自己的同名 hook 時，git-guard 會改執行那裡的 hook。

## Windows PowerShell

`install.sh` 寫的是全域設定（`~/.gitconfig`）。原生 `git.exe` 依 `HOME` 找這個檔，`HOME` 是 MSYS 格式（`/c/Users/<名字>`）時會讀不到，全域 `core.hooksPath` 跟著消失，從這個 PowerShell 推送時 git-guard 完全不執行，`install.sh --check` 也查不出來（它跑在 sh 裡，sh 會把 `HOME` 轉成正確路徑）。Orca 啟動的 Claude Code 就是這樣：它的 PowerShell 工具帶著 `HOME=/c/Users/<名字>`（E-361）。

在要推送的 PowerShell 裡確認：

```powershell
git config --global --get core.hooksPath   # 必須印出 .../.elf-git-guard/hooks；空白就是讀不到
$env:HOME                                  # 以 / 開頭就是這個問題
```

修法：Claude Code 在 `~/.claude/settings.json` 的 `env` 加上 Windows 格式的 `HOME`，重開 session 後 PowerShell 與 Git Bash 工具都讀得到：

```json
{ "env": { "HOME": "C:\\Users\\<名字>" } }
```

其他工具的 PowerShell 若也有 `/` 開頭的 `HOME`，在該工具的環境變數設定改成同樣的 Windows 格式；改不了就用 Git Bash 執行 `git push`。`scripts/release-ff.ps1` 會比對 PowerShell 與 sh 讀到的 `core.hooksPath`，不一致就停下。

## 已知限制

- 第 3 種同時推 `release` 和 `main`（`git push origin release main`）時，`main` 會和推送前的 `origin/release` 比對而被擋；請分兩次推，先 `release` 再 `main`。
- `dev` 的合併提交只檢查兩個 parent，不檢查合併時是否夾帶額外修改。
