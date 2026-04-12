---
builtin: true
name: Tạo Hướng Dẫn Giải Bài Tập
description: Soạn hướng dẫn giải chi tiết từng bước cho bộ bài tập có sẵn. Dùng khi giáo viên muốn soạn hướng dẫn giải, lời giải chi tiết hoặc đáp án cho bộ bài tập.
---

# Skill: Tạo Hướng Dẫn Giải Bài Tập

## Mục tiêu

Soạn tài liệu hướng dẫn giải chi tiết từng bước, giải thích tư duy giải quyết vấn đề để học sinh học cách tư duy chứ không chỉ chép đáp án.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu

Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "File bài tập cần soạn hướng dẫn giải nằm ở đâu trong workspace? (ví dụ: tên file bài tập, hoặc mô tả bài tập cần giải)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu

- Dùng `fs_find_files` để tìm file bài tập
- Dùng `fs_read_file` để đọc toàn bộ đề bài
- Nếu có tài liệu lý thuyết liên quan, hỏi giáo viên có muốn đọc thêm không

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)

- Mức độ chi tiết: tóm tắt / đầy đủ từng bước / giải thích tư duy
- Đối tượng đọc: học sinh tự học hay giáo viên tham khảo
- Có cần lưu ý lỗi sai phổ biến không
- Định dạng xuất: PDF, DOCX hay Markdown (mặc định: Markdown)

### Bước 4 — Soạn hướng dẫn giải với cấu trúc sau

```
# Hướng Dẫn Giải: [Tên bài tập/chủ đề]
**Môn học:** ... | **Lớp:** ... | **Ngày:** ...

---

## Bài 1
**Đề bài:** [Chép lại đề]

**Phân tích:**
- Dữ kiện cho: ...
- Yêu cầu tìm: ...
- Hướng tiếp cận: ...

**Lời giải:**

*Bước 1:* ...
*Bước 2:* ...
*Bước 3:* ...

**Kết quả:** ...

> **Lưu ý:** [Sai lầm phổ biến cần tránh, hoặc cách nhớ nhanh]

---

## Bài 2
...
```

Yêu cầu chất lượng:

- Mỗi bước phải có lý do / công thức / quy tắc áp dụng
- Giải thích tại sao chọn hướng tiếp cận đó
- Ghi rõ đơn vị, dấu, format kết quả cuối
- Với bài toán thực tế: liên hệ ý nghĩa của đáp án

### Bước 5 — Xuất file

- **BẮT BUỘC** dùng `fs_create_markdown` (mặc định), `fs_create_pdf`, hoặc `fs_create_docx` để lưu file
- Đặt tên file: `huong-dan-giai-[tên-bài]-[ngày].[ext]`
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
