import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { AppError } from "@/server/errors";
import * as approval from "./approval";
import * as attachments from "./attachments";
import * as boards from "./boards";
import * as cards from "./cards";
import * as comments from "./comments";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

const NOW = new Date("2026-10-30T18:00:00Z");
const MB = 1024 * 1024;

/** Armazenamento de mentirinha: guarda só o tamanho de cada arquivo "enviado". */
function fakeStorage() {
  const files = new Map<string, number>();
  const port: attachments.StoragePort = {
    async createUploadUrl(path) { return { token: "tok", signedUrl: `https://fake/upload/${path}` }; },
    async getObjectSize(path) { return files.get(path) ?? null; },
    async createDownloadUrls(paths) { return Object.fromEntries(paths.map((p) => [p, `https://fake/dl/${p}`])); },
    async remove(paths) { for (const p of paths) files.delete(p); },
  };
  return { port, files };
}

describe.skipIf(!TEST_DATABASE_URL)("F3 — colaboração (integração)", () => {
  let db: Db;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  beforeEach(async () => {
    db ??= testDb();
    s = await seedScenario(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const base = () => ({ title: "Post", description: "", dueDate: null as string | null, requesterAreaId: s.area.id });
  const expectCode = async (p: Promise<unknown>, code: AppError["code"], msg?: RegExp) => {
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ code });
    if (msg) await expect(p).rejects.toThrow(msg);
  };
  const inbox = (userId: string) => db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

  describe("Comentários", () => {
    it("Observador comenta; quem não tem acesso não", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await comments.addComment(db, s.observer, c.id, { body: "Ficou ótimo!" }, NOW);
      await expectCode(comments.addComment(db, s.outsider, c.id, { body: "oi" }, NOW), "NOT_FOUND");
      await expectCode(comments.addComment(db, s.member, c.id, { body: "   " }, NOW), "INVALID");
      const list = await comments.listComments(db, c.id);
      expect(list[0]).toMatchObject({ body: "Ficou ótimo!", author: { name: "Observador" }, kind: "COMMENT" });
      expect((await db.cardEvent.findMany({ where: { cardId: c.id, type: "COMMENTED" } })).length).toBe(1);
    });

    it("avisa mencionados, responsáveis e criador — nunca quem comentou", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), assigneeIds: [s.member2.id] }, NOW);
      await comments.addComment(db, s.member2, c.id, { body: "@Observador e @Admin, vejam", mentionIds: [s.observer.id, s.admin.id] }, NOW);
      expect((await inbox(s.observer.id)).map((n) => n.type)).toEqual(["COMMENT_MENTION"]);
      expect((await inbox(s.admin.id)).map((n) => n.type)).toEqual(["COMMENT_MENTION"]);
      expect((await inbox(s.member.id)).map((n) => n.type)).toEqual(["COMMENT_ADDED"]); // criador
      expect(await inbox(s.member2.id)).toHaveLength(0); // quem comentou
    });

    it("menção só vale para quem tem acesso ao quadro e está no texto", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await comments.addComment(db, s.member, c.id, { body: "@Forasteiro @Membro2", mentionIds: [s.outsider.id, s.member2.id, s.observer.id] }, NOW);
      const [cm] = await comments.listComments(db, c.id);
      expect(cm.mentions.map((m) => m.name)).toEqual(["Membro2"]);
      expect(await inbox(s.outsider.id)).toHaveLength(0);
    });

    it("editar só o próprio; excluir o próprio ou Administrador", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      const { id } = await comments.addComment(db, s.member2, c.id, { body: "Primeira versão" }, NOW);
      await expectCode(comments.editComment(db, s.admin, id, { body: "hack" }, NOW), "FORBIDDEN");
      await comments.editComment(db, s.member2, id, { body: "Versão corrigida" }, NOW);
      await expectCode(comments.deleteComment(db, s.member, id, NOW), "FORBIDDEN");
      let [cm] = await comments.listComments(db, c.id);
      expect(cm).toMatchObject({ body: "Versão corrigida", edited: true, deleted: false });
      await comments.deleteComment(db, s.admin, id, NOW);
      [cm] = await comments.listComments(db, c.id);
      expect(cm).toMatchObject({ body: "", deleted: true });
      await expectCode(comments.editComment(db, s.member2, id, { body: "volta" }, NOW), "NOT_FOUND");
    });

    it("reprovação vira comentário destacado na conversa (5A)", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await approval.requestApproval(db, s.member2, c.id, NOW);
      await approval.rejectCard(db, s.member, c.id, "Ajustar o título", NOW);
      const [cm] = await comments.listComments(db, c.id);
      expect(cm).toMatchObject({ kind: "REJECTION", body: "Ajustar o título", author: { name: "Membro" } });
    });

    it("tarefa mostra contagem de comentários (sem os excluídos)", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await comments.addComment(db, s.member, c.id, { body: "a" }, NOW);
      const { id } = await comments.addComment(db, s.member, c.id, { body: "b" }, NOW);
      await comments.deleteComment(db, s.member, id, NOW);
      const view = await cards.getBoardView(db, s.member, s.board.id);
      expect(view.cards[0].commentCount).toBe(1);
      expect(view.mentionableUsers.map((u) => u.name)).toEqual(["Admin", "Membro", "Membro2", "Observador"]);
    });
  });

  describe("Anexos", () => {
    async function upload(actor = s.member, name = "foto.png", size = 2 * MB, mimeType = "image/png", cardId?: string) {
      const st = storage;
      const id = cardId ?? (await cards.createCard(db, s.member, s.board.id, base(), NOW)).id;
      const prep = await attachments.prepareUpload(db, st.port, actor, id, { name, size });
      st.files.set(prep.path, size); // o navegador "enviou" o arquivo
      const att = await attachments.confirmUpload(db, st.port, actor, id, { path: prep.path, name, mimeType }, NOW);
      return { cardId: id, attachmentId: att.id, path: prep.path };
    }
    let storage = fakeStorage();
    beforeEach(() => { storage = fakeStorage(); });

    it("envia, registra no histórico e aparece com link temporário", async () => {
      const { cardId, path } = await upload();
      expect(path).toMatch(new RegExp(`^${s.board.id}/${cardId}/.+-foto\\.png$`));
      const detail = await cards.getCardDetail(db, s.member, cardId, { storage: storage.port });
      expect(detail.attachments[0]).toMatchObject({ name: "foto.png", isImage: true, size: 2 * MB, url: `https://fake/dl/${path}`, canDelete: true });
      expect((await db.cardEvent.findMany({ where: { cardId, type: "ATTACHMENT_ADDED" } })).length).toBe(1);
    });

    it("recusa executáveis e arquivos acima de 10 MB (antes e depois do envio)", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(attachments.prepareUpload(db, storage.port, s.member, c.id, { name: "virus.exe", size: 10 }), "INVALID", /\.exe/);
      await expectCode(attachments.prepareUpload(db, storage.port, s.member, c.id, { name: "grande.mp4", size: 11 * MB }), "INVALID", /10 MB/);
      // Navegador mentiu o tamanho: o servidor confere o arquivo real e apaga
      const prep = await attachments.prepareUpload(db, storage.port, s.member, c.id, { name: "falso.mp4", size: 1 * MB });
      storage.files.set(prep.path, 12 * MB);
      await expectCode(attachments.confirmUpload(db, storage.port, s.member, c.id, { path: prep.path, name: "falso.mp4", mimeType: "video/mp4" }, NOW), "INVALID", /10 MB/);
      expect(storage.files.has(prep.path)).toBe(false);
      expect(await db.attachment.count()).toBe(0);
    });

    it("não aceita confirmar arquivo de outra tarefa nem envio que não aconteceu", async () => {
      const a = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      const b = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      const prep = await attachments.prepareUpload(db, storage.port, s.member, a.id, { name: "x.pdf", size: 10 });
      await expectCode(attachments.confirmUpload(db, storage.port, s.member, b.id, { path: prep.path, name: "x.pdf", mimeType: "application/pdf" }, NOW), "INVALID");
      await expectCode(attachments.confirmUpload(db, storage.port, s.member, a.id, { path: prep.path, name: "x.pdf", mimeType: "application/pdf" }, NOW), "INVALID", /não foi concluído/);
    });

    it("Observador não anexa", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(attachments.prepareUpload(db, storage.port, s.observer, c.id, { name: "a.png", size: 10 }), "FORBIDDEN");
    });

    it("capa: só imagem da própria tarefa; aparece no quadro", async () => {
      const { cardId, attachmentId, path } = await upload();
      const pdf = await upload(s.member, "briefing.pdf", 1000, "application/pdf", cardId);
      await expectCode(attachments.setCover(db, s.member, cardId, pdf.attachmentId, NOW), "INVALID", /imagens/);
      await attachments.setCover(db, s.member2, cardId, attachmentId, NOW);
      const view = await cards.getBoardView(db, s.member, s.board.id, { storage: storage.port });
      expect(view.cards[0]).toMatchObject({ coverUrl: `https://fake/dl/${path}`, attachmentCount: 2 });
      await attachments.setCover(db, s.member2, cardId, null, NOW);
      expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).coverAttachmentId).toBeNull();
    });

    it("excluir: quem enviou ou Administrador; a capa sai junto e o arquivo é apagado", async () => {
      const { cardId, attachmentId, path } = await upload(s.member2);
      await attachments.setCover(db, s.member2, cardId, attachmentId, NOW);
      await expectCode(attachments.deleteAttachment(db, storage.port, s.member, attachmentId, NOW), "FORBIDDEN");
      await attachments.deleteAttachment(db, storage.port, s.admin, attachmentId, NOW);
      expect(storage.files.has(path)).toBe(false);
      expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).coverAttachmentId).toBeNull();
    });

    it("excluir o quadro apaga os arquivos dele (P33); recorrência não copia anexos", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-10-30", recurrence: { frequency: "WEEKLY", endDate: null } }, NOW);
      const { path } = await upload(s.member, "a.png", 100, "image/png", c.id);
      await cards.moveCard(db, s.member, c.id, "DONE", NOW);
      const child = await db.card.findUniqueOrThrow({ where: { recurrenceParentId: c.id } });
      expect(await db.attachment.count({ where: { cardId: child.id } })).toBe(0);
      await boards.deleteBoard(db, s.admin, s.board.id, "Marketing", storage.port);
      expect(storage.files.has(path)).toBe(false);
    });
  });
});
