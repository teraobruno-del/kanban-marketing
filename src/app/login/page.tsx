import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Kanban Marketing" };

const ERRORS: Record<string, string> = {
  "nao-cadastrado": "Este e-mail do Google não está cadastrado. Peça acesso ao Administrador.",
  "google": "Não foi possível entrar com o Google. Tente novamente.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="text-3xl">📋</div>
          <h1 className="text-xl font-semibold">Kanban Marketing</h1>
          <p className="text-sm text-muted-foreground">Entre para ver os seus quadros</p>
        </div>
        <LoginForm
          initialError={erro ? (ERRORS[erro] ?? ERRORS.google) : undefined}
          googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
        />
      </div>
    </main>
  );
}
