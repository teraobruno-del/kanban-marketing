/** Limite de tamanho por anexo (SPEC §5): 10 MB, validado no navegador e no servidor. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** "Balde" privado do Supabase Storage onde ficam os anexos (P31). */
export const ATTACHMENTS_BUCKET = "attachments";
