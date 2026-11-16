# 容器映像 tag 查證紀錄

> 調查日期：2026-11-16（台灣時間）。來源 commit：BASE `86651e5b`（E-117 開工時的 `origin/dev`）。以下每筆輸出都是當天逐字貼上，指令見表內。**沒有查到的不列。**

| 映像 | tag | registry | 指令 | 結果 | 日期 |
|---|---|---|---|---|---|
| `node:24.22.2-alpine` | `24.22.2-alpine` | Docker Hub `library/node` | `curl -s https://hub.docker.com/v2/repositories/library/<repo>/tags/<tag> \| python -c "...print(d['name'],d['digest'],d['last_updated'])"` | tag 存在，`last_updated` 2026-11-05 | 2026-11-16 |
| `nginx:1.31.8-alpine` | `1.31.8-alpine` | Docker Hub `library/nginx` | `curl -s https://hub.docker.com/v2/repositories/library/<repo>/tags/<tag> \| python -c "...print(d['name'],d['digest'],d['last_updated'])"` | tag 存在，digest 與 `alpine`、`mainline-alpine` 相同 | 2026-11-16 |
| `mcr.microsoft.com/dotnet/sdk:10.0.403` | `10.0.403` | MCR | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/<image>/manifests/<tag>` | `200` | 2026-11-16 |
| `mcr.microsoft.com/dotnet/aspnet:10.0.14` | `10.0.14` | MCR | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/dotnet/<image>/manifests/<tag>` | `200`（`aspnet:10.0.403` 回 `404`，見下） | 2026-11-16 |

## nginx 為什麼釘 mainline 線

`alpine`、`mainline-alpine`、`1.31.8-alpine` 三個 tag 的 digest 相同（`sha256:fed7e14b…`），也就是 `1.31.8-alpine` 就是當天的 mainline。`stable-alpine` 的 digest 與 `1.30.6-alpine` 相同（`sha256:901e593c…`），是另一條線。要換成 stable 線是版本決定（Spec 第 6 節 A2），不是查證能決定的，這裡只記錄事實。

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

## runtime 映像為什麼不是 10.0.403

`sdk:10.0.403` 是 SDK 版號（對齊 `global.json`），runtime 映像的版號跟 ASP.NET Core 套件版走，兩者不同步：`aspnet:10.0.403` 在 MCR 不存在（`404`），`aspnet:10.0.14` 存在（`200`）。所以 api 建置階段用 `sdk:10.0.403`、執行階段用 `aspnet:10.0.14`（A1）。

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
