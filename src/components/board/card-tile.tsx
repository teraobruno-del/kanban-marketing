"use client";
import { CheckSquare, AlignLeft } from "lucide-react";
import type { BoardCard } from "@/server/services/cards";
import { isOverdue } from "@/lib/dates/time-column";
import type { DateOnly } from "@/lib/dates/day";
import { formatDateOnlyShort, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Conteúdo visual de um card no quadro. */
export function CardTile({ card, today, dragging }: { card: BoardCard; today: DateOnly; dragging?: boolean }) {
  const done = card.stage === "DONE";
  const overdue = !done && isOverdue(card.dueDate, today);

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 bg-card p-3 text-left shadow-xs transition hover:shadow-md",
        dragging && "rotate-2 shadow-lg",
      )}
      style={{ borderLeftColor: card.area.color }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: card.area.color }}>
          {card.area.name}
        </span>
        {overdue && (
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white" title="Prazo vencido">
            ATRASADO
          </span>
        )}
      </div>

      <div className="text-sm font-medium leading-snug break-words">{card.title}</div>

      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span key={l.id} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {done ? (
          <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-medium text-white">✓ Concluído</span>
        ) : card.dueDate ? (
          <span className={cn("rounded px-1.5 py-0.5 font-medium", overdue ? "bg-red-100 text-red-700" : "bg-muted text-foreground")}>
            📅 {formatDateOnlyShort(card.dueDate)}
          </span>
        ) : null}
        {card.hasDescription && <AlignLeft className="size-3.5" aria-label="Tem descrição" />}
        {card.checklistTotal > 0 && (
          <span className={cn("flex items-center gap-1", card.checklistDone === card.checklistTotal && "text-emerald-700")}>
            <CheckSquare className="size-3.5" /> {card.checklistDone}/{card.checklistTotal}
          </span>
        )}
        <div className="ml-auto flex -space-x-1.5">
          {card.assignees.map((a) => (
            <span
              key={a.id}
              title={a.name}
              className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-slate-700 text-[10px] font-semibold text-white"
            >
              {initials(a.name)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
