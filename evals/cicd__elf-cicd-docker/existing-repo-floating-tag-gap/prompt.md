---
tags: [cicd__elf-cicd-docker, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

這個已上線的 repo 的 `docker/web.Dockerfile` 是 `FROM nginx:alpine`、`docker/api.Dockerfile` 是 `mcr.microsoft.com/dotnet/sdk:10.0`。我這次只要改 `docker/nginx.conf` 的 proxy 設定，順便看一下版本有沒有問題。
Input files: docker/web.Dockerfile, docker/api.Dockerfile, docker/nginx.conf
