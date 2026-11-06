# elf-stack 例外登記：尚未對齊 v2 的既有專案

既有 repo 還有一項以上停在 v2 之前的值時，登記在這裡。新 repo 永遠不登記（見 `SKILL.md` §0）。專案完全對齊 v2 後，刪掉它的區塊。

登記只記錄現況，不要求降版，也不要求在登記的那張單裡遷移。

一筆登記的規則：

- 一個專案一個區塊。只列偏離的項目，其餘項目在該 repo 照 v2。
- 理由寫一行。「還沒排遷移」也是可以接受的理由；寫出來，不要留白。
- 寫明會關掉這筆例外的單，或寫 `none yet`。單號前面寫來源（Linear E-426、Multica E-45），後面加幾個字說明，讓沒開 Linear／Multica 的人也看得懂。
- 例外只涵蓋版本表。治理規則（誰核准什麼、批次、SHA 釘選、CVE 路徑）對有例外的專案照樣適用。

## 範本

```
### <repo 名稱>
- 登記：YYYY-MM-DD，<登記人>
- 理由：<一行>
- 收斂單：<來源 E-xxx（做什麼） | none yet>
- 偏離項目：
  | 項目 | 現值 | v2 目標 | 批次 | 收斂條件 |
  | --- | --- | --- | --- | --- |
  | vite | ^6.4.3 | ^8.3.5 | Vite | 遷移單合併 |
```

## 已登記的例外

下列值取自 2026-10-25 的 lint 工具鏈盤點（`lint-toolchain-audit.md`）與 2026-10-29 的堆疊盤點；v2 目標是 `SKILL.md` §3 的表。這些是快照，動手前對照 repo HEAD 重新確認。

### ELF.Studio

- 登記：2026-11-02，Eddie（取自盤點紀錄）
- 理由：已上線產品；大版本（Vite、Pinia、router、TS）要各自開遷移單，並保留既有的自訂 lint 規則與守門。既有 CI 與 repo 專屬規則要整組遷移，不能只升 ESLint 或只換 formatter。
- 收斂單：Linear E-427（ELF.Studio 遷移到完整 antfu）——lint 列；執行期列尚無單（none yet）。
- 偏離項目：

  | 項目 | 現值 | v2 目標 | 批次 | 收斂條件 |
  | --- | --- | --- | --- | --- |
  | typescript | ^5.6.3 → 5.9.3 | ^6.0.3 | TS | TS 5→6 升級單驗證通過；TS 7 依 Multica E-48（TypeScript 7 解除條件追蹤） |
  | vue-tsc | ^2.1.10 → 2.2.12 | ^3.3.13 | TS | 與 TypeScript 同一張單 |
  | eslint | ^9.17.0 → 9.39.5 | ^10.13.0 | Lint | Linear E-427 遷移：config 查找方式與 `recommended` 的變動已驗證，維持 0 錯誤 0 警告 |
  | @eslint/js | ^9.17.0 | 完整 antfu 下不疊加 | Lint | antfu 遷移時移除 |
  | @antfu/eslint-config | 未使用 | ^10.0.0 | Lint | 在 Linear E-427 遷移中採用 |
  | prettier | ^3.3.3 → 3.9.10 | 不留獨立 CLI | Lint | 每種副檔名都由 antfu formatters 涵蓋後才移除 |
  | eslint-config-prettier | ^9.1.0 → 9.1.2 | 移除 | Lint | 完整 antfu 後移除 |
  | @types/node | ^24.0.0 → 24.19.2 | ^24.19.2 | Node | 已在範圍內，只需收緊下限 |
  | vite | ^6.4.3 | ^8.3.5 | Vite | none yet——團隊決議單 |
  | pinia | ^2.2.6 | ^4.1.0 | Router | none yet——與 vue-router 同一張單 |
  | vue-router | ^4.4.5 | ^5.4.0 | Router | none yet |
  | vue-i18n | ^10.0.5 | ^11.4.16 | — | none yet（BasicApp 已走 CVE 路徑升級） |

- 遷移時必須保留：schema 的 `no-restricted-imports`（UI 中立守門）、SFC 樣式限制、browser／node globals 語意、`.superpowers`／`.ocrca`／`.openchamber`／`uio-design-feedback` 的 ignores；根目錄納入 lint，0 錯誤 0 警告；既有 typecheck、測試、build、E2E 都要過；全庫排版獨立 commit。

### ELF.BasicApp（frontend）

- 登記：2026-11-02，Eddie（取自盤點紀錄）
- 理由：大多數列已經比 Studio 前面；剩下的偏離是針對已知誤報的刻意固定版，加上格式化雙入口與被忽略的 lockfile。這兩項修好之前，這裡的值都不算「可重現」。
- 收斂單：Linear E-428（ELF.BasicApp 遷移到完整 antfu preset），承接下面每一列。
- 偏離項目：

  | 項目 | 現值 | v2 目標 | 批次 | 收斂條件 |
  | --- | --- | --- | --- | --- |
  | vue-tsc | 固定 3.3.11 | ^3.3.13 | TS | 模板 `.value` 誤報（上游 vuejs/language-tools #6237）在穩定版重現確認已修，且產品 typecheck 通過 |
  | @typescript-eslint/*（plugin override） | override 8.71.0；parser 間接 8.71.1 | 經 antfu 10 帶入 ^8.72.0 | Lint | `.mjs` 的 `no-unused-vars` 誤報確認已消失，且 typecheck／lint／測試／build 通過 |
  | eslint | ^10.12.0 | ^10.13.0 | Lint | Linear E-428，與 antfu 一起對齊 |
  | @antfu/eslint-config | ^9.5.1 | ^10.0.0 | Lint | Linear E-428 |
  | prettier CLI ＋ antfu formatters | 兩者處理同一批檔案 | 每種副檔名單一入口 | Lint | Linear E-428 列出實際覆蓋矩陣（JSON／CSS／HTML／MD／YAML），移除重複入口 |
  | @types/node | ^26.6.4 | ^24.19.2 | Node | 另單確認部署的 runtime 與實際使用的 API |
  | pnpm-lock.yaml | 被 git 忽略（`frontend/.gitignore:43`） | 提交 | — | 依 repo 分支流程提交 lockfile；乾淨環境 `pnpm install --frozen-lockfile` 與 CI 通過 |
  | oxlint 先行檢查 | catalog ^1.86.0 → 1.87.0 | 不在 v2 表（保留為 repo 守門） | — | 保留；Linear E-428 確認 oxlint 與 antfu 的規則分工。這不是要移除的偏離 |
  | vite | ^8.3.2 | ^8.3.5 | Vite | patch——任何成員可升 |
  | pinia | ^4.0.3 | ^4.1.0 | Router | minor——Tech Lead 核准 |
  | vue-router | ^5.3.1 | ^5.4.0 | Router | minor——Tech Lead 核准 |
  | vue-i18n | ^11.4.13 | ^11.4.16 | — | patch |

  TypeScript `^6.0.3` 就是本表值，不列差距；TS 7 由 Multica E-48（TypeScript 7 解除條件追蹤）追蹤。

- 不因 registry 出了新版（latest）就移除例外。
