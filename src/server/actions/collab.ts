"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { supabaseStorage } from "@/lib/supabase/storage";
import * as comments from "@/server/services/comments";
import * as attachments from "@/server/services/attachments";
import { run } from "./run";

async function refreshCard(cardId: string) {
  const c = await prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } });
  if (c) revalidatePath(`/boards/${c.boardId}`);
}

// ── Comentários ──
export async function addCommentAction(cardId: string, body: string, mentionIds: string[]) {
  return run(async (u) => {
    await comments.addComment(prisma, u, cardId, { body, mentionIds });
    await refreshCard(cardId);
  });
}

export async function editCommentAction(cardId: string, commentId: string, body: string, mentionIds: string[]) {
  return run(async (u) => {
    await comments.editComment(prisma, u, commentId, { body, mentionIds });
    await refreshCard(cardId);
  });
}

export async function deleteCommentAction(cardId: string, commentId: string) {
  return run(async (u) => {
    await comments.deleteComment(prisma, u, commentId);
    await refreshCard(cardId);
  });
}

// ── Anexos (envio em 2 passos: link assinado → confirmação) ──
export async function prepareUploadAction(cardId: string, file: { name: string; size: number }) {
  return run((u) => attachments.prepareUpload(prisma, supabaseStorage(), u, cardId, file));
}

export async function confirmUploadAction(cardId: string, input: { path: string; name: string; mimeType: string }) {
  return run(async (u) => {
    const r = await attachments.confirmUpload(prisma, supabaseStorage(), u, cardId, input);
    await refreshCard(cardId);
    return r;
  });
}

export async function deleteAttachmentAction(cardId: string, attachmentId: string) {
  return run(async (u) => {
    await attachments.deleteAttachment(prisma, supabaseStorage(), u, attachmentId);
    await refreshCard(cardId);
  });
}

export async function setCoverAction(cardId: string, attachmentId: string | null) {
  return run(async (u) => {
    await attachments.setCover(prisma, u, cardId, attachmentId);
    await refreshCard(cardId);
  });
}
