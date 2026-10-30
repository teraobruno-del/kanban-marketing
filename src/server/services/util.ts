import type { z } from "zod";
import { firstError } from "@/lib/validation/schemas";
import { invalid } from "@/server/errors";

/** Valida os dados com o esquema Zod; em caso de erro, lança mensagem amigável. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw invalid(firstError(r.error));
  return r.data;
}
