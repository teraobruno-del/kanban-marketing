"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente do Supabase no navegador (login com Google e, na F3, atualização ao vivo). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
