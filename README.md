# Bảng Truy Nã · Block 2: host static site bằng Nginx

Nhóm **Băng Hải Tặc Dấu Chấm Phẩy**: Hiệp · Nhân · Phước · Trang

Site Block 1 (HTML/CSS/JS thuần, không có bước build) được serve bằng **Nginx** tại **http://127.0.0.1:8080**. Không dùng dev server của framework.

```text
.
├── site/                  ← DOCUMENT ROOT: chỉ chứa file public
│   ├── index.html
│   ├── css/style.css
│   ├── js/audio.js, js/main.js
│   └── assets/jolly-roger.svg, assets/portraits/*.svg
├── nginx/
│   ├── nginx.conf         ← config server (nằm ngoài root nên không bị serve)
│   └── mime.types         ← bảng đuôi file → Content-Type, chép từ Nginx 1.31.6
├── scripts/run.sh         ← chạy (foreground)
├── scripts/stop.sh        ← dừng / reload
├── scripts/test.sh        ← kiểm thử T2–T7 bằng curl
├── .github/workflows/pages.yml  ← deploy site/ lên GitHub Pages
└── logs/ tmp/             ← script tự tạo, không commit
```

> Bằng chứng (`evidence/`), tài liệu môn học (`docs/`) và nhật ký dùng agent (`AGENT-LOG.md`) chỉ lưu ở máy của nhóm, không đưa lên GitHub (xem `.gitignore`).

---

## 1. Cài đặt (làm một lần)

| Máy | Lệnh |
| :--- | :--- |
| macOS | `brew install nginx` (**không** chạy `brew services start nginx`, vì service này cũng chiếm cổng 8080) |
| Windows | Mở **WSL2 Ubuntu**, chạy `sudo apt install nginx`, rồi làm tiếp các bước bên dưới trong WSL |
| Không cài được Nginx | Cài **Docker Desktop**. `run.sh` sẽ tự dùng image `nginx:alpine` với **cùng file config** |

Kiểm tra: `nginx -v` (hoặc `docker info` nếu dùng Docker).

## 2. Run / Stop

Chạy từ gốc repo:

```bash
scripts/run.sh            # kiểm tra config (nginx -t) rồi chạy ở foreground → mở http://127.0.0.1:8080
                          # Ctrl+C để dừng
```

Ở một terminal khác:

```bash
scripts/stop.sh           # dừng êm (nginx -s quit)
scripts/stop.sh reload    # sửa nginx.conf xong thì nạp lại, không cần tắt server
scripts/test.sh           # chạy 18 kiểm thử bằng curl: 200 / MIME / 404 / 403 / 400
tail -f logs/access.log   # xem request đến server theo thời gian thực
```

`run.sh` thực chất chạy hai lệnh, mở file ra là đọc được:

```bash
nginx -t -p "$PWD" -c nginx/nginx.conf -e stderr                    # kiểm tra cú pháp
nginx    -p "$PWD" -c nginx/nginx.conf -e stderr -g 'daemon off;'   # -p: prefix = gốc repo · daemon off: chạy foreground
```

> Muốn ép chạy bằng Docker trên máy đã có Nginx: `MODE=docker scripts/run.sh`. Khi chạy Docker, `access.log` ghi IP `172.17.0.1` (cổng bridge của Docker) và giờ theo UTC; đây là hành vi bình thường.

---

## 3. URL nào ánh xạ tới file nào

Quy tắc trong [nginx/nginx.conf](nginx/nginx.conf):

```nginx
root   site;                      # đường dẫn file = site + URL path
index  index.html;                # URL kết thúc bằng "/" → tìm index.html trong thư mục đó
location / {
    try_files $uri $uri/ =404;    # thử file → thử thư mục → không có thì 404
}
include mime.types;               # đuôi file → Content-Type
```

| URL (`http://127.0.0.1:8080` + …) | File trên đĩa | Status · Content-Type đo được | Initiator |
| :--- | :--- | :--- | :--- |
| `/` | `site/index.html` (nhờ `index`) | `200` · `text/html; charset=utf-8` | Gõ URL / reload |
| `/css/style.css` | `site/css/style.css` | `200` · `text/css; charset=utf-8` | `index.html:12` `<link>` |
| `/js/audio.js`, `/js/main.js` | `site/js/…` | `200` · `application/javascript; charset=utf-8` | `index.html:15-16` `<script defer>` |
| `/assets/jolly-roger.svg` | `site/assets/jolly-roger.svg` | `200` · `image/svg+xml; charset=utf-8` | `index.html:8` favicon, `:23` `<img>` |
| `/assets/portraits/{hiep,nhan,phuoc,trang}.svg` | `site/assets/portraits/…` | `200` · `image/svg+xml; charset=utf-8` | `<img>` trong poster |
| `fonts.googleapis.com/…`, `fonts.gstatic.com/…` | **Không phải server của nhóm** | `200` · `text/css`, `font/woff2` | `<link>` / CSS của Google |
| `/khong-ton-tai`, `/assets/portraits/khong-co.svg` | Không có | `404` · trang HTML do Nginx tạo (153 byte) | Gõ URL / curl |
| `/nginx/nginx.conf`, `/README.md`, `/docs/REPORT.md` | Nằm **ngoài** `site/` | `404` (không lộ ra ngoài) | curl |
| `/css` → `/css/` | Thư mục không có `index.html` | `301` → `403` (vì `autoindex` đang tắt) | curl |
| `/../nginx/nginx.conf` | Path traversal | `400 Bad Request` | `curl --path-as-is` |

Các con số trong bảng là kết quả thật của `scripts/test.sh`.

---

## 4. Giải thích một cặp request/response: `GET /css/style.css`

1. Browser nhận `index.html` và parse đến dòng 12: `<link rel="stylesheet" href="css/style.css">`. Đây là đường dẫn **tương đối**, nên browser ghép với URL hiện tại (`http://127.0.0.1:8080/`) thành `http://127.0.0.1:8080/css/style.css`.
2. **Request:**
   ```http
   GET /css/style.css HTTP/1.1
   Host: 127.0.0.1:8080
   Accept: text/css,*/*;q=0.1
   Referer: http://127.0.0.1:8080/
   ```
3. **Nginx xử lý:** `Host` và cổng khớp `listen 127.0.0.1:8080`; URI khớp `location /`. `try_files $uri` thử file `site` + `/css/style.css` = `site/css/style.css` và thấy file tồn tại. Đuôi `.css` tra trong `mime.types` ra `text/css`, rồi `charset utf-8` được nối thêm.
4. **Response** (đo thật):
   ```http
   HTTP/1.1 200 OK
   Server: nginx/1.31.6
   Content-Type: text/css; charset=utf-8
   Content-Length: 26711
   Last-Modified: Fri, 02 Oct 2026 04:06:18 GMT
   ETag: "6abf2dba-6857"
   Accept-Ranges: bytes
   ```
   `ETag` = `hex(thời điểm sửa file)-hex(kích thước)`, với `0x6857 = 26711` byte, đúng bằng `Content-Length`. Lần tải sau, browser gửi `If-None-Match: "6abf2dba-6857"`. Nếu file chưa đổi, Nginx trả **`304 Not Modified`** không kèm body.
5. **Server ghi log** (`logs/access.log`, định dạng `block2` tự đặt, có thêm Content-Type). Mỗi request của browser sinh ra một dòng log có dạng:
   ```text
   127.0.0.1 [<thời gian>] "GET /css/style.css HTTP/1.1" 200 26711 type="text/css; charset=utf-8" ref="http://127.0.0.1:8080/"
   ```
   `ref=` (header Referer) cho thấy request này **sinh ra từ** trang `/`. Nó khớp với cột Initiator bên phía browser.
6. **Vì sao Content-Type quan trọng:** browser **bỏ qua** stylesheet có Content-Type sai, dù status là 200. Đã thử có chủ đích (T17): ép `/css/` trả `text/plain` thì vẫn ra `200`, nhưng trang mất toàn bộ style.

## 5. Vì sao site này là Static (không phải SSR hay CSR)

- Response của `GET /` (tab **Response** trong Network) **đã chứa đủ** 4 tên, vai trò và hồ sơ. HTML có sẵn trên đĩa **trước** khi có request.
- Nginx chỉ đọc file rồi trả bytes, không tạo HTML riêng cho từng request, nên **không phải SSR**.
- JS chỉ **bổ sung hành vi** (gió thổi, xé poster, lật hồ sơ, đếm tiền truy nã); tắt JS thì chế độ `no-js` vẫn đọc được. Browser không dựng giao diện từ một trang rỗng, nên **không phải CSR**.
- Vì vậy dùng `try_files … =404` chứ **không** dùng fallback `/index.html` kiểu SPA. Fallback đó sẽ biến mọi URL sai thành `200` và làm mất bằng chứng 404.

---

## 6. Deploy lên GitHub Pages

Workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) đưa **đúng thư mục `site/`** (cùng document root với Nginx) lên Pages mỗi khi push lên `main` có thay đổi trong `site/`.

1. Repo phải là **public** (gói GitHub Free chỉ hỗ trợ Pages cho repo public).
2. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions** (chỉ cần làm một lần).
3. Vào tab **Actions → Deploy site/ lên GitHub Pages → Run workflow** (hoặc push một thay đổi trong `site/`).
4. Khi job xanh, site có địa chỉ `https://<username>.github.io/<tên-repo>/`.

Site chạy được dưới đường dẫn con `/<tên-repo>/` là nhờ HTML chỉ dùng **đường dẫn tương đối** (`css/style.css`, không phải `/css/style.css`). Trên Pages, URL sai vẫn trả **404**, nhưng trang 404 là của GitHub, không phải của Nginx.

## 7. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `✗ Cổng 8080 đang bị chiếm` / `bind() … Address already in use` | `brew services` nginx, hoặc lần chạy trước chưa tắt | `scripts/stop.sh`; `brew services stop nginx`; `lsof -nP -iTCP:8080 -sTCP:LISTEN` |
| Browser tải file về thay vì hiển thị trang; CSS không được áp dụng | Thiếu `include mime.types`, nên mọi file đều trả `application/octet-stream` | Kiểm tra dòng `include` và file `nginx/mime.types` |
| Thấy trang "Welcome to nginx!" | Đang chạy Nginx với config **của hệ thống**, không phải config của repo | Dùng `scripts/run.sh`; `nginx -t` in ra đường dẫn file đang dùng |
| Sửa conf nhưng không thấy thay đổi | Chưa reload | `scripts/stop.sh reload` |
| 403 cho mọi file | Chạy bằng `sudo` nên worker chạy với user `nobody`, không đọc được `~/Desktop` | Không dùng sudo |
| URL sai mà vẫn trả 200 | Có fallback `try_files … /index.html` | Giữ nguyên `=404` |
| `unknown option "-e"` (Ubuntu 22.04, Nginx 1.18) | Cờ `-e` chỉ có từ bản 1.19.5 | `run.sh` tự bỏ cờ này; cảnh báo "could not open error log" lúc khởi động có thể bỏ qua |
| Trang trên GitHub Pages mất CSS/JS | Có đường dẫn tuyệt đối `/…` trỏ về gốc domain thay vì gốc repo | Giữ đường dẫn tương đối trong `site/` |
| Workflow Pages báo lỗi ở bước deploy | Chưa bật **Source: GitHub Actions** trong Settings → Pages | Bật xong thì vào Actions bấm **Re-run jobs** |
