import { checkKey, checkSupabaseUrl } from "./clean";

/**
 * Endereço e chave pública do Supabase (usados no servidor e no navegador).
 * As variáveis NEXT_PUBLIC_* precisam ser lidas exatamente assim (process.env.NOME)
 * para o Next.js incluí-las na montagem do site.
 */
export function publicSupabaseConfig() {
  const url = checkSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = checkKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return { url, key };
}
