"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { ColumnKey } from "@/lib/board/columns";
import type { CardInput } from "@/lib/validation/schemas";
import * as svc from "@/server/services/cards";
import { supabaseStorage } from "@/lib/supabase/storage";
import { run } from "./run";

const refresh = (boardId: string) => revalidatePath(`/boards/${boardId}`);

async function boardOf(cardId: string) {
  const c = await prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } });
  return c?.boardId;
}

export async function getCardDetailAction(cardId: string) {
  return run((u) => svc.getCardDetail(prisma, u, cardId, { storage: supabaseStorage() }));
}

export async function createCardAction(boardId: string, input: CardInput) {
  return run(async (u) => {
    const card = await svc.createCard(prisma, u, boardId, input);
    refresh(boardId);
    return { id: card.id };
  });
}

export async function updateCardAction(cardId: string, input: CardInput) {
  return run(async (u) => {
    await svc.updateCard(prisma, u, cardId, input);
    const b = await boardOf(cardId);
    if (b) refresh(b);
  });
}

export async function moveCardAction(cardId: string, target: ColumnKey, opts: { completeChecklist?: boolean } = {}) {
  return run(async (u) => {
    const r = await svc.moveCard(prisma, u, cardId, target, new Date(), opts);
    const b = await boardOf(cardId);
    if (b) refresh(b);
    return r;
  });
}

/** Janela de "ajustar data" ao arrastar para uma coluna de prazo. */
export async function moveWithDueDateAction(cardId: string, dueDate: string) {
  return run(async (u) => {
    await svc.moveWithDueDate(prisma, u, cardId, dueDate);
    const b = await boardOf(cardId);
    if (b) refresh(b);
  });
}

export async function deleteCardAction(cardId: string) {
  return run(async (u) => {
    await svc.deleteCard(prisma, u, cardId);
    const b = await boardOf(cardId);
    if (b) refresh(b);
  });
}

// ── Checklists ──
async function afterChecklist(cardId: string) {
  const b = await boardOf(cardId);
  if (b) refresh(b);
}

export async function addChecklistAction(cardId: string, title: string) {
  return run(async (u) => {
    await svc.addChecklist(prisma, u, cardId, { title });
    await afterChecklist(cardId);
  });
}

export async function deleteChecklistAction(cardId: string, checklistId: string) {
  return run(async (u) => {
    await svc.deleteChecklist(prisma, u, checklistId);
    await afterChecklist(cardId);
  });
}

export async function addChecklistItemAction(cardId: string, checklistId: string, text: string) {
  return run(async (u) => {
    await svc.addChecklistItem(prisma, u, checklistId, { text });
    await afterChecklist(cardId);
  });
}

export async function toggleChecklistItemAction(cardId: string, itemId: string, isDone: boolean) {
  return run(async (u) => {
    await svc.toggleChecklistItem(prisma, u, itemId, isDone);
    await afterChecklist(cardId);
  });
}

export async function deleteChecklistItemAction(cardId: string, itemId: string) {
  return run(async (u) => {
    await svc.deleteChecklistItem(prisma, u, itemId);
    await afterChecklist(cardId);
  });
}

export async function renameChecklistAction(cardId: string, checklistId: string, title: string) {
  return run(async (u) => {
    await svc.renameChecklist(prisma, u, checklistId, { title });
    await afterChecklist(cardId);
  });
}

export async function editChecklistItemAction(cardId: string, itemId: string, text: string) {
  return run(async (u) => {
    await svc.editChecklistItem(prisma, u, itemId, { text });
    await afterChecklist(cardId);
  });
}
