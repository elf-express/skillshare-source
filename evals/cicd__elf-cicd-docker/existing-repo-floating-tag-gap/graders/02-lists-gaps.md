---
type: llm
focus: trace
weight: 1
---

回覆把三項差距逐項列出，每項都含 elf-stack 規則 1 的五欄，缺任一項或任一欄就未通過：
- 項目（web 執行階段映像、api 建置階段映像、api 執行階段映像）
- 專案現值：`nginx:alpine`、`mcr.microsoft.com/dotnet/sdk:10.0`、`mcr.microsoft.com/dotnet/aspnet:10.0`
- 本表值：`nginx:1.31.8-alpine`、`mcr.microsoft.com/dotnet/sdk:10.0.403`、`mcr.microsoft.com/dotnet/aspnet:10.0.14`
- 是否跨 major：三項都不跨。`nginx:alpine` 這一項要以 elf-stack `references/docker-images.md`「浮動別名查證日指向」記錄的完整 tag（`1.31.8-alpine`）為比較對象判「不跨」，並寫明比的是 registry 別名在查證日的指向、不是已部署映像的實際版本；答「無法判定」，或沒有查證依據就斷言已部署映像是哪一版，都算缺這一欄
- 是否已登記在 `references/exceptions.md`：三項都沒有
