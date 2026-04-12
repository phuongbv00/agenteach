---
name: Tạo Quiz
description: Tạo bộ câu hỏi trắc nghiệm nhiều lựa chọn từ nội dung bài giảng. Dùng khi giáo viên muốn tạo quiz hoặc bộ câu hỏi trắc nghiệm từ nội dung bài học.
---

# Skill: Tạo Quiz

## Mục tiêu

Soạn bộ câu hỏi trắc nghiệm chất lượng cao, các đáp án nhiễu có tính đánh lừa hợp lý, phù hợp để kiểm tra nhanh hoặc luyện tập.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu

Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Tài liệu bài giảng cần tạo quiz nằm ở đâu trong workspace? (ví dụ: tên file, thư mục, hoặc chủ đề cụ thể)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu

- Dùng `fs_find_files` để tìm file theo tên giáo viên cung cấp
- Dùng `fs_read_file` để đọc nội dung tài liệu nguồn
- Liệt kê các khái niệm, định nghĩa, công thức, sự kiện quan trọng cần kiểm tra

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)

- Số lượng câu hỏi (mặc định: 10–20 câu)
- Số lựa chọn mỗi câu: A/B/C/D (4 lựa chọn) hay A/B/C (3 lựa chọn)
- Tỉ lệ câu dễ/trung bình/khó (ví dụ: 50/30/20)
- Có cần giải thích đáp án không
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Soạn quiz với cấu trúc sau

```
# Quiz: [Tên chủ đề]
**Môn học:** ... | **Lớp:** ... | **Số câu:** ... | **Thời gian:** ...

---

**Câu 1.** [Nội dung câu hỏi]
- A. ...
- B. ...
- C. ...
- D. ...

**Câu 2.** ...

---
*(Đáp án)*
## Đáp án
| Câu | Đáp án | Giải thích |
|-----|--------|------------|
| 1   | B      | ... |
| 2   | A      | ... |
```

Yêu cầu chất lượng câu hỏi:

- Mỗi câu hỏi chỉ có **một** đáp án đúng duy nhất
- Đáp án nhiễu phải hợp lý, không quá rõ ràng sai
- Tránh câu hỏi "tất cả đều đúng" hoặc "không câu nào đúng"
- Ngôn ngữ rõ ràng, không mơ hồ

### Bước 5 — Xuất file

- **BẮT BUỘC** dùng `fs_create_markdown` (mặc định), `fs_create_pdf`, hoặc `fs_create_docx` để lưu file
- Đặt tên file: `quiz-[tên-chủ-đề]-[ngày].[ext]`
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
