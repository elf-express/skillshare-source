# coverage-v8-same-version：GREEN 紀錄

## 第 1 次（Plan Task 3 原文）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `e333b9ef4db08574143c2ed80a450126d3b39f14`（HEAD `3a9feb6c3197c91dec67380d43b1600817531cc1` ＋ 未提交的 stack/elf-stack/SKILL.md）；`git diff --stat`：`1 file changed, 2 insertions(+), 1 deletion(-)`（只有 stack/elf-stack/SKILL.md）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：5，耗時 29 秒
- 結果：2/3 個 grader 通過 → **未通過**
- 備註：同一快照前一次執行只回覆一段殘句、1 回合、沒有讀檔也沒有產出，判定為執行異常作廢、未評分，本節是重跑的那一次。02 未通過 → 修 skill（兩列改寫成「不套用 §3 前言的 caret 預設」）

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-both-exact` | 通過 | work/apps/package.json 第9、10行："@vitest/coverage-v8": "5.0.5"、"vitest": "5.0.5"，皆無 ^ 或 ~。 |
| `02-named-exception` | 未通過 | final-response.md 說「兩個都要寫同一個精確版號 5.0.5，不能帶 ^，要一起升級」，但全文沒有指出這是 §3 caret 慣例的註明例外（沒有『例外』或『慣例』字樣，也未說明是對 caret 預設的偏離）。只陳述規則內容，未點名為例外。 |
| `03-table-not-self-picked` | 通過 | 回覆明說依據 elf-stack v2 版本表，package.json 寫 5.0.5，與 SKILL.md 第89-90行一致；未使用 5.1.0。trace 中 5.1.0 只出現在讀檔內容，未被採用。 |

### 子代理最後回覆（逐字）

````markdown
我新建了 `apps/package.json`，`@vitest/coverage-v8` 用 `5.0.5`。依據是 elf-stack v2 版本表：它和 `vitest` 都要寫同一個精確版號 `5.0.5`，不能帶 `^`，兩個套件要一起升級。

- **工作目錄原本是空的：** 所以 `vitest 5.0.5` 也一併放進 devDependencies，另外加了 `test` 和 `test:coverage`（`vitest run --coverage`）兩個指令。
- **還沒驗證：** 我沒有執行 `pnpm install`，所以還沒產生 `pnpm-lock.yaml`，也沒實際跑過覆蓋率。lockfile 規定要提交，裝好後要記得一起提交。
- **還沒做：** 覆蓋率門檻（elf-cicd-frontend 負責）沒有寫進去，根目錄的 `package.json`、`.nvmrc`、`pnpm-workspace.yaml` 也都還沒建立。

下一步：在 `apps/` 執行 `pnpm install`，產生並提交 lockfile。
````

## 第 2 次（修正 1：兩列寫明不套用 caret 預設）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `d890a8b1a6cbc6d94599cbdd0dc911782165c777`（HEAD `3a9feb6c3197c91dec67380d43b1600817531cc1` ＋ 未提交的 stack/elf-stack/SKILL.md）；`git diff --stat`：`1 file changed, 2 insertions(+), 1 deletion(-)`（只有 stack/elf-stack/SKILL.md）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：5，耗時 26 秒
- 結果：2/3 個 grader 通過 → **未通過**
- 備註：02 仍未通過 → 修 skill（coverage-v8 列加「寫進 manifest 或回答版號時要說明這是 caret 預設的註明例外」與 WHY）

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-both-exact` | 通過 | work/apps/package.json:9-10 兩者皆 "5.0.5"，無 ^ 或 ~。 |
| `02-named-exception` | 未通過 | 回覆只說「不要加 ^」「必須和 vitest 寫成完全相同的版號，兩個一起升級」，未指出這是 §3 caret 慣例的註明例外（未提 caret 預設／例外）。 |
| `03-table-not-self-picked` | 通過 | 回覆「照 v2 那欄的值寫」，版號 5.0.5；trace 中 5.1.0 僅出現在無關的 actions/checkout 列。 |

### 子代理最後回覆（逐字）

````markdown
`@vitest/coverage-v8` 要裝 **`5.0.5`**，不要加 `^`。elf-stack 規定它必須和 `vitest` 寫成完全相同的版號，兩個一起升級。這個 repo 是新的，所以照 v2 那欄的值寫。

已建立 `apps/package.json`。`devDependencies` 裡 `vitest` 和 `@vitest/coverage-v8` 都是 `5.0.5`，另外加了 `test:coverage` 指令（`vitest run --coverage`）。

我還沒跑 `pnpm install`，所以還沒有 `pnpm-lock.yaml`。團隊規定 lockfile 要一起提交，接下來請在 `apps/` 跑一次 install 產生它。覆蓋率門檻沒寫在這裡，那部分照 elf-cicd-frontend 的規定設定。
````

## 第 3 次（修正 2：coverage-v8 列要求說明是註明例外）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `94f2c98a0a479478aaecdbf69dcbff6d9b98577e`（HEAD `3a9feb6c3197c91dec67380d43b1600817531cc1` ＋ 未提交的 stack/elf-stack/SKILL.md）；`git diff --stat`：`1 file changed, 2 insertions(+), 1 deletion(-)`（只有 stack/elf-stack/SKILL.md）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：6，耗時 26 秒
- 結果：3/3 個 grader 通過 → **通過**
- 備註：同一快照前一次執行為 1 回合殘句，判定為執行異常作廢、未評分，本節是重跑的那一次

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-both-exact` | 通過 | work/apps/package.json:9-10 兩者皆 "5.0.5"，無 range 符號。 |
| `02-named-exception` | 通過 | 回覆明言「表上其他 npm 套件預設都加 ^，這兩個是表上特別註明的例外」，且須與 vitest 相同精確版號、一起升。 |
| `03-table-not-self-picked` | 通過 | 回覆「依據是 elf-stack v2 表 §3.2…照 v2 欄位」，5.0.5；trace 的 5.1.0 僅為 actions/checkout 無關列。 |

### 子代理最後回覆（逐字）

````markdown
`@vitest/coverage-v8` 要用 **`5.0.5`**，而且要寫精確版號、不加 `^`。依據是 elf-stack v2 表 §3.2；這是新 repo，所以照 v2 欄位。

我已經建立 `apps/package.json`，放在 `devDependencies`：

```json
"@vitest/coverage-v8": "5.0.5",
"vitest": "5.0.5"
```

- **為什麼不加 `^`：** 表上其他 npm 套件預設都加 `^`，這兩個是表上特別註明的例外。`@vitest/coverage-v8` 必須和 `vitest` 寫完全相同的精確版號，升級時兩個一起升。之後有人看到這裡沒有 `^`，不要當成漏寫而補回去，否則兩個套件會各自升到不同版本。
- **為什麼也加了 `vitest`：** 工作目錄原本是空的，沒有 `vitest`，所以我照同一列規定一起加，也是 `5.0.5`。另外加了 `test:coverage` 指令（`vitest run --coverage`）。

**還沒做的：** 我沒有執行 `pnpm install`，所以還沒有 `pnpm-lock.yaml`，也沒跑過覆蓋率。根目錄的 `package.json`（`packageManager: pnpm@12.16.1`、`engines`）、`.nvmrc`、`pnpm-workspace.yaml` 也都還沒建。覆蓋率門檻的設定在另一個團隊規範 elf-cicd-frontend 裡，這次沒寫。
````
