"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "./env";

/** Cliente do Supabase no navegador (login com Google e, na F3, atualização ao vivo). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl(), supabasePublicKey());
}
