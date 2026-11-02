/**
 * Cálculos do Dashboard (SPEC §8 + decisões da F4). Funções puras, sem banco:
 * recebem tarefas e eventos já carregados e devolvem os números de cada indicador.
 * Datas de calendário sempre no horário de São Paulo (P36).
 */
import {
  addDaysToDateOnly, daysInMonth, isoWeekday, makeDateOnly, parseDateOnly, todayInSaoPaulo, type DateOnly,
} from "@/lib/dates/day";
import { getBoardColumn, type CardStage, type ColumnKey } from "@/lib/board/columns";

export interface DashCard {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  completedOnTime: boolean | null;
  stage: CardStage;
  dueDate: DateOnly | null;
  areaName: string;
  assigneeIds: string[];
}

/** Mudança de etapa (vem da tabela card_events). */
export interface StageEvent {
  cardId: string;
  createdAt: Date;
  fromStage: CardStage | null;
  toStage: CardStage | null;
}

export interface Period {
  from: DateOnly;
  to: DateOnly; // inclusivo
}

export type PeriodPreset = "month" | "quarter" | "year";
export type Granularity = "week" | "month";

const spDate = (d: Date) => todayInSaoPaulo(d);
const inPeriod = (d: Date | null, p: Period) => {
  if (!d) return false;
  const day = spDate(d);
  return day >= p.from && day <= p.to;
};

// ───────────────────────── Períodos ─────────────────────────

/** Mês, trimestre ou ano que contém `ref`. */
export function presetPeriod(preset: PeriodPreset, ref: DateOnly): Period {
  const { year, month } = parseDateOnly(ref);
  if (preset === "year") return { from: makeDateOnly(year, 1, 1), to: makeDateOnly(year, 12, 31) };
  const first = preset === "month" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const last = preset === "month" ? month : first + 2;
  return { from: makeDateOnly(year, first, 1), to: makeDateOnly(year, last, daysInMonth(year, last)) };
}

/** Agrupamento automático (decisão F4-5A): até ~2 meses → semanas; mais → meses. */
export function autoGranularity(p: Period): Granularity {
  const days = (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 + 1;
  return days <= 62 ? "week" : "month";
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Início do "balde" (segunda-feira da semana, ou dia 1 do mês) de uma data. */
export function bucketStart(day: DateOnly, g: Granularity): DateOnly {
  if (g === "week") return addDaysToDateOnly(day, 1 - isoWeekday(day));
  const { year, month } = parseDateOnly(day);
  return makeDateOnly(year, month, 1);
}

function nextBucket(start: DateOnly, g: Granularity): DateOnly {
  if (g === "week") return addDaysToDateOnly(start, 7);
  const { year, month } = parseDateOnly(start);
  return month === 12 ? makeDateOnly(year + 1, 1, 1) : makeDateOnly(year, month + 1, 1);
}

function bucketLabel(start: DateOnly, g: Granularity): string {
  const { year, month, day } = parseDateOnly(start);
  return g === "week"
    ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`
    : `${MONTHS[month - 1]}/${String(year).slice(2)}`;
}

// ───────────────────────── 1. Volume ─────────────────────────

/** Criadas (por data de criação) × concluídas (por data de conclusão), por semana ou mês (P35). */
export function volume(cards: DashCard[], p: Period, g: Granularity) {
  const buckets: { start: DateOnly; label: string; created: number; completed: number }[] = [];
  for (let b = bucketStart(p.from, g); b <= p.to; b = nextBucket(b, g)) {
    buckets.push({ start: b, label: bucketLabel(b, g), created: 0, completed: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.start, i]));
  for (const c of cards) {
    if (inPeriod(c.createdAt, p)) buckets[index.get(bucketStart(spDate(c.createdAt), g))!].created++;
    if (c.stage === "DONE" && inPeriod(c.completedAt, p)) buckets[index.get(bucketStart(spDate(c.completedAt!), g))!].completed++;
  }
  return buckets;
}

/** Tarefas concluídas no período (última conclusão — P38). */
export function completedIn(cards: DashCard[], p: Period) {
  return cards.filter((c) => c.stage === "DONE" && inPeriod(c.completedAt, p));
}

// ───────────────────────── 2. Entregas no prazo ─────────────────────────

export function onTime(cards: DashCard[], p: Period) {
  const done = completedIn(cards, p).filter((c) => c.completedOnTime !== null); // sem prazo fica fora (P37)
  const ok = done.filter((c) => c.completedOnTime).length;
  return {
    considered: done.length,
    onTime: ok,
    late: done.length - ok,
    pct: done.length ? Math.round((ok / done.length) * 1000) / 10 : null,
  };
}

/** Atrasadas agora: não finalizadas com prazo vencido (inclui APROVAÇÃO e ALTERAÇÃO — P5). */
export function overdueNow(cards: DashCard[], today: DateOnly) {
  return cards.filter((c) => c.stage !== "DONE" && c.dueDate !== null && c.dueDate < today).length;
}

// ───────────────────────── 3. Carga por pessoa ─────────────────────────

export const WORKLOAD_COLUMNS = ["OVERDUE", "TODAY", "THIS_WEEK", "UPCOMING", "APPROVAL", "CHANGES"] as const;
export type WorkloadColumn = (typeof WORKLOAD_COLUMNS)[number];
export const UNASSIGNED = "__unassigned__";

/** Tarefas ativas por responsável, empilhadas por coluna (P39). NOVAS DEMANDAS e FINALIZADAS ficam fora. */
export function workload(cards: DashCard[], today: DateOnly) {
  const rows = new Map<string, Record<WorkloadColumn, number>>();
  const empty = () => Object.fromEntries(WORKLOAD_COLUMNS.map((k) => [k, 0])) as Record<WorkloadColumn, number>;
  for (const c of cards) {
    const col = getBoardColumn(c, today) as ColumnKey;
    if (!(WORKLOAD_COLUMNS as readonly string[]).includes(col)) continue;
    const people = c.assigneeIds.length ? c.assigneeIds : [UNASSIGNED];
    for (const id of people) {
      const row = rows.get(id) ?? empty();
      row[col as WorkloadColumn]++;
      rows.set(id, row);
    }
  }
  return [...rows.entries()]
    .map(([userId, counts]) => ({ userId, counts, total: WORKLOAD_COLUMNS.reduce((n, k) => n + counts[k], 0) }))
    .sort((a, b) => b.total - a.total);
}

// ───────────────────────── 4. Áreas demandantes ─────────────────────────

/** Normaliza o nome da área (decisão F4-1A): "RH" = "rh" = " Rh ". */
export const areaKey = (name: string) => name.trim().toLocaleLowerCase("pt-BR").normalize("NFC");

/** Tarefas criadas no período por área (juntando pelo nome), da maior para a menor. */
export function areas(cards: DashCard[], p: Period) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const c of cards) {
    if (!inPeriod(c.createdAt, p)) continue;
    const k = areaKey(c.areaName);
    const cur = counts.get(k) ?? { name: c.areaName.trim(), count: 0 };
    cur.count++;
    counts.set(k, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

// ───────────────────────── 5. Tempo de entrega ─────────────────────────

function stats(values: number[]) {
  if (values.length === 0) return { count: 0, mean: null, median: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: values.length, mean: values.reduce((s, v) => s + v, 0) / values.length, median };
}

/** Lead time (ms): da criação à conclusão, tarefas concluídas no período. */
export function leadTime(cards: DashCard[], p: Period) {
  return stats(completedIn(cards, p).map((c) => c.completedAt!.getTime() - c.createdAt.getTime()));
}

// ───────────────────────── 6. Gargalo de aprovação ─────────────────────────

/**
 * Tempo total (ms) que cada tarefa passou em APROVAÇÃO, somando todas as passagens (P40).
 * Uma passagem começa quando um evento leva para APPROVAL e termina quando um evento sai de APPROVAL
 * (se ainda está lá, conta até `now`).
 */
export function approvalTimeByCard(events: StageEvent[], now: Date) {
  const byCard = new Map<string, StageEvent[]>();
  for (const e of events) byCard.set(e.cardId, [...(byCard.get(e.cardId) ?? []), e]);
  const out = new Map<string, { total: number; enteredAt: Date | null }>();
  for (const [cardId, evs] of byCard) {
    evs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let total = 0;
    let enteredAt: Date | null = null;
    for (const e of evs) {
      if (enteredAt && e.fromStage === "APPROVAL" && e.toStage !== "APPROVAL") {
        total += e.createdAt.getTime() - enteredAt.getTime();
        enteredAt = null;
      }
      if (e.toStage === "APPROVAL" && e.fromStage !== "APPROVAL" && !enteredAt) enteredAt = e.createdAt;
    }
    if (enteredAt) total += now.getTime() - enteredAt.getTime();
    if (total > 0 || enteredAt) out.set(cardId, { total, enteredAt });
  }
  return out;
}

export function approvalBottleneck(cards: DashCard[], events: StageEvent[], p: Period, now: Date) {
  const times = approvalTimeByCard(events, now);
  const done = completedIn(cards, p).filter((c) => times.has(c.id));
  const waiting = cards.filter((c) => c.stage === "APPROVAL" && times.get(c.id)?.enteredAt);
  const oldest = waiting.reduce<number | null>((max, c) => {
    const ms = now.getTime() - times.get(c.id)!.enteredAt!.getTime();
    return max === null || ms > max ? ms : max;
  }, null);
  return { ...stats(done.map((c) => times.get(c.id)!.total)), waitingNow: waiting.length, oldestWaiting: oldest };
}

// ───────────────────────── 7. Retrabalho ─────────────────────────

/** % das concluídas no período que passaram por ALTERAÇÃO e média de ciclos entre elas (decisão F4-3A). */
export function rework(cards: DashCard[], events: StageEvent[], p: Period) {
  const done = completedIn(cards, p);
  const cycles = new Map<string, number>();
  for (const e of events) {
    if (e.toStage === "CHANGES" && e.fromStage !== "CHANGES") cycles.set(e.cardId, (cycles.get(e.cardId) ?? 0) + 1);
  }
  const reworked = done.filter((c) => (cycles.get(c.id) ?? 0) > 0);
  const totalCycles = reworked.reduce((n, c) => n + cycles.get(c.id)!, 0);
  return {
    completed: done.length,
    reworked: reworked.length,
    pct: done.length ? Math.round((reworked.length / done.length) * 1000) / 10 : null,
    avgCycles: reworked.length ? Math.round((totalCycles / reworked.length) * 10) / 10 : null,
  };
}

// ───────────────────────── Formatação ─────────────────────────

/** "2 d 5 h", "3 h 10 min", "45 min" (P41). */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} d${hours % 24 ? ` ${hours % 24} h` : ""}`;
}
