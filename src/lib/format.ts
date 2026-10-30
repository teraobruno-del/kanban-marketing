import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { APP_TIME_ZONE, parseDateOnly, type DateOnly } from "@/lib/dates/day";

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
