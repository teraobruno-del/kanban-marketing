import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { APP_TIME_ZONE, addDaysToDateOnly, endOfWeekSunday, isoWeekday, parseDateOnly, type DateOnly } from "@/lib/dates/day";

/** "2026-10-30" → "30/10/2026" */
export function formatDateOnly(value: DateOnly): string {
  const { year, month, day } = parseDateOnly(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** "2026-10-30" → "30/10" (forma curta, para o card no quadro) */
export function formatDateOnlyShort(value: DateOnly): string {
  return formatDateOnly(value).slice(0, 5);
}

/** Data e hora em São Paulo: "30/10/2026 às 15:04" */
export function formatDateTime(iso: string): string {
  return format(new TZDate(new Date(iso).getTime(), APP_TIME_ZONE), "dd/MM/yyyy 'às' HH:mm");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export type DueTone = "done" | "overdue" | "today" | "soon" | "normal";

/**
 * Prazo em linguagem natural, para o card no quadro:
 * "Hoje", "Amanhã", "Atrasado há 2 dias", "sex 06/11" (nesta semana) ou "19/11".
 */
export function describeDue(due: DateOnly, today: DateOnly): { text: string; tone: DueTone } {
  if (due < today) {
    const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    return { text: days === 1 ? "Atrasado há 1 dia" : `Atrasado há ${days} dias`, tone: "overdue" };
  }
  if (due === today) return { text: "Hoje", tone: "today" };
  if (due === addDaysToDateOnly(today, 1)) return { text: "Amanhã", tone: "soon" };
  if (due <= endOfWeekSunday(today)) return { text: `${WEEKDAYS[isoWeekday(due) - 1]} ${formatDateOnlyShort(due)}`, tone: "soon" };
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return { text: sameYear ? formatDateOnlyShort(due) : formatDateOnly(due), tone: "normal" };
}

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";
const WEEKDAY_FULL = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/** Resumo da repetição: "Repete toda semana (sexta), até 31/12/2026". */
export function describeRecurrence(frequency: Frequency, dueDate: DateOnly | null, endDate: DateOnly | null): string {
  let text =
    frequency === "DAILY" ? "Repete todo dia"
    : frequency === "WEEKLY" ? `Repete toda semana${dueDate ? ` (${WEEKDAY_FULL[isoWeekday(dueDate) - 1]})` : ""}`
    : `Repete todo mês${dueDate ? ` (dia ${parseDateOnly(dueDate).day})` : ""}`;
  text += endDate ? `, até ${formatDateOnly(endDate)}` : ", sem data para terminar";
  return text;
}
