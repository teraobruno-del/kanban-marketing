"use client";
import { CheckSquare, AlignLeft, CalendarDays, CheckCircle2, AlertTriangle, Hourglass, Repeat, MessageSquare, Paperclip, Eye } from "lucide-react";
import type { BoardCard } from "@/server/services/cards";
import type { DateOnly } from "@/lib/dates/day";
import { describeDue, initials } from "@/lib/format";
import { readableTextColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const DUE_STYLE = {
  overdue: "bg-red-600 text-white",
  today: "bg-orange-100 text-orange-800",
  soon: "bg-amber-50 text-amber-800",
  normal: "bg-muted text-foreground",
  done: "bg-emerald-600 text-white",
} as const;

/** Conteúdo visual de um card no quadro. */
export function CardTile({ card, today, dragging, awaitingMe }: { card: BoardCard; today: DateOnly; dragging?: boolean; awaitingMe?: boolean }) {
  const done = card.stage === "DONE";
  const due = !done && card.dueDate ? describeDue(card.dueDate, today) : null;
  const checklistComplete = card.checklistTotal > 0 && card.checklistDone === card.checklistTotal;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-left shadow-xs transition hover:border-foreground/20 hover:shadow-md",
        due?.tone === "overdue" && "border-red-300",
        dragging && "rotate-2 shadow-xl ring-2 ring-primary/20",
        card.coverUrl && "overflow-hidden pt-0",
      )}
    >
      {card.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- link temporário do Supabase
        <img src={card.coverUrl} alt="" className="-mx-3 mb-2 block h-28 w-[calc(100%+1.5rem)] max-w-none object-cover" draggable={false} />
      )}
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.area.color }} aria-hidden />
        <span className="truncate font-medium">{card.area.name}</span>
        {awaitingMe && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Hourglass className="size-3" /> Sua aprovação
          </span>
        )}
      </div>

      <div className="text-sm leading-snug font-medium break-words">{card.title}</div>

      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[11px] leading-none font-medium"
              style={{ backgroundColor: l.color, color: readableTextColor(l.color) }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {done ? (
          <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 font-medium", DUE_STYLE.done)}>
            <CheckCircle2 className="size-3.5" /> Concluído
          </span>
        ) : due ? (
          <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 font-medium", DUE_STYLE[due.tone])}>
            {due.tone === "overdue" ? <AlertTriangle className="size-3.5" /> : <CalendarDays className="size-3.5" />}
            {due.text}
          </span>
        ) : null}
        {card.isRecurring && <Repeat className="size-3.5 text-sky-700" aria-label="Tarefa recorrente" />}
        {card.hasDescription && <AlignLeft className="size-3.5" aria-label="Tem descrição" />}
        {card.commentCount > 0 && (
          <span className="flex items-center gap-1" title="Comentários"><MessageSquare className="size-3.5" /> {card.commentCount}</span>
        )}
        {card.observerCount > 0 && (
          <span className="flex items-center gap-1" title="Observadores"><Eye className="size-3.5" /> {card.observerCount}</span>
        )}
        {card.attachmentCount > 0 && (
          <span className="flex items-center gap-1" title="Anexos"><Paperclip className="size-3.5" /> {card.attachmentCount}</span>
        )}
        {card.checklistTotal > 0 && (
          <span className={cn("flex items-center gap-1", checklistComplete && "font-medium text-emerald-700")} title="Checklist">
            <CheckSquare className="size-3.5" /> {card.checklistDone}/{card.checklistTotal}
          </span>
        )}
        {card.assignees.length > 0 && (
          <div className="ml-auto flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                title={a.name}
                className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-slate-700 text-[10px] font-semibold text-white"
              >
                {initials(a.name)}
              </span>
            ))}
            {card.assignees.length > 3 && (
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold">
                +{card.assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
