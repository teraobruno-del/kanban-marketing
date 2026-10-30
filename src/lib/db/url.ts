/**
 * Limpa e confere os endereços do banco vindos das variáveis de ambiente.
 * Aceita erros comuns de "copiar e colar" (espaços, aspas, "NOME=" na frente)
 * e, se o endereço estiver inválido, explica em português — sem mostrar a senha.
 */

const VAR_PREFIX = /^[A-Z_]+\s*=\s*/;

export function normalizeDbUrl(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let v = raw.trim().replace(VAR_PREFIX, "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  return v === "" ? undefined : v;
}

/** Devolve o motivo do problema, ou null se o endereço parece válido. */
export function dbUrlProblem(url: string): string | null {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return "não começa com postgresql:// — copie a linha inteira do Supabase (botão Connect → URI), sem aspas e sem o nome da variável.";
  }
  if (/\[YOUR-PASSWORD\]/i.test(url)) {
    return "ainda contém [YOUR-PASSWORD] — troque esse trecho (incluindo os colchetes) pela senha do banco.";
  }
  try {
    const u = new URL(url);
    if (!u.hostname) return "está sem o endereço do servidor.";
    if (!u.port) return "está sem a porta (deve terminar em :6543/postgres ou :5432/postgres).";
  } catch {
    return "tem caracteres inválidos. Se a senha do banco tiver símbolos como @ # / ? %, crie uma nova senha só com letras e números (Supabase → Project Settings → Database → Reset database password).";
  }
  return null;
}

/** Lê e confere uma variável; lança erro claro se estiver inválida. */
export function readDbUrl(name: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const url = normalizeDbUrl(env[name]);
  if (url === undefined) return undefined;
  const problem = dbUrlProblem(url);
  if (problem) throw new Error(`A variável ${name} ${problem}`);
  return url;
}
