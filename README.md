# Agenteach

Trợ lý AI cá nhân dành cho giáo viên — giúp soạn giáo án, tạo tài liệu giảng dạy, và quản lý nội dung lớp học.

## Tải về

Tải bản mới nhất tại [Releases](https://github.com/phuongbv00/agenteach/releases).

## Cài đặt

### macOS

> **Lưu ý:** App chưa được ký bởi Apple nên macOS có thể hiện thông báo _"Agenteach.app is damaged and can't be opened"_. Đây không phải lỗi của app — làm theo các bước dưới để mở được.

1. Tải file `.dmg`, mở và kéo **Agenteach** vào thư mục **Applications**
2. Nếu thấy thông báo lỗi khi mở app, mở **Terminal** và chạy lệnh:

```bash
xattr -cr /Applications/Agenteach.app
```

3. Mở lại app bình thường

> Lệnh trên chỉ cần chạy **một lần duy nhất** sau khi cài đặt.

---

### Windows

> **Lưu ý:** Windows SmartScreen có thể hiện thông báo _"Windows protected your PC"_ hoặc _"Unknown publisher"_ khi cài đặt. Đây là do app chưa có chữ ký số — làm theo các bước dưới để bỏ qua.

1. Tải file `.exe` về máy
2. Khi Windows SmartScreen hiện cảnh báo, nhấn **More info** (Thông tin thêm)
3. Nhấn **Run anyway** (Vẫn chạy)
4. Làm theo hướng dẫn cài đặt như bình thường

---

## Yêu cầu hệ thống

|         | Tối thiểu           |
| ------- | ------------------- |
| macOS   | 12 Monterey trở lên |
| Windows | Windows 10 trở lên  |

## Cấu hình

Có 2 cách sử dụng AI trong app:

---

### Tuỳ chọn 1: Chạy AI tại máy (không cần mạng)

Sử dụng [Ollama](https://ollama.com) để chạy AI hoàn toàn offline trên máy tính cá nhân.

1. Tải và cài đặt [Ollama](https://ollama.com)
2. Mở Terminal (macOS) hoặc Command Prompt (Windows), chạy:

```bash
ollama pull qwen3.5:9b
```

3. Trong app, chọn **Ollama — trên máy này** và model `qwen3.5:9b`

> Máy tính cần có ít nhất **16GB RAM** để chạy model này mượt mà.

---

### Tuỳ chọn 2: Chạy AI trong mạng LAN

Sử dụng server AI do nhà trường/đơn vị triển khai trong nội bộ — không cần internet, tốc độ nhanh hơn.

Liên hệ bộ phận IT để được cung cấp:

- **Base URL** — địa chỉ server AI nội bộ
- **Model** — tên model đang chạy trên server
- **API Key** — nếu server yêu cầu xác thực
