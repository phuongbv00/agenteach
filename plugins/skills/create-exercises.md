---
builtin: true
name: Tạo Bài Tập
description: Tạo bộ bài tập thực hành theo nội dung bài giảng với nhiều cấp độ. Dùng khi giáo viên muốn tạo hoặc soạn bài tập thực hành theo nội dung bài học.
---

# Skill: Tạo Bài Tập

## Mục tiêu

Soạn bộ bài tập thực hành đa dạng, bao phủ các cấp độ tư duy từ nhận biết đến vận dụng cao.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu

Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Tài liệu bài giảng hoặc đề cương cần ra bài tập nằm ở đâu trong workspace? (ví dụ: tên file, thư mục, hoặc mô tả chủ đề)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu

- Dùng `fs_find_files` để tìm file theo tên giáo viên cung cấp
- Dùng `fs_read_file` để đọc nội dung tài liệu nguồn
- Xác định các chủ đề, kiến thức, kỹ năng cần kiểm tra

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)

- Số lượng bài tập cần tạo
- Cấp độ: cơ bản / nâng cao / hỗn hợp
- Dạng bài: tính toán, lý thuyết, bài toán thực tế, lập trình, viết...
- Có cần đáp án kèm theo không
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Soạn bài tập với cấu trúc sau

```
# Bài Tập: [Tên chủ đề]
**Môn học:** ... | **Lớp:** ... | **Ngày:**...

---

## Phần A: Bài tập cơ bản
**Bài 1.** ...
**Bài 2.** ...

## Phần B: Bài tập nâng cao
**Bài 3.** ...

## Phần C: Bài tập thực tế / ứng dụng
**Bài 4.** ...

---
*(Đáp án — nếu có)*
## Đáp án
**Bài 1.** ...
```

Mỗi bài tập cần:

- Đề bài rõ ràng, không mơ hồ
- Dữ liệu đầy đủ để giải
- Ghi rõ đơn vị, yêu cầu đầu ra

### Bước 5 — Xuất file

- **BẮT BUỘC** dùng `fs_create_markdown` (mặc định), `fs_create_pdf`, hoặc `fs_create_docx` để lưu file
- Đặt tên file: `bai-tap-[tên-chủ-đề]-[ngày].[ext]`
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
