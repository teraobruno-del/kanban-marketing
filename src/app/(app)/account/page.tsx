import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const metadata = { title: "Minha conta · Kanban Marketing" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <dl className="space-y-2 rounded-xl border bg-background p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Nome</dt><dd>{user.name}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">E-mail</dt><dd>{user.email}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Papel</dt><dd>{ROLE_LABELS[user.role]}</dd></div>
      </dl>
      <ChangePasswordForm />
    </main>
  );
}
