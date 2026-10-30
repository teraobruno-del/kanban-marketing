import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>📋</span> <span className="hidden sm:inline">Kanban Marketing</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" asChild><Link href="/">Quadros</Link></Button>
            {user.role === "ADMIN" && (
              <Button variant="ghost" size="sm" asChild><Link href="/admin/users">Usuários</Link></Button>
            )}
            <Button variant="ghost" size="sm" asChild><Link href="/account">Minha conta</Link></Button>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground md:inline">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">Sair</Button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
