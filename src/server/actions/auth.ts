"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthAdmin } from "@/lib/supabase/auth-admin";
import { passwordSchema } from "@/lib/validation/schemas";
import { bootstrapFirstAdmin } from "@/server/services/users";
import { getCurrentUser } from "@/lib/auth/session";

export type FormState = { error?: string; success?: string };

const initialAdminEnv = () => ({
  email: process.env.INITIAL_ADMIN_EMAIL,
  password: process.env.INITIAL_ADMIN_PASSWORD,
});

/** Login com e-mail e senha. */
export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createSupabaseServerClient();
  let result = await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    // Primeiro acesso do sistema (P10): cria o Administrador inicial.
    const created = await bootstrapFirstAdmin(prisma, supabaseAuthAdmin(), { email, password }, initialAdminEnv());
    if (created) result = await supabase.auth.signInWithPassword({ email, password });
  }
  if (result.error || !result.data.user) return { error: "E-mail ou senha incorretos, ou usuário desativado." };

  let row = await prisma.user.findUnique({ where: { id: result.data.user.id } });
  if (!row && (await bootstrapFirstAdmin(prisma, supabaseAuthAdmin(), { email, password }, initialAdminEnv()))) {
    row = await prisma.user.findUnique({ where: { id: result.data.user.id } });
  }
  if (!row || !row.isActive) {
    await supabase.auth.signOut();
    return { error: "Seu usuário não está cadastrado ou foi desativado. Fale com o Administrador." };
  }
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Troca da própria senha (página Minha conta). */
export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "As duas senhas não são iguais." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível trocar a senha. Tente uma senha diferente da atual." };
  return { success: "Senha alterada com sucesso." };
}
