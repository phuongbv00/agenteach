import { PluginLoader } from "../../plugins/PluginLoader";

type LabelFn = (args: Record<string, unknown>) => string;

export const staticLabels: Record<string, LabelFn> = {
  fs_list_dir: (a) => `Xem thư mục: ${a.dir_path ?? "."}`,
  fs_find_files: (a) => `Tìm file: "${a.query ?? ""}"`,
  fs_read_file: (a) => `Đọc file: ${a.file_path ?? ""}`,
  fs_write_file: (a) => `Ghi file: ${a.file_path ?? ""}`,
  fs_search_in_files: (a) => `Tìm kiếm: "${a.query ?? ""}"`,
  fs_create_markdown: (a) => `Tạo file Markdown: ${a.file_name ?? ""}`,
  fs_create_pdf: (a) => `Tạo file PDF: ${a.file_name ?? ""}`,
  fs_create_docx: (a) => `Tạo file Word: ${a.file_name ?? ""}`,
  memory_update: () => "Ghi nhớ thông tin",
  time_now: () => "Lấy ngày hôm nay",
};

export function resolveToolLabel(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (staticLabels[toolName]) return staticLabels[toolName](input);

  // Plugin skills: plugin_skill_{id}
  const skills = PluginLoader.listSkills();
  for (const skill of skills) {
    if (`plugin_skill_${skill.id.replace(/-/g, "_")}` === toolName) {
      return `Skill: ${skill.name}`;
    }
  }

  return toolName;
}
