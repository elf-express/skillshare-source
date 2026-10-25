# E-426：lint／format／TypeScript 查證紀錄

查證日期：2026-10-25。決策正本：[E-426](https://linear.app/elf-express/issue/E-426)。
Eddie 定案：單一純文字工作單；TypeScript `^6.0.3`；格式化目標完整 antfu；產品與執行期升級另單。
此檔是有日期的盤點證據；後續版本決策以 SKILL.md 的表為準，不從快照自動升級。

## 證據範圍與重現

- ELF.Studio：`main`，HEAD `7796516b383aed8baf08cdc743897a841e913870`；盤點根 `package.json`、`pnpm-lock.yaml`、`eslint.config.js`、`apps/playground/package.json` 與 `packages/studio/package.json`。
- ELF.BasicApp：本機 `feat/e-194-pdf-questpdf`，HEAD `c9bb24b6d23ff413616397a34beb050d2465387c`；盤點 `frontend/package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`eslint.config.mjs`、`.prettierrc.mjs`。這是該 checkout 的現況，**不是已發佈 release 的宣告**。
- BasicApp 的 `frontend/pnpm-lock.yaml` 被 `frontend/.gitignore:43` 忽略，**不在上述 commit 中**。表內 BasicApp 的解析值是本機檔案 `E:\source\ELF\ELF.BasicApp\frontend\pnpm-lock.yaml` 的快照，SHA256：`470D3D483400A94DA6988FBC442002B418F29EA4DD2FB4EC06F4F11A2480D72C`；不能只憑 HEAD／tracked 乾淨宣稱可從 commit 重現。Studio lockfile 則已納入版控。
- 兩個產品的 tracked 檔案在盤點時均無未提交修改；本單沒有修改產品或執行產品安裝。BasicApp 的 fork 遷移位置須由後續工作依其 BRANCHING.md 決定。
- 套件版本直接讀 npm registry 的 `latest` manifest（另讀 TS 6 與 Node 24 型別固定版）；**沒有把 target 值填成產品 lockfile 已解析值**。

以產品 checkout 為工作目錄，先確認 HEAD／tracked 狀態，再讀下列檔案；有 `.codegraph/` 時先用 `codegraph explore` 定位，未涵蓋的 manifest／config 才直接讀：

```powershell
git rev-parse HEAD
git status --porcelain --untracked-files=no
# ELF.Studio
git show HEAD:package.json
git show HEAD:pnpm-lock.yaml
git show HEAD:eslint.config.js
# ELF.BasicApp
git show HEAD:frontend/package.json
git show HEAD:frontend/pnpm-workspace.yaml
git show HEAD:frontend/eslint.config.mjs
git show HEAD:frontend/.prettierrc.mjs
# BasicApp lockfile 是被忽略的本機快照，不能用 git show HEAD 重現
git check-ignore -v frontend/pnpm-lock.yaml
Get-FileHash -Algorithm SHA256 -LiteralPath frontend/pnpm-lock.yaml
Get-Content -LiteralPath frontend/pnpm-lock.yaml
```

Registry 重現（PowerShell；只讀公開 metadata，每次請求限制 20 秒）：

```powershell
$packages = @('typescript', 'vue-tsc', 'eslint', '@eslint/js', 'typescript-eslint',
  'eslint-plugin-vue', 'vue-eslint-parser', 'globals', 'eslint-config-prettier',
  'prettier', 'eslint-plugin-format', '@antfu/eslint-config', '@types/node')
foreach ($name in $packages) {
  $uri = 'https://registry.npmjs.org/' + [uri]::EscapeDataString($name) + '/latest'
  $manifest = Invoke-RestMethod $uri -TimeoutSec 20
  $manifest | Select-Object name, version, engines, peerDependencies,
    peerDependenciesMeta, dependencies | ConvertTo-Json -Depth 6
}
Invoke-RestMethod 'https://registry.npmjs.org/typescript/6.0.3' -TimeoutSec 20
Invoke-RestMethod 'https://registry.npmjs.org/@types%2fnode/24.19.2' -TimeoutSec 20
```

## 完整盤點：宣告範圍 → lockfile 解析

括號省略 peer resolution 後綴；「間接」是 preset 帶入，不能誤寫為沒有安裝。BasicApp 的箭頭後解析值均來自上述有雜湊的本機鎖檔，沒有可從 commit 還原的保證。

| 套件 | 舊 elf-stack | ELF.Studio | ELF.BasicApp frontend | registry latest | 決策與代價 |
|------|-------------|------------|-----------------------|-----------------|------------|
| TypeScript | `^5.6.3` → 5.9.3 | `^5.6.3` → 5.9.3 | `^6.0.3` → 6.0.3 | 7.0.2 | 統一 `^6.0.3`；保留 TS lint，暫不採 TS 7；Studio 另單驗證 TS 主版差異 |
| vue-tsc | `^2.1.10` | `^2.1.10` → 2.2.12 | **固定** 3.3.11 → 3.3.11 | 3.3.13 | 目標 `^3.3.13`；BasicApp 保留誤報例外，修復重現與產品 typecheck 通過才解除；peer 相容不能證明已修復 |
| eslint | 無 | `^9.17.0` → 9.39.5 | `^10.12.0` → 10.12.0 | 10.13.0 | 統一目標 `^10.13.0`；Studio 9→10 要驗證查找方式與 recommended 規則 |
| @eslint/js | 無 | `^9.17.0` → 9.39.5 | 無直接宣告 | **10.0.1** | 表列手動設定備用；完整 antfu 不額外疊加；不是跟 ESLint 同為 10.13.0 |
| @antfu/eslint-config | 無 | 無 | `^9.5.1` → 9.5.1 | 10.0.0 | 完整採用 `^10.0.0`；兩個產品各自遷移與 CI 驗證，規則差異與排版變更分 commit |
| typescript-eslint | 無 | `^8.18.1` → 8.72.0 | 無 umbrella；間接 parser 8.71.1、plugin **override 8.71.0** | 8.72.0 | antfu 目標內含 `@typescript-eslint/* ^8.72.0`；BasicApp override 保留至 `.mjs` 誤報驗證通過 |
| eslint-plugin-vue | `^10.11.1` → 10.11.1 | `^10.11.1` → 10.11.1 | 間接 → 10.11.1 | 10.11.1 | 同版；保留各 repo Vue 規則與 globals 語意；不強加直接相依 |
| vue-eslint-parser | 無 | 自動 peer → 10.4.1 | 間接 → 10.4.1 | 10.4.1 | 統一目標 `^10.4.1`，隨 preset／lockfile 固定；手動 import 才直接宣告 |
| globals | `^17.13.0` → 17.13.0 | `^17.13.0` → 17.13.0 | antfu 間接 → 17.13.0 | 17.13.0 | 同版；preset 提供不代表 repo 自行 import 可省直接相依 |
| eslint-plugin-format | 無 | 無 | `^2.0.1` → 2.0.1 | 2.0.1 | 目標 `^2.0.1`；啟用 antfu 外部 formatters 時安裝，須明確覆蓋非 JS 格式 |
| prettier | 無 | `^3.3.3` → 3.9.10 | `^3.9.9` → 3.9.9 | 3.9.10 | `^3.9.10` 供過渡 CLI；目標取消獨立 CLI，plugin 內部仍可依賴 Prettier；不能刪 CLI 卻漏掉檔案 |
| eslint-config-prettier | 無 | `^9.1.0` → 9.1.2 | 無直接宣告 | 10.1.8 | `^10.1.8` 只供過渡手動組合；完整 antfu 遷移後移除，不把此 config 疊在 stylistic preset 上 |
| @types/node | 無 | `^24.0.0` → 24.19.2 | `^26.6.4` → 26.6.4 | 26.6.5（24 線 24.19.2） | Node 24 目標 `^24.19.2`；避免型別允許 runtime 沒有的 API。BasicApp 保留現況例外，另單確認部署 runtime 與 API 使用再收斂 |

## Manifest 相容證據

| 套件固定版 | 必要條件／相依 | 判讀 |
|------------|---------------|------|
| typescript-eslint 8.72.0 | ESLint `^8.57.0 || ^9.0.0 || ^10.0.0`；TS `>=4.8.4 <6.1.0` | TS 6.0.3＋ESLint 10.13.0 在範圍內，TS 7 不在 |
| antfu 10.0.0 | ESLint `^9.10.0 || ^10.0.0`；內含 parser／plugin `^8.72.0`、Vue plugin `^10.11.1`、Vue parser `^10.4.1`、globals `^17.13.0` | 不能藉改用 antfu 繞過 TS 上限；format plugin 是 optional peer，啟用才需要 |
| eslint-plugin-vue 10.11.1 | ESLint `^8.57.0 || ^9.0.0 || ^10.0.0`；Vue parser `^10.3.0`；TS parser `^7.0.0 || ^8.0.0`（optional） | 目標 parser／ESLint 符合；@stylistic peer 亦涵蓋 antfu 帶入的 5.x |
| vue-eslint-parser 10.4.1 | ESLint `^8.57.0 || ^9.0.0 || ^10.0.0` | 可配 ESLint 10 |
| eslint-plugin-format 2.0.1 | ESLint `^8.40.0 || ^9.0.0 || ^10.0.0`；內部 Prettier `^3.8.1` | 可配 ESLint 10；整套 antfu 不等於完全不使用 Prettier engine |
| vue-tsc 3.3.13 | TS `>=5.0.0` | TS 6 符合，但不代表 BasicApp 的模板誤報已修 |
| @eslint/js 10.0.1 | ESLint `^10.0.0` | 手動組合目標符合 |
| eslint-config-prettier 10.1.8 | ESLint `>=7.0.0` | 過渡期組合符合 |
| ESLint 10.13.0 | Node `^20.19.0 || ^22.13.0 || >=24` | 表定 Node 24.18 符合；TS ESLint／Vue parser 的 Node 範圍也涵蓋 24.18 |

以上只查 manifest／官方支援範圍，**沒有在產品安裝新組合或跑過 lint／typecheck／測試／build**。產品 PR 要實跑並保留原有守門。

## 例外來源與遷移驗收

- BasicApp `pnpm-workspace.yaml` 註明 vue-tsc 3.3.12 對模板中匯入物件成員誤補 `.value`；[上游 #6237](https://github.com/vuejs/language-tools/issues/6237) 有同類重現。latest 3.3.13 不足以證明本專案已修復，維持 3.3.11 直到穩定版重現測試通過。
- 同檔 override 的註解記錄 TS ESLint 8.71.1 對 `.mjs` 的 `no-unused-vars` 誤報。這是 repo 記錄的理由；本單未獨立重現，不能宣稱 8.72.0 已修復，也不移除 override。
- BasicApp 的 `format` script 仍用 Prettier 格式化 `**/*.{json,css,html,md}`，antfu formatters 開 CSS／HTML；同一檔案存在兩入口，`.prettierrc.mjs` 也註明要避免兩邊互相重排。產品遷移應列出 JSON／CSS／HTML／MD／YAML 等實際覆蓋矩陣、統一入口，再調整 scripts／CI／編輯器。
- BasicApp 的 `lint`／`lint:fix` 先執行 oxlint 再執行 ESLint；catalog `oxlint ^1.86.0`、lockfile 1.87.0。這是既有 repo 守門例外，本單沒有決定 oxlint 的新目標版本，E-428 保留入口並確認與 antfu 的規則分工，不因「完整 antfu」而刪除。
- BasicApp 忽略 lockfile 與本 skill 規則 6 不一致；E-428 須依 repo 流程提交 lockfile、驗證乾淨環境 frozen install 與 CI。此例外未解決前，不能把本機解析值當成下游可重現的鎖定組合。
- Studio 必須保留 schema 的 `no-restricted-imports`、SFC 樣式限制、browser／node globals 語意與 `.superpowers`／`.ocrca`／`.openchamber`／`uio-design-feedback` ignores。根目錄 lint 保持涵蓋，0 錯誤 0 警告；原有 typecheck／測試／build／E2E 都要過。全庫排版獨立 commit 以利審查。
- [ESLint 10 官方遷移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0)：Node 支援範圍、由每個 linted file 出發查找 config、recommended 規則及已移除 API 等都有變動；不能只以 peer 相容作結論。
- [typescript-eslint 官方支援範圍](https://typescript-eslint.io/users/dependency-versions/) 與 [antfu 官方設定說明](https://github.com/antfu/eslint-config#readme) 是後續組合重查入口；版本升級仍須先改本表。

## 執行期另單與發版界線

Vite `^6.4.3`／`^8.3.2`、Pinia `^2.2.6`／`^4.0.3`、vue-i18n `^10.0.5`／`^11.4.13`（Studio／BasicApp）屬產品相依差異；BasicApp 另用 vue-router `^5.3.1`，舊表為 `^4.4.5`。本單不改這些表值或產品，另單確認最新穩定組合、breaking changes 與驗收，再依 §6.2 先改表後改產品。

E-426 只開 `dev` PR；合併後維持「驗證中」。E-391 群組完成後由該批獨立發版審計員一併核對 SHA／CI 與 release 快轉，執行 release source 的 pull／sync 並取得各 AI 工具生效證據。本單沒有執行實際同步；隔離 config（`targets: {}`）的 validate／dry-run 不算發版驗收。
