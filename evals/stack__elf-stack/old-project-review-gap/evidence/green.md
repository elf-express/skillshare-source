# old-project-review-gap：GREEN 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive edc237aad13287a16bbd48aac6415237ae982555` 取出的樹
- 結果：5/5 個 grader 通過 → **通過**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-lists-four-gaps` | 通過 | 差距表列出 vite、pinia、vue-router、Node，都附 v2 值 |
| `02-gap-does-not-block` | 通過 | 結論第一句寫版本差距不擋這個 PR |
| `03-no-manifest-change` | 通過 | `files/` 三個檔與 fixture 相同（`diff -r`），回覆也寫不該在這個 PR 升級 |
| `04-ticket-or-exception` | 通過 | 回覆給出登記例外或開升級單兩個選項 |
| `05-batched-upgrade` | 通過 | Node、Vite、Router 三批，Pinia 與 vue-router 同屬 Router 批；跨 major 寫明要附遷移計畫 |

## 子代理最後回覆（逐字）

````markdown
**結論：版本差距不擋這個 PR，也不該在這個 PR 裡升級。程式碼有 2 個問題要處理：一個要先確認範圍，一個是小修。** 我只看了 `package.json`、`.nvmrc`、`pr.diff`，lint、typecheck、測試、build、E2E 都沒跑，手上沒有完整 repo。

## 程式碼審查

**合併前要處理**

1. **設定開關沒有實際作用**（`src/views/Settings.vue:4`）：`notify` 只是元件內的 `ref(true)`，沒接 store 或 API。
   - 使用者關掉通知後，什麼都不會發生；離開頁面再回來，又顯示成開啟。專案已上線，真實使用者會以為設定生效了。
   - 如果這個 PR 就是完整範圍，請把開關接上實際設定，或先不開放這個路由。如果接線已排在下一個 PR，請在描述寫明，並確認這段期間不會對外開放。
2. **頁面缺 `<h1>`**：`elf-ui-pattern` 規則 12 要求每頁一個 `<h1>`，可以視覺隱藏。這是新程式碼，在這個 PR 補就好。

**不擋合併的小問題**

- `/settings` 沒有 `name`，團隊範本是 `name: 'settings'`。diff 裡的既有路由也沒寫，補不補都可以。
- `class="settings"` 目前沒有對應樣式。
- 看不到路由守衛：如果設定頁要登入才能看，請確認 `/settings` 有被保護。

**這次不要求改的地方**（依 §0 跟著 repo 現況走）

| 項目 | 團隊規範 | 不要求的原因 |
|---|---|---|
| 檔名 `Settings.vue` | `SettingsView.vue` | 既有的 `Home.vue`、`About.vue` 都沒加 `View`，只改這一個反而不一致 |
| 寫死的「接收通知」 | 走 i18n | manifest 沒有 `vue-i18n`，為一頁新增相依超出範圍 |
| 原生 checkbox | `a-switch` | manifest 沒有 `ant-design-vue`；`<label>` 包住 input 也符合規則 21 |
| 沒有測試 | 規則 38 | 專案沒有 Vitest，也沒有 `test` 腳本 |

## 版本差距

`elf-legacy-portal` 沒有登記在 `references/exceptions.md`，又已上線一年，屬於 §0 第 3 種情況：既有值不動，只回報差距。這個 PR 沒改 manifest，這樣是對的。

| 項目 | 專案現值 | v2 | 跨 major | 批次 | 已登記 |
|---|---|---|---|---|---|
| Node（`.nvmrc`） | `22`（只釘 major） | `24.22.2` | 是（22→24） | Node | 否 |
| `engines.node` | 未設定 | `>=24.22.2` | 隨 Node 版本 | Node | 否 |
| `packageManager` | 未設定 | `pnpm@12.16.1` | 無法判斷 | — | 否 |
| vite | `^5.4.0` | `^8.3.5` | 是（跨 3 個 major） | Vite | 否 |
| pinia | `^2.1.7` | `^4.1.0` | 是（跨 2 個 major） | Router | 否 |
| vue-router | `^4.3.0` | `^5.4.0` | 是（4→5） | Router | 否 |

Node、vite、pinia、vue-router 的現值連 v1 都不到。

**沒給檔案、無法判斷：** lockfile 與實際使用的套件管理工具、`pnpm-workspace.yaml` 的 `engineStrict`、CI 的 `uses:` 釘選。治理規則不因例外而豁免，這些仍要查。

## 既有問題，不是這個 PR 造成的

- **manifest 缺相依：** 沒宣告 `vue`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`，但程式碼有 `.vue` 檔和 `lang="ts"`。如果這就是完整的 manifest，`vite build` 應該處理不了 `.vue`（我沒實跑）；比較可能是給的不是完整檔案，請確認。
- **型別沒人檢查：** `build` 腳本沒跑 `vue-tsc`，所以 `lang="ts"` 不會被型別檢查。

## 其他要回報的

- **diff 不完整：** router 那段 hunk 標頭寫 6→7 行，實際只有 3→4 行，`]` 之後的內容（可能包含守衛）我看不到。
- **skill 內部衝突：** `frontend/elf-vue/SKILL.md:158` 和 `cicd/elf-cicd-frontend/SKILL.md:31` 還寫 Node `24.18`，與 elf-stack 的 `24.22.2` 不一致。依規則 1 以 elf-stack 為準，這兩份要另外修正。

## 需要 Eddie 決定

這個專案要登記例外，還是開升級單？

- **A. 登記例外，收斂單寫 `none yet`（建議先做）：** 只要一個改 skill 的小 PR，落後的項目也看得到；代價是版本繼續落後，也還沒有收斂時間表。
- **B. 開升級單（Node、Vite、Router 三批）：** 能真正收斂；代價是跨 major 要團隊決議並附遷移計畫，而且 Vite 8、Pinia 4、vue-router 5 的寫法遷移還沒在團隊專案實跑過（elf-stack 第 8 節），這個線上專案會先承擔這個風險。
````
