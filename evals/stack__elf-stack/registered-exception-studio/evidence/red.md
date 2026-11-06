# registered-exception-studio：RED 紀錄

- 日期：2026-11-03
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive 5e13bd2a797e113dd937d07eada936a6cf092b7e` 取出的樹
- 開分支時的 `origin/dev`：`5e13bd2a797e113dd937d07eada936a6cf092b7e`
- 結果：2/5 個 grader 通過 → **失敗**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-recognises-registration` | 失敗 | 只認出 elf-stack 3.6 表內的 Studio 過渡例外列；沒有 `references/exceptions.md` 這份登記 |
| `02-cites-closing-tickets` | 失敗 | lint 列引 E-427；但執行期列沒有寫「none yet」：vite／pinia／vue-router 判為「跟表一致」，vue-i18n 判為未登記、要另開安全性單 |
| `03-no-reregistration-no-block` | 通過 | 「這個 PR 本身可以合併」，沒有要求重新登記 |
| `04-no-manifest-change` | 通過 | 工作目錄的 `package.json` 與 fixtures 逐位元組相同 |
| `05-unregistered-playwright-gap` | 失敗 | 把 `@playwright/test ^1.50.0` 回報為差距，但附的表值是 `^1.63.0`（v1），不是 `^1.64.1` |

## 子代理最後回覆（逐字）

````markdown
## ELF.Studio PR 審查（新增 `apps/playground/src/components/ColorSwatch.vue`）

**結論：這個 PR 本身可以合併，沒有阻擋問題。** 它沒有改 `package.json`，所以下面列的版本差異都是 repo 原本就有的。依 elf-stack 規則 3（沒有明確要求就不升級），這些差異不該在這個 PR 裡「順手」修，應該另外開單。

### 一、元件本身
- 有照 elf-vue 的寫法：區塊順序是 `<script setup lang="ts">` → `<template>` → `<style scoped>`（規則 6、11），props 用型別宣告 `defineProps<{...}>()`（規則 90）。
- `:style="{ background: color }"` 綁的是 prop，元件裡沒有寫死色碼，所以沒有違反 elf-ui-pattern 規則 28。這是色票元件，本來就要顯示呼叫端傳進來的顏色，而且它放在 playground，可以接受。
- 小建議（不擋合併）：
  - `.swatch__chip` 只是裝飾，可以加 `aria-hidden="true"`。
  - `<style scoped>` 寫成一行，和 repo 的排版不一致，可以交給 Prettier 處理。

### 二、版本對照 elf-stack（都不是這個 PR 造成的）

**屬於已登記的過渡例外（elf-stack 3.6 的 ELF.Studio 那一列），不算違規，不用處理：**

| 套件 | 現況 | 表上的目標 |
|---|---|---|
| eslint | `^9.17.0` | `^10.13.0` |
| prettier | `^3.3.3` | 過渡期允許 ESLint 9 加 Prettier 的組合 |
| typescript | `^5.6.3` | `^6.0.3` |
| vue-tsc | `^2.1.10` | `^3.3.13` |

這組要整組遷移到 antfu，由 E-427（ELF.Studio 的 lint 工具鏈遷移單）處理，不能在這裡單獨升級某一個。

**跟表一致：** vite `^6.4.3`、pinia `^2.2.6`、vue-router `^4.4.5`。

**不符合規範、也沒有登記成例外的，建議另外開單：**
1. **vue-i18n `^10.0.5`，表上是 `^11.4.16`，這是安全性問題。** E-21（vue-i18n 安全修補決議）因為 GHSA-83rm-6c8r-g728 和 GHSA-8rc2-428q-7ww3 決定升到 `^11.4.16`，3.6 的例外清單也沒有涵蓋 vue-i18n。照 elf-stack 第 6 節第 5 點，有 CVE 時可以先升專案、再補表。建議優先開單。
   - 補充：E-426 的查證紀錄把 Studio 的 vue-i18n 歸在「產品相依差異」，交給 E-429（執行期套件版本決策單）處理。不過 E-21 的安全決議比那份紀錄新，所以仍然該升。
2. **@playwright/test `^1.50.0`，表上是 `^1.63.0`。** 偏離表值，也沒有登記例外。
3. **根目錄 `package.json` 少了 `engines.node`（`>=24.18`）和 `packageManager`（`pnpm@<完整版號>`）。** 違反規則 2 和檢查清單。pnpm 確切版號目前在表上還是「待確認」，暫定 11.x。

**這次的輸入裡看不到、沒辦法驗證的：** `.nvmrc`、`pnpm-workspace.yaml` 的 `engineStrict: true`、`pnpm-lock.yaml` 裡 TypeScript 實際解析到的版本（必須 `<6.1.0`），以及 CI 的 `uses:` 有沒有釘 SHA。

### 建議
- 這個 PR：可以合併。上面兩個小建議看作者要不要改。
- 另外開單：vue-i18n 升到 `^11.4.16`（安全性，優先）、Playwright 對齊 `^1.63.0`、根 `package.json` 補上 `engines` 和 `packageManager`。
````

## 工作目錄的檔案（逐字；`node_modules`、`pnpm-lock.yaml` 不列）

- `package.json`：與 `files/package.json` 逐位元組相同（未修改）
- `pr.diff`：與 `files/pr.diff` 逐位元組相同（未修改）
