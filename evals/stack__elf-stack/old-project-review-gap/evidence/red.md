# old-project-review-gap：RED 紀錄

- 日期：2026-11-03
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive 5e13bd2a797e113dd937d07eada936a6cf092b7e` 取出的樹
- 開分支時的 `origin/dev`：`5e13bd2a797e113dd937d07eada936a6cf092b7e`
- 結果：3/5 個 grader 通過 → **失敗**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-lists-four-gaps` | 失敗 | 四項都列了，但附的是 v1 值（`.nvmrc` `24.18`、Vite `^6.4.3`、Pinia `^2.2.6`、vue-router `^4.4.5`），不是 v2 值 |
| `02-gap-does-not-block` | 通過 | 「這個 PR 不用為了版本問題擋下」 |
| `03-no-manifest-change` | 通過 | 工作目錄的 `package.json`、`.nvmrc` 與 fixtures 逐位元組相同；回覆說「不要動版本」 |
| `04-ticket-or-exception` | 通過 | 建議另開「elf-legacy-portal 版本對齊」單 |
| `05-batched-upgrade` | 失敗 | 所有落差併成同一張「版本對齊」單，只按 patch／minor／major 分級，沒有照批次分單（Vite、Router、Node 各一張）；舊 skill 沒有 §3.7 |

## 子代理最後回覆（逐字）

````markdown
## PR 審查：新增 `/settings` 頁（elf-legacy-portal）

**結論：** 這個 PR 不用為了版本問題擋下。下面列的版本差異全部是 PR 之前就存在的，這個 PR 沒有動到任何版本。不過 PR 本身有兩個功能面的問題要先修。版本落差另外開單處理，不要在這個 PR 裡順手升級（elf-stack 規則 3）。

### 一、PR 本身（`src/views/Settings.vue`、`src/router/index.ts`）

**要先修：**

1. **設定沒有作用，也存不下來。** `notify` 只是元件裡的 `ref(true)`，離開頁面就重設，也沒有任何程式讀它。一個「設定」頁應該把值放進 Pinia 的 settings store（這個 repo 已經裝了 pinia），並說明它的值存在哪裡（localStorage 或後端 API）。依 elf-vue 2.1 的分層，view 只讀 store，由 store 去呼叫 api。如果這次只是先放個殼，PR 描述要寫清楚，畫面上也不要讓使用者以為已經生效。
2. **「接收通知」寫死在 template 裡。** 依 elf-i18n 規則 9–11、16，文字要放進 locale JSON，例如 `settings.notify.label`，再用 `const { t } = useI18n()`。但這個專案的 `package.json` 沒有 `vue-i18n`。如果整個專案本來就沒做多語系，就照 repo 現況處理，並在 PR 註明；不要只為這一頁把 i18n 裝進來。

**建議（不擋合併）：**

3. 頁面缺 `<h1>`（elf-ui-pattern 規則 12）。
4. elf-vue 規定一個 route 對應一個 `XxxView.vue`，所以檔名應該是 `SettingsView.vue`。不過這個 repo 既有的檔名是 `Home.vue`、`About.vue`。這個 PR 跟著 repo 現況走比較一致，要改名就另外開單一起改。
5. 沒有測試。如果把 store 抽出來，store 的預設值和讀寫邏輯值得補一個 Vitest。但這個 repo 目前沒有裝 Vitest。
6. 路由用 lazy import，符合規範。

**要請作者確認：** `package.json` 裡沒有 `vue`、`@vitejs/plugin-vue`、`typescript`。照這份檔案，`import { ref } from 'vue'` 用 pnpm 嚴格模式會失敗，`.vue` 檔沒有 plugin-vue 也無法 build。請確認這份 `package.json` 是不是完整的，以及這個 PR 在本機 `build` 有沒有過。

### 二、版本與團隊規範（elf-stack 3.1／3.2）

這些都是既有的落差，不是這個 PR 造成的。依規則 1，以版本表為準並回報衝突：

| 項目 | 專案現況 | 團隊標準 | 差異 |
|---|---|---|---|
| Node（`.nvmrc`） | `22` | `24.18` | 主版本落後 |
| `engines.node` | 沒有 | `">=24.18"` | 缺少 |
| `packageManager` | 沒有 | `pnpm@<完整版號>`（pnpm 版號在 elf-stack 是「待確認」） | 缺少；也看不出目前用 npm 還是 pnpm |
| 嚴格檢查 Node 版本（engine-strict） | 看不出來 | `pnpm-workspace.yaml` 的 `engineStrict: true` | 待確認 |
| lockfile | 沒有提供 | 必須提交，CI 用 `--frozen-lockfile` 安裝 | 待確認 |
| Vite | `^5.4.0` | `^6.4.3` | 主版本落後 |
| Pinia | `^2.1.7` | `^2.2.6` | 次版本落後 |
| vue-router | `^4.3.0` | `^4.4.5` | 次版本落後 |
| Vue、`@vitejs/plugin-vue`、TypeScript、vue-tsc | 沒有列 | `^3.5.13`、`^6.0.9`、`^6.0.3`、`^3.3.13` | 缺少，見上面要確認的事 |
| Vitest、lint 工具鏈 | 沒有 | 3.2 與 3.6 | 缺少 |

### 處理方式

- **這個 PR：** 修完第一節的第 1、2 點就可以合併。不要動版本。
- **版本落差：** 另外開一張「elf-legacy-portal 版本對齊」單，照 elf-stack 第 6 節分級處理：
  - Pinia、vue-router 是次版本升級，需要 Tech Lead 核准。
  - Node 22→24、Vite 5→6 是主版本升級，需要團隊決議並排遷移計畫。
  - 專案已經上線一年，主版本升級要排在獨立的 PR 裡，build 和測試完整跑過，不能和功能 PR 混在一起。
- **規範缺口：** elf-stack 的 3.6 只把 ELF.Studio 和 ELF.BasicApp 列為過渡例外。這個專案不在清單上，elf-stack 也沒有寫「已上線的舊專案」要怎麼處理。所以目前只能當作衝突回報，不能當成例外放行。如果團隊想讓這類舊專案暫時維持現況，要先在 elf-stack 補一條例外並寫明收斂條件。
````

## 工作目錄的檔案（逐字；`node_modules`、`pnpm-lock.yaml` 不列）

- `.nvmrc`：與 `files/.nvmrc` 逐位元組相同（未修改）
- `package.json`：與 `files/package.json` 逐位元組相同（未修改）
- `pr.diff`：與 `files/pr.diff` 逐位元組相同（未修改）
