import { normalizeDbUrl } from "@/lib/db/url";

/** Limpa um valor de variável de ambiente (espaços, aspas, "NOME=" colado). Vazio → undefined. */
export const cleanEnv = normalizeDbUrl;

/**
 * Confere o endereço do projeto Supabase e devolve só a origem (sem barra/caminho no final).
 * Ex.: ' "https://abc.supabase.co/" ' → "https://abc.supabase.co"
 */
export function checkSupabaseUrl(raw: string | undefined): { value?: string; problem?: string } {
  const v = cleanEnv(raw);
  if (!v) return { problem: "não foi cadastrada (ou está vazia)." };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { problem: "não é um endereço válido. Deve ser parecido com https://abcdefgh.supabase.co" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { problem: "deve começar com https:// (ex.: https://abcdefgh.supabase.co)." };
  }
  if (u.hostname === "supabase.com" || u.hostname.endsWith(".supabase.com")) {
    return {
      problem:
        "é o endereço do painel do Supabase, não do projeto. Use o Project URL (ex.: https://abcdefgh.supabase.co), em Project Settings → Data API.",
    };
  }
  return { value: u.origin };
}

/** Confere uma chave (não pode ficar vazia nem ter espaços no meio). */
export function checkKey(raw: string | undefined): { value?: string; problem?: string } {
  const v = cleanEnv(raw);
  if (!v) return { problem: "não foi cadastrada (ou está vazia)." };
  if (/\s/.test(v)) return { problem: "tem espaços ou quebras de linha no meio. Copie a chave de novo, inteira." };
  return { value: v };
}
