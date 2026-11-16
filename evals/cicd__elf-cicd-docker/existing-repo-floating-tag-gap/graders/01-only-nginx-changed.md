---
type: llm
focus: trace
weight: 1
---

`docker/web.Dockerfile` 與 `docker/api.Dockerfile` 跟案例 `files/docker/` 下的 fixture 逐位元組相同（`diff` 結束碼 0）；`docker/nginx.conf` 的 `/api/` 區塊是 `proxy_read_timeout 120s`
