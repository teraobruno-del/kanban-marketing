import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listBoards } from "@/server/services/boards";
import { NewBoardForm } from "@/components/boards/new-board-form";
import { RestoreBoardButton } from "@/components/boards/restore-board-button";

export const metadata = { title: "Quadros · Kanban Marketing" };

export default async function BoardsPage() {
  const user = await requireUser();
  const { active, archived } = await listBoards(prisma, user);
  const isAdmin = user.role === "ADMIN";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Quadros</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Todos os quadros do sistema." : "Quadros dos quais você participa."}
          </p>
        </div>
        {isAdmin && <NewBoardForm />}
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {isAdmin
            ? "Nenhum quadro ainda. Crie o primeiro acima."
            : "Você ainda não participa de nenhum quadro. Peça acesso ao Administrador."}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="block rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="font-medium">{b.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {b._count.cards} {b._count.cards === 1 ? "tarefa em aberto" : "tarefas em aberto"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Arquivados</h2>
          <ul className="divide-y rounded-xl border">
            {archived.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <Link href={`/boards/${b.id}`} className="hover:underline">{b.name}</Link>
                <RestoreBoardButton boardId={b.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
