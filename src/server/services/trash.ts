import type { Db } from "@/lib/db/client";
import { canManage, type Actor } from "@/lib/auth/permissions";
import { forbidden, invalid, notFound } from "@/server/errors";
import type { StoragePort } from "./attachments";

function requireAdmin(actor: Actor) {
  if (!canManage(actor)) throw forbidden("Só o Administrador acessa a lixeira.");
}

/** Tarefas na lixeira de um quadro, mais recentes primeiro. */
export async function listTrash(db: Db, actor: Actor, boardId: string) {
  requireAdmin(actor);
  const rows = await db.card.findMany({
    where: { boardId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true, title: true, stage: true, deletedAt: true,
      requesterArea: { select: { name: true, color: true } },
      deletedBy: { select: { name: true } },
      _count: { select: { attachments: true, comments: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    area: r.requesterArea,
    deletedAt: r.deletedAt!.toISOString(),
    deletedBy: r.deletedBy?.name ?? "—",
    attachments: r._count.attachments,
    comments: r._count.comments,
  }));
}

async function loadTrashed(db: Db, actor: Actor, cardId: string) {
  requireAdmin(actor);
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card) throw notFound("Tarefa não encontrada.");
  if (!card.deletedAt) throw invalid("Esta tarefa não está na lixeira.");
  return card;
}

/** Restaurar: a tarefa volta para onde estava, com tudo (etapa, prazo, checklist, anexos, comentários). */
export async function restoreCard(db: Db, actor: Actor, cardId: string, now = new Date()) {
  const card = await loadTrashed(db, actor, cardId);
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { deletedAt: null, deletedById: null } });
    await tx.cardEvent.create({
      data: { cardId, boardId: card.boardId, actorId: actor.id, type: "RESTORED", createdAt: now },
    });
  });
  return { boardId: card.boardId };
}

/** Excluir definitivamente (com confirmação na tela): apaga tarefa, histórico e arquivos. Não há volta. */
export async function purgeCard(db: Db, storage: StoragePort | undefined, actor: Actor, cardId: string) {
  const card = await loadTrashed(db, actor, cardId);
  const files = (await db.attachment.findMany({ where: { cardId }, select: { storagePath: true } })).map((a) => a.storagePath);
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { coverAttachmentId: null } });
    await tx.card.updateMany({ where: { recurrenceParentId: cardId }, data: { recurrenceParentId: null } });
    await tx.card.delete({ where: { id: cardId } });
  });
  if (storage && files.length) await storage.remove(files);
  return { boardId: card.boardId };
}
