import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Esqueci minha senha · Kanban Marketing" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="text-3xl">🔑</div>
          <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">Informe o seu e-mail. Enviaremos um link para você criar uma nova senha.</p>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}
