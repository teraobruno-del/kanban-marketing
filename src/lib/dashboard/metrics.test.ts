import { describe, expect, it } from "vitest";
import {
  approvalBottleneck, areas, autoGranularity, formatDuration, leadTime, onTime, overdueNow, presetPeriod, rework,
  UNASSIGNED, volume, workload, type DashCard, type StageEvent,
} from "./metrics";

const H = 3_600_000;
const D = 24 * H;
let n = 0;
const card = (p: Partial<DashCard> = {}): DashCard => ({
  id: `c${++n}`, createdAt: new Date("2026-10-05T15:00:00Z"), completedAt: null, completedOnTime: null,
  stage: "ACTIVE", dueDate: null, areaName: "RH", assigneeIds: [], ...p,
});
const done = (createdAt: string, completedAt: string, extra: Partial<DashCard> = {}) =>
  card({ stage: "DONE", createdAt: new Date(createdAt), completedAt: new Date(completedAt), ...extra });
const ev = (cardId: string, at: string, fromStage: DashCard["stage"] | null, toStage: DashCard["stage"]): StageEvent =>
  ({ cardId, createdAt: new Date(at), fromStage, toStage });

const OCT = presetPeriod("month", "2026-10-15");

describe("Períodos", () => {
  it("mês, trimestre e ano (inclusive fevereiro de ano bissexto)", () => {
    expect(OCT).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetPeriod("quarter", "2026-11-02")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(presetPeriod("year", "2026-03-10")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(presetPeriod("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("agrupamento automático: mês → semanas; trimestre/ano → meses", () => {
    expect(autoGranularity(OCT)).toBe("week");
    expect(autoGranularity(presetPeriod("quarter", "2026-10-15"))).toBe("month");
  });
});

describe("1. Volume", () => {
  it("semanas começam na segunda; data de São Paulo (23h30 do dia 31 conta em outubro)", () => {
    const cards = [
      card({ createdAt: new Date("2026-10-01T12:00:00Z") }), // qui → semana de 28/09
      card({ createdAt: new Date("2026-10-05T12:00:00Z") }), // seg → semana de 05/10
      done("2026-10-02T12:00:00Z", "2026-11-01T02:30:00Z"), // conclusão 31/10 23h30 em SP
      card({ createdAt: new Date("2026-11-01T03:30:00Z") }), // já é 01/11 em SP → fora
    ];
    const b = volume(cards, OCT, "week");
    expect(b.map((x) => x.label)).toEqual(["28/09", "05/10", "12/10", "19/10", "26/10"]);
    expect(b[0]).toMatchObject({ created: 2, completed: 0 });
    expect(b[1]).toMatchObject({ created: 1 });
    expect(b[4]).toMatchObject({ completed: 1 });
  });
  it("por mês atravessando a virada do ano", () => {
    const p = { from: "2026-11-15", to: "2027-01-20" };
    const b = volume([card({ createdAt: new Date("2027-01-02T12:00:00Z") })], p, "month");
    expect(b.map((x) => x.label)).toEqual(["nov/26", "dez/26", "jan/27"]);
    expect(b[2].created).toBe(1);
  });
});

describe("2. Entregas no prazo", () => {
  it("% só entre concluídas no período com prazo; atrasadas agora inclui aprovação/alteração", () => {
    const cards = [
      done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z", { completedOnTime: true }),
      done("2026-10-01T12:00:00Z", "2026-10-11T12:00:00Z", { completedOnTime: true }),
      done("2026-10-01T12:00:00Z", "2026-10-12T12:00:00Z", { completedOnTime: false }),
      done("2026-10-01T12:00:00Z", "2026-10-12T12:00:00Z", { completedOnTime: null }), // sem prazo
      done("2026-09-01T12:00:00Z", "2026-09-12T12:00:00Z", { completedOnTime: false }), // fora do período
      card({ stage: "APPROVAL", dueDate: "2026-10-30" }),
      card({ stage: "ACTIVE", dueDate: "2026-11-05" }),
    ];
    expect(onTime(cards, OCT)).toEqual({ considered: 3, onTime: 2, late: 1, pct: 66.7 });
    expect(overdueNow(cards, "2026-11-02")).toBe(1);
    expect(onTime([], OCT).pct).toBeNull();
  });
});

describe("3. Carga por pessoa", () => {
  it("conta para cada responsável, por coluna; sem responsável aparece; NOVAS e FINALIZADAS ficam fora", () => {
    const today = "2026-11-02"; // segunda
    const cards = [
      card({ dueDate: "2026-11-01", assigneeIds: ["ana", "bia"] }), // atrasada
      card({ dueDate: "2026-11-02", assigneeIds: ["ana"] }), // hoje
      card({ dueDate: "2026-11-20", assigneeIds: [] }), // próximos
      card({ stage: "APPROVAL", assigneeIds: ["bia"] }),
      card({ stage: "NEW", assigneeIds: ["ana"] }),
      card({ stage: "DONE", assigneeIds: ["ana"] }),
    ];
    const w = workload(cards, today);
    expect(w.find((r) => r.userId === "ana")).toMatchObject({ total: 2, counts: { OVERDUE: 1, TODAY: 1 } });
    expect(w.find((r) => r.userId === "bia")).toMatchObject({ total: 2, counts: { OVERDUE: 1, APPROVAL: 1 } });
    expect(w.find((r) => r.userId === UNASSIGNED)).toMatchObject({ total: 1, counts: { UPCOMING: 1 } });
  });
});

describe("4. Áreas demandantes", () => {
  it("junta pelo nome, sem diferenciar maiúsculas; ordena da maior para a menor", () => {
    const cards = [card({ areaName: "RH" }), card({ areaName: "rh " }), card({ areaName: "Diretoria" }),
      card({ areaName: "Parque", createdAt: new Date("2026-09-01T12:00:00Z") })];
    expect(areas(cards, OCT)).toEqual([{ name: "RH", count: 2 }, { name: "Diretoria", count: 1 }]);
  });
});

describe("5. Tempo de entrega", () => {
  it("média e mediana entre criação e conclusão", () => {
    const cards = [
      done("2026-10-01T12:00:00Z", "2026-10-02T12:00:00Z"), // 1 d
      done("2026-10-01T12:00:00Z", "2026-10-04T12:00:00Z"), // 3 d
      done("2026-10-01T12:00:00Z", "2026-10-11T12:00:00Z"), // 10 d
    ];
    expect(leadTime(cards, OCT)).toEqual({ count: 3, mean: (14 * D) / 3, median: 3 * D });
    expect(leadTime(cards.slice(0, 2), OCT).median).toBe(2 * D); // par: média dos dois do meio
  });
});

describe("6. Gargalo de aprovação", () => {
  it("soma todas as passagens; mostra quantas aguardam agora e há quanto tempo", () => {
    const a = done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z");
    const b = card({ stage: "APPROVAL" });
    const events = [
      ev(a.id, "2026-10-02T12:00:00Z", "ACTIVE", "APPROVAL"),
      ev(a.id, "2026-10-03T12:00:00Z", "APPROVAL", "CHANGES"), // 1 d
      ev(a.id, "2026-10-05T12:00:00Z", "CHANGES", "APPROVAL"),
      ev(a.id, "2026-10-05T18:00:00Z", "APPROVAL", "DONE"), // + 6 h
      ev(b.id, "2026-11-01T12:00:00Z", "ACTIVE", "APPROVAL"),
    ];
    const r = approvalBottleneck([a, b], events, OCT, new Date("2026-11-02T12:00:00Z"));
    expect(r).toMatchObject({ count: 1, mean: D + 6 * H, waitingNow: 1, oldestWaiting: D });
  });
});

describe("7. Retrabalho", () => {
  it("% que passou por ALTERAÇÃO e média de ciclos só entre as que tiveram retrabalho", () => {
    const a = done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z");
    const b = done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z");
    const c = done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z");
    const d = done("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z");
    const events = [
      ev(a.id, "2026-10-02T12:00:00Z", "APPROVAL", "CHANGES"),
      ev(a.id, "2026-10-04T12:00:00Z", "APPROVAL", "CHANGES"),
      ev(b.id, "2026-10-03T12:00:00Z", "APPROVAL", "CHANGES"),
    ];
    expect(rework([a, b, c, d], events, OCT)).toEqual({ completed: 4, reworked: 2, pct: 50, avgCycles: 1.5 });
  });
});

describe("Formatação de tempo", () => {
  it("dias e horas", () => {
    expect(formatDuration(2 * D + 5 * H)).toBe("2 d 5 h");
    expect(formatDuration(3 * D)).toBe("3 d");
    expect(formatDuration(3 * H + 10 * 60_000)).toBe("3 h 10 min");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(null)).toBe("—");
  });
});
