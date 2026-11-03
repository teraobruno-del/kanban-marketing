import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthAdmin } from "@/lib/supabase/auth-admin";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Retorno do login com Google. Só aceita e-mails já cadastrados pelo Administrador
 * (SPEC §7). Exceção: o primeiro Administrador (P10), enquanto não houver nenhum usuário.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const fail = (erro: string) => {
    url.pathname = "/login";
    url.search = `?erro=${erro}`;
    return NextResponse.redirect(url);
  };
  const viaLink = next !== "/"; // link de e-mail (ex.: nova senha), não Google
  if (!code) return fail(viaLink ? "link" : "google");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail(viaLink ? "link" : "google");

  const authUser = data.user;
  const email = authUser.email?.toLowerCase() ?? "";
  let row = await prisma.user.findUnique({ where: { id: authUser.id } });

  if (!row && email && email === process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() && (await prisma.user.count()) === 0) {
    row = await prisma.user.create({
      data: { id: authUser.id, email, name: authUser.user_metadata?.full_name ?? email.split("@")[0], role: "ADMIN" },
    });
  }

  if (!row || !row.isActive) {
    await supabase.auth.signOut();
    // Conta criada agora pelo Google, sem cadastro no sistema: remove para não ficar "pendurada".
    if (!row) await supabaseAuthAdmin().deleteUser(authUser.id).catch(() => {});
    return fail("nao-cadastrado");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
