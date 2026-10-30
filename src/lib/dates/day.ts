import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** Fuso horário oficial do sistema (SPEC §2). */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/**
 * Uma data sem hora, no formato "AAAA-MM-DD" (ex.: "2026-02-28").
 * Usamos texto em vez de Date para que o fuso horário nunca "empurre"
 * um prazo para o dia anterior ou seguinte.
 */
export type DateOnly = string;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Confere se o texto é uma data real no formato AAAA-MM-DD. */
export function isDateOnly(value: string): value is DateOnly {
  const m = DATE_ONLY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

function assertDateOnly(value: string): void {
  if (!isDateOnly(value)) {
    throw new Error(`Data inválida (esperado AAAA-MM-DD): "${value}"`);
  }
}

/** Separa "AAAA-MM-DD" em números (mês de 1 a 12). */
export function parseDateOnly(value: DateOnly): { year: number; month: number; day: number } {
  assertDateOnly(value);
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** Monta "AAAA-MM-DD" a partir de ano, mês (1–12) e dia. */
export function makeDateOnly(year: number, month: number, day: number): DateOnly {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Quantidade de dias do mês (considera ano bissexto). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Converte para um Date fixo em UTC, só para fazer contas de calendário. */
function toUtc(value: DateOnly): Date {
  const { year, month, day } = parseDateOnly(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): DateOnly {
  return makeDateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Soma (ou subtrai) dias de calendário. */
export function addDaysToDateOnly(value: DateOnly, days: number): DateOnly {
  const d = toUtc(value);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Dia da semana no padrão ISO: 1 = segunda … 7 = domingo. */
export function isoWeekday(value: DateOnly): number {
  const js = toUtc(value).getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

/** Domingo da semana (segunda a domingo) que contém a data. */
export function endOfWeekSunday(value: DateOnly): DateOnly {
  return addDaysToDateOnly(value, 7 - isoWeekday(value));
}

/**
 * "Hoje" no fuso de São Paulo, independentemente do fuso do computador
 * ou do servidor.
 */
export function todayInSaoPaulo(now: Date = new Date()): DateOnly {
  return format(new TZDate(now.getTime(), APP_TIME_ZONE), "yyyy-MM-dd");
}

/**
 * Converte o valor que o Prisma devolve para uma coluna DATE (meia-noite UTC)
 * em "AAAA-MM-DD".
 */
export function dateOnlyFromDb(value: Date): DateOnly {
  return fromUtc(value);
}

/** Converte "AAAA-MM-DD" para o formato que o Prisma grava numa coluna DATE. */
export function dateOnlyToDb(value: DateOnly): Date {
  return toUtc(value);
}
