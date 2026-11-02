import type { Db } from "@/lib/db/client";
import { canManage, type Actor } from "@/lib/auth/permissions";
import { dateOnlyFromDb, isDateOnly, todayInSaoPaulo, type DateOnly } from "@/lib/dates/day";
import {
  approvalBottleneck, areaKey, areas, autoGranularity, completedIn, leadTime, onTime, overdueNow, presetPeriod,
  rework, UNASSIGNED, volume, workload, type DashCard, type Granularity, type Period, type PeriodPreset, type StageEvent,
} from "@/lib/dashboard/metrics";
import { forbidden } from "@/server/errors";

/** Filtros vindos da tela (endereço da página). Valores inválidos voltam ao padrão. */
export interface DashboardFilters {
  boards?: string[]; // vazio = todos
  period?: string; // "month" | "quarter" | "year" | "custom"
  from?: string;
  to?: string;
  area?: string; // nome da área (juntado entre quadros)
  group?: string; // "week" | "month"
}

export function resolveFilters(f: DashboardFilters, today: DateOnly) {
  const requested = (["month", "quarter", "year", "custom"] as const).find((p) => p === f.period) ?? "month";
  const customOk = requested === "custom" && !!f.from && !!f.to && isDateOnly(f.from) && isDateOnly(f.to);
  const preset = requested === "custom" && !customOk ? "month" : requested;
  const period: Period = customOk
    ? (f.from! <= f.to! ? { from: f.from!, to: f.to! } : { from: f.to!, to: f.from! })
    : presetPeriod(preset as PeriodPreset, today);
  const granularity: Granularity = f.group === "week" || f.group === "month" ? f.group : autoGranularity(period);
  return {
    preset,
    period,
    granularity,
    autoGranularity: autoGranularity(period),
    boardIds: (f.boards ?? []).filter(Boolean),
    area: f.area?.trim() || null,
  };
}

/** Dados do Dashboard (SPEC §8) — só Administrador. */
export async function getDashboard(db: Db, actor: Actor, filters: DashboardFilters, now = new Date()) {
  if (!canManage(actor)) throw forbidden("Só o Administrador vê o Dashboard.");
  const today = todayInSaoPaulo(now);
  const f = resolveFilters(filters, today);

  // Quadros: todos, inclusive arquivados (decisão F4-2A)
  const allBoards = await db.board.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, archivedAt: true } });
  const selected = f.boardIds.filter((id) => allBoards.some((b) => b.id === id));
  const boardIds = selected.length ? selected : allBoards.map((b) => b.id);

  const areaRows = await db.requesterArea.findMany({ where: { boardId: { in: boardIds } }, select: { name: true } });
  const areaOptions = [...new Map(areaRows.map((a) => [areaKey(a.name), a.name.trim()])).values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const rows = await db.card.findMany({
    where: { boardId: { in: boardIds }, deletedAt: null }, // lixeira fora (P37)
    select: {
      id: true, createdAt: true, completedAt: true, completedOnTime: true, stage: true, dueDate: true,
      requesterArea: { select: { name: true } },
      assignees: { select: { userId: true } },
    },
  });
  const cards: DashCard[] = rows
    .filter((c) => !f.area || areaKey(c.requesterArea.name) === areaKey(f.area))
    .map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      completedAt: c.completedAt,
      completedOnTime: c.completedOnTime,
      stage: c.stage,
      dueDate: c.dueDate ? dateOnlyFromDb(c.dueDate) : null,
      areaName: c.requesterArea.name,
      assigneeIds: c.assignees.map((a) => a.userId),
    }));

  // Mudanças de etapa só das tarefas que importam para gargalo/retrabalho
  const relevantIds = [...new Set([...completedIn(cards, f.period), ...cards.filter((c) => c.stage === "APPROVAL")].map((c) => c.id))];
  const eventRows = relevantIds.length
    ? await db.cardEvent.findMany({
        where: { cardId: { in: relevantIds }, OR: [{ fromStage: { not: null } }, { toStage: { not: null } }] },
        select: { cardId: true, createdAt: true, fromStage: true, toStage: true },
      })
    : [];
  const events: StageEvent[] = eventRows;

  const load = workload(cards, today);
  const people = await db.user.findMany({
    where: { id: { in: load.map((r) => r.userId).filter((id) => id !== UNASSIGNED) } },
    select: { id: true, name: true },
  });
  const names = new Map(people.map((p) => [p.id, p.name]));

  return {
    filters: {
      ...f,
      boardIds: selected,
      boardOptions: allBoards.map((b) => ({ id: b.id, name: b.name, archived: b.archivedAt !== null })),
      areaOptions,
    },
    today,
    volume: volume(cards, f.period, f.granularity),
    onTime: onTime(cards, f.period),
    overdueNow: overdueNow(cards, today),
    completedCount: completedIn(cards, f.period).length,
    createdCount: cards.filter((c) => {
      const d = todayInSaoPaulo(c.createdAt);
      return d >= f.period.from && d <= f.period.to;
    }).length,
    workload: load.map((r) => ({ ...r, name: r.userId === UNASSIGNED ? "Sem responsável" : (names.get(r.userId) ?? "—") })),
    areas: areas(cards, f.period),
    leadTime: leadTime(cards, f.period),
    approval: approvalBottleneck(cards, events, f.period, now),
    rework: rework(cards, events, f.period),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
