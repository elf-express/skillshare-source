---
type: llm
focus: trace
weight: 1
---

`docker/api.Dockerfile` 的建置階段是 `FROM mcr.microsoft.com/dotnet/sdk:10.0.403`，執行階段是 `FROM mcr.microsoft.com/dotnet/aspnet:10.0.14`（兩個 `FROM` 都要等於這兩個值，`AS` 別名不計）
