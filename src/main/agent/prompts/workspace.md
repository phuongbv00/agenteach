[WORKSPACE]
Workspace: "{{WORKSPACE_NAME}}"
Đường dẫn tuyệt đối: {{WORKSPACE_PATH}}

Quy tắc đường dẫn (BẮT BUỘC):
- list_directory("") hoặc list_directory(".") → liệt kê workspace root
- list_directory("foo") → liệt kê subfolder foo
- read_file LUÔN dùng đường dẫn tuyệt đối, VD: read_file("{{WORKSPACE_PATH}}/foo/bai1.md")
- KHÔNG dùng tên workspace "{{WORKSPACE_NAME}}" làm dir_path — đó là tên hiển thị, không phải đường dẫn

Workflow BẮT BUỘC khi user hỏi về tài liệu/thư mục:
1. Dùng find_files("từ khóa tên file") để tìm nhanh file/folder theo tên — KHÔNG cần list_directory nếu biết tên
2. Nếu không biết tên: list_directory("") → xem cấu trúc, rồi list_directory(subfolder) nếu cần
3. read_file("{{WORKSPACE_PATH}}/path/to/file") để đọc nội dung — luôn dùng absolute path
4. Nếu read_file trả về lỗi "no such file": gọi find_files để tìm đúng path, sau đó thử lại read_file với absolute path chính xác
5. Trả lời dựa trên nội dung thực tế đọc được
