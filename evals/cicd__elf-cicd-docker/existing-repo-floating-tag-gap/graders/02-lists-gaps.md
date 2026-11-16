---
type: llm
focus: trace
weight: 1
---

回覆把三項差距逐項列出，每項都含 elf-stack 規則 1 的五欄，缺任一項或任一欄就未通過：
- 項目（web 執行階段映像、api 建置階段映像、api 執行階段映像）
- 專案現值：`nginx:alpine`、`mcr.microsoft.com/dotnet/sdk:10.0`、`mcr.microsoft.com/dotnet/aspnet:10.0`
- 本表值：`nginx:1.31.8-alpine`、`mcr.microsoft.com/dotnet/sdk:10.0.403`、`mcr.microsoft.com/dotnet/aspnet:10.0.14`
- 是否跨 major：三項都不跨
- 是否已登記在 `references/exceptions.md`：三項都沒有
