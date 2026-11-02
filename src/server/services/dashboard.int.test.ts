import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { AppError } from "@/server/errors";
import * as approval from "./approval";
import * as boards from "./boards";
import * as cards from "./cards";
import { getDashboard } from "./dashboard";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

const T0 = new Date("2026-10-05T15:00:00Z"); // segunda, 12h em SP
const T1 = new Date("2026-10-06T15:00:00Z");
const T2 = new Date("2026-10-07T15:00:00Z");
const T3 = new Date("2026-10-08T15:00:00Z");
const NOW = new Date("2026-10-20T15:00:00Z");
const OCT = { period: "month" };

describe.skipIf(!TEST_DATABASE_URL)("Dashboard (integração)", () => {
  let db: Db;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  beforeEach(async () => {
    db ??= testDb();
    s = await seedScenario(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const mk = (title: string, extra: Partial<Parameters<typeof cards.createCard>[3]> = {}, at = T0, boardId = s.board.id, areaId = s.area.id) =>
    cards.createCard(db, s.member, boardId, { title, description: "", dueDate: null, requesterAreaId: areaId, ...extra }, at);

  it("só Administrador vê", async () => {
    await expect(getDashboard(db, s.member, OCT, NOW)).rejects.toBeInstanceOf(AppError);
    await expect(getDashboard(db, s.observer, OCT, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fluxo real: aprovação reprovada uma vez, depois aprovada → gargalo, retrabalho, prazo e tempo de entrega", async () => {
    const c = await mk("Post", { dueDate: "2026-10-10", assigneeIds: [s.member2.id] });
    await approval.requestApproval(db, s.member2, c.id, T0);
    await approval.rejectCard(db, s.member, c.id, "Ajustar", T1); // 1 dia em aprovação
    await approval.requestApproval(db, s.member2, c.id, T2);
    await approval.approveCard(db, s.member, c.id, T3); // + 1 dia
    const d = await getDashboard(db, s.admin, OCT, NOW);
    expect(d.completedCount).toBe(1);
    expect(d.onTime).toMatchObject({ considered: 1, onTime: 1, pct: 100 });
    expect(d.approval).toMatchObject({ count: 1, mean: 2 * 86_400_000 });
    expect(d.rework).toEqual({ completed: 1, reworked: 1, pct: 100, avgCycles: 1 });
    expect(d.leadTime.median).toBe(3 * 86_400_000);
  });

  it("filtros: quadro, área juntada pelo nome; arquivado entra; lixeira fica fora", async () => {
    const otherRh = await db.requesterArea.findFirstOrThrow({ where: { boardId: s.otherBoard.id } }); // também "RH"
    const diretoria = await db.requesterArea.create({ data: { boardId: s.board.id, name: "Diretoria", color: "#2563EB" } });
    await mk("a");
    await mk("b", {}, T0, s.board.id, diretoria.id);
    await cards.createCard(db, s.outsider, s.otherBoard.id, { title: "c", description: "", dueDate: null, requesterAreaId: otherRh.id }, T0);
    const gone = await mk("lixo");
    await cards.deleteCard(db, s.admin, gone.id, T0);
    await boards.setBoardArchived(db, s.admin, s.otherBoard.id, true);

    let d = await getDashboard(db, s.admin, OCT, NOW);
    expect(d.createdCount).toBe(3);
    expect(d.areas).toEqual([{ name: "RH", count: 2 }, { name: "Diretoria", count: 1 }]);
    expect(d.filters.boardOptions.find((b) => b.id === s.otherBoard.id)?.archived).toBe(true);
    expect(d.filters.areaOptions).toEqual(["Diretoria", "RH"]);

    d = await getDashboard(db, s.admin, { ...OCT, boards: [s.board.id] }, NOW);
    expect(d.createdCount).toBe(2);
    d = await getDashboard(db, s.admin, { ...OCT, area: "rh" }, NOW);
    expect(d.createdCount).toBe(2);
  });

  it("carga por pessoa com nomes; atrasadas agora; período e agrupamento", async () => {
    await mk("x", { dueDate: "2026-10-15", assigneeIds: [s.member.id] });
    await mk("y", { dueDate: "2026-10-25" });
    const d = await getDashboard(db, s.admin, { period: "custom", from: "2026-10-01", to: "2026-12-31" }, NOW);
    expect(d.filters.period).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(d.filters.granularity).toBe("month");
    expect(d.overdueNow).toBe(1);
    expect(d.workload.map((w) => w.name)).toEqual(expect.arrayContaining(["Membro", "Sem responsável"]));
    const bad = await getDashboard(db, s.admin, { period: "custom", from: "lixo" }, NOW);
    expect(bad.filters.preset).toBe("month");
  });
});
