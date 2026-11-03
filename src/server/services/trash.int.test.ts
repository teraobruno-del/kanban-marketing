import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { AppError } from "@/server/errors";
import * as attachments from "./attachments";
import * as cards from "./cards";
import * as trash from "./trash";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

const NOW = new Date("2026-10-30T18:00:00Z");

describe.skipIf(!TEST_DATABASE_URL)("Lixeira e FINALIZADAS recentes (integração)", () => {
  let db: Db;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  beforeEach(async () => {
    db ??= testDb();
    s = await seedScenario(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  const base = (extra: Record<string, unknown> = {}) => ({ title: "Post", description: "", dueDate: null as string | null, requesterAreaId: s.area.id, ...extra });

  it("só Administrador vê, restaura e exclui definitivamente", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
    await cards.deleteCard(db, s.admin, c.id, NOW);
    await expect(trash.listTrash(db, s.member, s.board.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(trash.restoreCard(db, s.member, c.id, NOW)).rejects.toBeInstanceOf(AppError);
    const list = await trash.listTrash(db, s.admin, s.board.id);
    expect(list).toMatchObject([{ id: c.id, title: "Post", deletedBy: "Admin" }]);
  });

  it("restaurar devolve a tarefa à mesma etapa e ao quadro", async () => {
    const c = await cards.createCard(db, s.member, s.board.id, base({ dueDate: "2026-11-05" }), NOW);
    await cards.moveCard(db, s.member, c.id, "CHANGES", NOW);
    await cards.deleteCard(db, s.admin, c.id, NOW);
    expect((await cards.getBoardView(db, s.member, s.board.id, {}, { now: NOW })).cards).toHaveLength(0);
    await trash.restoreCard(db, s.admin, c.id, NOW);
    const view = await cards.getBoardView(db, s.member, s.board.id, {}, { now: NOW });
    expect(view.cards.map((x) => [x.id, x.stage])).toEqual([[c.id, "CHANGES"]]);
    expect(await db.cardEvent.count({ where: { cardId: c.id, type: "RESTORED" } })).toBe(1);
    await expect(trash.restoreCard(db, s.admin, c.id, NOW)).rejects.toMatchObject({ code: "INVALID" });
  });

  it("excluir definitivamente apaga tarefa e arquivos; série recorrente continua", async () => {
    const files = new Map<string, number>();
    const storage: attachments.StoragePort = {
      async createUploadUrl() { return { token: "t", signedUrl: "u" }; },
      async getObjectSize(p) { return files.get(p) ?? null; },
      async createDownloadUrls() { return {}; },
      async remove(paths) { for (const p of paths) files.delete(p); },
    };
    const c = await cards.createCard(db, s.member, s.board.id, base({ dueDate: "2026-10-30", recurrence: { frequency: "WEEKLY", endDate: null } }), NOW);
    const prep = await attachments.prepareUpload(db, storage, s.member, c.id, { name: "a.png", size: 10 });
    files.set(prep.path, 10);
    await attachments.confirmUpload(db, storage, s.member, c.id, { path: prep.path, name: "a.png", mimeType: "image/png" }, NOW);
    await cards.moveCard(db, s.member, c.id, "DONE", NOW);
    const child = await db.card.findUniqueOrThrow({ where: { recurrenceParentId: c.id } });
    await expect(trash.purgeCard(db, storage, s.admin, c.id)).rejects.toMatchObject({ code: "INVALID" }); // precisa estar na lixeira
    await cards.deleteCard(db, s.admin, c.id, NOW);
    await trash.purgeCard(db, storage, s.admin, c.id);
    expect(await db.card.count({ where: { id: c.id } })).toBe(0);
    expect(files.size).toBe(0);
    expect(await db.card.findUnique({ where: { id: child.id } })).not.toBeNull();
  });

  it("FINALIZADAS: só as dos últimos 30 dias; as antigas contadas à parte", async () => {
    const old = await cards.createCard(db, s.member, s.board.id, base({ title: "antiga" }), new Date("2026-08-01T12:00:00Z"));
    await cards.moveCard(db, s.member, old.id, "DONE", new Date("2026-09-01T12:00:00Z")); // 59 dias antes
    const recent = await cards.createCard(db, s.member, s.board.id, base({ title: "recente" }), NOW);
    await cards.moveCard(db, s.member, recent.id, "DONE", new Date("2026-10-15T12:00:00Z"));
    await cards.createCard(db, s.member, s.board.id, base({ title: "aberta" }), NOW);
    let view = await cards.getBoardView(db, s.member, s.board.id, {}, { now: NOW });
    expect(view.cards.map((c) => c.title).sort()).toEqual(["aberta", "recente"]);
    expect(view.olderDoneCount).toBe(1);
    view = await cards.getBoardView(db, s.member, s.board.id, {}, { now: NOW, allDone: true });
    expect(view.cards).toHaveLength(3);
    expect(view.showingAllDone).toBe(true);
  });
});
