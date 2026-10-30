import Link from "next/link";
import { LayoutGrid, AlertTriangle, CalendarClock, Hourglass } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listBoards } from "@/server/services/boards";
import { NewBoardDialog } from "@/components/boards/new-board-dialog";
import { RestoreBoardButton } from "@/components/boards/restore-board-button";

export const metadata = { title: "Quadros · Kanban Marketing" };

export default async function BoardsPage() {
  const user = await requireUser();
  const { active, archived } = await listBoards(prisma, user);
  const isAdmin = user.role === "ADMIN";
  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Todos os quadros do sistema." : "Quadros dos quais você participa."}
          </p>
        </div>
        {isAdmin && <NewBoardDialog />}
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background p-12 text-center">
          <LayoutGrid className="size-10 text-muted-foreground" />
          <div className="font-medium">{isAdmin ? "Nenhum quadro ainda" : "Você ainda não participa de nenhum quadro"}</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isAdmin
              ? "Crie o primeiro quadro, cadastre as áreas e etiquetas e dê acesso à equipe."
              : "Peça ao Administrador para liberar o seu acesso."}
          </p>
          {isAdmin && <NewBoardDialog />}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="group block h-full rounded-xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="font-semibold group-hover:underline">{b.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {b.stats.open} {b.stats.open === 1 ? "tarefa em aberto" : "tarefas em aberto"}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Stat icon={<AlertTriangle />} label="atrasadas" value={b.stats.overdue} tone={b.stats.overdue > 0 ? "danger" : "muted"} />
                  <Stat icon={<CalendarClock />} label="hoje" value={b.stats.today} tone={b.stats.today > 0 ? "warn" : "muted"} />
                  <Stat icon={<Hourglass />} label="em aprovação" value={b.stats.approval} tone={b.stats.approval > 0 ? "info" : "muted"} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Arquivados</h2>
          <ul className="divide-y rounded-xl border bg-background">
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

const TONES = {
  danger: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-orange-50 text-orange-700 border-orange-200",
  info: "bg-violet-50 text-violet-700 border-violet-200",
  muted: "bg-muted/60 text-muted-foreground border-transparent",
};

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 [&_svg]:size-3.5 ${TONES[tone]}`}>
      {icon} <strong className="tabular-nums">{value}</strong> {label}
    </span>
  );
}
