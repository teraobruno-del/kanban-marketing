"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { supabaseAuthAdmin } from "@/lib/supabase/auth-admin";
import * as svc from "@/server/services/users";
import { run } from "./run";

const refresh = () => revalidatePath("/admin/users");

export async function createUserAction(input: { name: string; email: string; role: string; password: string }) {
  return run(async (u) => {
    await svc.createUser(prisma, supabaseAuthAdmin(), u, input);
    refresh();
  });
}

export async function updateUserAction(userId: string, input: { name: string; role: string }) {
  return run(async (u) => {
    await svc.updateUser(prisma, u, userId, input);
    refresh();
  });
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  return run(async (u) => {
    await svc.setUserActive(prisma, supabaseAuthAdmin(), u, userId, isActive);
    refresh();
  });
}

export async function resetUserPasswordAction(userId: string, password: string) {
  return run(async (u) => {
    await svc.resetUserPassword(prisma, supabaseAuthAdmin(), u, userId, password);
  });
}
