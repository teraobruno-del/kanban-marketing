import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listUsers } from "@/server/services/users";
import { UsersAdmin } from "@/components/admin/users-admin";

export const metadata = { title: "Usuários · Kanban Marketing" };

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const users = await listUsers(prisma, user);
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Só o Administrador cadastra usuários. “Desativar” bloqueia o acesso e preserva o histórico.
        </p>
      </div>
      <UsersAdmin users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} currentUserId={user.id} />
    </main>
  );
}
