# coverage-v8-same-version：RED 紀錄

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：`git archive 86651e5b2530bdc516d995e99246da832205c1f3` 取出的樹（BASE＝舊 skill）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：6，耗時 30 秒
- 結果：2/3 個 grader 通過 → **失敗（RED 成立）**

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-both-exact` | 通過 | work/apps/package.json devDependencies: "@vitest/coverage-v8": "5.0.5"、"vitest": "5.0.5" |
| `02-named-exception` | 未通過 | 回覆稱 coverage-v8 不在版本表、vitest 寫法「和版本表不同」，依據是 elf-cicd-frontend 規則 16 與 elf-vue，並要求開 PR 註明待加入 elf-stack；未指出 elf-stack 有註明例外 |
| `03-table-not-self-picked` | 通過 | 版號 5.0.5 由表上 vitest 值推得，非 registry latest 5.1.0；但回覆承認表上無 coverage-v8 列（從寬判通過，缺列已由 02 反映） |

### 要重現的舊行為

| 行為 | grader 組 | 重現 | 依據 |
| --- | --- | --- | --- |
| P4a 表上只有 vitest ^5.0.5、沒有 coverage-v8 列與例外 | 01, 02, 03 | 重現 | 02 未通過：回覆自述表上沒有 coverage-v8、vitest 與表寫法不一致，無例外可引 |

### 子代理最後回覆（逐字）

````markdown
我建立了 `apps/package.json`（原本沒有這個檔案），`@vitest/coverage-v8` 寫成精確的 `5.0.5`，`vitest` 也改成同樣的精確 `5.0.5`，並加了 `test:coverage` 腳本。還沒安裝，也沒產生 `pnpm-lock.yaml`，所以 `vitest --coverage` 還沒實際跑過。下一步是在 `apps/` 執行 `pnpm install`，並提交 lockfile。

有兩件事跟團隊規範不完全一致：

1. **`@vitest/coverage-v8` 不在 elf-stack 版本表上。** 規定是表上沒有的套件，AI 不能自己決定版本。這次是照 `elf-cicd-frontend` 規則 16 和 `elf-vue` 的設定範例填的，兩份都要求它和 `vitest` 完全同版、不加 `^`。所以版本是從 Vitest 的 v2 值 `^5.0.5` 推出來的。開 PR 時要註明「待加入 elf-stack」，或者先把這個套件補進 3.2 表。
2. **`vitest` 的寫法和版本表不同。** 版本表寫 `^5.0.5`，我寫成精確的 `5.0.5`，原因同上：兩個套件必須同版。版本號一樣，只是不加 `^`。

另外，`name` 我先暫時填 `web`，等你決定 scope 後再改成 `@<scope>/web`。
````
