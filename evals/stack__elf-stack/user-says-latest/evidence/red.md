# user-says-latest：RED 紀錄

- 日期：2026-11-03
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive 5e13bd2a797e113dd937d07eada936a6cf092b7e` 取出的樹
- 開分支時的 `origin/dev`：`5e13bd2a797e113dd937d07eada936a6cf092b7e`
- 結果：2/3 個 grader 通過 → **失敗**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-same-as-skeleton` | 失敗 | 沒有寫任何檔案；口頭預設值為 Node `24.18`、pnpm「待確認」、3.2 的 v1 值 |
| `02-latest-means-table` | 通過 | 拒絕直接跟 registry latest，照表釘版；列出 TS 7、@types/node 26 比表新，建議要更新版本時先開 PR 改 elf-stack 表 |
| `03-typescript-6-with-reason` | 通過 | TypeScript 釘 `^6.0.3`，理由是 typescript-eslint／antfu 只支援 `<6.1.0`；沒有寫 TS 7，保留 lockfile 解析值檢查 |

## 子代理最後回覆（逐字）

````markdown
我不會直接全部改成最新版。團隊規範規定新專案也要照 `stack/elf-stack` 的版本表釘版本，而且要升級得先改表、再改專案，不能跳過表。下面列出「全部最新」在哪些地方行不通，以及我預設會怎麼做。

**哪些套件不能跟最新版**

| 項目 | 最新版的狀況 | 團隊規定 |
|---|---|---|
| TypeScript | registry 上最新的穩定版已經是 TS 7 | typescript-eslint 和 antfu 只支援 `<6.1.0`，所以釘 `^6.0.3`。產生 lockfile 時要確認實際裝到的版本還在 `<6.1.0` 以內，超過就停下來回報 |
| @types/node | 最新主版本是 26 | 執行環境是 Node 24.18，所以型別用 `^24.19.2` |
| Vite 6→7 這類主版本升級 | 需要團隊決議並安排遷移 | Vite、Pinia、vue-router 這些執行期套件，還在等 E-429（執行期套件版本決策單）決定，表上的值先不動 |
| `latest`、`*`、`postgres:latest` | 一律禁止 | 寫明確的 range，並提交 lockfile；資料庫映像用 `postgres:18` |
| GitHub Actions | 不能用 `@v4` 這種寫法，也不能用表外的 action | 只能用 3.5 節對照表裡的 40 碼 SHA，行尾加版本註解 |
| beta 或 RC 版 | 不採用 | 只用穩定版 |

**預設做法**

新專案的版本照表上的值來釘：
- Node `24.18`（寫在 `.nvmrc`、`engines`，並設 `engineStrict: true`）
- .NET `global.json` 寫 `10.0.100` 加 `latestFeature`，ASP.NET Core 用 `10.0.12`
- 前端用 3.2 節的值，lint／format 用 3.6 節的完整 antfu 組合
- Actions 用 3.5 節的 SHA

表上有三項還是「待確認」，會先寫暫定值，並在 PR 裡列出來：
- pnpm 主版本（11.x 或 12）和完整版號
- .NET SDK feature band
- SqlSugarCore 確切 minor 版本（暫定 `5.1.4.221`）

**如果你確實想用比表上更新的版本，有兩條路**

1. **先照表建專案（建議）**：馬上就能開工，CI 和相容性都核對過；代價是部分套件不是最新版。
2. **先開 PR 改 elf-stack 版本表**：一個套件附一份升級理由、breaking changes 和影響的 repo，表合併後專案才跟著升。patch 更新表後就能用，minor 要 Tech Lead 核准，major 要團隊決議；代價是要等審核。TS 7 不管走哪條路都卡住，要等 typescript-eslint 穩定版正式支援才能升。

請告訴我新專案包含哪幾塊（前端、後端、桌面、MCP server），我就照表產生對應的版本釘選檔。
````

## 工作目錄的檔案（逐字；`node_modules`、`pnpm-lock.yaml` 不列）

（工作目錄沒有任何檔案）
