"use client";
import type { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { formatDateOnly } from "@/lib/format";

/**
 * Antes de finalizar (arrastar para FINALIZADAS ou Aprovar): se houver itens pendentes na checklist,
 * pergunta (SPEC §6.B / P23). Devolve null se a pessoa cancelou.
 */
export async function askChecklistConfirmation(
  confirm: ReturnType<typeof useConfirm>,
  pending: number,
): Promise<{ completeChecklist: boolean } | null> {
  if (pending <= 0) return { completeChecklist: false };
  const ok = await confirm({
    title: "Finalizar a tarefa?",
    description: `${pending} ${pending === 1 ? "item da checklist será marcado como concluído" : "itens da checklist serão marcados como concluídos"}.`,
    confirmLabel: "Finalizar",
  });
  return ok ? { completeChecklist: true } : null;
}

/** Mensagem depois de finalizar; avisa quando a próxima tarefa da série foi criada. */
export function finishedToast(base: string, nextRecurrence: string | null | undefined) {
  toast.success(nextRecurrence ? `${base} A próxima tarefa da série vence em ${formatDateOnly(nextRecurrence)}.` : base);
}
