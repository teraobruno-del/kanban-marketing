/** Erro com mensagem amigável (em português) para mostrar ao usuário. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" = "INVALID",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (msg = "Você não tem permissão para fazer isso.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Não encontrado.") => new AppError(msg, "NOT_FOUND");
export const invalid = (msg: string) => new AppError(msg, "INVALID");

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
