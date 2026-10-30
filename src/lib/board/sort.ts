import type { DateOnly } from "@/lib/dates/day";
import { BOARD_COLUMNS, getBoardColumn, type CardStage, type ColumnKey } from "./columns";

export interface SortableCard {
  stage: CardStage;
  dueDate: DateOnly | null;
  createdAt: Date | string;
}

function time(value: Date | string): number {
  return typeof value === "string" ? Date.parse(value) : value.getTime();
}

/**
 * Ordem dentro das colunas (SPEC §4.3): prazo mais próximo primeiro; empate → criação mais antiga.
 * Cards sem prazo vêm depois dos que têm prazo (premissa P16), entre si por criação.
 */
export function compareCards(a: SortableCard, b: SortableCard): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return time(a.createdAt) - time(b.createdAt);
}

/** Distribui os cards nas 8 colunas, já ordenados. */
export function groupCardsByColumn<T extends SortableCard>(
  cards: T[],
  today: DateOnly,
): Record<ColumnKey, T[]> {
  const groups = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.key, [] as T[]])) as Record<ColumnKey, T[]>;
  for (const card of cards) groups[getBoardColumn(card, today)].push(card);
  for (const key of Object.keys(groups) as ColumnKey[]) groups[key].sort(compareCards);
  return groups;
}
