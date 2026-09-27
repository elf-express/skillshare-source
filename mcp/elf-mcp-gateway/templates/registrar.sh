#!/usr/bin/env sh
# 一次性註冊容器:等 gateway 起來後,把 server 設定檔註冊,然後結束。
# 供 docker-compose 的 registrar 服務使用(沿用 mcpjungle image,內含 /mcpjungle CLI)。
# 這讓「git pull -> docker compose up」即完成「部署 + 註冊」,適合 Portainer/Komodo/Dockhand 等 GitOps 工具。
#
# 具備:
#   - 等 gateway 就緒
#   - 每個 server 註冊含重試(處理上游 HTTP server 尚未開始監聽的競態)
#   - 冪等:已註冊則略過(適合每次 push 後 redeploy 重跑)
set -eu

REGISTRY="${REGISTRY_URL:-http://mcpjungle:8080}"
CONFIGS="${CONFIGS_DIR:-/configs}"
# 要註冊哪些(空白分隔);可用 env REGISTER_LIST 覆寫
LIST="${REGISTER_LIST:-sqlsugar fc filesystem fetch time}"

echo "registrar: 等待 gateway $REGISTRY ..."
i=0
until /mcpjungle --registry "$REGISTRY" list servers >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then echo "registrar: 等 gateway 逾時(120s)"; exit 1; fi
  sleep 2
done
echo "registrar: gateway 就緒"

is_registered() {
  /mcpjungle --registry "$REGISTRY" list servers 2>/dev/null | grep -qE "^[0-9]+\. $1$"
}

for name in $LIST; do
  cfg="$CONFIGS/$name.json"
  if [ ! -f "$cfg" ]; then echo "   (找不到 $cfg,略過)"; continue; fi
  if is_registered "$name"; then echo ">> $name 已註冊,略過"; continue; fi
  echo ">> 註冊 $name(含重試,等待上游就緒)"
  j=0
  until /mcpjungle --registry "$REGISTRY" register -c "$cfg"; do
    if is_registered "$name"; then break; fi
    j=$((j + 1))
    if [ "$j" -ge 20 ]; then echo "   ($name 重試 20 次仍失敗,放棄)"; break; fi
    echo "   ($name 上游尚未就緒,3s 後重試 #$j)"
    sleep 3
  done
done

echo "registrar: 完成,目前 servers:"
/mcpjungle --registry "$REGISTRY" list servers 2>/dev/null | grep -E '^[0-9]+\.' || true
