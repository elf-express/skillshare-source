# docker-image-tags-pinned：RED 紀錄

- 日期：2026-11-16
- 模型：claude-opus-5-5（`claude -p` 全新 headless session，每個案例一次；工具清單 ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']，與 `prompt.md` 的 `allowed_tools` 相同；`max_turns` 20、逾時 600 秒）
- skill 來源：`git archive 86651e5b2530bdc516d995e99246da832205c1f3` 取出的樹（BASE＝舊 skill）
- 當時的 `origin/dev`：`86651e5b2530bdc516d995e99246da832205c1f3`
- 回合數：10，耗時 85 秒
- 結果：1/5 個 grader 通過 → **失敗（RED 成立）**
- 備註：同一案例前一次執行只回覆「發揮功能」四字、1 回合、沒有讀檔也沒有產出，判定為執行異常作廢、未評分；本紀錄是重跑的那一次（提示、樹、工具清單相同）

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-api-images` | 通過 | work/docker/api.Dockerfile:7 sdk:10.0.403、:24 aspnet:10.0.14 |
| `02-web-images` | 未通過 | work/docker/web.Dockerfile:4 node:24.22.2-alpine 符合；:37 為 nginx:alpine，不是 nginx:1.31.8-alpine |
| `03-no-floating-tags` | 未通過 | grep -rnE ... docker/ 命中 docker/web.Dockerfile:37 FROM nginx:alpine，結束碼 0 |
| `04-cites-image-table` | 未通過 | 回覆引用規則 7 處理 .NET，但明說「nginx 還是 nginx:alpine：版本表沒列 nginx…先留著」，即表上沒有就照範本沿用浮動 tag |
| `05-evidence-file` | 未通過 | base-tree/stack/elf-stack/references 只有 exceptions.md、lint-toolchain-audit.md、simplification-evidence.md，沒有 docker-images.md |

### 要重現的舊行為

| 行為 | grader 組 | 重現 | 依據 |
| --- | --- | --- | --- |
| P1a 照範本寫浮動映像 tag | 01, 02, 03 | 重現 | 02、03 未通過：web 執行階段 nginx:alpine（表上無 nginx 列、沿用範本）；04 同因 |
| P1b 查證檔不存在 | 05 | 重現 | BASE 沒有 references/docker-images.md |

### 子代理最後回覆（逐字）

````markdown
我照團隊範本寫好了 `docker/api.Dockerfile` 和 `docker/web.Dockerfile`。兩份都還沒建置過：本機 Docker daemon 沒開，`docker build --check` 連不上；repo 也還沒有程式碼可以拿來建置。

**有一處兩份規範互相衝突**：elf-cicd-docker 範本寫的是 `sdk:10.0`、`aspnet:10.0`、`nginx:alpine`，但 elf-stack 規則 7 禁止會自動漂移的 tag（例如 `latest`、`10.0`），而且兩份衝突時以 elf-stack 為準。我的處理：

- **.NET 兩個映像**：改成 `sdk:10.0.403` 和 `aspnet:10.0.14`。兩個版本都在版本表上，我也到 MCR 查過：SDK 10.0.403 映像內建的就是 ASP.NET 10.0.14，兩個 tag 都存在。
- **Node**：`node:24.22.2-alpine`，範本本來就是固定版本。pnpm 填 `12.16.1`。
- **nginx 還是 `nginx:alpine`**：版本表沒列 nginx，規範不允許我自己挑版本，所以先留著，並在檔案裡加了 TODO 註解。

**需要你決定：**
1. nginx 用哪個 tag：
   - 先把 nginx 加進 elf-stack 版本表，再釘到具體版本，例如 `nginx:1.x.y-alpine`：要多開一張改版本表的單，但之後每個專案都有依據。
   - 暫時保留 `nginx:alpine`：今天就能用，但違反規則 7，每次建置拿到的 nginx 版本可能不同。
2. 應用程式名稱：`<AppName>`（API 專案 `server/src/<AppName>.Api/`）和 `<app>`（nginx 設定檔名，小寫）沒填，名稱一給我就補上。前端目錄先照團隊慣例用 `apps/`。

另外，elf-cicd-docker 範本本身也要改成固定版本，不然下一個新專案照抄又會碰到同樣的衝突。這兩份 Dockerfile 也要搭配 `docker/nginx.conf`、`docker-compose.yml`、`.env.example` 和根目錄的 `.dockerignore` 才跑得起來，這幾個檔案這次都還沒做。
````
