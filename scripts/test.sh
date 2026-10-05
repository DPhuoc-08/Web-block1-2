#!/usr/bin/env bash
# Kiểm thử T2–T7 bằng curl (server phải đang chạy qua scripts/run.sh).
#   scripts/test.sh                                  → in kết quả ra màn hình
#   scripts/test.sh | tee evidence/curl-tests.txt    → lưu làm bằng chứng
set -o pipefail
cd "$(dirname "$0")/.."

BASE=http://127.0.0.1:8080
PASS=0; FAIL=0

# check <ID> <mô tả> <status mong đợi> <content-type mong đợi hoặc -> <curl args...>
check() {
  local id=$1 desc=$2 want_status=$3 want_type=$4; shift 4
  local out status type
  out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$@")
  status=${out%% *}; type=${out#* }
  if [ "$status" = "$want_status" ] && { [ "$want_type" = - ] || [ "$type" = "$want_type" ]; }; then
    printf '  ✅ %-4s %-46s %s  %s\n' "$id" "$desc" "$status" "$type"; PASS=$((PASS+1))
  else
    printf '  ❌ %-4s %-46s %s  %s   (mong đợi %s %s)\n' "$id" "$desc" "$status" "$type" "$want_status" "$want_type"; FAIL=$((FAIL+1))
  fi
}

echo "== Kiểm thử $BASE · $(date '+%Y-%m-%d %H:%M:%S')"
echo
echo "-- T2: document (header đầy đủ)"
curl -sI "$BASE/" | sed 's/^/     /'
if curl -s "$BASE/" | grep -q 'Welcome to nginx'; then
  echo "  ❌ T2   body là trang mặc định 'Welcome to nginx!' → root sai"; FAIL=$((FAIL+1))
else
  check T2 "GET /  (body là Bảng Truy Nã)" 200 "text/html; charset=utf-8" "$BASE/"
fi

echo
echo "-- T3: asset của nhóm, đúng MIME"
check T3 "GET /css/style.css"              200 "text/css; charset=utf-8"               "$BASE/css/style.css"
check T3 "GET /js/audio.js"                200 "application/javascript; charset=utf-8" "$BASE/js/audio.js"
check T3 "GET /js/main.js"                 200 "application/javascript; charset=utf-8" "$BASE/js/main.js"
check T3 "GET /assets/jolly-roger.svg"     200 "image/svg+xml; charset=utf-8"          "$BASE/assets/jolly-roger.svg"
for p in hiep nhan phuoc trang; do
  check T3 "GET /assets/portraits/$p.svg"  200 "image/svg+xml; charset=utf-8"          "$BASE/assets/portraits/$p.svg"
done

echo
echo "-- T4: tài nguyên không tồn tại → 404 do Nginx tạo"
check T4 "GET /assets/portraits/khong-co.svg" 404 "text/html; charset=utf-8" "$BASE/assets/portraits/khong-co.svg"
check T4 "GET /khong-ton-tai"                 404 "text/html; charset=utf-8" "$BASE/khong-ton-tai"
curl -si "$BASE/khong-ton-tai" | sed 's/^/     /'
echo

echo
echo "-- T5: file ngoài document root không bị serve"
check T5 "GET /nginx/nginx.conf"           404 - "$BASE/nginx/nginx.conf"
check T5 "GET /README.md"                  404 - "$BASE/README.md"
check T5 "GET /logs/access.log"            404 - "$BASE/logs/access.log"
check T5 "GET /docs/REPORT.md"             404 - "$BASE/docs/REPORT.md"

echo
echo "-- T6: path traversal bị chặn"
check T6 "GET /../nginx/nginx.conf (--path-as-is)" 400 - --path-as-is "$BASE/../nginx/nginx.conf"

echo
echo "-- T7: thư mục"
check T7 "GET /css  → chuyển hướng sang /css/" 301 - "$BASE/css"
echo "     Location: $(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/css")"
check T7 "GET /css/ → không liệt kê thư mục"   403 - "$BASE/css/"

echo
echo "== Kết quả: $PASS đạt, $FAIL lỗi"
[ "$FAIL" -eq 0 ]
