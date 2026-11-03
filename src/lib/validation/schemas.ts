import { z } from "zod";
import { isDateOnly } from "@/lib/dates/day";

const id = z.uuid({ message: "Identificador inválido." });
const name = (field: string, max = 80) =>
  z.string().trim().min(1, `${field} é obrigatório.`).max(max, `${field}: no máximo ${max} caracteres.`);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use o formato #RRGGBB).");

/** Data sem hora "AAAA-MM-DD" ou vazio (sem prazo). */
export const dueDateSchema = z
  .union([z.string(), z.null()])
  .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
  .refine((v) => v === null || isDateOnly(v), "Data inválida.");

export const roleSchema = z.enum(["ADMIN", "MEMBER", "OBSERVER"]);

// ── Quadros ──
export const boardNameSchema = z.object({ name: name("Nome do quadro") });
export const boardItemSchema = z.object({ name: name("Nome", 40), color });

// ── Usuários ──
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

export const createUserSchema = z.object({
  name: name("Nome"),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  role: roleSchema,
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  name: name("Nome"),
  role: roleSchema,
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")).optional(),
});

// ── Cards ──
export const recurrenceSchema = z.object({
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).nullable().default(null),
  endDate: dueDateSchema.default(null),
});

export const cardInputSchema = z
  .object({
    title: name("Título", 200),
    description: z.string().max(20000, "Descrição muito longa.").default(""),
    dueDate: dueDateSchema,
    requesterAreaId: id,
    labelIds: z.array(id).max(30).default([]),
    assigneeIds: z.array(id).max(30).default([]),
    observerIds: z.array(id).max(30).default([]),
    recurrence: recurrenceSchema.default({ frequency: null, endDate: null }),
  })
  .superRefine((v, ctx) => {
    const r = v.recurrence;
    if (r.frequency && !v.dueDate) {
      ctx.addIssue({ code: "custom", message: "Para repetir a tarefa, defina um prazo.", path: ["recurrence"] });
    }
    if (r.frequency && r.endDate && v.dueDate && r.endDate < v.dueDate) {
      ctx.addIssue({ code: "custom", message: "A data final da repetição não pode ser antes do prazo.", path: ["recurrence"] });
    }
  });
export type CardInput = z.input<typeof cardInputSchema>;

export const checklistTitleSchema = z.object({ title: name("Título da checklist", 120) });
export const checklistItemTextSchema = z.object({ text: name("Item", 300) });

/** Primeira mensagem de erro, em português, para mostrar na tela. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

// ── Aprovação ──
export const rejectReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Escreva o motivo da reprovação (pelo menos 3 caracteres).")
    .max(1000, "Motivo muito longo (máximo de 1000 caracteres)."),
});

// ── Comentários ──
export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Escreva um comentário.")
  .max(5000, "Comentário muito longo (máximo de 5000 caracteres).");
