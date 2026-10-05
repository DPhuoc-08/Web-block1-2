#!/usr/bin/env bash
# Chạy Nginx ở foreground. Ctrl+C (hoặc scripts/stop.sh ở terminal khác) để dừng.
#   - Máy có lệnh `nginx` (brew / apt)  → chạy native.
#   - Không có `nginx` nhưng có Docker  → chạy image nginx:alpine với CÙNG config.
#   Ép chế độ: MODE=native scripts/run.sh  hoặc  MODE=docker scripts/run.sh
set -eo pipefail
cd "$(dirname "$0")/.."                        # luôn chạy từ gốc repo, dù gọi script từ đâu

CONF=nginx/nginx.conf
PORT=8080
CONTAINER=block2-nginx
MODE="${MODE:-$(command -v nginx >/dev/null 2>&1 && echo native || echo docker)}"

mkdir -p logs tmp

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Cổng $PORT đang bị chiếm:" >&2
  lsof -nP -iTCP:$PORT -sTCP:LISTEN >&2
  echo "  → chạy scripts/stop.sh, hoặc brew services stop nginx" >&2
  exit 1
fi

if [ "$MODE" = native ]; then
  # Cờ -e có từ Nginx 1.19.5; bản cũ hơn (Ubuntu 22.04: 1.18) thì bỏ qua
  E_FLAG=(); nginx -h 2>&1 | grep -q -- '-e filename' && E_FLAG=(-e stderr)
  nginx -t -p "$PWD" -c "$CONF" "${E_FLAG[@]}"                       # kiểm tra cú pháp trước
  echo "→ http://127.0.0.1:$PORT   (native · Ctrl+C để dừng · log: logs/access.log)"
  exec nginx -p "$PWD" -c "$CONF" "${E_FLAG[@]}" -g 'daemon off;'    # foreground
fi

# Docker: trong container phải nghe mọi interface (cổng được publish chỉ ra 127.0.0.1
# của máy host), và pid để trong /tmp của container để không ghi đè logs/nginx.pid.
sed -e 's/listen 127\.0\.0\.1:8080;/listen 8080;/' \
    -e 's#pid        logs/nginx.pid;#pid        /tmp/nginx.pid;#' "$CONF" > tmp/nginx.docker.conf

TTY=(); [ -t 0 ] && TTY=(-it)
DOCKER_RUN=(docker run --rm "${TTY[@]}" --name "$CONTAINER" --user "$(id -u):$(id -g)"
  -p 127.0.0.1:$PORT:8080
  -v "$PWD/site:/srv/site:ro" -v "$PWD/nginx:/srv/nginx:ro"
  -v "$PWD/tmp/nginx.docker.conf:/srv/nginx/nginx.conf:ro"
  -v "$PWD/logs:/srv/logs" -v "$PWD/tmp:/srv/tmp"
  --entrypoint nginx "${NGINX_IMAGE:-nginx:alpine}" -p /srv -c nginx/nginx.conf -e stderr)

"${DOCKER_RUN[@]}" -t
echo "→ http://127.0.0.1:$PORT   (docker · Ctrl+C để dừng · log: logs/access.log)"
exec "${DOCKER_RUN[@]}" -g 'daemon off;'
