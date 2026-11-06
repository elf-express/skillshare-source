# registered-exception-studio：GREEN 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive edc237aad13287a16bbd48aac6415237ae982555` 取出的樹
- 結果：5/5 個 grader 通過 → **通過**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-recognises-registration` | 通過 | 回覆寫 ELF.Studio 已登記在 `references/exceptions.md` |
| `02-cites-closing-tickets` | 通過 | eslint、prettier 列引 Linear E-427；vite、pinia、vue-router、vue-i18n 列寫 none yet |
| `03-no-reregistration-no-block` | 通過 | 結論寫版本差距不擋；沒有要求 Studio 重新登記，只就未登記的三項給選項 |
| `04-no-manifest-change` | 通過 | `files/` 兩個檔與 fixture 相同（`diff -r`） |
| `05-unregistered-playwright-gap` | 通過 | `@playwright/test ^1.50.0` 列為未登記的差距，附 `^1.64.1` |

## 子代理最後回覆（逐字）

````markdown
**結論：這個 PR 可以合併，版本差距不擋它。** PR 沒動 manifest，版本差距另外處理（規則 1、3）。lint、typecheck、測試、build 都沒跑，手上只有 `pr.diff` 和 `package.json`。

## 元件 `apps/playground/src/components/ColorSwatch.vue`

沒有阻擋項。區塊順序、`<script setup lang="ts">`、型別 props、scoped 樣式都符合 elf-vue 規則 5、6、8、11。元件本身也沒寫死色碼。

建議（都不擋合併）：
- **樣式屬性：** `:style` 改用 `backgroundColor`。`background` 簡寫也吃 `url(...)`，`color` 日後若來自使用者輸入，會發出對外請求。
- **呼叫端：** 這個 diff 裡沒有地方使用它。之後傳 `color` 要用 `var(--token)`（elf-ui-pattern 規則 28），`label` 要走 i18n。
- **待跑檢查：** 第 12 行的單行 `<style>` 可能被 Prettier 改寫。Studio 的 SFC 樣式限制在 `eslint.config.js`，這次沒有這個檔，要實跑 lint 才知道。

## 版本差距

ELF.Studio 已登記在 `references/exceptions.md`，但例外只涵蓋列出的項目，其餘照 v2。

| 項目 | 現值 | v2 | 跨 major | 已登記 |
|---|---|---|---|---|
| vite | ^6.4.3 | ^8.3.5 | 是（2 個） | 是，none yet |
| pinia | ^2.2.6 | ^4.1.0 | 是（2 個） | 是，none yet |
| vue-router | ^4.4.5 | ^5.4.0 | 是 | 是，none yet |
| vue-i18n | ^10.0.5 | ^11.4.16 | 是 | 是，none yet |
| typescript | ^5.6.3 | ^6.0.3 | 是 | 是 |
| vue-tsc | ^2.1.10 | ^3.3.13 | 是 | 是 |
| eslint | ^9.17.0 | ^10.13.0 | 是 | 是，Linear E-427（Studio 遷移到完整 antfu） |
| prettier | ^3.3.3 | 目標不留獨立 CLI（過渡 ^3.9.10） | 否 | 是，Linear E-427 |
| **@playwright/test** | **^1.50.0** | **^1.64.1** | 否 | **否** |
| **`engines.node`** | **缺** | **>=24.22.2** | 無法判斷 | **否** |
| **`packageManager`** | **缺** | **pnpm@12.16.1** | 無法判斷 | **否** |

已登記列的現值都與登記相符。

## 需要處理的事（都不在這個 PR 做）

1. **@playwright/test 沒登記：** 它連 v1 的 ^1.63.0 都不到。
2. **`engines`、`packageManager` 沒登記：** 這份 `package.json` 裡沒有這兩項，規則 2 要求寫進 repo。`.nvmrc` 和 `pnpm-workspace.yaml` 這次沒有，要到 repo 確認。
3. **vue-i18n 不只是落後，還有安全性問題：** 這一列的收斂單仍是 none yet，建議優先開單，並可走 §6 第 5 點的安全性修補路徑。是否實際可被利用，要看 repo 怎麼用 `escapeParameter`，這次沒查。
   - GHSA-8rc2-428q-7ww3（低）：影響 `>=9.0.0-beta.5 <11.4.14`，所以 ^10.0.5 一定中。
   - GHSA-83rm-6c8r-g728（高）：列的是 `=10.0.8`，要看 lockfile 是否解析到這一版。
   - 兩者的修補版都是 11.4.14；10.x 沒有修補版。
4. **manifest 與登記對不上：**
   - `exceptions.md` 列了 `@eslint/js`、`eslint-config-prettier`、`@types/node`，盤點紀錄還列了 `typescript-eslint`、`eslint-plugin-vue`、`globals`，這份 `package.json` 都沒有。
   - 登記是快照，可能已過時，也可能這份檔案不完整，要對照 repo HEAD 確認。
   - 這次也沒有 `apps/playground/package.json`、`packages/studio/package.json` 和 lockfile，所以 vue、@vitejs/plugin-vue、vitest、ant-design-vue 和實際解析版本都沒比對。

## 需要 Eddie 決定

@playwright/test、`engines`、`packageManager` 這三項：
- **A. 登記進 `exceptions.md`，收斂單寫 none yet：** 馬上合規，但落後狀態會繼續留著。
- **B. 開升級單：** 真正解決，但要排工。Playwright 是 minor，由 Tech Lead 核准，還要重跑 E2E；pnpm 和 Node 的影響範圍要先確認。
````
