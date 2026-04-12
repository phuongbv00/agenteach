---
name: Tạo Lecture Notes
description: Soạn tóm tắt bài giảng có cấu trúc từ tài liệu nguồn trong workspace. Dùng khi giáo viên muốn tạo lecture notes, tóm tắt hoặc soạn ghi chú từ nội dung bài giảng.
---

# Skill: Tạo Lecture Notes

## Mục tiêu
Soạn tài liệu tóm tắt bài giảng có cấu trúc rõ ràng, giúp học sinh nắm bắt nội dung cốt lõi.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu
Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Tài liệu bài giảng cần tóm tắt nằm ở đâu trong workspace? (ví dụ: tên file, thư mục, hoặc mô tả nội dung)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu
- Dùng `fs_find_files` để tìm file theo tên giáo viên cung cấp
- Dùng `fs_read_file` để đọc nội dung file nguồn
- Nếu có nhiều file liên quan, hỏi giáo viên xác nhận file nào cần dùng

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)
- Đối tượng học sinh (lớp mấy, trình độ)
- Có cần thêm ví dụ minh họa không
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Soạn lecture notes với cấu trúc sau
```
# [Tên bài giảng]
**Môn học:** ... | **Lớp:** ... | **Ngày:** ...

## Mục tiêu bài học
- ...

## 1. [Phần 1]
### Khái niệm chính
...
### Ví dụ
...

## 2. [Phần 2]
...

## Tóm tắt
Các điểm cần nhớ:
- ...

## Câu hỏi ôn tập nhanh
1. ...
```

### Bước 5 — Xuất file
- **BẮT BUỘC** dùng `fs_create_pdf` (mặc định), `fs_create_docx`, hoặc `fs_create_markdown` để lưu file
- Đặt tên file: `lecture-notes-[tên-bài]-[ngày].pdf`
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
