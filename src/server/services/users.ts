import type { Db } from "@/lib/db/client";
import { canManage, type Actor } from "@/lib/auth/permissions";
import { createUserSchema, passwordSchema, updateUserSchema } from "@/lib/validation/schemas";
import { forbidden, invalid, notFound } from "@/server/errors";
import { parse } from "./util";

/**
 * Operações nas contas de login (Supabase Auth). Fica separado para poder ser
 * substituído nos testes por uma versão falsa.
 */
export interface AuthAdminPort {
  createUser(email: string, password: string): Promise<{ id: string }>;
  findUserIdByEmail(email: string): Promise<string | null>;
  deleteUser(id: string): Promise<void>;
  setPassword(id: string, password: string): Promise<void>;
  setBanned(id: string, banned: boolean): Promise<void>;
}

function requireAdmin(actor: Actor) {
  if (!canManage(actor)) throw forbidden("Só o Administrador pode gerenciar usuários.");
}

export async function listUsers(db: Db, actor: Actor) {
  requireAdmin(actor);
  return db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

/** Lista simples de usuários ativos (para o Admin escolher acessos dos quadros). */
export async function listActiveUsers(db: Db, actor: Actor) {
  requireAdmin(actor);
  return db.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Cadastro com senha provisória (decisão F1-1A). */
export async function createUser(db: Db, auth: AuthAdminPort, actor: Actor, raw: unknown) {
  requireAdmin(actor);
  const input = parse(createUserSchema, raw);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw invalid("Já existe um usuário com este e-mail.");

  // Já existe conta de login sem cadastro no sistema (ex.: tentativa com Google, cadastro interrompido):
  // reaproveita a conta e define a senha provisória.
  const existingId = await auth.findUserIdByEmail(input.email);
  if (existingId) {
    if (await db.user.findUnique({ where: { id: existingId } })) throw invalid("Já existe um usuário com este e-mail.");
    await auth.setPassword(existingId, input.password);
    await auth.setBanned(existingId, false);
    return db.user.create({ data: { id: existingId, email: input.email, name: input.name, role: input.role } });
  }

  const { id } = await auth.createUser(input.email, input.password);
  try {
    return await db.user.create({ data: { id, email: input.email, name: input.name, role: input.role } });
  } catch (e) {
    await auth.deleteUser(id); // desfaz a conta de login se a ficha não pôde ser criada
    throw e;
  }
}

export async function updateUser(db: Db, actor: Actor, userId: string, raw: unknown) {
  requireAdmin(actor);
  const input = parse(updateUserSchema, raw);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário não encontrado.");
  if (user.id === actor.id && input.role !== "ADMIN") {
    throw invalid("Você não pode remover o seu próprio papel de Administrador.");
  }
  await db.user.update({ where: { id: userId }, data: input });
}

/** "Excluir" = desativar, preservando o histórico (SPEC §7). Também bloqueia o login. */
export async function setUserActive(db: Db, auth: AuthAdminPort, actor: Actor, userId: string, isActive: boolean) {
  requireAdmin(actor);
  if (userId === actor.id && !isActive) throw invalid("Você não pode desativar a sua própria conta.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário não encontrado.");
  await auth.setBanned(userId, !isActive);
  await db.user.update({
    where: { id: userId },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
  });
}

export async function resetUserPassword(db: Db, auth: AuthAdminPort, actor: Actor, userId: string, password: string) {
  requireAdmin(actor);
  const pw = parse(passwordSchema, password);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário não encontrado.");
  await auth.setPassword(userId, pw);
}

/**
 * Primeiro Administrador (premissa P10): enquanto não existir nenhum usuário, o login com
 * INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD cria a conta de Administrador.
 * Devolve true se criou (ou completou) o primeiro Administrador.
 */
export async function bootstrapFirstAdmin(
  db: Db,
  auth: AuthAdminPort,
  attempt: { email: string; password: string },
  env: { email?: string; password?: string },
): Promise<boolean> {
  const email = attempt.email.trim().toLowerCase();
  if (!env.email || !env.password) return false;
  if (email !== env.email.trim().toLowerCase() || attempt.password !== env.password) return false;
  if ((await db.user.count()) > 0) return false;

  let id = await auth.findUserIdByEmail(email);
  if (id) await auth.setPassword(id, attempt.password);
  else id = (await auth.createUser(email, attempt.password)).id;

  await db.user.create({ data: { id, email, name: email.split("@")[0], role: "ADMIN" } });
  return true;
}
