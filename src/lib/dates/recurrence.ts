import {
  addDaysToDateOnly,
  daysInMonth,
  isDateOnly,
  makeDateOnly,
  parseDateOnly,
  type DateOnly,
} from "./day";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface NextRecurrenceInput {
  /** Prazo do card que está sendo finalizado. */
  dueDate: DateOnly;
  frequency: RecurrenceFrequency;
  /** Hoje em São Paulo. */
  today: DateOnly;
  /** Data final da recorrência (inclusiva). null/undefined = sem fim. */
  endDate?: DateOnly | null;
  /**
   * Dia do mês original da série (1–31), só para MONTHLY (decisão 3A).
   * Ex.: série iniciada em 31/01 → 28/02 → 31/03. Se omitido, usa o dia de dueDate.
   */
  anchorDay?: number | null;
}

/** Próximo mês respeitando o dia-âncora; se o mês for curto, usa o último dia. */
function addOneMonth(value: DateOnly, anchorDay: number): DateOnly {
  const { year, month } = parseDateOnly(value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const day = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));
  return makeDateOnly(nextYear, nextMonth, day);
}

function step(value: DateOnly, frequency: RecurrenceFrequency, anchorDay: number): DateOnly {
  switch (frequency) {
    case "DAILY":
      return addDaysToDateOnly(value, 1);
    case "WEEKLY":
      return addDaysToDateOnly(value, 7);
    case "MONTHLY":
      return addOneMonth(value, anchorDay);
  }
}

/**
 * Calcula o prazo do próximo card de uma série recorrente (SPEC §6.C).
 *
 * - Parte do prazo original e usa aritmética de calendário (nunca "+30 dias").
 * - Se a data resultante ficar no passado, avança ciclos até chegar a hoje ou depois
 *   (hoje é aceito — premissa P3).
 * - Se passar da data final, devolve null (não cria novo card).
 */
export function getNextRecurrenceDate(input: NextRecurrenceInput): DateOnly | null {
  const { dueDate, frequency, today, endDate } = input;
  if (!isDateOnly(dueDate) || !isDateOnly(today)) {
    throw new Error(`Datas inválidas: dueDate="${dueDate}", today="${today}"`);
  }
  if (endDate != null && !isDateOnly(endDate)) {
    throw new Error(`Data final inválida: "${endDate}"`);
  }

  const anchorDay = input.anchorDay ?? parseDateOnly(dueDate).day;
  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new Error(`Dia-âncora inválido: ${anchorDay}`);
  }

  let next = step(dueDate, frequency, anchorDay);

  // Pular ciclos que já ficaram no passado.
  // Para diária/semanal, salta direto para perto de hoje (evita laços longos).
  if (next < today && frequency !== "MONTHLY") {
    const cycle = frequency === "DAILY" ? 1 : 7;
    const gap = Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${next}T00:00:00Z`)) / 86_400_000,
    );
    next = addDaysToDateOnly(next, Math.floor(gap / cycle) * cycle);
  }
  while (next < today) {
    next = step(next, frequency, anchorDay);
  }

  if (endDate != null && next > endDate) return null;
  return next;
}
