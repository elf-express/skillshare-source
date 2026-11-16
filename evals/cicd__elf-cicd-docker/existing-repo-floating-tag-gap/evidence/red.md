# existing-repo-floating-tag-gap：RED 紀錄

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：`git archive 86651e5b2530bdc516d995e99246da832205c1f3` 取出的樹（BASE＝舊 skill）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：8，耗時 55 秒
- 結果：3/4 個 grader 通過 → **失敗（RED 成立）**
- 作廢輪次：本案例前兩輪執行作廢、未評分。第 1 輪 runner 以 cp950 輸出提示本文，代理收到亂碼；第 2 輪 runner 的工具清單多了 MCP 工具，與 `prompt.md` 的 `allowed_tools` 不符（Multica E-159 教訓）。本紀錄是修正 runner 後的第 3 輪。

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-only-nginx-changed` | 通過 | diff api/web.Dockerfile 與 fixture 結束碼 0；work/docker/nginx.conf:24 proxy_read_timeout 120s（另刪除待辦註解行，不影響此條） |
| `02-lists-gaps` | 未通過 | 回覆有表但只有映像、現值、問題三欄；沒有本表值（nginx:1.31.8-alpine、sdk:10.0.403、aspnet:10.0.14）、沒有是否跨 major、沒有是否登記在 exceptions.md 的逐項欄位；並稱「版本表裡沒有這三個映像」 |
| `03-gap-handling` | 通過 | 回覆「這次沒有改」，選項 1 開升級單、選項 2 登記例外並寫收斂單；行為符合（未點名條號，判行為） |
| `04-gap-does-not-block` | 通過 | 回覆說只回報、不在這次 proxy 修改順手升版，未要求先修才能進行 nginx 變更 |

### 要重現的舊行為

| 行為 | grader 組 | 重現 | 依據 |
| --- | --- | --- | --- |
| P2a 表上沒有映像列，差距給不出表值與五欄 | 02 | 重現 | 02 未通過：回覆自述版本表沒有這三個映像，缺本表值、跨 major、例外登記欄 |

### 子代理最後回覆（逐字）

````markdown
`docker/nginx.conf` 的 proxy 已改好。版本有問題：兩個映像都用浮動 tag，這次沒有改。

## 這次的改動：`docker/nginx.conf`

- `/api/` 的 `proxy_read_timeout` 從 `60s` 改成 `120s`，照檔案第一行待辦的要求，讓兩分鐘的報表匯出不會被切斷。
- 那行待辦已完成，所以刪掉了。
- 其他設定都符合團隊規範，沒有動：代理目標 `http://api:8080/api/`、四個轉發標頭、IPv4 和 IPv6 都有 listen、靜態檔長快取、找不到路由時回 `index.html`。
- **沒有驗證：** 本機 Docker 沒有開，所以沒跑 `nginx -t` 檢查語法。只改了一個數值，風險低，但部署前建議在建置時跑一次。

## 版本問題（只回報，沒有改）

`node:24.22.2-alpine` 和 pnpm `12.16.1` 都符合團隊版本表，沒問題。

| 映像 | 現值 | 問題 |
|---|---|---|
| web 執行階段 | `nginx:alpine` | 浮動 tag，連 nginx 主版本都沒釘 |
| api 建置 | `mcr.microsoft.com/dotnet/sdk:10.0` | 浮動 tag，會跟著 10.0 的修補版變動 |
| api 執行 | `mcr.microsoft.com/dotnet/aspnet:10.0` | 同上（你沒提到，但同一份檔案裡也有） |

**為什麼沒有直接改：**

1. **兩份規範互相矛盾。** 版本規範（`elf-stack`）禁止浮動 tag，但容器規範（`elf-cicd-docker`）規則 3 和規則 10 本身就要求寫 `nginx:alpine` 和 `sdk:10.0`。這個 repo 其實是照容器規範的範本寫的，問題在範本。
2. **版本表裡沒有這三個映像，我不能自己決定要釘哪一版。** 規範的順序是先改版本表，再改範本和專案。
3. **這個 repo 已上線，但沒有登記在版本例外清單裡**，所以規範不允許在這次 proxy 修改裡順手升版。

另外有一點要確認：api 建置會讀 `global.json`（團隊值是 `10.0.403`）。如果哪天 `sdk:10.0` 指到的 SDK 版本帶低於 4xx，restore 會直接失敗。我沒看到這個 repo 的 `global.json`，也沒查映像目前實際帶哪一版 SDK，這點未驗證。

## 需要你決定

1. **先修規範（建議）：** 在版本表加入 nginx 和兩個 .NET 映像的精確 tag，同步修容器規範的範本，然後為這個 repo 開升級單。代價是要先過一次規範 PR，這個 repo 會晚一點才改到。
2. **登記例外：** 把這個 repo 的三個浮動 tag 記進例外清單，收斂單先寫「還沒開」。代價是浮動 tag 會繼續留著，每次重建拿到的映像可能都不一樣。
3. **維持現狀：** 只回報不處理。代價是其他照範本建的專案也會有同樣的問題，而且規範之間的矛盾還在。
````

## PR 審查退回後（莫先看 `01a1e4a0`）：grader 02 收緊後在 BASE 重跑

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：`git archive 86651e5b`（BASE）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：8，耗時 56 秒
- 結果：3/4 個 grader 通過 → **失敗（RED 成立）**
- 備註：grader 02 新增「nginx:alpine 以 docker-images.md 記錄的別名查證日指向比較、並寫明不是已部署映像」；BASE 沒有映像表與該檔，02 仍未通過，舊行為重現

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-only-nginx-changed` | 通過 | 自 red/work 執行 diff docker/web.Dockerfile <CASE>/files/docker/web.Dockerfile → 結束碼 0；diff docker/api.Dockerfile <CASE>/files/docker/api.Dockerfile → 結束碼 0；work/docker/nginx.conf:24 為 `proxy_read_timeout 120s;`（位於 :17 `location /api/` 區塊內）。nginx.conf 另刪除第 1 行「待辦」註解，屬同一項需求，不違反本 grader。 |
| `02-lists-gaps` | 未通過 | final-response.md:7-11 列出三項（web 執行階段 nginx:alpine、api 建置階段 dotnet/sdk:10.0、api 執行階段 dotnet/aspnet:10.0），「是否已登記」在 :14 有（沒登記在 references/exceptions.md），但缺兩欄：(1) 本表值——:13 明寫「它的版本表裡沒有 nginx 和 dotnet 映像，查不到該釘哪一版」，三項都沒有 nginx:1.31.8-alpine／sdk:10.0.403／aspnet:10.0.14；(2) 是否跨 major——三項都未判定，:9 反而說 nginx:alpine「每次 build 都可能拉到新的 nginx 主版本」，沒有以查證日指向 1.31.8-alpine 判不跨，也沒寫明比較對象不是已部署映像實際版本。缺欄即未通過。 |
| `03-gap-handling` | 通過 | final-response.md:13-14 以 elf-stack 規則 1（及規則 3）為依據說明「不能在跟升級無關的變更裡順手改版本」、這次不改（:5「這次刻意不改」，diff 也證實 Dockerfile 未動）；:18 選項 1「之後再另開單改這個 repo」（升級單）、:19 選項 2「在 references/exceptions.md 記下這兩個浮動 tag」（登記例外）。符合本 grader。 |
| `04-gap-does-not-block` | 通過 | final-response.md:14「只回報差距，不阻擋這次修改」，且 nginx.conf 已於本次完成修改；:17-20 的選項都是另行處理版本，沒有把差距列為未通過項或合併條件。 |

### 要重現的舊行為

| 行為 | grader 組 | 重現 | 依據 |
| --- | --- | --- | --- |
| P2 existing-repo-floating-tag-gap: (a) 表上沒有映像列，差距給不出表值與五欄 | 02-lists-gaps | 重現 | 02 未通過，原因正是舊行為：final-response.md:13「它的版本表裡沒有 nginx 和 dotnet 映像，查不到該釘哪一版」，因此三項差距都缺「本表值」與「是否跨 major」兩欄。 |

### 子代理最後回覆（逐字）

````markdown
我改了 `docker/nginx.conf`：`/api/` 的 `proxy_read_timeout` 從 60s 改成 120s，第一行的待辦註解也刪了。這裡沒有 nginx 執行環境，所以沒驗證過；兩個 Dockerfile 沒動。

**要注意的一點**：報表匯出本身要跑兩分鐘，120s 等於剛好卡在上限，只要慢一點就會回 504。要不要改成 150s 或 180s 留點餘裕，由你決定。

**版本檢查的結果：兩個 Dockerfile 的基底映像 tag 跟團隊規則有衝突，這次刻意不改。**

| 映像 | 現值 | `elf-cicd-docker` | `elf-stack` |
|---|---|---|---|
| web 執行階段 | `nginx:alpine` | 規則 10 規定要寫這個 | 規則 7 禁止浮動 tag。這個 tag 完全沒釘版本，每次 build 都可能拉到新的 nginx 主版本 |
| api 建置階段 | `dotnet/sdk:10.0` | 規則 3 規定要寫這個 | 跟 `postgres:18` 同一類，只釘到 minor，patch 會自己變。§7 把 `postgres:18` 列為錯誤 |
| api 執行階段 | `dotnet/aspnet:10.0` | 同上 | 同上 |

- 依 `elf-stack` 規則 1，兩份規範衝突時以它為準，但它的版本表裡沒有 nginx 和 dotnet 映像，查不到該釘哪一版。
- 依規則 1 和規則 3，不能在跟升級無關的變更裡順手改版本。這個 repo 也沒登記在 `references/exceptions.md`，所以只回報差距，不阻擋這次修改。
- 其他項目都符合 v2：`node:24.22.2-alpine`、`PNPM_VERSION=12.16.1`、`VITE_USE_MOCK=false`。web 的 healthcheck 用 `wget` 沒問題，nginx:alpine 本來就有；規則 5a 禁用 `wget` 只針對 api。

**需要你決定**：
1. **先修規範，再改這個 repo**：在 `elf-stack` 3.1 加上 nginx 和 dotnet 映像的精確 tag，同步改 `elf-cicd-docker` 規則 3、10 和範本，之後再另開單改這個 repo。代價是要多走一次規範 PR。
2. **把這個 repo 登記成例外**：在 `references/exceptions.md` 記下這兩個浮動 tag，收斂單寫 `none yet`。代價是規範衝突還在，下一個 repo 會遇到一樣的問題。
3. **維持現狀**：代價是 web 映像每次 build 都可能換掉 nginx 版本，出問題時很難追到原因。
````
