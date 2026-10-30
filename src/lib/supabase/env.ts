import { checkKey } from "@/lib/config/clean";
import { publicSupabaseConfig } from "@/lib/config/public";

/** Variáveis do Supabase, já limpas e conferidas (aceita os nomes novos e antigos das chaves). */
export function supabaseUrl(): string {
  const { url } = publicSupabaseConfig();
  if (!url.value) throw new Error(`NEXT_PUBLIC_SUPABASE_URL ${url.problem}`);
  return url.value;
}

export function supabasePublicKey(): string {
  const { key } = publicSupabaseConfig();
  if (!key.value) throw new Error(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ${key.problem}`);
  return key.value;
}

export function supabaseSecretKey(): string {
  const k = checkKey(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!k.value) throw new Error(`SUPABASE_SECRET_KEY ${k.problem}`);
  return k.value;
}
