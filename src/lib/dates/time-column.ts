import { endOfWeekSunday, isDateOnly, type DateOnly } from "./day";

/** Colunas de prazo calculadas para cards em ACTIVE (SPEC §4.2). */
export type TimeColumn = "OVERDUE" | "TODAY" | "THIS_WEEK" | "UPCOMING";

/**
 * Decide em qual coluna de prazo um card ACTIVE aparece.
 *
 * - OVERDUE   (ATRASADAS):  dueDate < today
 * - TODAY     (HOJE):       dueDate = today
 * - THIS_WEEK (ESTA SEMANA): de today+1 até o domingo da semana corrente
 *                            (no domingo, nenhum card cai aqui)
 * - UPCOMING  (ESTE MÊS / PRÓXIMOS): depois do domingo da semana corrente
 *
 * A semana vai de segunda a domingo. `today` deve ser a data de hoje
 * em São Paulo (use todayInSaoPaulo()).
 */
export function getTimeColumn(dueDate: DateOnly, today: DateOnly): TimeColumn {
  if (!isDateOnly(dueDate) || !isDateOnly(today)) {
    throw new Error(`Datas inválidas: dueDate="${dueDate}", today="${today}"`);
  }
  // Texto AAAA-MM-DD compara na mesma ordem do calendário.
  if (dueDate < today) return "OVERDUE";
  if (dueDate === today) return "TODAY";
  if (dueDate <= endOfWeekSunday(today)) return "THIS_WEEK";
  return "UPCOMING";
}

/** Card está com prazo vencido (selo vermelho), em qualquer etapa não finalizada. */
export function isOverdue(dueDate: DateOnly | null, today: DateOnly): boolean {
  return dueDate !== null && dueDate < today;
}
