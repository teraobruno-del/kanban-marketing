import { getTimeColumn } from "@/lib/dates/time-column";
import { todayInSaoPaulo, type DateOnly } from "@/lib/dates/day";
import { BOARD_COLUMNS, getBoardColumn, type CardStage, type ColumnKey } from "./columns";

/** Etapa de um card recém-criado (SPEC §6.A): com prazo → ACTIVE; sem prazo → NEW. */
export function stageForNewCard(dueDate: DateOnly | null): CardStage {
  return dueDate ? "ACTIVE" : "NEW";
}

/**
 * Etapa depois de mudar o prazo:
 * - NEW que recebe prazo → ACTIVE (SPEC §6.A);
 * - ACTIVE que perde o prazo → NEW (premissa P1);
 * - demais etapas não mudam.
 */
export function stageAfterDueDateChange(stage: CardStage, dueDate: DateOnly | null): CardStage {
  if (stage === "NEW" && dueDate) return "ACTIVE";
  if (stage === "ACTIVE" && !dueDate) return "NEW";
  return stage;
}

export type DropResult =
  | { ok: true; stage: CardStage }
  | { ok: false; reason: string; sameColumn?: boolean };

const TIME_COLUMNS = new Set<ColumnKey>(["TODAY", "THIS_WEEK", "UPCOMING"]);

export function columnLabel(key: ColumnKey): string {
  const col = BOARD_COLUMNS.find((c) => c.key === key);
  return col ? `${col.emoji} ${col.label}` : key;
}

/**
 * O que acontece ao soltar um card numa coluna (F1 — decisão 2A).
 * Na F1, soltar numa coluna de prazo só é aceito se o prazo já corresponder à coluna;
 * o modal para ajustar a data chega na F2.
 */
export function resolveDrop(
  card: { stage: CardStage; dueDate: DateOnly | null },
  target: ColumnKey,
  today: DateOnly,
): DropResult {
  const current = getBoardColumn(card, today);
  if (current === target) return { ok: false, reason: "O card já está nesta coluna.", sameColumn: true };

  if (target === "OVERDUE") {
    return { ok: false, reason: "A coluna ATRASADAS é só de leitura: os cards entram nela pelo prazo." };
  }

  if (target === "NEW") {
    if (card.dueDate) {
      return {
        ok: false,
        reason: "Só cards sem prazo podem voltar para NOVAS DEMANDAS. Remova o prazo do card primeiro.",
      };
    }
    return { ok: true, stage: "NEW" };
  }

  if (TIME_COLUMNS.has(target)) {
    if (!card.dueDate) {
      return { ok: false, reason: "Defina um prazo no card para colocá-lo numa coluna de prazo." };
    }
    const expected = getTimeColumn(card.dueDate, today);
    if (expected !== target) {
      return {
        ok: false,
        reason: `Pelo prazo atual, este card pertence a ${columnLabel(expected)}. Para mudar de coluna, ajuste o prazo no card.`,
      };
    }
    return { ok: true, stage: "ACTIVE" };
  }

  // APPROVAL, CHANGES, DONE
  return { ok: true, stage: target as CardStage };
}

/**
 * Campos de conclusão ao mudar de etapa (SPEC §6.B; premissas P2 e P4).
 * Devolve undefined quando nada muda.
 */
export function completionFieldsForStageChange(
  from: CardStage,
  to: CardStage,
  dueDate: DateOnly | null,
  now: Date,
): { completedAt: Date | null; completedOnTime: boolean | null } | undefined {
  if (to === "DONE" && from !== "DONE") {
    return {
      completedAt: now,
      completedOnTime: dueDate ? todayInSaoPaulo(now) <= dueDate : null,
    };
  }
  if (from === "DONE" && to !== "DONE") {
    return { completedAt: null, completedOnTime: null };
  }
  return undefined;
}

/** Tipo do evento de histórico para uma mudança de etapa. */
export function eventTypeForStageChange(from: CardStage, to: CardStage) {
  if (to === "DONE") return "COMPLETED" as const;
  if (from === "DONE") return "REOPENED" as const;
  return "STAGE_CHANGED" as const;
}
