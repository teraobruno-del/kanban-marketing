import type { Db } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { canComment, canDeleteComment, canEditComment, type Actor } from "@/lib/auth/permissions";
import { resolveMentions } from "@/lib/mentions";
import { commentBodySchema } from "@/lib/validation/schemas";
import { forbidden, invalid, notFound } from "@/server/errors";
import { loadBoardAccess } from "./boards";
import { createNotifications } from "./notifications";
import { parse } from "./util";

type Tx = Prisma.TransactionClient;

/** Quem pode ser mencionado num quadro: Administradores ativos + quem tem acesso (decisão F3-2A). */
export async function listMentionableUsers(db: Db | Tx, boardId: string) {
  return db.user.findMany({
    where: { isActive: true, OR: [{ role: "ADMIN" }, { boardMemberships: { some: { boardId } } }] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function loadCardForComment(db: Db, actor: Actor, cardId: string) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { assignees: { select: { userId: true } }, observers: { select: { userId: true } } },
  });
  if (!card || card.deletedAt) throw notFound("Tarefa não encontrada.");
  const { access } = await loadBoardAccess(db, actor, card.boardId);
  return { card, access };
}

/** Comentários da tarefa, mais recentes primeiro (decisão F3-4A). Excluídos aparecem sem o texto. */
export async function listComments(db: Db | Tx, cardId: string, take = 100) {
  const rows = await db.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { id: true, name: true } },
      mentions: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    author: c.author,
    body: c.deletedAt ? "" : c.body,
    deleted: c.deletedAt !== null,
    edited: c.editedAt !== null,
    createdAt: c.createdAt.toISOString(),
    mentions: c.deletedAt ? [] : c.mentions.map((m) => m.user),
  }));
}

/**
 * Novo comentário (SPEC §5). Avisa (decisão F3-1A): mencionados ("mencionou você"),
 * responsáveis e criador ("comentou") — nunca quem escreveu.
 */
export async function addComment(
  db: Db, actor: Actor, cardId: string, input: { body: string; mentionIds?: string[] }, now = new Date(),
) {
  const { card, access } = await loadCardForComment(db, actor, cardId);
  if (!canComment(actor, access)) throw forbidden();
  const body = parse(commentBodySchema, input.body);

  return db.$transaction(async (tx) => {
    const candidates = await listMentionableUsers(tx, card.boardId);
    const mentionIds = resolveMentions(body, input.mentionIds ?? [], candidates);
    const comment = await tx.comment.create({
      data: {
        cardId, authorId: actor.id, body, createdAt: now,
        mentions: { create: mentionIds.map((userId) => ({ userId })) },
      },
    });
    await tx.cardEvent.create({
      data: { cardId, boardId: card.boardId, actorId: actor.id, type: "COMMENTED", data: { commentId: comment.id }, createdAt: now },
    });
    await createNotifications(tx, mentionIds, { type: "COMMENT_MENTION", cardId, actorId: actor.id });
    const others = [card.createdById, ...card.assignees.map((a) => a.userId), ...card.observers.map((o) => o.userId)]
      .filter((id) => !mentionIds.includes(id));
    await createNotifications(tx, others, { type: "COMMENT_ADDED", cardId, actorId: actor.id });
    return { id: comment.id };
  });
}

async function loadComment(db: Db, actor: Actor, commentId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.deletedAt) throw notFound("Comentário não encontrado.");
  const { card } = await loadCardForComment(db, actor, comment.cardId);
  return { comment, card };
}

/** Editar: só quem escreveu. Atualiza as menções (sem avisar de novo). */
export async function editComment(
  db: Db, actor: Actor, commentId: string, input: { body: string; mentionIds?: string[] }, now = new Date(),
) {
  const { comment, card } = await loadComment(db, actor, commentId);
  if (!canEditComment(actor, comment)) throw forbidden("Só quem escreveu pode editar o comentário.");
  const body = parse(commentBodySchema, input.body);
  if (body === comment.body) return;
  await db.$transaction(async (tx) => {
    const candidates = await listMentionableUsers(tx, card.boardId);
    const old = (await tx.commentMention.findMany({ where: { commentId } })).map((m) => m.userId);
    const mentionIds = resolveMentions(body, [...old, ...(input.mentionIds ?? [])], candidates);
    await tx.comment.update({ where: { id: commentId }, data: { body, editedAt: now } });
    await tx.commentMention.deleteMany({ where: { commentId } });
    await tx.commentMention.createMany({ data: mentionIds.map((userId) => ({ commentId, userId })) });
  });
}

/** Excluir: quem escreveu ou Administrador. Vira "comentário excluído" na conversa. */
export async function deleteComment(db: Db, actor: Actor, commentId: string, now = new Date()) {
  const { comment } = await loadComment(db, actor, commentId);
  if (!canDeleteComment(actor, comment)) throw forbidden("Só quem escreveu ou um Administrador pode excluir o comentário.");
  await db.comment.update({ where: { id: commentId }, data: { deletedAt: now } });
}

/** Motivo da reprovação também entra na conversa (decisão F3-5A). Usado dentro da transação de rejectCard. */
export async function addRejectionComment(tx: Tx, cardId: string, authorId: string, reason: string, now: Date) {
  if (!reason.trim()) throw invalid("Motivo vazio.");
  await tx.comment.create({ data: { cardId, authorId, body: reason, kind: "REJECTION", createdAt: now } });
}

export type CommentList = Awaited<ReturnType<typeof listComments>>;
