import type { Db } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  canApprove, canBeAssignee, canBeObserver, canChangeDueDate, canManageObservers, canComment, canDeleteAttachment, canDeleteCard, canDeleteComment,
  canEditCards, canEditComment, type Actor, type BoardAccess, type Role,
} from "@/lib/auth/permissions";
import { dateOnlyFromDb, dateOnlyToDb, parseDateOnly, todayInSaoPaulo, type DateOnly } from "@/lib/dates/day";
import type { ColumnKey } from "@/lib/board/columns";
import {
  completionFieldsForStageChange, eventTypeForStageChange, resolveDrop, stageAfterDueDateChange, stageForNewCard,
} from "@/lib/board/moves";
import { cardInputSchema, checklistItemTextSchema, checklistTitleSchema, dueDateSchema, type CardInput } from "@/lib/validation/schemas";
import { forbidden, invalid, notFound } from "@/server/errors";
import { loadBoardAccess } from "./boards";
import { requestApproval } from "./approval";
import { finishCard } from "./completion";
import { listComments, listMentionableUsers } from "./comments";
import { listAttachments, type StoragePort } from "./attachments";
import { parse } from "./util";

type Tx = Prisma.TransactionClient;

// ───────────────────────── Leitura ─────────────────────────

const cardListInclude = {
  requesterArea: { select: { id: true, name: true, color: true } },
  labels: { include: { label: { select: { id: true, name: true, color: true } } } },
  assignees: { include: { user: { select: { id: true, name: true } } } },
  observers: { select: { userId: true } },
  checklists: { select: { items: { select: { isDone: true } } } },
  coverAttachment: { select: { storagePath: true } },
  _count: { select: { comments: { where: { deletedAt: null } }, attachments: true, observers: true } },
} satisfies Prisma.CardInclude;

/** Dependências opcionais (armazenamento de arquivos); nos testes podem faltar. */
export interface CardDeps {
  storage?: StoragePort;
}

/** Tudo o que a tela do quadro precisa. */
/** FINALIZADAS mostra só as concluídas nos últimos N dias (decisão pós-SPEC 2). */
export const DONE_RECENT_DAYS = 30;

export async function getBoardView(
  db: Db, actor: Actor, boardId: string, deps: CardDeps = {}, opts: { allDone?: boolean; now?: Date } = {},
) {
  const { board, access } = await loadBoardAccess(db, actor, boardId);
  const now = opts.now ?? new Date();
  const doneCutoff = new Date(now.getTime() - DONE_RECENT_DAYS * 86_400_000);
  const oldDone = { boardId, deletedAt: null, stage: "DONE" as const, completedAt: { lt: doneCutoff } };
  const visible: Prisma.CardWhereInput = opts.allDone
    ? { boardId, deletedAt: null }
    : { boardId, deletedAt: null, NOT: { stage: "DONE", completedAt: { lt: doneCutoff } } };
  const [cards, areas, labels, assignableUsers, mentionableUsers, observableUsers, olderDoneCount] = await Promise.all([
    db.card.findMany({ where: visible, include: cardListInclude }),
    db.requesterArea.findMany({ where: { boardId }, orderBy: { name: "asc" } }),
    db.label.findMany({ where: { boardId }, orderBy: { name: "asc" } }),
    listAssignableUsers(db, boardId),
    listMentionableUsers(db, boardId),
    listObservableUsers(db, boardId),
    db.card.count({ where: oldDone }),
  ]);
  const coverPaths = cards.flatMap((c) => (c.coverAttachment ? [c.coverAttachment.storagePath] : []));
  const coverUrls = deps.storage && coverPaths.length ? await deps.storage.createDownloadUrls(coverPaths, 60 * 60) : {};
  return {
    board: { id: board.id, name: board.name, archived: board.archivedAt !== null },
    olderDoneCount,
    showingAllDone: opts.allDone === true,
    access,
    cards: cards.map((c) => {
      const items = c.checklists.flatMap((cl) => cl.items);
      return {
        id: c.id,
        title: c.title,
        stage: c.stage,
        dueDate: c.dueDate ? dateOnlyFromDb(c.dueDate) : null,
        createdAt: c.createdAt.toISOString(),
        createdById: c.createdById,
        area: c.requesterArea,
        labels: c.labels.map((l) => l.label),
        assignees: c.assignees.map((a) => a.user),
        observerIds: c.observers.map((o) => o.userId),
        checklistTotal: items.length,
        checklistDone: items.filter((i) => i.isDone).length,
        hasDescription: c.description.trim().length > 0,
        isRecurring: c.isRecurring,
        commentCount: c._count.comments,
        attachmentCount: c._count.attachments,
        observerCount: c._count.observers,
        coverUrl: c.coverAttachment ? (coverUrls[c.coverAttachment.storagePath] ?? null) : null,
      };
    }),
    areas: areas.map(({ id, name, color, isActive }) => ({ id, name, color, isActive })),
    labels: labels.map(({ id, name, color, isActive }) => ({ id, name, color, isActive })),
    assignableUsers,
    mentionableUsers,
    observableUsers,
  };
}

/** Usuários que podem ser observadores da tarefa: papel Observador, ativos, com acesso ao quadro. */
export async function listObservableUsers(db: Db, boardId: string) {
  return db.user.findMany({
    where: { isActive: true, role: "OBSERVER", boardMemberships: { some: { boardId } } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** Usuários que podem ser responsáveis no quadro: Admins ativos + Membros ativos com acesso. */
export async function listAssignableUsers(db: Db, boardId: string) {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: "ADMIN" }, { role: "MEMBER", boardMemberships: { some: { boardId } } }],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function getCardDetail(db: Db, actor: Actor, cardId: string, deps: CardDeps = {}) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: {
      ...cardListInclude,
      createdBy: { select: { id: true, name: true } },
      recurrenceChild: { select: { id: true } },
      observers: { include: { user: { select: { id: true, name: true } } } },
      checklists: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!card || card.deletedAt) throw notFound("Card não encontrado.");
  const { access } = await loadBoardAccess(db, actor, card.boardId);
  const [comments, attachments] = await Promise.all([
    listComments(db, card.id),
    listAttachments(db, deps.storage, card.id),
  ]);
  return {
    id: card.id,
    coverAttachmentId: card.coverAttachmentId,
    comments: comments.map((c) => ({
      ...c,
      canEdit: !c.deleted && canEditComment(actor, { authorId: c.author.id }),
      canDelete: !c.deleted && canDeleteComment(actor, { authorId: c.author.id }),
    })),
    attachments: attachments.map((a) => ({
      ...a,
      canDelete: canDeleteAttachment(actor, access, { uploadedById: a.uploadedBy.id }),
    })),
    boardId: card.boardId,
    title: card.title,
    description: card.description,
    stage: card.stage,
    dueDate: card.dueDate ? dateOnlyFromDb(card.dueDate) : null,
    completedAt: card.completedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    createdBy: card.createdBy,
    area: card.requesterArea,
    labels: card.labels.map((l) => l.label),
    assignees: card.assignees.map((a) => a.user),
    observers: card.observers.map((o) => o.user),
    checklists: card.checklists.map((cl) => ({
      id: cl.id,
      title: cl.title,
      items: cl.items.map((i) => ({ id: i.id, text: i.text, isDone: i.isDone })),
    })),
    events: card.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStage: e.fromStage,
      toStage: e.toStage,
      data: e.data,
      actorName: e.actor.name,
      createdAt: e.createdAt.toISOString(),
    })),
    recurrence: card.isRecurring && card.recurrenceFrequency
      ? {
          frequency: card.recurrenceFrequency,
          endDate: card.recurrenceEndDate ? dateOnlyFromDb(card.recurrenceEndDate) : null,
          nextCreated: card.recurrenceChild !== null,
        }
      : null,
    lastRejection: (() => {
      if (card.stage !== "CHANGES") return null;
      const e = card.events.find((ev) => ev.type === "REJECTED");
      const reason = (e?.data as { reason?: string } | null)?.reason;
      return e && reason ? { actorName: e.actor.name, reason, createdAt: e.createdAt.toISOString() } : null;
    })(),
    permissions: {
      canComment: canComment(actor, access),
      canApprove: canApprove(actor, access, card),
      canEdit: canEditCards(actor, access),
      canChangeDueDate: canChangeDueDate(actor, access, card),
      canManageObservers: canManageObservers(actor, access, card),
      canDelete: canDeleteCard(actor),
    },
  };
}

// ───────────────────────── Validações de referência ─────────────────────────

async function checkReferences(
  tx: Tx,
  boardId: string,
  input: { requesterAreaId: string; labelIds: string[]; assigneeIds: string[]; observerIds?: string[] },
  current?: { requesterAreaId: string; labelIds: string[]; assigneeIds: string[]; observerIds?: string[] },
) {
  const area = await tx.requesterArea.findUnique({ where: { id: input.requesterAreaId } });
  if (!area || area.boardId !== boardId) throw invalid("Área solicitante inválida.");
  // Área desativada só pode continuar num card que já a usava (decisão 6A).
  if (!area.isActive && current?.requesterAreaId !== area.id) throw invalid("Esta área solicitante está desativada.");

  const labelIds = [...new Set(input.labelIds)];
  const labels = await tx.label.findMany({ where: { id: { in: labelIds } } });
  if (labels.length !== labelIds.length || labels.some((l) => l.boardId !== boardId)) {
    throw invalid("Etiqueta inválida.");
  }
  if (labels.some((l) => !l.isActive && !current?.labelIds.includes(l.id))) {
    throw invalid("Uma das etiquetas está desativada.");
  }

  const assigneeIds = [...new Set(input.assigneeIds)];
  const newAssignees = assigneeIds.filter((id) => !current?.assigneeIds.includes(id));
  if (newAssignees.length > 0) {
    const users = await tx.user.findMany({
      where: { id: { in: newAssignees } },
      include: { boardMemberships: { where: { boardId }, select: { userId: true } } },
    });
    const ok =
      users.length === newAssignees.length &&
      users.every((u) =>
        canBeAssignee({ id: u.id, role: u.role as Role, isActive: u.isActive }, { isBoardMember: u.boardMemberships.length > 0 }),
      );
    if (!ok) throw invalid("Responsável inválido: escolha Administradores ou Membros com acesso ao quadro.");
  }
  // Observadores: papel Observador com acesso ao quadro; nunca também responsável.
  const observerIds = [...new Set(input.observerIds ?? [])].filter((id) => !assigneeIds.includes(id));
  const newObservers = observerIds.filter((id) => !current?.observerIds?.includes(id));
  if (newObservers.length > 0) {
    const users = await tx.user.findMany({
      where: { id: { in: newObservers } },
      include: { boardMemberships: { where: { boardId }, select: { userId: true } } },
    });
    const ok =
      users.length === newObservers.length &&
      users.every((u) =>
        canBeObserver({ id: u.id, role: u.role as Role, isActive: u.isActive }, { isBoardMember: u.boardMemberships.length > 0 }),
      );
    if (!ok) throw invalid("Observador inválido: escolha usuários com papel Observador que tenham acesso ao quadro.");
  }
  return { labelIds, assigneeIds, observerIds };
}

async function addEvent(
  tx: Tx,
  card: { id: string; boardId: string },
  actor: Actor,
  type: Prisma.CardEventCreateManyInput["type"],
  extra: Partial<Pick<Prisma.CardEventCreateManyInput, "fromStage" | "toStage" | "data">> = {},
  at?: Date,
) {
  await tx.cardEvent.create({
    data: { cardId: card.id, boardId: card.boardId, actorId: actor.id, type, ...extra, ...(at ? { createdAt: at } : {}) },
  });
}

async function requireEditableCard(db: Db | Tx, actor: Actor, cardId: string) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: {
      labels: { select: { labelId: true } },
      assignees: { select: { userId: true } },
      observers: { select: { userId: true } },
    },
  });
  if (!card || card.deletedAt) throw notFound("Card não encontrado.");
  const { access } = await loadBoardAccess(db as Db, actor, card.boardId);
  if (!canEditCards(actor, access)) throw forbidden();
  return { card, access };
}

// ───────────────────────── Criar / editar ─────────────────────────

/** Campos de recorrência gravados no card (SPEC §6.C). Mensal guarda o dia do prazo como "dia original". */
function recurrenceData(r: { frequency: "DAILY" | "WEEKLY" | "MONTHLY" | null; endDate: DateOnly | null }, dueDate: DateOnly | null) {
  if (!r.frequency || !dueDate) {
    return { isRecurring: false, recurrenceFrequency: null, recurrenceEndDate: null, recurrenceAnchorDay: null };
  }
  return {
    isRecurring: true,
    recurrenceFrequency: r.frequency,
    recurrenceEndDate: r.endDate ? dateOnlyToDb(r.endDate) : null,
    recurrenceAnchorDay: parseDateOnly(dueDate).day,
  };
}

export async function createCard(db: Db, actor: Actor, boardId: string, raw: CardInput, now = new Date()) {
  const { board, access } = await loadBoardAccess(db, actor, boardId);
  if (!canEditCards(actor, access)) throw forbidden();
  if (board.archivedAt) throw invalid("Este quadro está arquivado.");
  const input = parse(cardInputSchema, raw);

  return db.$transaction(async (tx) => {
    const { labelIds, assigneeIds, observerIds } = await checkReferences(tx, boardId, input);
    const stage = stageForNewCard(input.dueDate);
    const card = await tx.card.create({
      data: {
        boardId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? dateOnlyToDb(input.dueDate) : null,
        stage,
        requesterAreaId: input.requesterAreaId,
        createdById: actor.id,
        createdAt: now,
        ...recurrenceData(input.recurrence, input.dueDate),
        labels: { create: labelIds.map((labelId) => ({ labelId })) },
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        observers: { create: observerIds.map((userId) => ({ userId })) },
      },
    });
    await addEvent(tx, card, actor, "CREATED", { toStage: stage, data: { dueDate: input.dueDate } }, now);
    return card;
  });
}

export async function updateCard(db: Db, actor: Actor, cardId: string, raw: CardInput, now = new Date()) {
  const { card, access } = await requireEditableCard(db, actor, cardId);
  const input = parse(cardInputSchema, raw);
  const oldDue: DateOnly | null = card.dueDate ? dateOnlyFromDb(card.dueDate) : null;
  const dueChanged = input.dueDate !== oldDue;
  if (dueChanged && !canChangeDueDate(actor, access, card)) {
    throw forbidden("Só o Administrador ou quem criou o card pode alterar o prazo.");
  }
  const oldRecurrence = {
    frequency: card.isRecurring ? card.recurrenceFrequency : null,
    endDate: card.isRecurring && card.recurrenceEndDate ? dateOnlyFromDb(card.recurrenceEndDate) : null,
  };
  const recurrenceChanged =
    input.recurrence.frequency !== oldRecurrence.frequency ||
    (input.recurrence.frequency !== null && input.recurrence.endDate !== oldRecurrence.endDate);
  if (recurrenceChanged && !canChangeDueDate(actor, access, card)) {
    throw forbidden("Só o Administrador ou quem criou a tarefa pode mudar a repetição.");
  }

  return db.$transaction(async (tx) => {
    const current = {
      requesterAreaId: card.requesterAreaId,
      labelIds: card.labels.map((l) => l.labelId),
      assigneeIds: card.assignees.map((a) => a.userId),
      observerIds: card.observers.map((o) => o.userId),
    };
    const { labelIds, assigneeIds, observerIds } = await checkReferences(tx, card.boardId, input, current);
    const newStage = dueChanged ? stageAfterDueDateChange(card.stage, input.dueDate) : card.stage;

    await tx.card.update({
      where: { id: cardId },
      data: {
        title: input.title,
        description: input.description,
        requesterAreaId: input.requesterAreaId,
        dueDate: input.dueDate ? dateOnlyToDb(input.dueDate) : null,
        stage: newStage,
        // Recorrência: recalculada se mudou a repetição ou o prazo (o "dia original" segue o novo prazo).
        ...(recurrenceChanged || dueChanged ? recurrenceData(input.recurrence, input.dueDate) : {}),
      },
    });

    const changed: string[] = [];
    if (input.title !== card.title) changed.push("title");
    if (input.description !== card.description) changed.push("description");
    if (input.requesterAreaId !== card.requesterAreaId) changed.push("requesterArea");
    if (recurrenceChanged) changed.push("recurrence");
    if (changed.length) await addEvent(tx, card, actor, "UPDATED", { data: { fields: changed } }, now);

    if (dueChanged) await addEvent(tx, card, actor, "DUE_DATE_CHANGED", { data: { from: oldDue, to: input.dueDate } }, now);
    if (newStage !== card.stage) {
      await addEvent(tx, card, actor, "STAGE_CHANGED", { fromStage: card.stage, toStage: newStage, data: { reason: "dueDate" } }, now);
    }

    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (!sameSet(labelIds, current.labelIds)) {
      await tx.cardLabel.deleteMany({ where: { cardId } });
      await tx.cardLabel.createMany({ data: labelIds.map((labelId) => ({ cardId, labelId })) });
      await addEvent(tx, card, actor, "LABELS_CHANGED", { data: { labelIds } }, now);
    }
    if (!sameSet(assigneeIds, current.assigneeIds)) {
      await tx.cardAssignee.deleteMany({ where: { cardId, userId: { notIn: assigneeIds } } });
      await tx.cardAssignee.createMany({
        data: assigneeIds.map((userId) => ({ cardId, userId })),
        skipDuplicates: true,
      });
      await addEvent(tx, card, actor, "ASSIGNEES_CHANGED", { data: { assigneeIds } }, now);
    }
    if (!sameSet(observerIds, current.observerIds)) {
      if (!canManageObservers(actor, access, card)) {
        throw forbidden("Só quem criou a tarefa ou um Administrador pode incluir ou retirar observadores.");
      }
      await tx.cardObserver.deleteMany({ where: { cardId, userId: { notIn: observerIds } } });
      await tx.cardObserver.createMany({ data: observerIds.map((userId) => ({ cardId, userId })), skipDuplicates: true });
      await addEvent(tx, card, actor, "OBSERVERS_CHANGED", { data: { observerIds } }, now);
    }
  });
}

// ───────────────────────── Mover ─────────────────────────

export async function moveCard(
  db: Db, actor: Actor, cardId: string, target: ColumnKey, now = new Date(), opts: { completeChecklist?: boolean } = {},
) {
  const { card } = await requireEditableCard(db, actor, cardId);
  const due = card.dueDate ? dateOnlyFromDb(card.dueDate) : null;
  // Saída de APROVAÇÃO só por Aprovar/Reprovar (SPEC §6.E).
  if (card.stage === "APPROVAL" && target !== "APPROVAL") {
    throw invalid("Uma tarefa em APROVAÇÃO só sai pelos botões Aprovar ou Reprovar.");
  }
  // Entrar em APROVAÇÃO = enviar para aprovação (avisa o criador).
  if (target === "APPROVAL" && card.stage !== "APPROVAL") {
    if (card.stage === "DONE") throw invalid("Tarefas finalizadas não vão para aprovação. Reabra a tarefa primeiro.");
    await requestApproval(db, actor, cardId, now);
    return { nextRecurrence: null };
  }
  const result = resolveDrop({ stage: card.stage, dueDate: due }, target, todayInSaoPaulo(now));
  if (!result.ok) {
    if (result.sameColumn) return { nextRecurrence: null };
    throw invalid(result.reason);
  }
  if (result.stage === card.stage) return { nextRecurrence: null };

  const completion = completionFieldsForStageChange(card.stage, result.stage, due, now);
  const write = async (tx: Tx) => {
    await tx.card.update({ where: { id: cardId }, data: { stage: result.stage, ...(completion ?? {}) } });
    await addEvent(
      tx, card, actor, eventTypeForStageChange(card.stage, result.stage),
      { fromStage: card.stage, toStage: result.stage }, now,
    );
  };
  return db.$transaction(async (tx) => {
    if (result.stage === "DONE") {
      // Conclusão: checklist pendente (com confirmação) + próxima tarefa da série (SPEC §6.B/§6.C).
      const spawned = await finishCard(tx, card, actor, now, opts.completeChecklist ?? false, () => write(tx));
      return { nextRecurrence: spawned?.dueDate ?? null };
    }
    await write(tx);
    return { nextRecurrence: null };
  });
}

/**
 * Janela de "ajustar data" ao arrastar para uma coluna de prazo (SPEC §6.A, decisão F2-1A):
 * define o novo prazo (a partir de hoje) e coloca a tarefa em ACTIVE. Sair de FINALIZADAS = reabrir.
 */
export async function moveWithDueDate(db: Db, actor: Actor, cardId: string, rawDate: string, now = new Date()) {
  const { card, access } = await requireEditableCard(db, actor, cardId);
  if (!canChangeDueDate(actor, access, card)) {
    throw forbidden("Só o Administrador ou quem criou a tarefa pode mudar o prazo.");
  }
  if (card.stage === "APPROVAL") throw invalid("Uma tarefa em APROVAÇÃO só sai pelos botões Aprovar ou Reprovar.");
  const dueDate = parse(dueDateSchema, rawDate);
  if (!dueDate) throw invalid("Escolha uma data.");
  const today = todayInSaoPaulo(now);
  if (dueDate < today) throw invalid("Escolha uma data a partir de hoje.");

  const oldDue = card.dueDate ? dateOnlyFromDb(card.dueDate) : null;
  const completion = completionFieldsForStageChange(card.stage, "ACTIVE", dueDate, now);
  await db.$transaction(async (tx) => {
    await tx.card.update({
      where: { id: cardId },
      data: {
        dueDate: dateOnlyToDb(dueDate),
        stage: "ACTIVE",
        ...(completion ?? {}),
        ...(card.isRecurring && card.recurrenceFrequency === "MONTHLY" ? { recurrenceAnchorDay: parseDateOnly(dueDate).day } : {}),
      },
    });
    if (oldDue !== dueDate) await addEvent(tx, card, actor, "DUE_DATE_CHANGED", { data: { from: oldDue, to: dueDate } }, now);
    if (card.stage !== "ACTIVE") {
      await addEvent(tx, card, actor, eventTypeForStageChange(card.stage, "ACTIVE"), { fromStage: card.stage, toStage: "ACTIVE" }, now);
    }
  });
}

// ───────────────────────── Excluir (lixeira) ─────────────────────────

export async function deleteCard(db: Db, actor: Actor, cardId: string, now = new Date()) {
  if (!canDeleteCard(actor)) throw forbidden("Só o Administrador pode excluir cards.");
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card || card.deletedAt) throw notFound("Card não encontrado.");
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { deletedAt: now, deletedById: actor.id } });
    await addEvent(tx, card, actor, "DELETED", {}, now);
  });
}

// ───────────────────────── Checklists ─────────────────────────

async function requireEditableChecklist(db: Db, actor: Actor, checklistId: string) {
  const checklist = await db.checklist.findUnique({ where: { id: checklistId } });
  if (!checklist) throw notFound("Checklist não encontrada.");
  const { card } = await requireEditableCard(db, actor, checklist.cardId);
  return { checklist, card };
}

async function requireEditableItem(db: Db, actor: Actor, itemId: string) {
  const item = await db.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Item não encontrado.");
  const { card } = await requireEditableChecklist(db, actor, item.checklistId);
  return { item, card };
}

export async function addChecklist(db: Db, actor: Actor, cardId: string, raw: { title: string }) {
  const { card } = await requireEditableCard(db, actor, cardId);
  const { title } = parse(checklistTitleSchema, raw);
  const count = await db.checklist.count({ where: { cardId } });
  await db.$transaction(async (tx) => {
    await tx.checklist.create({ data: { cardId, title, position: count } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "checklist_added", title } });
  });
}

export async function deleteChecklist(db: Db, actor: Actor, checklistId: string) {
  const { checklist, card } = await requireEditableChecklist(db, actor, checklistId);
  await db.$transaction(async (tx) => {
    await tx.checklist.delete({ where: { id: checklistId } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "checklist_removed", title: checklist.title } });
  });
}

export async function addChecklistItem(db: Db, actor: Actor, checklistId: string, raw: { text: string }) {
  const { card } = await requireEditableChecklist(db, actor, checklistId);
  const { text } = parse(checklistItemTextSchema, raw);
  const count = await db.checklistItem.count({ where: { checklistId } });
  await db.$transaction(async (tx) => {
    await tx.checklistItem.create({ data: { checklistId, text, position: count } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "item_added", text } });
  });
}

export async function toggleChecklistItem(db: Db, actor: Actor, itemId: string, isDone: boolean, now = new Date()) {
  const { item, card } = await requireEditableItem(db, actor, itemId);
  if (item.isDone === isDone) return;
  await db.$transaction(async (tx) => {
    await tx.checklistItem.update({
      where: { id: itemId },
      data: { isDone, doneAt: isDone ? now : null, doneById: isDone ? actor.id : null },
    });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", {
      data: { action: isDone ? "item_checked" : "item_unchecked", text: item.text },
    }, now);
  });
}

/** Renomear checklist (Administrador ou Membro do quadro). */
export async function renameChecklist(db: Db, actor: Actor, checklistId: string, raw: { title: string }) {
  const { checklist, card } = await requireEditableChecklist(db, actor, checklistId);
  const { title } = parse(checklistTitleSchema, raw);
  if (title === checklist.title) return;
  await db.$transaction(async (tx) => {
    await tx.checklist.update({ where: { id: checklistId }, data: { title } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "checklist_renamed", from: checklist.title, title } });
  });
}

/** Editar o texto de um item da checklist (Administrador ou Membro do quadro). */
export async function editChecklistItem(db: Db, actor: Actor, itemId: string, raw: { text: string }) {
  const { item, card } = await requireEditableItem(db, actor, itemId);
  const { text } = parse(checklistItemTextSchema, raw);
  if (text === item.text) return;
  await db.$transaction(async (tx) => {
    await tx.checklistItem.update({ where: { id: itemId }, data: { text } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "item_edited", from: item.text, text } });
  });
}

export async function deleteChecklistItem(db: Db, actor: Actor, itemId: string) {
  const { item, card } = await requireEditableItem(db, actor, itemId);
  await db.$transaction(async (tx) => {
    await tx.checklistItem.delete({ where: { id: itemId } });
    await addEvent(tx, card, actor, "CHECKLIST_CHANGED", { data: { action: "item_removed", text: item.text } });
  });
}

export type BoardView = Awaited<ReturnType<typeof getBoardView>>;
export type BoardCard = BoardView["cards"][number];
export type CardDetail = Awaited<ReturnType<typeof getCardDetail>>;
export type { BoardAccess };
