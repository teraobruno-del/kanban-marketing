import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { AppError, type ActionResult } from "@/server/errors";

/**
 * Executa uma ação em nome do usuário logado. Erros conhecidos viram mensagem amigável;
 * erros inesperados são registrados no log e o usuário vê uma mensagem genérica.
 */
export async function run<T>(fn: (user: CurrentUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  try {
    const data = await fn(user);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Algo deu errado. Tente novamente." };
  }
}
