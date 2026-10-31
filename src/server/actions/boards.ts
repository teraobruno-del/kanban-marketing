"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import * as svc from "@/server/services/boards";
import { supabaseStorage } from "@/lib/supabase/storage";
import { run } from "./run";

const refresh = (boardId?: string) => {
  revalidatePath("/");
  if (boardId) revalidatePath(`/boards/${boardId}`, "layout");
};

export async function createBoardAction(name: string) {
  return run(async (u) => {
    const b = await svc.createBoard(prisma, u, { name });
    refresh();
    return { id: b.id };
  });
}

export async function renameBoardAction(boardId: string, name: string) {
  return run(async (u) => {
    await svc.renameBoard(prisma, u, boardId, { name });
    refresh(boardId);
  });
}

export async function setBoardArchivedAction(boardId: string, archived: boolean) {
  return run(async (u) => {
    await svc.setBoardArchived(prisma, u, boardId, archived);
    refresh(boardId);
  });
}

export async function deleteBoardAction(boardId: string, confirmName: string) {
  return run(async (u) => {
    await svc.deleteBoard(prisma, u, boardId, confirmName, supabaseStorage());
    refresh();
  });
}

export async function setBoardMembersAction(boardId: string, userIds: string[]) {
  return run(async (u) => {
    await svc.setBoardMembers(prisma, u, boardId, userIds);
    refresh(boardId);
  });
}

export async function createBoardItemAction(kind: svc.BoardItemKind, boardId: string, input: { name: string; color: string }) {
  return run(async (u) => {
    await svc.createBoardItem(prisma, u, kind, boardId, input);
    refresh(boardId);
  });
}

export async function updateBoardItemAction(kind: svc.BoardItemKind, boardId: string, itemId: string, input: { name: string; color: string }) {
  return run(async (u) => {
    await svc.updateBoardItem(prisma, u, kind, itemId, input);
    refresh(boardId);
  });
}

export async function setBoardItemActiveAction(kind: svc.BoardItemKind, boardId: string, itemId: string, isActive: boolean) {
  return run(async (u) => {
    await svc.setBoardItemActive(prisma, u, kind, itemId, isActive);
    refresh(boardId);
  });
}

export async function deleteBoardItemAction(kind: svc.BoardItemKind, boardId: string, itemId: string) {
  return run(async (u) => {
    await svc.deleteBoardItem(prisma, u, kind, itemId);
    refresh(boardId);
  });
}
