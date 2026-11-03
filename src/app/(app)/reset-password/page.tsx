import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const metadata = { title: "Nova senha · Kanban Marketing" };

/** Aberta pelo link do e-mail "Esqueci minha senha" (a pessoa já entra conectada pelo link). */
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">Olá, {user.name}. Escolha a sua nova senha abaixo.</p>
      </div>
      <ChangePasswordForm />
      <p className="text-sm"><Link href="/" className="underline underline-offset-4">Ir para os quadros</Link></p>
    </main>
  );
}
