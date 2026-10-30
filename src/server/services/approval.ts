import type { Db } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { canApprove, canEditCards, type Actor } from "@/lib/auth/permissions";
import { dateOnlyFromDb } from "@/lib/dates/day";
import { canRequestApprovalFrom, completionFieldsForStageChange } from "@/lib/board/moves";
import { rejectReasonSchema } from "@/lib/validation/schemas";
import { forbidden, invalid, notFound } from "@/server/errors";
import { loadBoardAccess } from "./boards";
import { parse } from "./util";
import { createNotifications as notify } from "./notifications";
import { finishCard } from "./completion";

type Tx = Prisma.TransactionClient;

async function loadCard(db: Db, actor: Actor, cardId: string) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!card || card.deletedAt) throw notFound("Tarefa não encontrada.");
  const { access } = await loadBoardAccess(db, actor, card.boardId);
  return { card, access };
}

/**
 * Envia para aprovação (botão ou arrastar para APROVAÇÃO): vai para APPROVAL e avisa o criador.
 * Usado também pelo moveCard quando o destino é APROVAÇÃO.
 */
export async function requestApproval(db: Db, actor: Actor, cardId: string, now = new Date()) {
  const { card, access } = await loadCard(db, actor, cardId);
  if (!canEditCards(actor, access)) throw forbidden();
  if (!canRequestApprovalFrom(card.stage)) {
    throw invalid(card.stage === "APPROVAL" ? "A tarefa já está aguardando aprovação." : "Tarefas finalizadas não vão para aprovação. Reabra a tarefa primeiro.");
  }
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { stage: "APPROVAL" } });
    await tx.cardEvent.create({
      data: { cardId, boardId: card.boardId, actorId: actor.id, type: "APPROVAL_REQUESTED", fromStage: card.stage, toStage: "APPROVAL", createdAt: now },
    });
    await notify(tx, [card.createdById], { type: "APPROVAL_REQUESTED", cardId, actorId: actor.id });
  });
}

/** Quem enviou por último para aprovação (também é avisado do resultado). */
async function lastRequester(tx: Tx, cardId: string) {
  const ev = await tx.cardEvent.findFirst({
    where: { cardId, type: "APPROVAL_REQUESTED" },
    orderBy: { createdAt: "desc" },
    select: { actorId: true },
  });
  return ev?.actorId;
}

async function requireApprover(db: Db, actor: Actor, cardId: string) {
  const { card, access } = await loadCard(db, actor, cardId);
  if (card.stage !== "APPROVAL") throw invalid("Esta tarefa não está aguardando aprovação.");
  if (!canApprove(actor, access, card)) {
    throw forbidden("Só quem criou a tarefa ou um Administrador pode aprová-la ou reprová-la.");
  }
  return card;
}

/**
 * Aprovar: APROVAÇÃO → FINALIZADAS (regra de conclusão: checklist + recorrência) e avisa responsáveis + quem enviou.
 * `completeChecklist` confirma que itens pendentes serão marcados como concluídos (P23).
 */
export async function approveCard(
  db: Db, actor: Actor, cardId: string, now = new Date(), opts: { completeChecklist?: boolean } = {},
) {
  const card = await requireApprover(db, actor, cardId);
  const due = card.dueDate ? dateOnlyFromDb(card.dueDate) : null;
  return db.$transaction(async (tx) => {
    const spawned = await finishCard(tx, card, actor, now, opts.completeChecklist ?? false, async () => {
      await tx.card.update({
        where: { id: cardId },
        data: { stage: "DONE", ...completionFieldsForStageChange("APPROVAL", "DONE", due, now) },
      });
      await tx.cardEvent.create({
        data: { cardId, boardId: card.boardId, actorId: actor.id, type: "APPROVED", fromStage: "APPROVAL", toStage: "DONE", createdAt: now },
      });
    });
    const requester = await lastRequester(tx, cardId);
    await notify(tx, [...card.assignees.map((a) => a.userId), ...(requester ? [requester] : [])], {
      type: "CARD_APPROVED", cardId, actorId: actor.id,
    });
    return { nextRecurrence: spawned?.dueDate ?? null };
  });
}

/** Reprovar com motivo obrigatório: APROVAÇÃO → ALTERAÇÃO e avisa responsáveis + quem enviou. */
export async function rejectCard(db: Db, actor: Actor, cardId: string, rawReason: string, now = new Date()) {
  const { reason } = parse(rejectReasonSchema, { reason: rawReason });
  const card = await requireApprover(db, actor, cardId);
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { stage: "CHANGES" } });
    await tx.cardEvent.create({
      data: {
        cardId, boardId: card.boardId, actorId: actor.id, type: "REJECTED",
        fromStage: "APPROVAL", toStage: "CHANGES", data: { reason }, createdAt: now,
      },
    });
    const requester = await lastRequester(tx, cardId);
    await notify(tx, [...card.assignees.map((a) => a.userId), ...(requester ? [requester] : [])], {
      type: "CARD_REJECTED", cardId, actorId: actor.id, message: reason,
    });
  });
}
