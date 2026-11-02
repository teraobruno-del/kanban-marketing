import { notFound } from "next/navigation";
import { CheckCircle2, Clock, AlertTriangle, Target, Hourglass, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDashboard } from "@/server/services/dashboard";
import { formatDuration, WORKLOAD_COLUMNS } from "@/lib/dashboard/metrics";
import { formatDateOnly } from "@/lib/format";
import { DashboardFilters, GranularityToggle } from "@/components/dashboard/filters";
import { AreasChart, VolumeChart, WorkloadChart, WORKLOAD_LABELS } from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard · Kanban Marketing" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound(); // só Administrador (SPEC §7)
  const sp = await searchParams;
  const d = await getDashboard(prisma, user, {
    boards: many(sp.boards), period: one(sp.period), from: one(sp.from), to: one(sp.to), area: one(sp.area), group: one(sp.group),
  });
  const p = d.filters.period;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {formatDateOnly(p.from)} a {formatDateOnly(p.to)}
          {d.filters.area && <> · área {d.filters.area}</>}
          {d.filters.boardIds.length > 0 && <> · {d.filters.boardIds.length} {d.filters.boardIds.length === 1 ? "quadro" : "quadros"}</>}
        </p>
      </div>

      <DashboardFilters filters={d.filters} />

      {/* Números em destaque */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <Kpi icon={<CheckCircle2 />} label="Concluídas no período" value={String(d.completedCount)} hint={`${d.createdCount} criadas`} />
        <Kpi icon={<Target />} label="Entregas no prazo" value={d.onTime.pct === null ? "—" : `${String(d.onTime.pct).replace(".", ",")}%`}
          hint={d.onTime.considered ? `${d.onTime.onTime} de ${d.onTime.considered} com prazo` : "nenhuma com prazo"} />
        <Kpi icon={<AlertTriangle />} label="Atrasadas agora" value={String(d.overdueNow)} hint="tarefas abertas com prazo vencido" alert={d.overdueNow > 0} />
        <Kpi icon={<Clock />} label="Tempo de entrega (mediana)" value={formatDuration(d.leadTime.median)}
          hint={d.leadTime.count ? `média ${formatDuration(d.leadTime.mean)}` : "sem tarefas concluídas"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Volume: criadas × concluídas" action={<GranularityToggle value={d.filters.granularity} />}
          empty={d.volume.every((b) => b.created + b.completed === 0)}
          table={{ head: ["Início", "Criadas", "Concluídas"], rows: d.volume.map((b) => [b.label, b.created, b.completed]) }}>
          <VolumeChart data={d.volume} />
        </Panel>

        <Panel title="Áreas demandantes" subtitle="Tarefas criadas no período, por área solicitante" empty={d.areas.length === 0}
          table={{ head: ["Área", "Tarefas"], rows: d.areas.map((a) => [a.name, a.count]) }}>
          <AreasChart data={d.areas} />
        </Panel>

        <Panel title="Carga por pessoa" subtitle="Tarefas ativas agora, por responsável e coluna" className="lg:col-span-2"
          empty={d.workload.length === 0}
          table={{ head: ["Pessoa", ...WORKLOAD_COLUMNS.map((k) => WORKLOAD_LABELS[k]), "Total"], rows: d.workload.map((r) => [r.name, ...WORKLOAD_COLUMNS.map((k) => r.counts[k]), r.total]) }}>
          <WorkloadChart data={d.workload} />
        </Panel>

        <Panel title="Gargalo de aprovação" subtitle="Tempo que cada tarefa concluída no período passou em APROVAÇÃO (somando todas as vezes)">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Hourglass />} label="Média por tarefa" value={formatDuration(d.approval.mean)} />
            <Stat label="Mediana" value={formatDuration(d.approval.median)} />
            <Stat label="Tarefas que passaram por aprovação" value={String(d.approval.count)} />
            <Stat label="Aguardando aprovação agora" value={String(d.approval.waitingNow)}
              hint={d.approval.oldestWaiting !== null ? `a mais antiga há ${formatDuration(d.approval.oldestWaiting)}` : undefined} />
          </div>
        </Panel>

        <Panel title="Retrabalho" subtitle="Tarefas concluídas no período que voltaram para ALTERAÇÃO">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<RotateCcw />} label="Tiveram retrabalho" value={d.rework.pct === null ? "—" : `${String(d.rework.pct).replace(".", ",")}%`}
              hint={d.rework.completed ? `${d.rework.reworked} de ${d.rework.completed} concluídas` : "sem tarefas concluídas"} />
            <Stat label="Voltas para ALTERAÇÃO (média)" value={d.rework.avgCycles === null ? "—" : String(d.rework.avgCycles).replace(".", ",")}
              hint="entre as que tiveram retrabalho" />
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Kpi({ icon, label, value, hint, alert }: { icon: React.ReactNode; label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border bg-background p-4 ${alert ? "border-red-300" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-4">
        <span className={alert ? "text-red-600" : ""}>{icon}</span> {label}
      </div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-red-700" : ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Panel({ title, subtitle, action, children, empty, table, className = "" }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; empty?: boolean;
  table?: { head: string[]; rows: (string | number)[][] }; className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-background p-4 ${className}`} aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? <p className="py-10 text-center text-sm text-muted-foreground">Sem dados para estes filtros.</p> : children}
      {table && !empty && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Ver dados em tabela</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b">{table.head.map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="px-2 py-1 tabular-nums">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
