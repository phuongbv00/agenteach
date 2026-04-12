---
name: Đánh Giá Bài Tập Học Sinh
description: Chấm điểm và đưa ra nhận xét chi tiết cho bài tập nộp của học sinh. Dùng khi giáo viên muốn chấm bài, đánh giá hoặc nhận xét bài tập học sinh đã nộp.
---

# Skill: Đánh Giá Bài Tập Học Sinh

## Mục tiêu
Chấm bài và đưa ra nhận xét xây dựng, cụ thể cho từng học sinh — chỉ ra điểm đúng, điểm sai, và hướng cải thiện.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu
Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Bài tập của học sinh và đáp án / rubric chấm nằm ở đâu trong workspace? (ví dụ: tên file bài nộp, thư mục chứa bài, file đáp án)"

Chờ giáo viên trả lời. KHÔNG tự đoán hay đọc file ngẫu nhiên.

### Bước 2 — Tìm và đọc tài liệu
- Dùng `fs_find_files` để tìm file bài tập của học sinh
- Dùng `fs_read_file` để đọc bài làm của học sinh
- Nếu có file đáp án/rubric, đọc để làm cơ sở chấm điểm
- Nếu không có rubric, hỏi giáo viên về tiêu chí chấm

### Bước 3 — Hỏi thêm thông tin cần thiết (nếu chưa rõ)
- Thang điểm: 10 điểm, 100 điểm, hay theo tiêu chí riêng
- Mức độ chi tiết nhận xét: tóm tắt / chi tiết từng câu / đầy đủ + gợi ý cải thiện
- Giọng điệu nhận xét: khuyến khích / trung lập / nghiêm túc
- Tên học sinh hoặc mã bài nếu cần ghi vào báo cáo
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Đánh giá với cấu trúc sau

**Nhận xét cho từng bài:**
```
# Đánh Giá Bài Tập
**Học sinh:** ... | **Lớp:** ... | **Ngày chấm:** ...
**Bài tập:** ... | **Tổng điểm:** .../10

---

## Điểm số chi tiết
| Câu | Điểm tối đa | Điểm đạt | Nhận xét |
|-----|-------------|----------|----------|
| 1   | 3           | 2.5      | Giải đúng hướng, tuy nhiên thiếu đơn vị ở kết quả cuối |
| 2   | 4           | 2        | ... |
| 3   | 3           | 3        | Xuất sắc, trình bày rõ ràng |

**Tổng: .../10**

---

## Nhận xét tổng quát
**Điểm mạnh:**
- ...

**Cần cải thiện:**
- ...

**Gợi ý học tập:**
- ...
```

Yêu cầu nhận xét chất lượng:
- Chỉ ra chính xác chỗ sai (câu nào, ý nào, dòng nào)
- Giải thích ngắn gọn tại sao sai
- Đưa ra gợi ý cụ thể để cải thiện (không chỉ nói "cần học lại")
- Ghi nhận điểm đúng và cách làm tốt
- Giọng điệu tích cực, khuyến khích

### Bước 5 — Xuất file
- **BẮT BUỘC** dùng `fs_create_pdf` (mặc định), `fs_create_docx`, hoặc `fs_create_markdown` để lưu file
- Đặt tên file: `nhan-xet-[tên-học-sinh hoặc lớp]-[ngày].pdf`
- Nếu chấm nhiều bài: tạo một file tổng hợp nhận xét toàn lớp
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
