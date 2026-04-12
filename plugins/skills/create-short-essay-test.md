---
builtin: true
name: Tạo Bài Kiểm Tra Tự Luận
description: Soạn đề kiểm tra tự luận ngắn với thang điểm và hướng dẫn chấm. Dùng khi giáo viên muốn soạn đề kiểm tra tự luận ngắn hoặc đề thi cho học sinh.
---

# Skill: Tạo Bài Kiểm Tra Tự Luận Ngắn

## Mục tiêu

Soạn đề kiểm tra tự luận ngắn (15–45 phút) kèm hướng dẫn chấm điểm chi tiết, đánh giá được nhiều cấp độ tư duy.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu

Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Nội dung bài học cần ra đề kiểm tra nằm ở đâu trong workspace? (ví dụ: tên file, thư mục, hoặc phạm vi chương/bài)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu

- Dùng `fs_find_files` để tìm file theo tên giáo viên cung cấp
- Dùng `fs_read_file` để đọc nội dung tài liệu nguồn
- Xác định kiến thức trọng tâm, kỹ năng cần đánh giá

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)

- Thời gian làm bài (15, 30 hay 45 phút)
- Tổng điểm (mặc định: 10 điểm)
- Số câu hỏi và cơ cấu điểm
- Trình độ học sinh: đại trà / khá giỏi / ôn thi
- Có cần đáp án + rubric chấm không (mặc định: có)
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Soạn đề kiểm tra với cấu trúc sau

**Đề bài:**

```
TRƯỜNG: ...                           ĐỀ KIỂM TRA [X] PHÚT
MÔN: ... | LỚP: ...                  Ngày: ...
                                       Tổng điểm: 10

Họ tên: _________________________ Lớp: _______

---

**Câu 1** ([X] điểm): [Câu hỏi nhận biết/thông hiểu]
...

**Câu 2** ([X] điểm): [Câu hỏi vận dụng]
...

**Câu 3** ([X] điểm): [Câu hỏi vận dụng cao / phân tích]
...
```

**Hướng dẫn chấm:**

```
## HƯỚNG DẪN CHẤM

**Câu 1** ([X] điểm):
- Ý 1: ... → [x] điểm
- Ý 2: ... → [x] điểm

**Câu 2** ([X] điểm):
- ...
```

Yêu cầu thiết kế đề:

- Cơ cấu: ~30% nhận biết, ~40% thông hiểu, ~30% vận dụng
- Câu hỏi vận dụng phải có tình huống thực tế / ngữ cảnh cụ thể
- Điểm số phân bổ rõ ràng cho từng ý nhỏ
- Hướng dẫn chấm phải đủ chi tiết để giáo viên khác chấm được

### Bước 5 — Xuất file

- **BẮT BUỘC** tạo **hai file riêng**:
  1. `de-kiem-tra-[tên-bài]-[ngày].[ext]` — chỉ đề bài (cho học sinh)
  2. `dap-an-[tên-bài]-[ngày].[ext]` — đề + hướng dẫn chấm (cho giáo viên)
- Dùng `fs_create_markdown` (mặc định), `fs_create_pdf` hoặc `fs_create_docx` theo yêu cầu
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn cả hai file cho giáo viên
