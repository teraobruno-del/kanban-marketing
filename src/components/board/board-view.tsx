"use client";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Settings, Plus, Eye } from "lucide-react";
import type { BoardView as BoardViewData, BoardCard } from "@/server/services/cards";
import { BOARD_COLUMNS, type ColumnKey } from "@/lib/board/columns";
import { planDrop, type DropPlan } from "@/lib/board/moves";
import { groupCardsByColumn } from "@/lib/board/sort";
import type { DateOnly } from "@/lib/dates/day";
import { useToday } from "@/hooks/use-today";
import { useLiveBoard } from "@/hooks/use-live-board";
import { moveCardAction, moveWithDueDateAction } from "@/server/actions/cards";
import { approveCardAction, rejectCardAction } from "@/server/actions/approval";
import { RejectDialog } from "@/components/card/reject-dialog";
import { askChecklistConfirmation, finishedToast } from "@/components/card/finish";
import { useConfirm } from "@/components/ui/confirm";
import { DueDateDialog, type DueDateRequest } from "./due-date-dialog";
import { columnLabel } from "@/lib/board/moves";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { CardTile } from "./card-tile";
import { COLUMN_STYLE } from "./column-style";
import { CardDialog } from "@/components/card/card-dialog";

interface Props {
  view: BoardViewData;
  /** Abre esta tarefa ao carregar (link vindo do sininho). */
  initialCardId?: string;
  initialToday: DateOnly;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string;
}

export function BoardView({ view, initialCardId, initialToday, canEdit, isAdmin, currentUserId }: Props) {
  const today = useToday(initialToday);
  useLiveBoard(view.board.id, currentUserId);
  // Mostra o card na coluna nova na hora; se o servidor recusar, ele volta sozinho.
  const [cards, applyMove] = useOptimistic(
    view.cards,
    (cs, move: { id: string; stage: BoardCard["stage"] }) => cs.map((c) => (c.id === move.id ? { ...c, stage: move.stage } : c)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | "new" | null>(initialCardId ?? null);
  const [rejecting, setRejecting] = useState<BoardCard | null>(null);
  const [dateRequest, setDateRequest] = useState<DueDateRequest | null>(null);
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const columnRefs = useRef<Partial<Record<ColumnKey, HTMLElement | null>>>({});

  const columns = useMemo(() => groupCardsByColumn(cards, today), [cards, today]);
  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;
  const noActiveAreas = view.areas.every((a) => !a.isActive);
  // Pode aprovar/reprovar este card? (quem criou ou Administrador — SPEC §6.E)
  const canApproveCard = (c: BoardCard) => canEdit && (isAdmin || c.createdById === currentUserId);
  // Pode mudar o prazo? (Administrador ou quem criou — SPEC §7); mesma regra da janela de data.
  const canChangeDueCard = canApproveCard;
  const planFor = (c: BoardCard, target: ColumnKey): DropPlan => planDrop(c, target, today, canApproveCard(c), canChangeDueCard(c));
  const pendingOf = (c: BoardCard) => c.checklistTotal - c.checklistDone;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const card = cards.find((c) => c.id === e.active.id);
    const target = e.over?.id as ColumnKey | undefined;
    if (!card || !target) return;

    const plan = planFor(card, target);
    switch (plan.kind) {
      case "same":
        return;
      case "blocked":
        toast.warning(plan.reason);
        return;
      case "reject":
        setRejecting(card);
        return;
      case "pickDate":
        setDateRequest({
          cardId: card.id, title: card.title, currentDue: card.dueDate,
          targetLabel: columnLabel(plan.target), suggested: plan.suggested,
        });
        return;
      case "approve":
        void (async () => {
          const opts = await askChecklistConfirmation(confirm, pendingOf(card));
          if (!opts) return;
          startTransition(async () => {
            applyMove({ id: card.id, stage: "DONE" });
            const r = await approveCardAction(card.id, opts);
            if (!r.ok) toast.error(r.error);
            else finishedToast("Tarefa aprovada e finalizada.", r.data?.nextRecurrence);
          });
        })();
        return;
      case "request":
      case "move":
        void (async () => {
          const toDone = plan.kind === "move" && plan.stage === "DONE";
          const opts = toDone ? await askChecklistConfirmation(confirm, pendingOf(card)) : {};
          if (!opts) return;
          startTransition(async () => {
            applyMove({ id: card.id, stage: plan.kind === "request" ? "APPROVAL" : plan.stage });
            const r = await moveCardAction(card.id, target, opts);
            if (!r.ok) toast.error(r.error);
            else if (plan.kind === "request") toast.success("Enviada para aprovação. Quem criou a tarefa foi avisado(a).");
            else if (toDone) finishedToast("Tarefa finalizada.", r.data?.nextRecurrence);
          });
        })();
    }
  }

  const scrollTo = (key: ColumnKey) =>
    columnRefs.current[key]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho do quadro */}
      <div className="border-b bg-background px-3 pt-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-1 truncate text-lg font-semibold">{view.board.name}</h1>
          {view.board.archived && <Badge variant="secondary">Arquivado</Badge>}
          {!canEdit && !view.board.archived && (
            <Badge variant="outline" className="gap-1"><Eye /> Somente leitura</Badge>
          )}
          <div className="ml-auto flex gap-2">
            {isAdmin && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/boards/${view.board.id}/settings`} aria-label="Configurações do quadro">
                  <Settings /> <span className="hidden sm:inline">Configurações</span>
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setOpenCard("new")} disabled={noActiveAreas}>
                <Plus /> Nova tarefa
              </Button>
            )}
          </div>
        </div>

        {/* Atalhos para as 8 colunas — nenhuma etapa fica escondida */}
        <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-2" aria-label="Ir para a coluna">
          {BOARD_COLUMNS.map((col) => {
            const count = columns[col.key].length;
            const alert = col.key === "OVERDUE" && count > 0;
            return (
              <button
                key={col.key}
                onClick={() => scrollTo(col.key)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition hover:bg-accent",
                  alert && "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
                )}
              >
                <span aria-hidden>{col.emoji}</span>
                <span>{col.label}</span>
                <span className={cn("rounded-full px-1.5 tabular-nums", alert ? "bg-red-600 text-white" : "bg-muted text-muted-foreground")}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {canEdit && noActiveAreas && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:mx-4">
          Este quadro ainda não tem áreas solicitantes ativas.{" "}
          {isAdmin ? (
            <Link href={`/boards/${view.board.id}/settings`} className="font-medium underline">Cadastre-as em Configurações</Link>
          ) : (
            "Peça ao Administrador para cadastrá-las"
          )}{" "}
          antes de criar tarefas.
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-3 sm:snap-none sm:p-4">
          {BOARD_COLUMNS.map((col) => {
            const drop = activeCard ? planFor(activeCard, col.key) : null;
            return (
              <Column
                key={col.key}
                ref={(el) => { columnRefs.current[col.key] = el; }}
                columnKey={col.key}
                emoji={col.emoji}
                title={col.label}
                count={columns[col.key].length}
                state={!drop ? "idle" : drop.kind === "same" ? "origin" : drop.kind === "blocked" ? "reject" : "accept"}
                footer={col.key === "DONE" ? <OlderDoneToggle showingAll={view.showingAllDone} olderCount={view.olderDoneCount} /> : null}
              >
                {columns[col.key].map((card) => (
                  <DraggableCard
                    key={card.id}
                    card={card}
                    today={today}
                    disabled={!canEdit}
                    awaitingMe={card.stage === "APPROVAL" && canApproveCard(card)}
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

      <DueDateDialog
        request={dateRequest}
        today={today}
        onCancel={() => setDateRequest(null)}
        onConfirm={async (date) => {
          const r = await moveWithDueDateAction(dateRequest!.cardId, date);
          if (!r.ok) return r.error;
          setDateRequest(null);
          toast.success("Prazo atualizado.");
        }}
      />

      <RejectDialog
        open={rejecting !== null}
        taskTitle={rejecting?.title}
        onCancel={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const r = await rejectCardAction(rejecting!.id, reason);
          if (!r.ok) return r.error;
          setRejecting(null);
          toast.success("Tarefa reprovada. Os responsáveis foram avisados.");
        }}
      />

      <CardDialog
        cardId={openCard}
        onOpenChange={(open) => {
          if (open) return;
          setOpenCard(null);
          if (initialCardId) router.replace(pathname, { scroll: false }); // limpa o ?card= do link
        }}
        onCreated={(id) => setOpenCard(id)}
        board={view}
        currentUserId={currentUserId}
        today={today}
      />
    </div>
  );
}

/** No fim de FINALIZADAS: mostrar/ocultar as concluídas há mais de 30 dias (decisão pós-SPEC 2). */
function OlderDoneToggle({ showingAll, olderCount }: { showingAll: boolean; olderCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!showingAll && olderCount === 0) return null;
  const go = () => {
    const next = new URLSearchParams(params.toString());
    if (showingAll) next.delete("finalizadas"); else next.set("finalizadas", "todas");
    next.delete("card");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <button type="button" onClick={go} className="w-full cursor-pointer rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
      {showingAll ? "Mostrar só os últimos 30 dias" : `Mostrar as mais antigas (${olderCount})`}
    </button>
  );
}

function Column({
  ref, columnKey, emoji, title, count, state, children, footer,
}: {
  ref: (el: HTMLElement | null) => void;
  columnKey: ColumnKey; emoji: string; title: string; count: number;
  state: "idle" | "accept" | "reject" | "origin"; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  const style = COLUMN_STYLE[columnKey];
  return (
    <section
      ref={(el) => { setNodeRef(el); ref(el); }}
      aria-label={`${title}: ${count} ${count === 1 ? "tarefa" : "tarefas"}`}
      className={cn(
        "flex max-h-full w-[85vw] shrink-0 snap-start flex-col rounded-xl border border-t-4 bg-muted/60 transition sm:w-64",
        style.tint,
        state === "accept" && "ring-2 ring-emerald-500/70",
        state === "accept" && isOver && "bg-emerald-50",
        state === "reject" && "opacity-40",
      )}
      style={{ borderTopColor: style.accent }}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="flex items-center gap-1.5 truncate text-xs font-bold tracking-wide">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        <span className="rounded-full bg-background px-2 text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {children}
        {count === 0 && (
          <p className={cn(
            "rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground",
            state === "accept" && "border-emerald-400 text-emerald-700",
          )}>
            {state === "accept" ? "Solte aqui" : style.empty}
          </p>
        )}
        {footer}
      </div>
    </section>
  );
}

function DraggableCard({
  card, today, disabled, awaitingMe, hidden, onOpen,
}: { card: BoardCard; today: DateOnly; disabled: boolean; awaitingMe: boolean; hidden: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={disabled ? undefined : "card arrastável"}
      aria-label={card.title}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Enter abre o card; Espaço começa a arrastar pelo teclado.
        if (e.key === "Enter") return onOpen();
        listeners?.onKeyDown?.(e);
      }}
      className={cn(
        "cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !disabled && "touch-manipulation",
        hidden && "opacity-30",
      )}
    >
      <CardTile card={card} today={today} awaitingMe={awaitingMe} />
    </div>
  );
}
