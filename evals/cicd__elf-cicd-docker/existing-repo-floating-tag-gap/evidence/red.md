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
