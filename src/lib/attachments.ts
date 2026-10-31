import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";

/** Extensões bloqueadas por segurança (decisão F3-6A): programas e scripts executáveis. */
export const BLOCKED_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "msi", "scr", "pif", "cpl", "ps1", "psm1", "vbs", "vbe", "wsf", "wsh",
  "hta", "jar", "apk", "app", "dmg", "pkg", "sh", "bash", "reg", "lnk", "dll", "sys",
];

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Motivo para recusar o arquivo, ou null se pode enviar. Vale no navegador e no servidor. */
export function attachmentProblem(file: { name: string; size: number }): string | null {
  if (!file.name.trim()) return "Arquivo sem nome.";
  if (file.size <= 0) return `“${file.name}” está vazio.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `“${file.name}” tem ${formatBytes(file.size)}; o limite é 10 MB por arquivo.`;
  if (BLOCKED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `Arquivos .${fileExtension(file.name)} não são aceitos por segurança.`;
  }
  return null;
}

/** Imagem que pode ter miniatura e virar capa (SVG fica de fora por segurança — P32). */
export function isPreviewableImage(mimeType: string, name: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml" && fileExtension(name) !== "svg";
}

/** Nome seguro para guardar no armazenamento (sem acentos, espaços ou barras). */
export function safeStorageName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-80);
  return base || "arquivo";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
