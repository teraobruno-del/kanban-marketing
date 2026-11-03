"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { supabaseStorage } from "@/lib/supabase/storage";
import * as svc from "@/server/services/trash";
import { run } from "./run";

export async function restoreCardAction(cardId: string) {
  return run(async (u) => {
    const { boardId } = await svc.restoreCard(prisma, u, cardId);
    revalidatePath(`/boards/${boardId}`, "layout");
  });
}

export async function purgeCardAction(cardId: string) {
  return run(async (u) => {
    const { boardId } = await svc.purgeCard(prisma, supabaseStorage(), u, cardId);
    revalidatePath(`/boards/${boardId}`, "layout");
  });
}
