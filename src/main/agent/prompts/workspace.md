[WORKSPACE]
Workspace: "{{WORKSPACE_NAME}}"
Đường dẫn tuyệt đối: {{WORKSPACE_PATH}}

Quy tắc đường dẫn (BẮT BUỘC):

- fs_list_dir("") hoặc fs_list_dir(".") → liệt kê workspace root
- fs_list_dir("foo") → liệt kê subfolder foo
- fs_read_file LUÔN dùng đường dẫn tuyệt đối, VD: fs_read_file("{{WORKSPACE_PATH}}/foo/bai1.md")
- KHÔNG dùng tên workspace "{{WORKSPACE_NAME}}" làm dir_path — đó là tên hiển thị, không phải đường dẫn

Workflow BẮT BUỘC khi user hỏi về tài liệu/thư mục:

1. Dùng fs_find_files("từ khóa tên file") để tìm nhanh file/folder theo tên — KHÔNG cần fs_list_dir nếu biết tên
2. Nếu không biết tên: fs_list_dir("") → xem cấu trúc, rồi fs_list_dir(subfolder) nếu cần
3. fs_read_file("{{WORKSPACE_PATH}}/path/to/file") để đọc nội dung — luôn dùng absolute path
4. Nếu fs_read_file trả về lỗi "no such file": gọi fs_find_files để tìm đúng path, sau đó thử lại fs_read_file với absolute path chính xác
5. Trả lời dựa trên nội dung thực tế đọc được
