import type { Db } from "@/lib/db/client";
import type { Actor } from "@/lib/auth/permissions";
import type { Prisma } from "@/generated/prisma/client";

/** Cria avisos, sem avisar ninguém da própria ação, sem repetir pessoas e só para usuários ativos. */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  recipients: Iterable<string>,
  data: { type: Prisma.NotificationCreateManyInput["type"]; cardId: string; actorId: string; message?: string | null },
) {
  const ids = [...new Set(recipients)].filter((id) => id !== data.actorId);
  if (ids.length === 0) return;
  const active = await tx.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  if (active.length) await tx.notification.createMany({ data: active.map((u) => ({ ...data, userId: u.id })) });
}

/** Avisos recentes do usuário (sininho). */
export async function listNotifications(db: Db, actor: Actor, take = 20) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: actor.id, card: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: { select: { name: true } },
        card: { select: { id: true, title: true, boardId: true } },
      },
    }),
    db.notification.count({ where: { userId: actor.id, readAt: null, card: { deletedAt: null } } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
      actorName: n.actor.name,
      card: n.card,
    })),
  };
}

/** Tarefas aguardando a aprovação do usuário (criadas por ele; Admin vê todas que pode acessar). */
export async function listPendingApprovals(db: Db, actor: Actor) {
  if (!actor.isActive || actor.role === "OBSERVER") return [];
  const cards = await db.card.findMany({
    where: {
      stage: "APPROVAL",
      deletedAt: null,
      board: { archivedAt: null },
      ...(actor.role === "ADMIN"
        ? {}
        : { createdById: actor.id, board: { archivedAt: null, members: { some: { userId: actor.id } } } }),
    },
    orderBy: { updatedAt: "asc" },
    take: 30,
    select: { id: true, title: true, boardId: true, board: { select: { name: true } } },
  });
  return cards.map((c) => ({ id: c.id, title: c.title, boardId: c.boardId, boardName: c.board.name }));
}

/** Marca avisos do próprio usuário como lidos (todos, ou só os informados). */
export async function markNotificationsRead(db: Db, actor: Actor, ids?: string[], now = new Date()) {
  await db.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: now },
  });
}

export type NotificationList = Awaited<ReturnType<typeof listNotifications>>;
export type PendingApprovals = Awaited<ReturnType<typeof listPendingApprovals>>;
