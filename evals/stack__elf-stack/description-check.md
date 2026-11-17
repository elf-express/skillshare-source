# elf-stack description 對照

對照對象：`stack/elf-stack/SKILL.md` frontmatter 的實際 description（2.0.0）：

```yaml
description: |
  Elf Express 技術堆疊版本的唯一真實來源（single source of truth），規定每個工具的版本、在 repo 中的釘選方式，以及既有專案要升級還是登記例外；不涵蓋大版本的寫法遷移（歸各領域 skill）。
  當任務涉及建立新專案、新增或升級套件 / SDK / runtime、撰寫 global.json、.nvmrc、package.json 的 engines 或
  packageManager、Directory.Packages.props、docker image tag（完整 tag 或浮動 tag）、Cargo.toml 的 rust-version（MSRV）
  與 crate／Tauri plugin 版本、MSRV 或版本升級要誰核准、CI 的 setup-* 或任何 `uses:` 行、審查 Dependabot PR、
  審查 PR 時比對既有專案與團隊版本的差距、使用者要求「用最新版」、例外登記，或需要回答「團隊用哪一版」時觸發。
```

## 該載入（13 個觸發說法）

| # | 說法 | description 對應的詞 |
|---|------|---------------------|
| 1 | 「幫我開一個新的 Vue 前端 repo，package.json、.nvmrc 照團隊規範寫」 | 「建立新專案」「.nvmrc」「package.json 的 engines 或 packageManager」 |
| 2 | 「新後端專案的 global.json 跟 Directory.Packages.props 要寫哪一版」 | 「建立新專案」「global.json」「Directory.Packages.props」「團隊用哪一版」 |
| 3 | 「這個舊專案的 Vite 還在 5，跟團隊規範差多少？要怎麼升」 | 「比對既有專案與團隊版本的差距」「新增或升級套件」「既有專案要升級還是登記例外」 |
| 4 | 「新專案全部用最新版就好」 | 「使用者要求『用最新版』」「建立新專案」 |
| 5 | 「審查這個 PR，順便看版本有沒有符合團隊規範」 | 「審查 PR 時比對既有專案與團隊版本的差距」 |
| 6 | 「ELF.Studio 還在 Vite 6，可以先不升嗎？要登記在哪」 | 「既有專案要升級還是登記例外」「例外登記」 |
| 7 | 「Dependabot 開了一個 actions/checkout 的 PR，可以直接合嗎」 | 「審查 Dependabot PR」「任何 `uses:` 行」 |
| 8 | 「幫新 repo 寫 `docker/api.Dockerfile` 與 `docker/web.Dockerfile`，基底映像照團隊規範」 | 「建立新專案」「docker image tag（完整 tag 或浮動 tag）」（第 3 組） |
| 9 | 「Dockerfile 寫 `FROM nginx:alpine` 算不算釘版？」 | 「docker image tag（完整 tag 或浮動 tag）」「審查 PR 時比對既有專案與團隊版本的差距」（第 3 組＋規則 7 的滾動別名措辭） |
| 10 | 「新 Tauri 專案的 `src-tauri/Cargo.toml`，`rust-version` 跟 `tauri-plugin-updater` 要寫多少」 | 「Cargo.toml 的 rust-version（MSRV）」「crate／Tauri plugin 版本」（第 1 組） |
| 11 | 「`@vitest/coverage-v8` 要裝哪一版，可以寫 `^5.0.5` 嗎」 | 「新增或升級套件」「團隊用哪一版」 |
| 12 | 「Dependabot 開了 `mcr.microsoft.com/dotnet/sdk` 映像 tag 的 PR，能直接合嗎」 | 「審查 Dependabot PR」「docker image tag（完整 tag 或浮動 tag）」 |
| 13 | 「MSRV 要升版誰核准」 | 「MSRV 或版本升級要誰核准」（第 2 組） |

## 近似但不該載入（10 個說法）

| # | 說法 | 為什麼不會選到 elf-stack |
|---|------|--------------------------|
| 1 | 「Vite 8 的 vite.config.ts 要怎麼改寫」 | 是大版本的寫法遷移；description 明寫「不涵蓋大版本的寫法遷移（歸各領域 skill）」，也沒有 vite.config 之類的設定檔詞（歸 elf-vue） |
| 2 | 「Pinia setup store 裡的 storeToRefs 怎麼用」 | 是元件／store 寫法，description 沒有對應詞；只問用法、不涉及版本（歸 elf-vue） |
| 3 | 「SqlSugar 查 timestamptz 時區跑掉」 | description 沒有 ORM、查詢、時區之類的詞（歸 elf-postgresql／elf-sqlsugar） |
| 4 | 「把 dev 快轉到 release」 | description 沒有分支、快轉、發版的詞（歸 elf-team-rule） |
| 5 | 「ant-design-vue 主題 token 怎麼設」 | description 沒有 UI 元件庫、主題或 token 的詞（歸 elf-ui-pattern） |
| 6 | 「nginx 的 `/api/` 反向代理與 SPA fallback 要怎麼設」 | 是設定寫法，不是版本值；description 沒有 nginx、反向代理的詞（歸 elf-cicd-docker 規則 12–14） |
| 7 | 「`tauri-plugin-updater` 的簽章金鑰與自動更新流程」 | 是流程與金鑰；description 沒有簽章、更新流程的詞（歸 elf-tauri、elf-cicd-desktop） |
| 8 | 「Vitest 的覆蓋率門檻要設多少、多個測試專案的報告怎麼合併」 | elf-stack §3.2 明寫 V8 覆蓋率門檻由 elf-cicd-frontend 擁有；description 沒有門檻的詞 |
| 9 | 「GHCR 映像名稱要不要小寫、release tag 要不要 `v` 前綴」 | 是命名與 tag 前綴政策，不是版本值；description 沒有 GHCR 的詞（歸 elf-cicd-docker 規則 22／23） |
| 10 | 「`Cargo.toml` 的 `[target.'cfg(...)'.dependencies]` 要怎麼寫」 | 是 manifest 寫法，不是版本值；description 沒有 cfg( 的詞（歸 elf-tauri 規則 16） |

## 三組觸發詞

| 組 | 內容 | description 對應的字詞 |
|----|------|----------------------|
| 1 | Cargo 寫檔 | 「Cargo.toml 的 rust-version（MSRV）」「crate／Tauri plugin 版本」 |
| 2 | MSRV／版本升級的核准 | 「MSRV 或版本升級要誰核准」 |
| 3 | 容器映像 | 「docker image tag（完整 tag 或浮動 tag）」 |
