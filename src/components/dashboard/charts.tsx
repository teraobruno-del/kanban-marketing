"use client";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import type { DashboardData } from "@/server/services/dashboard";
import { WORKLOAD_COLUMNS } from "@/lib/dashboard/metrics";

/**
 * Cores validadas para daltonismo (guia de visualização; ordem testada lado a lado).
 * Volume: 2 séries (azul / verde-água). Carga por pessoa: uma cor por coluna, mantendo
 * vermelho = atrasadas, roxo = aprovação, amarelo = alteração (como no quadro).
 */
const BLUE = "#2a78d6";
const AQUA = "#1baf7a";
export const WORKLOAD_COLORS: Record<(typeof WORKLOAD_COLUMNS)[number], string> = {
  OVERDUE: "#e34948",
  TODAY: "#2a78d6",
  THIS_WEEK: "#eb6834",
  UPCOMING: "#1baf7a",
  APPROVAL: "#6250d6",
  CHANGES: "#eda100",
};
export const WORKLOAD_LABELS: Record<(typeof WORKLOAD_COLUMNS)[number], string> = {
  OVERDUE: "Atrasadas",
  TODAY: "Hoje",
  THIS_WEEK: "Esta semana",
  UPCOMING: "Este mês / próximos",
  APPROVAL: "Aprovação",
  CHANGES: "Alteração",
};

const axis = { stroke: "#a3a29d", fontSize: 12, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="#ecebe8" vertical={false} />;
const tooltipStyle = { borderRadius: 8, border: "1px solid #e5e4e0", fontSize: 13 };
/** Legenda na ordem das séries (não alfabética) e com texto neutro; a bolinha colorida identifica a série. */
const legendProps = {
  iconType: "circle" as const,
  itemSorter: null,
  formatter: (value: string) => <span style={{ color: "#3f3e3b" }}>{value}</span>,
};

export function VolumeChart({ data }: { data: DashboardData["volume"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f2ef" }} labelFormatter={(l) => `Início: ${l}`} />
        <Legend {...legendProps} wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="created" name="Criadas" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="completed" name="Concluídas" fill={AQUA} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WorkloadChart({ data }: { data: DashboardData["workload"] }) {
  const rows = data.map((r) => ({ name: r.name, ...r.counts }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 40 + 60)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#ecebe8" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="name" width={130} {...axis} stroke="#52514e" />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f2ef" }} />
        <Legend {...legendProps} wrapperStyle={{ fontSize: 12 }} />
        {WORKLOAD_COLUMNS.map((k, i) => (
          <Bar
            key={k} dataKey={k} name={WORKLOAD_LABELS[k]} stackId="a" fill={WORKLOAD_COLORS[k]}
            stroke="#ffffff" strokeWidth={2}
            radius={i === WORKLOAD_COLUMNS.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreasChart({ data }: { data: DashboardData["areas"] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={120} {...axis} stroke="#52514e" />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f2ef" }} formatter={(v) => [v, "Tarefas"]} />
        <Bar dataKey="count" name="Tarefas" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" fontSize={12} fill="#52514e" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
