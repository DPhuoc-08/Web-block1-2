#!/usr/bin/env bash
# Dừng server do scripts/run.sh khởi động (dùng từ một terminal khác).
#   scripts/stop.sh          → dừng êm (quit: xử lý xong request đang dở rồi mới tắt)
#   scripts/stop.sh reload   → nạp lại nginx.conf mà không tắt server
set -eo pipefail
cd "$(dirname "$0")/.."

SIGNAL="${1:-quit}"
CONTAINER=block2-nginx

if command -v docker >/dev/null 2>&1 && docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  if [ "$SIGNAL" = reload ]; then
    # Container đọc bản conf sinh ra trong tmp/, nên tạo lại bản đó trước khi reload
    sed -e 's/listen 127\.0\.0\.1:8080;/listen 8080;/' \
        -e 's#pid        logs/nginx.pid;#pid        /tmp/nginx.pid;#' nginx/nginx.conf > tmp/nginx.docker.conf
    docker exec "$CONTAINER" nginx -p /srv -c nginx/nginx.conf -e stderr -t
    docker exec "$CONTAINER" nginx -p /srv -c nginx/nginx.conf -e stderr -s reload
  else
    docker stop "$CONTAINER" >/dev/null
  fi
elif [ -f logs/nginx.pid ]; then
  E_FLAG=(); nginx -h 2>&1 | grep -q -- '-e filename' && E_FLAG=(-e stderr)
  [ "$SIGNAL" = reload ] && nginx -t -p "$PWD" -c nginx/nginx.conf "${E_FLAG[@]}"
  nginx -p "$PWD" -c nginx/nginx.conf "${E_FLAG[@]}" -s "$SIGNAL"
else
  echo "Không có server nào đang chạy (không thấy logs/nginx.pid hay container $CONTAINER)."
  exit 0
fi
echo "✓ Đã gửi tín hiệu: $SIGNAL"
