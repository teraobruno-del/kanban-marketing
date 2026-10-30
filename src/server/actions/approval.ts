"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import * as svc from "@/server/services/approval";
import * as notif from "@/server/services/notifications";
import { run } from "./run";

async function refresh(cardId: string) {
  const c = await prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } });
  if (c) revalidatePath(`/boards/${c.boardId}`);
  revalidatePath("/");
}

export async function requestApprovalAction(cardId: string) {
  return run(async (u) => {
    await svc.requestApproval(prisma, u, cardId);
    await refresh(cardId);
  });
}

export async function approveCardAction(cardId: string) {
  return run(async (u) => {
    await svc.approveCard(prisma, u, cardId);
    await refresh(cardId);
  });
}

export async function rejectCardAction(cardId: string, reason: string) {
  return run(async (u) => {
    await svc.rejectCard(prisma, u, cardId, reason);
    await refresh(cardId);
  });
}

/** Dados do sininho: avisos recentes + tarefas aguardando aprovação do usuário. */
export async function getInboxAction() {
  return run(async (u) => ({
    notifications: await notif.listNotifications(prisma, u),
    pending: await notif.listPendingApprovals(prisma, u),
  }));
}

export async function markNotificationsReadAction(ids?: string[]) {
  return run(async (u) => {
    await notif.markNotificationsRead(prisma, u, ids);
  });
}
