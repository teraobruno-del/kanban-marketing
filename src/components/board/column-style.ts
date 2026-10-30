import type { ColumnKey } from "@/lib/board/columns";

/** Cor de identificação de cada coluna (só visual) e texto do estado vazio. */
export const COLUMN_STYLE: Record<ColumnKey, { accent: string; tint: string; empty: string }> = {
  NEW: { accent: "#64748B", tint: "", empty: "Tarefas sem prazo aparecem aqui." },
  OVERDUE: { accent: "#DC2626", tint: "bg-red-50/80", empty: "Nenhuma tarefa atrasada. 🎉" },
  TODAY: { accent: "#EA580C", tint: "", empty: "Nada vence hoje." },
  THIS_WEEK: { accent: "#D97706", tint: "", empty: "Nada vence no resto da semana." },
  UPCOMING: { accent: "#0284C7", tint: "", empty: "Nada com prazo depois desta semana." },
  APPROVAL: { accent: "#7C3AED", tint: "", empty: "Arraste para cá o que está aguardando aprovação." },
  CHANGES: { accent: "#CA8A04", tint: "", empty: "Arraste para cá o que precisa de ajustes." },
  DONE: { accent: "#16A34A", tint: "", empty: "Arraste para cá o que foi concluído." },
};
