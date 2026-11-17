# 容器映像 tag 查證紀錄

> 調查日期：2026-11-16（台灣時間）。來源 commit：BASE `86651e5b`（E-117 開工時的 `origin/dev`）。以下每筆輸出都是當天逐字貼上，指令見表內。**沒有查到的不列。**

| 映像 | tag | registry | 指令 | 結果 | 日期 |
|---|---|---|---|---|---|
| `node:24.22.2-alpine` | `24.22.2-alpine` | Docker Hub `library/node` | `curl -s https://hub.docker.com/v2/repositories/library/<repo>/tags/<tag> \| python -c "...print(d['name'],d['digest'],d['last_updated'])"` | tag 存在，`last_updated` 2026-11-05 | 2026-11-16 |
| `nginx:1.31.8-alpine` | `1.31.8-alpine` | Docker Hub `library/nginx` | `curl -s https://hub.docker.com/v2/repositories/library/<repo>/tags/<tag> \| python -c "...print(d['name'],d['digest'],d['last_updated'])"` | tag 存在，digest 與 `alpine`、`mainline-alpine` 相同 | 2026-11-16 |
| `mcr.microsoft.com/dotnet/sdk:10.0.403` | `10.0.403` | MCR | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/<image>/manifests/<tag>` | `200` | 2026-11-16 |
| `mcr.microsoft.com/dotnet/aspnet:10.0.14` | `10.0.14` | MCR | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/<image>/manifests/<tag>` | `200`（`aspnet:10.0.403` 回 `404`，見下） | 2026-11-16 |

## nginx 為什麼釘 mainline 線

`alpine`、`mainline-alpine`、`1.31.8-alpine` 三個 tag 的 digest 相同（`sha256:fed7e14b…`），也就是 `1.31.8-alpine` 就是當天的 mainline。`stable-alpine` 的 digest 與 `1.30.6-alpine` 相同（`sha256:901e593c…`），是另一條線。要換成 stable 線是版本決定（elf-stack 第 6 節（升級政策）；Multica E-117 A2），不是查證能決定的，這裡只記錄事實。

2026-11-13 探測時同一組 tag 的 digest 是 `sha256:713fc2eb…`；nginx 於 2026-11-13T13:51Z 重建同一 tag，2026-11-16 查得 `sha256:fed7e14b…`。tag 不變、底下的映像會變，只有 digest 釘選能完全固定。

```text
$ curl -s https://hub.docker.com/v2/repositories/library/nginx/tags/1.31.8-alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
1.31.8-alpine sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72 2026-11-13T13:51:27.984823Z
$ curl -s https://hub.docker.com/v2/repositories/library/nginx/tags/alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
alpine sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72 2026-11-13T13:51:43.995081Z
$ curl -s https://hub.docker.com/v2/repositories/library/nginx/tags/mainline-alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
mainline-alpine sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72 2026-11-13T13:51:57.995806Z
$ curl -s https://hub.docker.com/v2/repositories/library/nginx/tags/stable-alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
stable-alpine sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a 2026-11-13T13:52:17.187574Z
$ curl -s https://hub.docker.com/v2/repositories/library/nginx/tags/1.30.6-alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
1.30.6-alpine sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a 2026-11-13T13:50:53.599123Z
```

## 浮動別名查證日指向

elf-stack 規則 7：既有專案的現值是浮動 tag 時，規則 1 的「是否跨 major」照這張表比。比的是 registry 別名在查證日指向哪個完整 tag，**不是**某個 repo 已部署映像的實際版本；部署映像要另外查（例如 `docker image inspect` 或部署紀錄），沒查過就不得說它是哪一版。

| 浮動 tag | 種類 | 查證日指向（比較對象） | 依據 | 與表值比 | 查證日 |
|---|---|---|---|---|---|
| `nginx:alpine` | 滾動別名 | `nginx:1.31.8-alpine` | digest 與 `1.31.8-alpine` 相同（`sha256:fed7e14b…`，上節逐字輸出） | 同 major（1），不跨 | 2026-11-16 |
| `nginx:mainline-alpine` | 滾動別名 | `nginx:1.31.8-alpine` | 同上 | 同 major（1），不跨 | 2026-11-16 |
| `nginx:stable-alpine` | 滾動別名 | `nginx:1.30.6-alpine` | digest 與 `1.30.6-alpine` 相同（`sha256:901e593c…`，上節逐字輸出） | 同 major（1），不跨；但是 stable 線，換線見上節 | 2026-11-16 |
| `mcr.microsoft.com/dotnet/sdk:10.0` | `major.minor` 簡寫 | 不必查：major 就寫在 tag 上（10） | tag 本身 | 與 `sdk:10.0.403` 同 major（10），不跨 | — |
| `mcr.microsoft.com/dotnet/aspnet:10.0` | `major.minor` 簡寫 | 不必查：major 就寫在 tag 上（10） | tag 本身 | 與 `aspnet:10.0.14` 同 major（10），不跨 | — |

別名的指向會隨上游重建改變；表值或查證日更新時，這張表要跟著重查。2026-11-16 13:53Z 重跑上節五個 nginx 指令，digest 與上節逐字輸出相同。

## runtime 映像為什麼不是 10.0.403

`sdk:10.0.403` 是 SDK 版號（對齊 `global.json`），runtime 映像的版號跟 ASP.NET Core 套件版走，兩者不同步：`aspnet:10.0.403` 在 MCR 不存在（`404`），`aspnet:10.0.14` 存在（`200`）。所以 api 建置階段用 `sdk:10.0.403`、執行階段用 `aspnet:10.0.14`（Multica E-117 A1）。

```text
$ curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/aspnet/manifests/10.0.14
200
$ curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/aspnet/manifests/10.0.403
404
```

SDK 的查證輸出：

```text
$ curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/sdk/manifests/10.0.403
200
```

## `node:24.22.2-alpine`

elf-cicd-docker 待確認「node 映像 tag 是否存在」指向這一節：Docker Hub `library/node` 回得到 `24.22.2-alpine`。

```text
$ curl -s https://hub.docker.com/v2/repositories/library/node/tags/24.22.2-alpine | python -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['digest'],d['last_updated'])"
24.22.2-alpine sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 2026-11-05T23:39:52.751445Z
```
