import { randomUUID } from "node:crypto";
import { createPrismaClient, type Db } from "@/lib/db/client";
import type { Actor, Role } from "@/lib/auth/permissions";

/** URL do banco local de testes de integração (scripts/test-db-setup.sh). Sem ela, esses testes são pulados. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export function testDb(): Db {
  return createPrismaClient(TEST_DATABASE_URL!);
}

const TABLES = [
  "notifications", "card_events", "comment_mentions", "comments", "attachments", "checklist_items", "checklists",
  "card_labels", "card_assignees", "cards", "labels", "requester_areas", "board_members", "boards", "users",
];

export async function resetDb(db: Db) {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

export async function makeUser(db: Db, role: Role, name: string, isActive = true): Promise<Actor> {
  const u = await db.user.create({
    data: { id: randomUUID(), email: `${name.toLowerCase()}@teste.com`, name, role, isActive },
  });
  return { id: u.id, role, isActive };
}

/** Cenário padrão: quadro com área e label; admin, membro, outro membro, observador e um membro de fora. */
export async function seedScenario(db: Db) {
  await resetDb(db);
  const admin = await makeUser(db, "ADMIN", "Admin");
  const member = await makeUser(db, "MEMBER", "Membro");
  const member2 = await makeUser(db, "MEMBER", "Membro2");
  const observer = await makeUser(db, "OBSERVER", "Observador");
  const outsider = await makeUser(db, "MEMBER", "Forasteiro");
  const board = await db.board.create({ data: { name: "Marketing", createdById: admin.id } });
  const otherBoard = await db.board.create({ data: { name: "Outro", createdById: admin.id } });
  await db.boardMember.createMany({
    data: [member, member2, observer].map((u) => ({ boardId: board.id, userId: u.id })),
  });
  await db.boardMember.create({ data: { boardId: otherBoard.id, userId: outsider.id } });
  const area = await db.requesterArea.create({ data: { boardId: board.id, name: "RH", color: "#E11D48" } });
  const otherArea = await db.requesterArea.create({ data: { boardId: otherBoard.id, name: "RH", color: "#E11D48" } });
  const label = await db.label.create({ data: { boardId: board.id, name: "Vídeo", color: "#2563EB" } });
  return { admin, member, member2, observer, outsider, board, otherBoard, area, otherArea, label };
}
