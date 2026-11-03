import "server-only";
import type { AuthAdminPort } from "@/server/services/users";
import { createSupabaseAdminClient } from "./admin";

/** Implementação real das operações de conta de login, usando o Supabase Auth. */
export function supabaseAuthAdmin(): AuthAdminPort {
  const admin = createSupabaseAdminClient().auth.admin;
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(`Supabase Auth: ${error.message}`);
  };
  return {
    async createUser(email, password) {
      const { data, error } = await admin.createUser({ email, password, email_confirm: true });
      if (error?.message.toLowerCase().includes("already")) {
        throw new Error("Este e-mail já tem uma conta de login no Supabase.");
      }
      check(error);
      return { id: data.user!.id };
    },
    async findUserIdByEmail(email) {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.listUsers({ page, perPage: 200 });
        check(error);
        const found = data.users.find((u) => u.email?.toLowerCase() === email);
        if (found) return found.id;
        if (data.users.length < 200) break;
      }
      return null;
    },
    async deleteUser(id) {
      check((await admin.deleteUser(id)).error);
    },
    async setPassword(id, password) {
      check((await admin.updateUserById(id, { password })).error);
    },
    async setEmail(id, email) {
      check((await admin.updateUserById(id, { email, email_confirm: true })).error);
    },
    async setBanned(id, banned) {
      check((await admin.updateUserById(id, { ban_duration: banned ? "876000h" : "none" })).error);
    },
  };
}
