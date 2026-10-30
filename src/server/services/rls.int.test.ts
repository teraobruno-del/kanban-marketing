import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Db } from "@/lib/db/client";
import * as cards from "./cards";
import { seedScenario, testDb, TEST_DATABASE_URL } from "./test-db";

/**
 * Simula o acesso direto ao banco pela API do Supabase: papel "authenticated"
 * com o id do usuário logado em auth.uid(). Confere as políticas de RLS.
 */
describe.skipIf(!TEST_DATABASE_URL)("Segurança no banco (RLS)", () => {
  let db: Db;
  let pool: pg.Pool;
  let s: Awaited<ReturnType<typeof seedScenario>>;
  let memberCardId: string;
  let member2CardId: string;

  beforeAll(async () => {
    db = testDb();
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
    s = await seedScenario(db);
    const now = new Date("2026-10-30T18:00:00Z");
    memberCardId = (await cards.createCard(db, s.member, s.board.id,
      { title: "A", description: "", dueDate: "2026-11-05", requesterAreaId: s.area.id }, now)).id;
    member2CardId = (await cards.createCard(db, s.member2, s.board.id,
      { title: "B", description: "", dueDate: "2026-11-05", requesterAreaId: s.area.id }, now)).id;
  });
  afterAll(async () => {
    await pool?.end();
    await db?.$disconnect();
  });

  /** Executa SQL como um usuário (ou como visitante, se userId = null) e desfaz tudo no fim. */
  async function as<T>(userId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`SET LOCAL ROLE ${userId ? "authenticated" : "anon"}`);
      await c.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      return await fn(c);
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  }
  const count = (who: string | { id: string } | null, table: string) => {
    const userId = who && typeof who === "object" ? who.id : who;
    return as(userId, async (c) => Number((await c.query(`SELECT count(*) FROM ${table}`)).rows[0].count));
  };

  it("visitante (não logado) não vê nada", async () => {
    for (const t of ["users", "boards", "cards", "requester_areas", "card_events"]) {
      expect(await count(null, t)).toBe(0);
    }
  });

  it("cada usuário só vê os quadros e cards aos quais tem acesso", async () => {
    expect(await count(s.member, "boards")).toBe(1);
    expect(await count(s.member, "cards")).toBe(2);
    expect(await count(s.outsider, "boards")).toBe(1);
    expect(await count(s.outsider, "cards")).toBe(0);
    expect(await count(s.admin, "boards")).toBe(2);
    expect(await count(s.admin, "cards")).toBe(2);
  });

  it("usuário desativado não vê nada", async () => {
    await db.user.update({ where: { id: s.member.id }, data: { isActive: false } });
    expect(await count(s.member.id, "cards")).toBe(0);
    await db.user.update({ where: { id: s.member.id }, data: { isActive: true } });
  });

  it("Observador vê, mas não altera cards", async () => {
    expect(await count(s.observer.id, "cards")).toBe(2);
    const updated = await as(s.observer.id, (c) => c.query("UPDATE cards SET title = 'hack'"));
    expect(updated.rowCount).toBe(0);
  });

  it("Membro edita título, mas não altera prazo de card de outra pessoa", async () => {
    await as(s.member.id, async (c) => {
      expect((await c.query("UPDATE cards SET title = 'ok' WHERE id = $1", [member2CardId])).rowCount).toBe(1);
      await expect(c.query("UPDATE cards SET due_date = '2026-12-01' WHERE id = $1", [member2CardId]))
        .rejects.toThrow(/prazo/);
    });
    await as(s.member.id, async (c) => {
      expect((await c.query("UPDATE cards SET due_date = '2026-12-01' WHERE id = $1", [memberCardId])).rowCount).toBe(1);
    });
  });

  it("Membro não exclui cards nem gerencia quadros, áreas ou usuários", async () => {
    await as(s.member.id, async (c) => {
      expect((await c.query("DELETE FROM cards")).rowCount).toBe(0);
      expect((await c.query("UPDATE boards SET name = 'x'")).rowCount).toBe(0);
      expect((await c.query("UPDATE requester_areas SET name = 'x'")).rowCount).toBe(0);
      expect((await c.query("UPDATE users SET role = 'ADMIN'")).rowCount).toBe(0);
    });
    await as(s.member.id, async (c) => {
      await expect(c.query("UPDATE cards SET deleted_at = now() WHERE id = $1", [memberCardId])).rejects.toThrow(/Administrador/);
    });
  });

  it("ninguém cria card em nome de outra pessoa", async () => {
    await as(s.member.id, async (c) => {
      await expect(
        c.query(
          "INSERT INTO cards (id, board_id, title, requester_area_id, created_by_id, updated_at) VALUES (gen_random_uuid(), $1, 'x', $2, $3, now())",
          [s.board.id, s.area.id, s.member2.id],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("Administrador pode alterar prazo de qualquer card", async () => {
    await as(s.admin.id, async (c) => {
      expect((await c.query("UPDATE cards SET due_date = '2026-12-01' WHERE id = $1", [member2CardId])).rowCount).toBe(1);
    });
  });

  it("tabela interna de migrações fica invisível", async () => {
    expect(await count(s.admin.id, "_prisma_migrations")).toBe(0);
  });
});
