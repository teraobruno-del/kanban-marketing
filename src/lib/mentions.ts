/** Menções com @ nos comentários (SPEC §5, decisão F3-2A / P18). */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Expressão que encontra "@Nome" como palavra inteira (não pega "@Ana" dentro de "@Anabela"). */
function mentionRegex(name: string, flags = "i") {
  return new RegExp(`(^|[^\\p{L}\\p{N}_@])@${escapeRegex(name)}(?![\\p{L}\\p{N}_])`, `u${flags}`);
}

/**
 * Quem foi mencionado de fato: das pessoas escolhidas na lista, só as que podem ser mencionadas
 * e cujo "@Nome" continua no texto.
 */
export function resolveMentions(
  body: string,
  requestedIds: string[],
  candidates: { id: string; name: string }[],
): string[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return [...new Set(requestedIds)].filter((id) => {
    const c = byId.get(id);
    return c ? mentionRegex(c.name).test(body) : false;
  });
}

/**
 * Prepara o texto para exibir: "@Nome" de quem foi mencionado vira um link especial
 * (`mention:`), que a tela mostra destacado.
 */
export function mentionsToMarkdown(body: string, mentioned: { id: string; name: string }[]): string {
  // Nomes maiores primeiro, para "@Ana Lima" não ser cortado por "@Ana".
  const sorted = [...mentioned].sort((a, b) => b.name.length - a.name.length);
  let out = body;
  for (const m of sorted) {
    const re = new RegExp(mentionRegex(m.name, "gi").source, "giu");
    out = out.replace(re, (_all, before: string) => `${before}[@${m.name}](mention:${m.id})`);
  }
  return out;
}

/** O que está sendo digitado depois de "@" (para abrir a lista de pessoas), ou null. */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s(])@([\p{L}\p{N}_.-]*(?: [\p{L}\p{N}_.-]*)?)$/u.exec(before);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}
