---
type: llm
focus: trace
weight: 1
---

`docker/web.Dockerfile` 的建置階段是 `FROM node:24.22.2-alpine`，執行階段是 `FROM nginx:1.31.8-alpine`（兩個 `FROM` 都要等於這兩個值，`AS` 別名不計）
