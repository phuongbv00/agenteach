---
name: Tạo Bài Giảng
description: Soạn nội dung bài giảng đầy đủ cho một buổi học, bao gồm mục tiêu, nội dung trình bày, hoạt động và đánh giá. Dùng khi giáo viên muốn soạn giáo án, tạo bài giảng hoặc lên kế hoạch nội dung cho buổi học.
---

# Skill: Tạo Bài Giảng Cho Buổi Học

## Mục tiêu
Soạn bài giảng hoàn chỉnh cho một buổi học: từ mục tiêu, nội dung trình bày, hoạt động tương tác đến phần đánh giá cuối buổi.

## Quy trình thực hiện

### Bước 1 — Hỏi vị trí tài liệu tham khảo
Trước khi làm bất cứ điều gì, hỏi giáo viên:

> "Có tài liệu tham khảo nào cho bài giảng này không (đề cương, sách giáo khoa, slide cũ...)? Nếu có, file nằm ở đâu trong workspace?"

Nếu giáo viên không có tài liệu sẵn, chuyển ngay sang Bước 3.

### Bước 2 — Tìm và đọc tài liệu tham khảo
- Dùng `fs_find_files` để tìm file theo tên giáo viên cung cấp
- Dùng `fs_read_file` để đọc nội dung làm cơ sở soạn bài giảng

### Bước 3 — Thu thập thông tin cần thiết (nếu chưa rõ)
Hỏi giáo viên các thông tin còn thiếu:
- Tên bài / chủ đề bài giảng
- Môn học và lớp
- Thời lượng buổi học (ví dụ: 45 phút, 90 phút)
- Số học sinh và đặc điểm lớp (nếu có)
- Phương pháp giảng dạy ưu tiên: thuyết trình, thảo luận nhóm, thực hành, dự án...
- Có cần tích hợp bài tập / hoạt động trong giờ không
- Định dạng xuất: PDF, DOCX hay Markdown

### Bước 4 — Soạn bài giảng với cấu trúc sau

```
# Bài Giảng: [Tên bài]
**Môn học:** ... | **Lớp:** ... | **Thời lượng:** ... phút | **Ngày:** ...

---

## I. Mục tiêu bài học
Sau buổi học, học sinh có thể:
- **Kiến thức:** ...
- **Kỹ năng:** ...
- **Thái độ:** ...

## II. Chuẩn bị
| Giáo viên | Học sinh |
|-----------|----------|
| ...       | ...      |

## III. Tiến trình bài giảng

### 1. Khởi động (~X phút)
**Mục đích:** Kích hoạt kiến thức nền, tạo hứng thú
**Hoạt động:** ...
**Dự kiến phản hồi của học sinh:** ...

### 2. Hình thành kiến thức mới (~X phút)

#### 2.1 [Nội dung 1]
**Nội dung trình bày:**
...

**Câu hỏi gợi mở:**
- ...

**Ví dụ / minh họa:**
...

#### 2.2 [Nội dung 2]
...

### 3. Luyện tập / Củng cố (~X phút)
**Hoạt động:** ...
**Yêu cầu:** ...

### 4. Vận dụng / Mở rộng (~X phút)
**Bài tập / tình huống thực tế:** ...

### 5. Tổng kết & Giao bài (~X phút)
**Tóm tắt nội dung chính:**
- ...

**Bài tập về nhà:** ...

---

## IV. Ghi chú của giáo viên
*(Điều chỉnh theo thực tế lớp học)*
```

Yêu cầu chất lượng:
- Thời gian mỗi phần cộng lại đúng tổng thời lượng buổi học
- Hoạt động học sinh chiếm ít nhất 40% thời gian
- Mỗi nội dung mới cần có ví dụ cụ thể, gần gũi với học sinh
- Câu hỏi gợi mở phải mở, không có câu trả lời "có/không"

### Bước 5 — Xuất file
- **BẮT BUỘC** dùng `fs_create_pdf` (mặc định), `fs_create_docx`, hoặc `fs_create_markdown` để lưu file
- Đặt tên file: `bai-giang-[tên-bài]-[ngày].pdf`
- KHÔNG chỉ paste nội dung vào chat
- Sau khi xuất, thông báo đường dẫn file cho giáo viên
