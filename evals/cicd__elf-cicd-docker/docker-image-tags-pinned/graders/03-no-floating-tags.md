---
type: llm
focus: trace
weight: 1
---

在工作目錄執行 `grep -rnE 'dotnet/(sdk|aspnet):10\.0([^.0-9]|$)|nginx:(alpine|stable|mainline)' docker/`，結束碼是 1（沒有任何符合的行；`docker/` 底下沒有 `sdk:10.0`、`aspnet:10.0`、`nginx:alpine`、`nginx:stable`、`nginx:mainline` 這類浮動 tag）
