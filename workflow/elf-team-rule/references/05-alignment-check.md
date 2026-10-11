# 檢查分支與來源是否對齊

用在「main 有沒有跟上游同步」「release 是不是 dev 測過的版本」「pr 分支跟 dev 上的改動一不一樣」這類問題，也用在快轉 `release`／`main` 之前。

先更新遠端狀態：

```bash
git fetch --all --prune
```

## 1. 基本指令

| 要回答的問題 | 指令 | 怎麼讀 |
| -- | -- | -- |
| A 和 B 各自多了幾個提交 | `git rev-list --left-right --count A...B` | 輸出 `x y`：A 有 x 個 B 沒有的提交，B 有 y 個 A 沒有的提交 |
| B 有哪些 A 沒有的提交 | `git log --oneline A..B` | 空的代表 B 沒有超前 A |
| A 能不能快轉到 B | `git merge-base --is-ancestor A B && echo 可以快轉` | A 是 B 的祖先才能快轉 |
| 內容是否完全相同 | `git diff --quiet A B && echo 內容相同` | 提交不同但內容可能相同（例如 cherry-pick） |
| 差在哪些檔案 | `git diff --stat A B` | |

## 2. 依類型應該成立的關係

「x y」指 `git rev-list --left-right --count 目標...來源` 的輸出。

**第 1 種：貢獻型 fork**

| 檢查 | 目標 | 來源 | 應該是 |
| -- | -- | -- | -- |
| `main` 是上游的鏡像 | `origin/main` | `upstream/main` | `0 y`（`y` > 0 代表還沒同步；`x` > 0 代表有人在 `main` 提交過 → 回報） |
| `dev` 已吸收 `main` | `origin/dev` | `origin/main` | `x 0`（`main` 的提交都已在 `dev`） |
| `release` 是測過的 `dev` | `origin/release` | `origin/dev` | `0 y`（`x` > 0 代表有人直接動過 `release` → 回報） |

**第 2 種：私有 fork**

| 檢查 | 目標 | 來源 | 應該是 |
| -- | -- | -- | -- |
| `main` 是第 1 種 `release` 的鏡像 | `origin/main` | `upstream/release` | `0 y` |
| `dev` 已吸收 `main` | `origin/dev` | `origin/main` | `x 0` |
| `release` 是測過的 `dev` | `origin/release` | `origin/dev` | `0 y` |

`git diff --stat origin/main origin/dev` 就是「我們私有版本跟上游差在哪裡」。

**第 3 種：自有專案**

| 檢查 | 目標 | 來源 | 應該是 |
| -- | -- | -- | -- |
| `release` 是測過的 `dev` | `origin/release` | `origin/dev` | `0 y` |
| `main` 跟上 `release` | `origin/main` | `origin/release` | `0 y`（發佈後應為 `0 0`） |

**三種共通**

| 檢查 | 目標 | 來源 | 應該是 |
| -- | -- | -- | -- |
| 本地分支沒落後遠端 | `<分支>` | `origin/<分支>` | `0 0`；`x` > 0 代表本地有沒推的提交 |

## 3. pr 分支與 dev 的改動一致（第 1 種）

同一個修正走兩條路：`feat/` → `dev`，和 `pr/` → 原作者。兩邊的實質改動要一致。

```bash
# 列出 pr 分支上的提交
git log --oneline main..pr/<短名>

# 比對兩邊同一主題的改動（feat 分支已合進 dev 時，用它被合併前的提交範圍）
git range-diff main..pr/<短名> <feat 分支起點>..<feat 分支終點>
```

`range-diff` 每一行是「左邊提交 標記 右邊提交 標題」，看中間的標記：`=` 代表兩邊內容相同，`!` 代表有差異，`<` 代表只有左邊（pr 分支）有，`>` 代表只有右邊（feat 分支）有。改動差太多時，同一個主題不會顯示成 `!`，而是拆成一行 `<` 加一行 `>`。

```
1:  a33c82a = 1:  f7d9713 add a          ← 相同
2:  ffd7319 < -:  ------- add b          ← 標題相同卻分成兩行：內容差很多
-:  ------- > 2:  c0d159e add b
```

只要出現 `!`、`<`、`>` 就回報差異，依 `references/01` B5 的衝突處理路徑讓兩邊一致。

## 4. 回報格式

```
類型：第 X 種
<檢查名稱>：目標 <ref> <SHA 前 8 碼>／來源 <ref> <SHA 前 8 碼> → x y（符合／不符合）
...
不符合的項目：<原因判斷>，可選的處理方式：<...>
```

## 範例（skillshare-source，2026-10-11 實測）

```
$ git rev-list --left-right --count origin/release...origin/dev
0	0
$ git rev-list --left-right --count origin/master...origin/release
0	0
$ git merge-base --is-ancestor origin/release origin/dev && echo 可以快轉
可以快轉
```

`release`、`dev`、`master` 都指向 eaf52f4f，彼此對齊。注意這個 repo 的主線叫 `master`，見 SKILL.md「待確認」第 3 項。
