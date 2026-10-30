"use client";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Settings, Plus } from "lucide-react";
import type { BoardView as BoardViewData, BoardCard } from "@/server/services/cards";
import { BOARD_COLUMNS, type ColumnKey } from "@/lib/board/columns";
import { resolveDrop } from "@/lib/board/moves";
import { groupCardsByColumn } from "@/lib/board/sort";
import type { DateOnly } from "@/lib/dates/day";
import { useToday } from "@/hooks/use-today";
import { moveCardAction } from "@/server/actions/cards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CardTile } from "./card-tile";
import { CardDialog } from "@/components/card/card-dialog";

interface Props {
  view: BoardViewData;
  initialToday: DateOnly;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string;
}

export function BoardView({ view, initialToday, canEdit, isAdmin, currentUserId }: Props) {
  const today = useToday(initialToday);
  // Mostra o card na coluna nova na hora; se o servidor recusar, ele volta sozinho.
  const [cards, applyMove] = useOptimistic(
    view.cards,
    (cs, move: { id: string; stage: BoardCard["stage"] }) => cs.map((c) => (c.id === move.id ? { ...c, stage: move.stage } : c)),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | "new" | null>(null);
  const [, startTransition] = useTransition();

  const columns = useMemo(() => groupCardsByColumn(cards, today), [cards, today]);
  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setMessage(null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const card = cards.find((c) => c.id === e.active.id);
    const target = e.over?.id as ColumnKey | undefined;
    if (!card || !target) return;

    const result = resolveDrop(card, target, today);
    if (!result.ok) {
      if (!result.sameColumn) setMessage(result.reason);
      return;
    }
    startTransition(async () => {
      applyMove({ id: card.id, stage: result.stage });
      const r = await moveCardAction(card.id, target);
      if (!r.ok) setMessage(r.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{view.board.name}</h1>
        {view.board.archived && <Badge variant="secondary">Arquivado</Badge>}
        {!canEdit && !view.board.archived && <Badge variant="outline">Somente leitura</Badge>}
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <Button size="sm" onClick={() => setOpenCard("new")} disabled={view.areas.every((a) => !a.isActive)}>
              <Plus /> Nova tarefa
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/boards/${view.board.id}/settings`}><Settings /> Configurações</Link>
            </Button>
          )}
        </div>
      </div>

      {canEdit && view.areas.every((a) => !a.isActive) && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Este quadro ainda não tem áreas solicitantes ativas. {isAdmin ? "Cadastre-as em Configurações" : "Peça ao Administrador para cadastrá-las"} antes de criar tarefas.
        </div>
      )}

      {message && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">
          {message}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {BOARD_COLUMNS.map((col) => {
            const drop = activeCard ? resolveDrop(activeCard, col.key, today) : null;
            return (
              <Column
                key={col.key}
                columnKey={col.key}
                title={`${col.emoji} ${col.label}`}
                count={columns[col.key].length}
                state={!drop ? "idle" : drop.ok ? "accept" : drop.sameColumn ? "idle" : "reject"}
              >
                {columns[col.key].map((card) => (
                  <DraggableCard
                    key={card.id}
                    card={card}
                    today={today}
                    disabled={!canEdit}
                    hidden={card.id === activeId}
                    onOpen={() => setOpenCard(card.id)}
                  />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeCard && <CardTile card={activeCard} today={today} dragging />}</DragOverlay>
      </DndContext>

      <CardDialog
        cardId={openCard}
        onOpenChange={(open) => !open && setOpenCard(null)}
        onCreated={(id) => setOpenCard(id)}
        board={view}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function Column({
  columnKey, title, count, state, children,
}: {
  columnKey: ColumnKey; title: string; count: number; state: "idle" | "accept" | "reject"; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/50 transition",
        columnKey === "OVERDUE" && "bg-red-50/70",
        state === "accept" && "ring-2 ring-emerald-400",
        state === "accept" && isOver && "bg-emerald-50",
        state === "reject" && "opacity-50",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-xs font-bold tracking-wide">{title}</h2>
        <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">{children}</div>
    </section>
  );
}

function DraggableCard({
  card, today, disabled, hidden, onOpen,
}: { card: BoardCard; today: DateOnly; disabled: boolean; hidden: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Enter abre o card; Espaço começa a arrastar pelo teclado.
        if (e.key === "Enter") return onOpen();
        listeners?.onKeyDown?.(e);
      }}
      className={cn("cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg", hidden && "opacity-30")}
    >
      <CardTile card={card} today={today} />
    </div>
  );
}
