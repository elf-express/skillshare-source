# elf-stack description 對照

對照對象：`stack/elf-stack/SKILL.md` frontmatter 的實際 description（2.0.0）：

```yaml
description: |
  Elf Express 技術堆疊版本的唯一真實來源（single source of truth），規定每個工具的版本、在 repo 中的釘選方式，以及既有專案要升級還是登記例外；不涵蓋大版本的寫法遷移（歸各領域 skill）。
  當任務涉及建立新專案、新增或升級套件 / SDK / runtime、撰寫 global.json、.nvmrc、package.json 的 engines 或
  packageManager、Directory.Packages.props、docker image tag、CI 的 setup-* 或任何 `uses:` 行、審查 Dependabot PR、
  審查 PR 時比對既有專案與團隊版本的差距、使用者要求「用最新版」、例外登記，或需要回答「團隊用哪一版」時觸發。
```

## 該載入（7 個觸發說法）

| # | 說法 | description 對應的詞 |
|---|------|---------------------|
| 1 | 「幫我開一個新的 Vue 前端 repo，package.json、.nvmrc 照團隊規範寫」 | 「建立新專案」「.nvmrc」「package.json 的 engines 或 packageManager」 |
| 2 | 「新後端專案的 global.json 跟 Directory.Packages.props 要寫哪一版」 | 「建立新專案」「global.json」「Directory.Packages.props」「團隊用哪一版」 |
| 3 | 「這個舊專案的 Vite 還在 5，跟團隊規範差多少？要怎麼升」 | 「比對既有專案與團隊版本的差距」「新增或升級套件」「既有專案要升級還是登記例外」 |
| 4 | 「新專案全部用最新版就好」 | 「使用者要求『用最新版』」「建立新專案」 |
| 5 | 「審查這個 PR，順便看版本有沒有符合團隊規範」 | 「審查 PR 時比對既有專案與團隊版本的差距」 |
| 6 | 「ELF.Studio 還在 Vite 6，可以先不升嗎？要登記在哪」 | 「既有專案要升級還是登記例外」「例外登記」 |
| 7 | 「Dependabot 開了一個 actions/checkout 的 PR，可以直接合嗎」 | 「審查 Dependabot PR」「任何 `uses:` 行」 |

## 近似但不該載入（5 個說法）

| # | 說法 | 為什麼不會選到 elf-stack |
|---|------|--------------------------|
| 1 | 「Vite 8 的 vite.config.ts 要怎麼改寫」 | 是大版本的寫法遷移；description 明寫「不涵蓋大版本的寫法遷移（歸各領域 skill）」，也沒有 vite.config 之類的設定檔詞（歸 elf-vue） |
| 2 | 「Pinia setup store 裡的 storeToRefs 怎麼用」 | 是元件／store 寫法，description 沒有對應詞；只問用法、不涉及版本（歸 elf-vue） |
| 3 | 「SqlSugar 查 timestamptz 時區跑掉」 | description 沒有 ORM、查詢、時區之類的詞（歸 elf-postgresql／elf-sqlsugar） |
| 4 | 「把 dev 快轉到 release」 | description 沒有分支、快轉、發版的詞（歸 elf-team-rule） |
| 5 | 「ant-design-vue 主題 token 怎麼設」 | description 沒有 UI 元件庫、主題或 token 的詞（歸 elf-ui-pattern） |
