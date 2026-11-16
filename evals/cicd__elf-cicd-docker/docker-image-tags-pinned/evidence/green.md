# docker-image-tags-pinned：GREEN 紀錄

## 第 1 次（Plan Task 4 原文）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `989cc7771a61bff61fa9286f046f574639888f31`（HEAD `bce461b470939406ed0ffe9071c3d2ca0808fa34` ＋ 未提交的 stack/elf-stack/SKILL.md、cicd/elf-cicd-docker/SKILL.md、cicd/elf-cicd-docker/templates/api.Dockerfile、cicd/elf-cicd-docker/templates/web.Dockerfile）；`git diff --stat`：`4 files changed, 22 insertions(+), 9 deletions(-)`，只列這四個檔
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：6，耗時 42 秒
- 結果：4/5 個 grader 通過 → **未通過**
- 備註：04 未通過 → 修 skill（elf-cicd-docker 規則 3、10 同行加「交付時說明 tag 依據該表」）；同一快照另跑 P2 與兩個回歸，修正後全部用新快照重跑

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-api-images` | 通過 | work/docker/api.Dockerfile:6 為 sdk:10.0.403，:22 為 aspnet:10.0.14。 |
| `02-web-images` | 通過 | work/docker/web.Dockerfile:4 為 node:24.22.2-alpine，:35 為 nginx:1.31.8-alpine。 |
| `03-no-floating-tags` | 通過 | 在 work 執行 grep -rnE 'dotnet/(sdk\|aspnet):10\.0([^.0-9]\|$)\|nginx:(alpine\|stable\|mainline)' docker/，結束碼 1，無符合行。 |
| `04-cites-image-table` | 未通過 | final-response.md 只說「照團隊範本建好」與「映像都釘完整版本」，沒有說明 tag 取自 elf-stack 容器映像表或規則 7（trace 顯示代理有讀 elf-stack 並依表寫入，Dockerfile 行為正確，但回覆沒有交代依據）。沒有沿用範本浮動 tag 的說法。 |
| `05-evidence-file` | 通過 | snap-t4/stack/elf-stack/references/docker-images.md:7 與 :47-54 有 node:24.22.2-alpine 的 curl 指令與逐字輸出。 |

### 子代理最後回覆（逐字）

````markdown
我照團隊範本建好了 `docker/api.Dockerfile` 和 `docker/web.Dockerfile`，映像都釘完整版本，沒有浮動 tag：

| 用途 | 映像 / 版本 |
|---|---|
| api 建置 | `mcr.microsoft.com/dotnet/sdk:10.0.403` |
| api 執行 | `mcr.microsoft.com/dotnet/aspnet:10.0.14` |
| web 建置 | `node:24.22.2-alpine`，pnpm `12.16.1` |
| web 執行 | `nginx:1.31.8-alpine` |

還沒實際跑過 `docker build`，現在也還建不起來，原因是下面兩件事。

**要你決定：應用程式名稱。** 這是 repo 現在空的，我沒有自己取名字，兩個佔位符還沒填：
- `<AppName>`：api 專案名稱，會對到 `server/src/<AppName>.Api/<AppName>.Api.csproj` 和最後啟動的 dll。
- `<app>`：小寫名稱，用在 nginx 設定檔名 `/etc/nginx/conf.d/<app>.conf`。

給我名稱我就填進去，或者你直接全域取代。

**還缺的檔案：**
- **建 web 需要：** `docker/nginx.conf`，web.Dockerfile 會複製這個檔。
- **建 api 需要：** 根目錄的 `global.json`、`server/Directory.Build.props`、`server/Directory.Packages.props`，restore 那一步會用到。
- **前端目錄：** 我照團隊慣例假設放在 `apps/`；不是的話要改 web.Dockerfile。
- **團隊規範的另外三個：** `docker-compose.yml`、`docker/.env.example`、根目錄 `.dockerignore`，本身不影響建置，這次也還沒做，範本都有，要的話我一起補。
````

## 第 2 次（修正 1：規則 3、10 要求交付時說明依據 3.1 容器映像表）

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：工作樹快照 tree `704353822a52af3c82f05a50fb95569d79ef5793`（HEAD `bce461b470939406ed0ffe9071c3d2ca0808fa34` ＋ 同上四個未提交檔）；`git diff --stat`：`4 files changed, 22 insertions(+), 9 deletions(-)`，只列這四個檔
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：8，耗時 47 秒
- 結果：5/5 個 grader 通過 → **通過**

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-api-images` | 通過 | work/docker/api.Dockerfile:7 `FROM mcr.microsoft.com/dotnet/sdk:10.0.403 AS build`、:23 `FROM mcr.microsoft.com/dotnet/aspnet:10.0.14 AS runtime`（以串接後 grep FROM 的行號計）。 |
| `02-web-images` | 通過 | web.Dockerfile 有 `FROM node:24.22.2-alpine AS build` 與 `FROM nginx:1.31.8-alpine AS runtime`。 |
| `03-no-floating-tags` | 通過 | 執行 grep -rnE 'dotnet/(sdk\|aspnet):10\.0([^.0-9]\|$)\|nginx:(alpine\|stable\|mainline)' docker/，無輸出，結束碼 1。 |
| `04-cites-image-table` | 通過 | final-response.md 寫「四個 tag 都照 elf-stack 3.1 容器映像表的 v2 欄填，新 repo 依規定用 v2」，未沿用範本浮動 tag。 |
| `05-evidence-file` | 通過 | snap-t4b/stack/elf-stack/references/docker-images.md 存在；第 7 列與「## node:24.22.2-alpine」一節（第 47-54 行）含 curl 指令與逐字輸出 `24.22.2-alpine sha256:a34ab6d7… 2026-11-05T23:39:52Z`。 |

### 子代理最後回覆（逐字）

````markdown
我照團隊範本（elf-cicd-docker 的 `templates/`）做好了 `docker/api.Dockerfile` 和 `docker/web.Dockerfile`。repo 目前是空的，所以還沒實際 build 過。

**映像版本**：四個 tag 都照 `elf-stack` 3.1 容器映像表的 v2 欄填，新 repo 依規定用 v2，沒有用 `10.0`、`alpine` 這類會自動跟著更新的 tag。
- 後端：建置用 `mcr.microsoft.com/dotnet/sdk:10.0.403`，執行用 `mcr.microsoft.com/dotnet/aspnet:10.0.14`
- 前端：建置用 `node:24.22.2-alpine`，執行用 `nginx:1.31.8-alpine`
- pnpm 版本填 `12.16.1`

**要你決定**：你沒給專案名稱，我先用範本的範例名 `MyApp`（後端專案 `server/src/MyApp.Api/`）和 `myapp`（nginx 設定檔名）。前端目錄用團隊預設的 `apps/`。
- 給我正式名稱，我直接替換；不換的話，映像和專案路徑都會叫 MyApp。
- 或者先保留，等後端專案建好再改；在那之前 api 映像 build 不起來。

**這兩個檔案還缺的東西**：
- `web.Dockerfile` 會讀 `docker/nginx.conf`，這個檔還不存在，前端映像目前 build 不了。
- 範本另外有 `docker-compose.yml`、`.env.example`、根目錄的 `.dockerignore`，你這次沒要求，所以沒做。要的話我照範本一起補上。
````
