# Ghi nhận cách nhóm dùng agent (Tuần 1: Block 1 + Block 2)

Nhóm **6**: 
1. 24127039 –  Phan Quang Hiệp 
2. 24127093 – Trần Nguyễn Đình Nhân
3. 24127508 – Lê Nho Duy Phước
4. 24127565 – Nguyễn Hoàng Mỹ Trang

**Agent:** Claude Code (extension VS Code), model Claude Opus 5.5
**Nguồn:** log của 5 phiên làm việc với agent, từ 01/10 đến 08/10/2026.

---

## 1. Agent được dùng vào việc gì

| Ngày | Việc | Nhóm yêu cầu | Agent làm |
| :--- | :--- | :--- | :--- |
| 01/10 | **Block 1**: bản thử đầu | Portfolio 3 thành viên, *"đưa ra câu hỏi và đợi xác nhận"* | Đề xuất 3 concept, dựng bản *Holo Cards* (3 file), tự chụp màn hình để kiểm tra responsive. Nhóm **bỏ bản này** để chuyển sang ý tưởng mới với 4 thành viên |
| 02/10 | **Block 1**: site chính | Ý tưởng *Bảng truy nã Hải tặc* do nhóm tự viết; *"mọi hành động đều cần sự xác nhận"* | Phân tích công nghệ và loại 7 phương án khác, hỏi 6 câu để chốt, viết `index.html`, CSS, JS, SVG và báo cáo Block 1 |
| 03/10 | **Block 2**: lập plan | Phân tích đề Block 2, đề xuất phương án, giải thích Why/How, kèm cách kiểm thử | Viết bản kế hoạch Block 2, chạy thử config bằng Nginx trong Docker, sửa sơ đồ Mermaid |
| 04/10 | **Block 2**: dựng server | Cấu hình theo plan, *"cần mình confirm rồi mới thao tác"* | Khảo sát (chỉ đọc), hỏi 3 câu, rồi cài Nginx, tách `site/`, viết config và script, chạy 18 test, viết README |
| 05/10 | Đưa lên GitHub | Chỉ đưa mã nguồn lên; lịch sử làm bài và bằng chứng giữ ở máy local | Hỏi 3 câu (lịch sử git, phạm vi, repo public), push nhánh `main`, thêm workflow GitHub Pages |
| 05–06/10 | Báo cáo Block 1 | Viết báo cáo Block 1 theo 4 câu hỏi của đề, xuất docx | Viết báo cáo, sau đó sửa **11 lượt** theo từng chỉ đạo của nhóm |

---

## 2. Cách nhóm làm việc với agent

1. **Nhóm đưa ý tưởng, agent hiện thực.** Ý tưởng Bảng truy nã (bố cục, tương tác, chất liệu) do nhóm viết. Agent đề xuất cách làm, và nhóm quyết từng điểm: phân vai, nguồn ảnh, nội dung mẫu, ý tưởng phụ nào giữ lại.
2. **Luôn bắt agent hỏi trước khi làm.** Prompt nào cũng có câu kiểu *"đợi xác nhận"*. Agent đã hỏi tổng cộng **17 câu** qua 4 phiên, và chỉ thao tác sau khi nhóm trả lời.
3. **Nhóm giữ quyền quyết định cuối cùng, kể cả khi trái đề xuất của agent:**
   - Agent đề xuất **Caddy**, nhóm chọn **Nginx**. Agent viết lại toàn bộ plan theo Nginx.
   - Nhóm **từ chối 3 thao tác** của agent: chụp màn hình bằng Chrome headless (02/10); đổi cách chạy giữa chừng khi Docker vừa tắt (03/10, nhóm tự bật lại Docker); truy cập repo khi chỉ cần hướng dẫn (06/10).
   - Với báo cáo, nhóm chỉ đạo nội dung từng mục (*"chỉ cần…"*, *"ngắn gọn, súc tích"*). Agent viết theo chỉ đạo đó.
4. **Bắt agent chạy thật để kiểm chứng.** Plan ban đầu chưa được chạy thử (agent tự nêu). Nhóm yêu cầu *"tiếp tục kiểm thử"*, agent chạy bằng Nginx thật, và phát hiện 2 chỗ plan ghi sai. Server sau đó qua 18/18 test, kết quả được lưu lại làm bằng chứng.

---

## 3. Phần nhóm tự làm

- **Ý tưởng và lựa chọn chính:** concept Bảng truy nã; chọn Nginx; cách chạy local; phạm vi đưa lên GitHub.
- **Nội dung thật:** họ tên, MSSV, phân vai. Biệt danh, case study và số tiền truy nã là **nội dung mẫu do agent viết**, nhóm đã đồng ý dùng; báo cáo Block 1 có ghi rõ điều này.
- **Kiểm thử trên browser và bằng chứng Network:** ảnh UI, Network, 404, đối chiếu log.


