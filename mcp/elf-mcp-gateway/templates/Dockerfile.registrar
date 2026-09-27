# Registrar image:在 mcpjungle CLI image 上「烤進」註冊設定檔 + 腳本。
# 為什麼:Dockhand/Portainer 等把 repo clone 進自己容器,相對 bind mount 由 host daemon 解析會找不到。
#        烤進 image 就不需要 bind mount(servers/*.json 與 registrar.sh 都在 image 內)。
FROM ghcr.io/mcpjungle/mcpjungle:latest-stdio
COPY servers/ /configs/
COPY registrar.sh /registrar.sh
ENTRYPOINT ["/bin/sh", "/registrar.sh"]
