import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import type { Db } from "@/lib/db/client";
import { AppError } from "@/server/errors";
import * as approval from "./approval";
import * as cards from "./cards";
import * as comments from "./comments";
import { makeUser, seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

const NOW = new Date("2026-10-30T18:00:00Z");

describe.skipIf(!TEST_DATABASE_URL)("Observadores da tarefa (integração)", () => {
  let db: Db;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  beforeEach(async () => {
    db ??= testDb();
    s = await seedScenario(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const base = (extra: Record<string, unknown> = {}) => ({
    title: "Post", description: "", dueDate: null as string | null, requesterAreaId: s.area.id, ...extra,
  });
  const expectCode = async (p: Promise<unknown>, code: AppError["code"], msg?: RegExp) => {
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ code });
    if (msg) await expect(p).rejects.toThrow(msg);
  };
  const observersOf = async (cardId: string) =>
    (await db.cardObserver.findMany({ where: { cardId } })).map((o) => o.userId);
  const inboxTypes = async (userId: string) =>
    (await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })).map((n) => n.type);

  it("quem cria a tarefa inclui observadores; aparece no quadro e na tarefa", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base({ observerIds: [s.observer.id] }), NOW);
    expect(await observersOf(c.id)).toEqual([s.observer.id]);
    const view = await cards.getBoardView(db, s.member, s.board.id);
    expect(view.cards[0].observerCount).toBe(1);
    expect(view.observableUsers.map((u) => u.name)).toEqual(["Observador"]);
    const detail = await cards.getCardDetail(db, s.member, c.id);
    expect(detail.observers.map((o) => o.name)).toEqual(["Observador"]);
    expect(detail.permissions.canManageObservers).toBe(true);
  });

  it("só papel Observador com acesso ao quadro", async () => {
    await expectCode(cards.createCard(db, s.member, s.board.id, base({ observerIds: [s.member2.id] }), NOW), "INVALID", /Observador/);
    const outsiderObs = await makeUser(db, "OBSERVER", "ObsDeFora");
    await expectCode(cards.createCard(db, s.member, s.board.id, base({ observerIds: [outsiderObs.id] }), NOW), "INVALID");
  });

  it("outro Membro não inclui nem retira; Administrador sim; demais edições continuam liberadas", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
    await expectCode(cards.updateCard(db, s.member2, c.id, base({ observerIds: [s.observer.id] }), NOW), "FORBIDDEN", /observadores/);
    await cards.updateCard(db, s.member2, c.id, base({ title: "Novo título" }), NOW); // sem mexer em observadores
    await cards.updateCard(db, s.admin, c.id, base({ title: "Novo título", observerIds: [s.observer.id] }), NOW);
    expect(await observersOf(c.id)).toEqual([s.observer.id]);
    const ev = await db.cardEvent.findMany({ where: { cardId: c.id, type: "OBSERVERS_CHANGED" } });
    expect(ev).toHaveLength(1);
    await cards.updateCard(db, s.member, c.id, base({ title: "Novo título", observerIds: [] }), NOW);
    expect(await observersOf(c.id)).toEqual([]);
  });

  it("recebe os mesmos avisos dos responsáveis (comentário, aprovada, reprovada)", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base({ assigneeIds: [s.member2.id], observerIds: [s.observer.id] }), NOW);
    await comments.addComment(db, s.member2, c.id, { body: "Começando" }, NOW);
    await approval.requestApproval(db, s.member2, c.id, NOW);
    await approval.rejectCard(db, s.member, c.id, "Ajustar cores", NOW);
    await approval.requestApproval(db, s.member2, c.id, NOW);
    await approval.approveCard(db, s.member, c.id, NOW);
    expect(await inboxTypes(s.observer.id)).toEqual(["COMMENT_ADDED", "CARD_REJECTED", "CARD_APPROVED"]);
  });

  it("tarefa recorrente copia os observadores e os avisa", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base({
      dueDate: "2026-10-30", observerIds: [s.observer.id], recurrence: { frequency: "WEEKLY", endDate: null },
    }), NOW);
    await cards.moveCard(db, s.member, c.id, "DONE", NOW);
    const child = await db.card.findUniqueOrThrow({ where: { recurrenceParentId: c.id } });
    expect(await observersOf(child.id)).toEqual([s.observer.id]);
    expect(await inboxTypes(s.observer.id)).toEqual(["RECURRENCE_CREATED"]);
  });

  it("segurança no banco: só quem criou ou Administrador grava observadores pela API", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
    const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
    const as = async (userId: string, sql: string) => {
      const cl = await pool.connect();
      try {
        await cl.query("BEGIN");
        await cl.query("SET LOCAL ROLE authenticated");
        await cl.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
        return await cl.query(sql, [c.id, s.observer.id]);
      } finally {
        await cl.query("ROLLBACK");
        cl.release();
      }
    };
    const insert = "INSERT INTO card_observers (card_id, user_id) VALUES ($1, $2)";
    await expect(as(s.member2.id, insert)).rejects.toThrow(/row-level security/);
    await expect(as(s.observer.id, insert)).rejects.toThrow(/row-level security/);
    expect((await as(s.member.id, insert)).rowCount).toBe(1);
    await pool.end();
  });
});
