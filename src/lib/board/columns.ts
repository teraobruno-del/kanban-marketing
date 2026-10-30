import { getTimeColumn, type TimeColumn } from "@/lib/dates/time-column";
import type { DateOnly } from "@/lib/dates/day";

/** Etapa gravada no card (espelha o enum CardStage do Prisma). */
export type CardStage = "NEW" | "ACTIVE" | "APPROVAL" | "CHANGES" | "DONE";

/** As 8 colunas fixas do quadro (SPEC §4). */
export type ColumnKey = "NEW" | TimeColumn | "APPROVAL" | "CHANGES" | "DONE";

export interface ColumnDefinition {
  key: ColumnKey;
  emoji: string;
  label: string; // rótulo em pt-BR (só na interface)
}

/** Ordem de exibição das colunas no quadro. */
export const BOARD_COLUMNS: readonly ColumnDefinition[] = [
  { key: "NEW", emoji: "🎁", label: "NOVAS DEMANDAS" },
  { key: "OVERDUE", emoji: "😱", label: "ATRASADAS" },
  { key: "TODAY", emoji: "😭", label: "HOJE" },
  { key: "THIS_WEEK", emoji: "🥲", label: "ESTA SEMANA" },
  { key: "UPCOMING", emoji: "😎", label: "ESTE MÊS / PRÓXIMOS" },
  { key: "APPROVAL", emoji: "🫣", label: "APROVAÇÃO" },
  { key: "CHANGES", emoji: "😒", label: "ALTERAÇÃO" },
  { key: "DONE", emoji: "🥳", label: "FINALIZADAS" },
] as const;

/** Em qual coluna o card aparece, a partir da etapa gravada e do prazo. */
export function getBoardColumn(
  card: { stage: CardStage; dueDate: DateOnly | null },
  today: DateOnly,
): ColumnKey {
  if (card.stage !== "ACTIVE") return card.stage;
  // Card ativo sem prazo não deveria existir (premissa P1); por segurança, vai para NOVAS.
  if (card.dueDate === null) return "NEW";
  return getTimeColumn(card.dueDate, today);
}
