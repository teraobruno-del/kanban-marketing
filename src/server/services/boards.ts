import type { Db } from "@/lib/db/client";
import { canManage, canViewBoard, type Actor, type BoardAccess } from "@/lib/auth/permissions";
import { boardItemSchema, boardNameSchema } from "@/lib/validation/schemas";
import { parse } from "./util";
import { dateOnlyFromDb, todayInSaoPaulo, type DateOnly } from "@/lib/dates/day";
import { forbidden, invalid, notFound } from "@/server/errors";

function requireAdmin(actor: Actor) {
  if (!canManage(actor)) throw forbidden("Só o Administrador pode fazer isso.");
}

/** Confere se o usuário pode ver o quadro e devolve o quadro + acesso. */
export async function loadBoardAccess(db: Db, actor: Actor, boardId: string) {
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) throw notFound("Quadro não encontrado.");
  const membership = await db.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: actor.id } },
  });
  const access: BoardAccess = { isBoardMember: membership !== null };
  if (!canViewBoard(actor, access)) throw notFound("Quadro não encontrado.");
  if (board.archivedAt && actor.role !== "ADMIN") throw notFound("Quadro não encontrado.");
  return { board, access };
}

/** Lista de quadros da tela inicial, com contagens. Admin vê todos (e os arquivados, à parte). */
export async function listBoards(db: Db, actor: Actor, today: DateOnly = todayInSaoPaulo()) {
  if (!actor.isActive) return { active: [], archived: [] };
  const where = actor.role === "ADMIN" ? {} : { members: { some: { userId: actor.id } }, archivedAt: null };
  const boards = await db.board.findMany({ where, orderBy: { name: "asc" } });
  const open = await db.card.findMany({
    where: { boardId: { in: boards.map((b) => b.id) }, deletedAt: null, stage: { not: "DONE" } },
    select: { boardId: true, stage: true, dueDate: true },
  });
  const stats = new Map(boards.map((b) => [b.id, { open: 0, overdue: 0, today: 0, approval: 0 }]));
  for (const c of open) {
    const st = stats.get(c.boardId)!;
    const due = c.dueDate ? dateOnlyFromDb(c.dueDate) : null;
    st.open++;
    if (due && due < today) st.overdue++;
    if (c.stage === "ACTIVE" && due === today) st.today++;
    if (c.stage === "APPROVAL") st.approval++;
  }
  const withStats = boards.map((b) => ({ id: b.id, name: b.name, archivedAt: b.archivedAt, stats: stats.get(b.id)! }));
  return {
    active: withStats.filter((b) => !b.archivedAt),
    archived: actor.role === "ADMIN" ? withStats.filter((b) => b.archivedAt) : [],
  };
}

export async function createBoard(db: Db, actor: Actor, input: { name: string }) {
  requireAdmin(actor);
  const { name } = parse(boardNameSchema, input);
  return db.board.create({ data: { name, createdById: actor.id } });
}

export async function renameBoard(db: Db, actor: Actor, boardId: string, input: { name: string }) {
  requireAdmin(actor);
  const { name } = parse(boardNameSchema, input);
  await db.board.update({ where: { id: boardId }, data: { name } });
}

export async function setBoardArchived(db: Db, actor: Actor, boardId: string, archived: boolean) {
  requireAdmin(actor);
  await db.board.update({ where: { id: boardId }, data: { archivedAt: archived ? new Date() : null } });
}

/** Exclusão definitiva do quadro e de tudo dentro dele (pedido explícito do Admin). */
export async function deleteBoard(
  db: Db, actor: Actor, boardId: string, confirmName: string,
  storage?: { remove(paths: string[]): Promise<void> },
) {
  requireAdmin(actor);
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) throw notFound("Quadro não encontrado.");
  if (confirmName.trim() !== board.name) throw invalid("Digite o nome exato do quadro para confirmar.");
  // Arquivos do quadro são apagados junto (P33).
  const files = (await db.attachment.findMany({ where: { card: { boardId } }, select: { storagePath: true } })).map((a) => a.storagePath);
  await db.$transaction(async (tx) => {
    // Cards referenciam áreas/labels sem cascata: apagar os cards primeiro.
    await tx.card.updateMany({ where: { boardId }, data: { coverAttachmentId: null, recurrenceParentId: null } });
    await tx.card.deleteMany({ where: { boardId } });
    await tx.board.delete({ where: { id: boardId } });
  });
  if (storage && files.length) await storage.remove(files);
}

/** Define quem tem acesso ao quadro (substitui a lista inteira). */
export async function setBoardMembers(db: Db, actor: Actor, boardId: string, userIds: string[]) {
  requireAdmin(actor);
  const unique = [...new Set(userIds)];
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (users.length !== unique.length) throw invalid("Usuário inválido na lista de acesso.");
  await db.$transaction([
    db.boardMember.deleteMany({ where: { boardId, userId: { notIn: unique } } }),
    db.boardMember.createMany({ data: unique.map((userId) => ({ boardId, userId })), skipDuplicates: true }),
  ]);
}

// ── Áreas solicitantes e labels (mesmas regras) ──

export type BoardItemKind = "area" | "label";

function itemDelegate(db: Db, kind: BoardItemKind) {
  return kind === "area" ? db.requesterArea : db.label;
}

export async function createBoardItem(
  db: Db, actor: Actor, kind: BoardItemKind, boardId: string, input: { name: string; color: string },
) {
  requireAdmin(actor);
  const data = parse(boardItemSchema, input);
  const delegate = itemDelegate(db, kind) as typeof db.label;
  const exists = await delegate.findFirst({ where: { boardId, name: { equals: data.name, mode: "insensitive" } } });
  if (exists) throw invalid(`Já existe ${kind === "area" ? "uma área" : "uma etiqueta"} com esse nome neste quadro.`);
  return delegate.create({ data: { ...data, boardId } });
}

export async function updateBoardItem(
  db: Db, actor: Actor, kind: BoardItemKind, itemId: string, input: { name: string; color: string },
) {
  requireAdmin(actor);
  const data = parse(boardItemSchema, input);
  const delegate = itemDelegate(db, kind) as typeof db.label;
  const item = await delegate.findUnique({ where: { id: itemId } });
  if (!item) throw notFound();
  const clash = await delegate.findFirst({
    where: { boardId: item.boardId, id: { not: itemId }, name: { equals: data.name, mode: "insensitive" } },
  });
  if (clash) throw invalid("Já existe outro item com esse nome neste quadro.");
  await delegate.update({ where: { id: itemId }, data });
}

export async function setBoardItemActive(db: Db, actor: Actor, kind: BoardItemKind, itemId: string, isActive: boolean) {
  requireAdmin(actor);
  const delegate = itemDelegate(db, kind) as typeof db.label;
  await delegate.update({ where: { id: itemId }, data: { isActive } });
}

/** Exclusão definitiva só se nunca foi usado (decisão 6A); senão, desative. */
export async function deleteBoardItem(db: Db, actor: Actor, kind: BoardItemKind, itemId: string) {
  requireAdmin(actor);
  const used =
    kind === "area"
      ? await db.card.count({ where: { requesterAreaId: itemId } })
      : await db.cardLabel.count({ where: { labelId: itemId } });
  if (used > 0) {
    throw invalid("Este item já foi usado em cards e não pode ser excluído. Você pode desativá-lo.");
  }
  if (kind === "area") await db.requesterArea.delete({ where: { id: itemId } });
  else await db.label.delete({ where: { id: itemId } });
}
