import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { dateOnlyFromDb } from "@/lib/dates/day";
import { AppError } from "@/server/errors";
import * as approval from "./approval";
import * as cards from "./cards";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

// Sexta-feira, 30/10/2026, 15h em São Paulo
const NOW = new Date("2026-10-30T18:00:00Z");
const LATER = new Date("2026-11-30T18:00:00Z");

describe.skipIf(!TEST_DATABASE_URL)("F2 — automações (integração)", () => {
  let db: Db;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  beforeEach(async () => {
    db ??= testDb();
    s = await seedScenario(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const base = () => ({ title: "Relatório", description: "", dueDate: null as string | null, requesterAreaId: s.area.id });
  const expectCode = async (p: Promise<unknown>, code: AppError["code"], msg?: RegExp) => {
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ code });
    if (msg) await expect(p).rejects.toThrow(msg);
  };
  const get = (id: string) => db.card.findUniqueOrThrow({ where: { id } });
  const due = async (id: string) => {
    const c = await get(id);
    return c.dueDate ? dateOnlyFromDb(c.dueDate) : null;
  };
  const childOf = (id: string) => db.card.findUnique({ where: { recurrenceParentId: id } });

  describe("Janela de data ao arrastar", () => {
    it("quem criou define a data; NOVAS → prazo; eventos registrados", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await cards.moveWithDueDate(db, s.member, c.id, "2026-10-30", NOW);
      expect(await get(c.id)).toMatchObject({ stage: "ACTIVE" });
      expect(await due(c.id)).toBe("2026-10-30");
      const types = (await db.cardEvent.findMany({ where: { cardId: c.id } })).map((e) => e.type);
      expect(types).toEqual(expect.arrayContaining(["DUE_DATE_CHANGED", "STAGE_CHANGED"]));
    });

    it("outro Membro não muda o prazo; data no passado é recusada", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(cards.moveWithDueDate(db, s.member2, c.id, "2026-11-02", NOW), "FORBIDDEN");
      await expectCode(cards.moveWithDueDate(db, s.member, c.id, "2026-10-29", NOW), "INVALID", /a partir de hoje/);
      await cards.moveWithDueDate(db, s.admin, c.id, "2026-11-02", NOW);
      expect(await due(c.id)).toBe("2026-11-02");
    });

    it("tarefa finalizada arrastada para coluna de prazo é reaberta", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-10-30" }, NOW);
      await cards.moveCard(db, s.member, c.id, "DONE", NOW);
      await cards.moveWithDueDate(db, s.member, c.id, "2026-11-10", NOW);
      expect(await get(c.id)).toMatchObject({ stage: "ACTIVE", completedAt: null, completedOnTime: null });
      expect((await db.cardEvent.findMany({ where: { cardId: c.id, type: "REOPENED" } })).length).toBe(1);
    });

    it("tarefa em APROVAÇÃO não sai pela janela de data", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await approval.requestApproval(db, s.member, c.id, NOW);
      await expectCode(cards.moveWithDueDate(db, s.member, c.id, "2026-11-02", NOW), "INVALID");
    });
  });

  describe("Checklist ao finalizar (P23)", () => {
    async function withChecklist(stage?: "APPROVAL") {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await cards.addChecklist(db, s.member, c.id, { title: "Etapas" });
      const cl = await db.checklist.findFirstOrThrow({ where: { cardId: c.id } });
      for (const t of ["a", "b", "c"]) await cards.addChecklistItem(db, s.member, cl.id, { text: t });
      const first = await db.checklistItem.findFirstOrThrow({ where: { checklistId: cl.id, text: "a" } });
      await cards.toggleChecklistItem(db, s.member, first.id, true, NOW);
      if (stage) await approval.requestApproval(db, s.member2, c.id, NOW);
      return c;
    }

    it("sem confirmação, não finaliza e diz quantos itens faltam", async () => {
      const c = await withChecklist();
      await expectCode(cards.moveCard(db, s.member, c.id, "DONE", NOW), "INVALID", /2 itens pendentes/);
      expect((await get(c.id)).stage).toBe("NEW");
    });

    it("com confirmação, marca todos e finaliza", async () => {
      const c = await withChecklist();
      await cards.moveCard(db, s.member, c.id, "DONE", NOW, { completeChecklist: true });
      expect((await get(c.id)).stage).toBe("DONE");
      expect(await db.checklistItem.count({ where: { isDone: false, checklist: { cardId: c.id } } })).toBe(0);
      const ev = await db.cardEvent.findFirstOrThrow({ where: { cardId: c.id, type: "CHECKLIST_CHANGED", data: { path: ["action"], equals: "all_completed" } } });
      expect(ev.data).toMatchObject({ count: 2 });
    });

    it("vale também para Aprovar", async () => {
      const c = await withChecklist("APPROVAL");
      await expectCode(approval.approveCard(db, s.member, c.id, NOW), "INVALID", /pendentes/);
      await approval.approveCard(db, s.member, c.id, NOW, { completeChecklist: true });
      expect((await get(c.id)).stage).toBe("DONE");
    });
  });

  describe("Recorrência (SPEC §6.C)", () => {
    async function monthly31() {
      const c = await cards.createCard(db, s.member, s.board.id, {
        ...base(), dueDate: "2026-10-31", labelIds: [s.label.id], assigneeIds: [s.member2.id],
        recurrence: { frequency: "MONTHLY", endDate: null },
      }, NOW);
      await cards.addChecklist(db, s.member, c.id, { title: "Passos" });
      const cl = await db.checklist.findFirstOrThrow({ where: { cardId: c.id } });
      await cards.addChecklistItem(db, s.member, cl.id, { text: "Coletar dados" });
      return c;
    }

    it("mensal 31/10 → 30/11 → 31/12 (guarda o dia original)", async () => {
      const c = await monthly31();
      expect(await get(c.id)).toMatchObject({ isRecurring: true, recurrenceFrequency: "MONTHLY", recurrenceAnchorDay: 31 });
      await cards.moveCard(db, s.member, c.id, "DONE", NOW, { completeChecklist: true });
      const child = await childOf(c.id);
      expect(child).not.toBeNull();
      expect(await due(child!.id)).toBe("2026-11-30");
      expect(child).toMatchObject({ stage: "ACTIVE", createdById: s.member.id, recurrenceAnchorDay: 31, isRecurring: true });
      await cards.moveCard(db, s.member2, child!.id, "DONE", LATER, { completeChecklist: true });
      const grandchild = await childOf(child!.id);
      expect(await due(grandchild!.id)).toBe("2026-12-31");
    });

    it("copia etiquetas, responsáveis e checklist desmarcada; não copia o histórico", async () => {
      const c = await monthly31();
      await cards.moveCard(db, s.member, c.id, "DONE", NOW, { completeChecklist: true });
      const child = (await childOf(c.id))!;
      expect(await db.cardLabel.count({ where: { cardId: child.id } })).toBe(1);
      expect((await db.cardAssignee.findMany({ where: { cardId: child.id } })).map((a) => a.userId)).toEqual([s.member2.id]);
      const items = await db.checklistItem.findMany({ where: { checklist: { cardId: child.id } } });
      expect(items.map((i) => [i.text, i.isDone])).toEqual([["Coletar dados", false]]);
      expect((await db.cardEvent.findMany({ where: { cardId: child.id } })).map((e) => e.type)).toEqual(["CREATED"]);
      const spawned = await db.cardEvent.findFirstOrThrow({ where: { cardId: c.id, type: "RECURRENCE_SPAWNED" } });
      expect(spawned.data).toMatchObject({ childId: child.id, dueDate: "2026-11-30" });
    });

    it("avisa os responsáveis (menos quem finalizou)", async () => {
      const c = await monthly31();
      await cards.moveCard(db, s.member, c.id, "DONE", NOW, { completeChecklist: true });
      const n = await db.notification.findMany({ where: { type: "RECURRENCE_CREATED" } });
      expect(n.map((x) => x.userId)).toEqual([s.member2.id]);
    });

    it("idempotente: reabrir e finalizar de novo não cria outra (P26)", async () => {
      const c = await monthly31();
      await cards.moveCard(db, s.member, c.id, "DONE", NOW, { completeChecklist: true });
      await cards.moveCard(db, s.member, c.id, "CHANGES", NOW);
      await cards.moveCard(db, s.member, c.id, "DONE", NOW);
      expect(await db.card.count({ where: { recurrenceParentId: c.id } })).toBe(1);
      expect(await db.card.count()).toBe(2);
    });

    it("respeita a data final e pula ciclos do passado", async () => {
      const w = await cards.createCard(db, s.member, s.board.id, {
        ...base(), dueDate: "2026-11-02", recurrence: { frequency: "WEEKLY", endDate: "2026-11-05" },
      }, NOW);
      await cards.moveCard(db, s.member, w.id, "DONE", NOW);
      expect(await childOf(w.id)).toBeNull();

      const d = await cards.createCard(db, s.admin, s.board.id, {
        ...base(), dueDate: "2026-10-01", recurrence: { frequency: "DAILY", endDate: null },
      }, NOW);
      await cards.moveCard(db, s.admin, d.id, "DONE", NOW);
      expect(await due((await childOf(d.id))!.id)).toBe("2026-10-30"); // hoje é aceito
    });

    it("aprovar também gera a próxima", async () => {
      const c = await monthly31();
      await approval.requestApproval(db, s.member2, c.id, NOW);
      await approval.approveCard(db, s.member, c.id, NOW, { completeChecklist: true });
      expect(await childOf(c.id)).not.toBeNull();
    });

    it("só quem pode mudar o prazo liga ou muda a repetição", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-11-10" }, NOW);
      const rec = { ...base(), dueDate: "2026-11-10", recurrence: { frequency: "WEEKLY" as const, endDate: null } };
      await expectCode(cards.updateCard(db, s.member2, c.id, rec, NOW), "FORBIDDEN", /repetição/);
      await cards.updateCard(db, s.member, c.id, rec, NOW);
      expect(await get(c.id)).toMatchObject({ isRecurring: true, recurrenceFrequency: "WEEKLY" });
      // Outro Membro pode editar o título sem mexer na repetição
      await cards.updateCard(db, s.member2, c.id, { ...rec, title: "Novo título" }, NOW);
      // Desligar vale dali em diante (P27)
      await cards.updateCard(db, s.member, c.id, { ...base(), dueDate: "2026-11-10" }, NOW);
      expect(await get(c.id)).toMatchObject({ isRecurring: false, recurrenceFrequency: null });
    });

    it("mudar o prazo de uma mensal redefine o dia original", async () => {
      const c = await monthly31();
      await cards.updateCard(db, s.member, c.id, {
        ...base(), dueDate: "2026-11-15", labelIds: [s.label.id], assigneeIds: [s.member2.id],
        recurrence: { frequency: "MONTHLY", endDate: null },
      }, NOW);
      expect((await get(c.id)).recurrenceAnchorDay).toBe(15);
    });

    it("tarefa na lixeira nunca gera a próxima (P29)", async () => {
      const c = await monthly31();
      await cards.deleteCard(db, s.admin, c.id, NOW);
      await expectCode(cards.moveCard(db, s.admin, c.id, "DONE", NOW, { completeChecklist: true }), "NOT_FOUND");
      expect(await childOf(c.id)).toBeNull();
    });
  });
});
