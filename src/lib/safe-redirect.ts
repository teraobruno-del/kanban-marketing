/**
 * Só aceita voltar para páginas do próprio site (ex.: "/reset-password").
 * Impede que um link adulterado leve a pessoa para outro site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
