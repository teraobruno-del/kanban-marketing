import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Cliente com a chave secreta: cria/desativa contas de login.
 * Só pode ser usado no servidor e depois de conferir que quem pede é Administrador.
 */
export function createSupabaseAdminClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
