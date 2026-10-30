import type { Prisma } from "@/generated/prisma/client";
import { canBeAssignee, type Actor, type Role } from "@/lib/auth/permissions";
import { dateOnlyFromDb, dateOnlyToDb, todayInSaoPaulo } from "@/lib/dates/day";
import { getNextRecurrenceDate } from "@/lib/dates/recurrence";
import { invalid } from "@/server/errors";
import { createNotifications } from "./notifications";

type Tx = Prisma.TransactionClient;

/** Quantos itens de checklist ainda estão pendentes no card. */
export async function pendingChecklistItems(tx: Tx, cardId: string) {
  return tx.checklistItem.count({ where: { isDone: false, checklist: { cardId } } });
}

/**
 * Conclusão de um card (SPEC §6.B e §6.C), usada ao arrastar para FINALIZADAS e ao Aprovar:
 * 1. itens pendentes de checklist: exige confirmação (P23) e marca todos como concluídos;
 * 2. `move()` grava a etapa DONE e o evento;
 * 3. se for recorrente e for a primeira finalização, cria a próxima tarefa da série.
 */
export async function finishCard(
  tx: Tx,
  card: { id: string; boardId: string },
  actor: Actor,
  now: Date,
  completeChecklist: boolean,
  move: () => Promise<void>,
) {
  const pending = await pendingChecklistItems(tx, card.id);
  if (pending > 0) {
    if (!completeChecklist) {
      throw invalid(
        `Esta tarefa tem ${pending} ${pending === 1 ? "item pendente" : "itens pendentes"} na checklist. Confirme para marcá-los como concluídos.`,
      );
    }
    await tx.checklistItem.updateMany({
      where: { isDone: false, checklist: { cardId: card.id } },
      data: { isDone: true, doneAt: now, doneById: actor.id },
    });
    await tx.cardEvent.create({
      data: { cardId: card.id, boardId: card.boardId, actorId: actor.id, type: "CHECKLIST_CHANGED", data: { action: "all_completed", count: pending }, createdAt: now },
    });
  }
  await move();
  return spawnNextRecurrence(tx, card.id, actor, now);
}

/**
 * Cria a próxima tarefa de uma série recorrente (SPEC §6.C, P25–P29).
 * Idempotente: se o card já gerou um sucessor (recurrenceParentId é único), não faz nada.
 */
export async function spawnNextRecurrence(tx: Tx, cardId: string, actor: Actor, now: Date) {
  const card = await tx.card.findUnique({
    where: { id: cardId },
    include: {
      recurrenceChild: { select: { id: true } },
      labels: { include: { label: { select: { id: true, isActive: true } } } },
      assignees: {
        include: { user: { select: { id: true, role: true, isActive: true, boardMemberships: { select: { boardId: true } } } } },
      },
      checklists: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!card || card.deletedAt || !card.isRecurring || !card.recurrenceFrequency || !card.dueDate) return null;
  if (card.recurrenceChild) return null;

  const nextDue = getNextRecurrenceDate({
    dueDate: dateOnlyFromDb(card.dueDate),
    frequency: card.recurrenceFrequency,
    today: todayInSaoPaulo(now),
    endDate: card.recurrenceEndDate ? dateOnlyFromDb(card.recurrenceEndDate) : null,
    anchorDay: card.recurrenceAnchorDay,
  });
  if (!nextDue) return null; // passou da data final

  const assigneeIds = card.assignees
    .filter(({ user }) =>
      canBeAssignee(
        { id: user.id, role: user.role as Role, isActive: user.isActive },
        { isBoardMember: user.boardMemberships.some((m) => m.boardId === card.boardId) },
      ),
    )
    .map((a) => a.userId);

  const child = await tx.card.create({
    data: {
      boardId: card.boardId,
      title: card.title,
      description: card.description,
      stage: "ACTIVE",
      dueDate: dateOnlyToDb(nextDue),
      requesterAreaId: card.requesterAreaId,
      createdById: card.createdById,
      isRecurring: true,
      recurrenceFrequency: card.recurrenceFrequency,
      recurrenceEndDate: card.recurrenceEndDate,
      recurrenceAnchorDay: card.recurrenceAnchorDay,
      recurrenceParentId: card.id,
      createdAt: now,
      labels: { create: card.labels.filter((l) => l.label.isActive).map((l) => ({ labelId: l.labelId })) },
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      checklists: {
        create: card.checklists.map((cl) => ({
          title: cl.title,
          position: cl.position,
          items: { create: cl.items.map((it) => ({ text: it.text, position: it.position })) },
        })),
      },
    },
  });

  await tx.cardEvent.createMany({
    data: [
      { cardId: child.id, boardId: card.boardId, actorId: actor.id, type: "CREATED", toStage: "ACTIVE", data: { recurrenceOf: card.id, dueDate: nextDue }, createdAt: now },
      { cardId: card.id, boardId: card.boardId, actorId: actor.id, type: "RECURRENCE_SPAWNED", data: { childId: child.id, dueDate: nextDue }, createdAt: now },
    ],
  });
  await createNotifications(tx, assigneeIds, { type: "RECURRENCE_CREATED", cardId: child.id, actorId: actor.id });
  return { id: child.id, dueDate: nextDue };
}
