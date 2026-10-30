import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Actor, Role } from "./permissions";

export interface CurrentUser extends Actor {
  name: string;
  email: string;
}

/** Usuário logado (conta do Supabase + ficha ativa no banco), ou null. Uma consulta por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const user = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!user || !user.isActive) return null;
  return { id: user.id, role: user.role as Role, isActive: user.isActive, name: user.name, email: user.email };
});

/** Exige login; sem usuário válido, vai para a tela de login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
