import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { AppError } from "@/server/errors";
import * as boards from "./boards";
import * as cards from "./cards";
import * as users from "./users";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

// Sexta-feira, 30/10/2026, 15h em São Paulo
const NOW = new Date("2026-10-30T18:00:00Z");

describe.skipIf(!TEST_DATABASE_URL)("Serviços com banco de dados (integração)", () => {
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
  const expectCode = async (p: Promise<unknown>, code: AppError["code"]) => {
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ code });
  };

  describe("Criar card", () => {
    it("com prazo nasce ACTIVE e registra evento CREATED", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-11-02" }, NOW);
      expect(c.stage).toBe("ACTIVE");
      const ev = await db.cardEvent.findMany({ where: { cardId: c.id } });
      expect(ev).toHaveLength(1);
      expect(ev[0]).toMatchObject({ type: "CREATED", toStage: "ACTIVE", actorId: s.member.id });
    });

    it("sem prazo nasce NEW; grava criador, labels e responsáveis", async () => {
      const c = await cards.createCard(db, s.member, s.board.id,
        { ...base(), labelIds: [s.label.id], assigneeIds: [s.member2.id, s.admin.id] }, NOW);
      expect(c.stage).toBe("NEW");
      expect(c.createdById).toBe(s.member.id);
      expect(await db.cardLabel.count({ where: { cardId: c.id } })).toBe(1);
      expect(await db.cardAssignee.count({ where: { cardId: c.id } })).toBe(2);
    });

    it("Observador não cria card", async () => {
      await expectCode(cards.createCard(db, s.observer, s.board.id, base(), NOW), "FORBIDDEN");
    });

    it("Membro de fora do quadro nem enxerga o quadro", async () => {
      await expectCode(cards.createCard(db, s.outsider, s.board.id, base(), NOW), "NOT_FOUND");
    });

    it("recusa área de outro quadro, área desativada e Observador como responsável", async () => {
      await expectCode(cards.createCard(db, s.member, s.board.id, { ...base(), requesterAreaId: s.otherArea.id }, NOW), "INVALID");
      await db.requesterArea.update({ where: { id: s.area.id }, data: { isActive: false } });
      await expectCode(cards.createCard(db, s.member, s.board.id, base(), NOW), "INVALID");
      await db.requesterArea.update({ where: { id: s.area.id }, data: { isActive: true } });
      await expectCode(cards.createCard(db, s.member, s.board.id, { ...base(), assigneeIds: [s.observer.id] }, NOW), "INVALID");
      await expectCode(cards.createCard(db, s.member, s.board.id, { ...base(), assigneeIds: [s.outsider.id] }, NOW), "INVALID");
    });
  });

  describe("Editar card e prazo", () => {
    it("Membro altera prazo do card que ele criou; NEW vira ACTIVE", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await cards.updateCard(db, s.member, c.id, { ...base(), dueDate: "2026-11-05" }, NOW);
      const after = await db.card.findUniqueOrThrow({ where: { id: c.id } });
      expect(after.stage).toBe("ACTIVE");
      const types = (await db.cardEvent.findMany({ where: { cardId: c.id } })).map((e) => e.type);
      expect(types).toEqual(expect.arrayContaining(["DUE_DATE_CHANGED", "STAGE_CHANGED"]));
    });

    it("Membro NÃO altera prazo de card criado por outra pessoa, mas edita o título", async () => {
      const c = await cards.createCard(db, s.member2, s.board.id, { ...base(), dueDate: "2026-11-05" }, NOW);
      await expectCode(cards.updateCard(db, s.member, c.id, { ...base(), dueDate: "2026-11-06" }, NOW), "FORBIDDEN");
      await cards.updateCard(db, s.member, c.id, { ...base(), title: "Novo título", dueDate: "2026-11-05" }, NOW);
      expect((await db.card.findUniqueOrThrow({ where: { id: c.id } })).title).toBe("Novo título");
    });

    it("Administrador altera prazo de qualquer card; apagar prazo de ACTIVE volta para NEW", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-11-05" }, NOW);
      await cards.updateCard(db, s.admin, c.id, { ...base(), dueDate: null }, NOW);
      expect((await db.card.findUniqueOrThrow({ where: { id: c.id } })).stage).toBe("NEW");
    });

    it("Observador não edita", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(cards.updateCard(db, s.observer, c.id, { ...base(), title: "x" }, NOW), "FORBIDDEN");
    });
  });

  describe("Mover card", () => {
    it("APROVAÇÃO → FINALIZADAS grava conclusão no prazo; reabrir limpa", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-10-30" }, NOW);
      await cards.moveCard(db, s.member, c.id, "APPROVAL", NOW);
      await cards.moveCard(db, s.member2, c.id, "DONE", NOW);
      let after = await db.card.findUniqueOrThrow({ where: { id: c.id } });
      expect(after).toMatchObject({ stage: "DONE", completedOnTime: true });
      expect(after.completedAt?.toISOString()).toBe(NOW.toISOString());

      await cards.moveCard(db, s.member, c.id, "CHANGES", NOW);
      after = await db.card.findUniqueOrThrow({ where: { id: c.id } });
      expect(after).toMatchObject({ stage: "CHANGES", completedAt: null, completedOnTime: null });

      const ev = await db.cardEvent.findMany({ where: { cardId: c.id }, orderBy: { createdAt: "asc" } });
      expect(ev.map((e) => e.type)).toEqual(["CREATED", "STAGE_CHANGED", "COMPLETED", "REOPENED"]);
      expect(ev[2]).toMatchObject({ fromStage: "APPROVAL", toStage: "DONE", actorId: s.member2.id });
    });

    it("recusa ATRASADAS e coluna de prazo que não corresponde", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, { ...base(), dueDate: "2026-11-20" }, NOW);
      await expectCode(cards.moveCard(db, s.member, c.id, "OVERDUE", NOW), "INVALID");
      await expectCode(cards.moveCard(db, s.member, c.id, "TODAY", NOW), "INVALID");
      await cards.moveCard(db, s.member, c.id, "APPROVAL", NOW);
      await cards.moveCard(db, s.member, c.id, "UPCOMING", NOW); // volta: corresponde ao prazo
      expect((await db.card.findUniqueOrThrow({ where: { id: c.id } })).stage).toBe("ACTIVE");
    });

    it("Observador não move", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(cards.moveCard(db, s.observer, c.id, "APPROVAL", NOW), "FORBIDDEN");
    });
  });

  describe("Excluir card (lixeira)", () => {
    it("só Administrador; o card some do quadro mas continua no banco", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(cards.deleteCard(db, s.member, c.id, NOW), "FORBIDDEN");
      await cards.deleteCard(db, s.admin, c.id, NOW);
      const view = await cards.getBoardView(db, s.member, s.board.id);
      expect(view.cards).toHaveLength(0);
      expect(await db.card.count({ where: { id: c.id } })).toBe(1);
    });
  });

  describe("Checklist", () => {
    it("Membro cria checklist, adiciona e marca item", async () => {
      const c = await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await cards.addChecklist(db, s.member, c.id, { title: "Tarefas" });
      const cl = await db.checklist.findFirstOrThrow({ where: { cardId: c.id } });
      await cards.addChecklistItem(db, s.member, cl.id, { text: "Roteiro" });
      const item = await db.checklistItem.findFirstOrThrow({ where: { checklistId: cl.id } });
      await cards.toggleChecklistItem(db, s.member2, item.id, true, NOW);
      const view = await cards.getBoardView(db, s.member, s.board.id);
      expect(view.cards[0]).toMatchObject({ checklistTotal: 1, checklistDone: 1 });
      await expectCode(cards.toggleChecklistItem(db, s.observer, item.id, false, NOW), "FORBIDDEN");
    });
  });

  describe("Quadros", () => {
    it("cada um vê só os quadros dos quais participa; Admin vê todos", async () => {
      expect((await boards.listBoards(db, s.member)).active.map((b) => b.name)).toEqual(["Marketing"]);
      expect((await boards.listBoards(db, s.outsider)).active.map((b) => b.name)).toEqual(["Outro"]);
      expect((await boards.listBoards(db, s.admin)).active).toHaveLength(2);
    });

    it("tela inicial mostra contagens: em aberto, atrasadas, hoje e em aprovação", async () => {
      const base2 = { description: "", requesterAreaId: s.area.id };
      await cards.createCard(db, s.member, s.board.id, { ...base2, title: "a", dueDate: "2026-10-28" }, NOW); // atrasada
      await cards.createCard(db, s.member, s.board.id, { ...base2, title: "b", dueDate: "2026-10-30" }, NOW); // hoje
      const c = await cards.createCard(db, s.member, s.board.id, { ...base2, title: "c", dueDate: "2026-11-20" }, NOW);
      await cards.moveCard(db, s.member, c.id, "APPROVAL", NOW);
      const d = await cards.createCard(db, s.member, s.board.id, { ...base2, title: "d", dueDate: null }, NOW);
      await cards.moveCard(db, s.member, d.id, "DONE", NOW); // finalizada não conta
      const { active } = await boards.listBoards(db, s.member, "2026-10-30");
      expect(active[0].stats).toEqual({ open: 3, overdue: 1, today: 1, approval: 1 });
    });

    it("quadro arquivado some para Membro e vai para 'Arquivados' do Admin", async () => {
      await boards.setBoardArchived(db, s.admin, s.board.id, true);
      expect((await boards.listBoards(db, s.member)).active).toHaveLength(0);
      await expectCode(cards.getBoardView(db, s.member, s.board.id), "NOT_FOUND");
      expect((await boards.listBoards(db, s.admin)).archived.map((b) => b.name)).toEqual(["Marketing"]);
    });

    it("só Admin cria quadro e gerencia acesso", async () => {
      await expectCode(boards.createBoard(db, s.member, { name: "X" }), "FORBIDDEN");
      const b = await boards.createBoard(db, s.admin, { name: "Lançamento X" });
      await boards.setBoardMembers(db, s.admin, b.id, [s.member.id]);
      expect((await boards.listBoards(db, s.member)).active.map((x) => x.name)).toContain("Lançamento X");
      await boards.setBoardMembers(db, s.admin, b.id, []);
      expect((await boards.listBoards(db, s.member)).active.map((x) => x.name)).not.toContain("Lançamento X");
    });

    it("área em uso não pode ser excluída, só desativada (6A)", async () => {
      await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(boards.deleteBoardItem(db, s.admin, "area", s.area.id), "INVALID");
      await boards.setBoardItemActive(db, s.admin, "area", s.area.id, false);
      const unused = await boards.createBoardItem(db, s.admin, "area", s.board.id, { name: "PARQUE", color: "#16A34A" });
      await boards.deleteBoardItem(db, s.admin, "area", unused.id);
      await expectCode(boards.createBoardItem(db, s.admin, "label", s.board.id, { name: "vídeo", color: "#000000" }), "INVALID");
    });

    it("excluir quadro exige digitar o nome e apaga os cards", async () => {
      await cards.createCard(db, s.member, s.board.id, base(), NOW);
      await expectCode(boards.deleteBoard(db, s.admin, s.board.id, "errado"), "INVALID");
      await boards.deleteBoard(db, s.admin, s.board.id, "Marketing");
      expect(await db.card.count()).toBe(0);
    });
  });

  describe("Usuários", () => {
    const fakeAuth = () => {
      const accounts = new Map<string, string>();
      const banned = new Set<string>();
      const port: users.AuthAdminPort = {
        async createUser(email) {
          const id = crypto.randomUUID();
          accounts.set(email, id);
          return { id };
        },
        async findUserIdByEmail(email) { return accounts.get(email) ?? null; },
        async deleteUser(id) { for (const [k, v] of accounts) if (v === id) accounts.delete(k); },
        async setPassword() {},
        async setBanned(id, b) { if (b) banned.add(id); else banned.delete(id); },
      };
      return { port, accounts, banned };
    };

    it("Admin cadastra com senha provisória; e-mail repetido é recusado", async () => {
      const auth = fakeAuth();
      const u = await users.createUser(db, auth.port, s.admin, { name: "Bia", email: "Bia@Empresa.com", role: "MEMBER", password: "provisoria1" });
      expect(u.email).toBe("bia@empresa.com");
      expect(auth.accounts.get("bia@empresa.com")).toBe(u.id);
      await expectCode(users.createUser(db, auth.port, s.admin, { name: "B", email: "bia@empresa.com", role: "MEMBER", password: "provisoria1" }), "INVALID");
      await expectCode(users.createUser(db, auth.port, s.member, { name: "C", email: "c@x.com", role: "MEMBER", password: "provisoria1" }), "FORBIDDEN");
    });

    it("reaproveita conta de login que já existia sem cadastro no sistema", async () => {
      const auth = fakeAuth();
      const { id } = await auth.port.createUser("leo@empresa.com", "x"); // conta "solta" no Supabase
      const u = await users.createUser(db, auth.port, s.admin, { name: "Léo", email: "leo@empresa.com", role: "MEMBER", password: "provisoria1" });
      expect(u.id).toBe(id);
      expect(auth.accounts.size).toBe(1);
    });

    it("desativar bloqueia o login e preserva o histórico; não pode desativar a si mesmo", async () => {
      const auth = fakeAuth();
      await users.setUserActive(db, auth.port, s.admin, s.member.id, false);
      expect(auth.banned.has(s.member.id)).toBe(true);
      expect(await db.user.findUniqueOrThrow({ where: { id: s.member.id } })).toMatchObject({ isActive: false });
      await expectCode(users.setUserActive(db, auth.port, s.admin, s.admin.id, false), "INVALID");
    });

    it("primeiro Administrador só é criado com o banco vazio e as credenciais certas (P10)", async () => {
      const auth = fakeAuth();
      const env = { email: "chefe@empresa.com", password: "senha-inicial" };
      // Já existem usuários neste cenário → não cria
      expect(await users.bootstrapFirstAdmin(db, auth.port, env, env)).toBe(false);
      await db.$executeRawUnsafe('TRUNCATE "boards", "users" CASCADE');
      expect(await users.bootstrapFirstAdmin(db, auth.port, { email: env.email, password: "errada" }, env)).toBe(false);
      expect(await users.bootstrapFirstAdmin(db, auth.port, { email: "CHEFE@empresa.com", password: env.password }, env)).toBe(true);
      expect(await db.user.findFirstOrThrow()).toMatchObject({ email: "chefe@empresa.com", role: "ADMIN" });
    });
  });
});
