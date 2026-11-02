"use client";
import { useCallback, useEffect, useState } from "react";
import { Trash2, ChevronDown } from "lucide-react";
import type { BoardView, CardDetail } from "@/server/services/cards";
import { createCardAction, deleteCardAction, getCardDetailAction, updateCardAction } from "@/server/actions/cards";
import { BOARD_COLUMNS, getBoardColumn } from "@/lib/board/columns";
import type { DateOnly } from "@/lib/dates/day";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/format";
import { COLUMN_STYLE } from "@/components/board/column-style";
import { CardForm, type CardFormValues } from "./card-form";
import { Checklists } from "./checklists";
import { describeEvent } from "./history";
import { ApprovalPanel } from "./approval-panel";
import { Attachments } from "./attachments";
import { Comments, type CommentDraft } from "./comments";
import { useUpload } from "./use-upload";
import { CARD_CHANGED_EVENT } from "@/hooks/use-live-board";
import { Upload, RefreshCw } from "lucide-react";

interface Props {
  /** "new" = criar; id = abrir card existente; null = fechado. */
  cardId: string | "new" | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  board: BoardView;
  currentUserId: string;
  today: DateOnly;
}

const EMPTY: CardFormValues = {
  title: "", description: "", dueDate: null, requesterAreaId: "", labelIds: [], assigneeIds: [],
  recurrence: { frequency: null, endDate: null },
};

export function CardDialog(props: Props) {
  const [dirty, setDirty] = useState(false);
  const confirm = useConfirm();

  async function handleOpenChange(open: boolean) {
    if (!open && dirty) {
      const ok = await confirm({
        title: "Descartar alterações?",
        description: "Você alterou esta tarefa e ainda não salvou.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        destructive: true,
      });
      if (!ok) return;
    }
    setDirty(false);
    props.onOpenChange(open);
  }

  return (
    <Dialog open={props.cardId !== null} onOpenChange={handleOpenChange}>
      <DialogContent
        // Esc dentro de uma edição na linha (ou da lista de @) só cancela aquela edição, sem fechar a janela.
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.("[data-escape-local]")) e.preventDefault();
        }}
        className="gap-0 sm:max-w-4xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
      >
        {/* key: cada card aberto começa do zero */}
        {props.cardId !== null && (
          <CardDialogBody key={props.cardId} {...props} onDirtyChange={setDirty} onClose={() => { setDirty(false); props.onOpenChange(false); }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardDialogBody({
  cardId, onCreated, board, today, currentUserId, onDirtyChange, onClose,
}: Props & { onDirtyChange: (d: boolean) => void; onClose: () => void }) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();
  const [showHistory, setShowHistory] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [draft, setDraft] = useState<CommentDraft>({ body: "", mentionIds: [] });
  const [changedRemotely, setChangedRemotely] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    if (!cardId || cardId === "new") return;
    const r = await getCardDetailAction(cardId);
    if (r.ok) {
      setDetail(r.data!);
      setError(undefined);
    } else setError(r.error);
  }, [cardId]);

  const reload = useCallback(async () => {
    await load();
    setVersion((v) => v + 1);
    setChangedRemotely(false);
  }, [load]);
  const { upload, uploading } = useUpload(cardId && cardId !== "new" ? cardId : "", load);

  // Outra pessoa mexeu nesta tarefa (atualização ao vivo — decisão F3-8A).
  useEffect(() => {
    if (!cardId || cardId === "new") return;
    const onChange = (e: Event) => {
      if ((e as CustomEvent<{ cardId: string }>).detail.cardId !== cardId) return;
      if (formDirty) setChangedRemotely(true);
      else void reload();
    };
    window.addEventListener(CARD_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CARD_CHANGED_EVENT, onChange);
  }, [cardId, formDirty, reload]);

  // Carrega o card quando a janela abre.
  useEffect(() => {
    if (!cardId || cardId === "new") return;
    let cancelled = false;
    getCardDetailAction(cardId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setDetail(r.data!);
        setVersion((v) => v + 1);
      } else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const isNew = cardId === "new";

  if (isNew) {
    return (
      <>
        <DialogHeader className="mb-4 pr-8">
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Com prazo, ela vai direto para a coluna de prazo. Sem prazo, fica em NOVAS DEMANDAS.</DialogDescription>
        </DialogHeader>
        <CardForm
          board={board}
          initial={EMPTY}
          canEdit
          canChangeDueDate
          alwaysShowSubmit
          submitLabel="Criar tarefa"
          onDirtyChange={onDirtyChange}
          onSubmit={async (values) => {
            const r = await createCardAction(board.board.id, values);
            if (!r.ok) return r.error;
            onDirtyChange(false);
            toast.success("Tarefa criada.");
            onCreated(r.data!.id);
          }}
        />
      </>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <DialogTitle className="sr-only">Carregando tarefa</DialogTitle>
        {error ? <Alert variant="destructive">{error}</Alert> : (
          <>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </>
        )}
      </div>
    );
  }

  const columnKey = getBoardColumn(detail, today);
  const column = BOARD_COLUMNS.find((c) => c.key === columnKey)!;

  const canAttach = detail.permissions.canEdit;
  const filesOf = (dt: DataTransfer | null) => Array.from(dt?.files ?? []);

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!canAttach || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => {
        if (!canAttach || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        void upload(filesOf(e.dataTransfer));
      }}
      onPaste={(e) => {
        const files = filesOf(e.clipboardData).filter((f) => f.type.startsWith("image/"));
        if (!canAttach || files.length === 0) return;
        e.preventDefault();
        void upload(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `imagem-colada-${Date.now()}-${i + 1}.png`, { type: f.type }))));
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90 text-sm font-medium">
          <Upload className="mr-2 size-5" /> Solte os arquivos para anexar
        </div>
      )}
      {changedRemotely && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900" role="status">
          Esta tarefa foi alterada por outra pessoa.
          <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => void reload()}>
            <RefreshCw /> Recarregar
          </Button>
        </div>
      )}
      <DialogHeader className="mb-2 pr-8">
        <DialogTitle className="sr-only">{detail.title}</DialogTitle>
        <DialogDescription className="text-xs">
          Criada por {detail.createdBy.name} em {formatDateTime(detail.createdAt)}
        </DialogDescription>
      </DialogHeader>
      {error && <Alert variant="destructive" className="mb-3">{error}</Alert>}

      <CardForm
        key={version}
        board={board}
        initial={{
          title: detail.title,
          description: detail.description,
          dueDate: detail.dueDate,
          requesterAreaId: detail.area.id,
          labelIds: detail.labels.map((l) => l.id),
          assigneeIds: detail.assignees.map((a) => a.id),
          recurrence: { frequency: detail.recurrence?.frequency ?? null, endDate: detail.recurrence?.endDate ?? null },
        }}
        canEdit={detail.permissions.canEdit}
        canChangeDueDate={detail.permissions.canChangeDueDate}
        submitLabel="Salvar alterações"
        onDirtyChange={(d) => { setFormDirty(d); onDirtyChange(d); }}
        onSubmit={async (values) => {
          const r = await updateCardAction(detail.id, values);
          if (!r.ok) return r.error;
          toast.success("Alterações salvas.");
          await load();
          setVersion((v) => v + 1);
        }}
        sideTop={
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Etapa atual</div>
            <div
              className="flex items-center gap-2 rounded-md border-l-4 bg-muted/50 px-3 py-2 text-sm font-semibold"
              style={{ borderLeftColor: COLUMN_STYLE[columnKey].accent }}
            >
              <span aria-hidden>{column.emoji}</span> {column.label}
            </div>
            {detail.completedAt && (
              <p className="text-xs text-emerald-700">Concluída em {formatDateTime(detail.completedAt)}</p>
            )}
            {detail.recurrence?.nextCreated && (
              <p className="text-xs text-sky-800">🔁 A próxima tarefa desta série já foi criada.</p>
            )}
            <ApprovalPanel card={detail} currentUserId={currentUserId} dirty={formDirty} onChanged={async () => { await load(); setVersion((v) => v + 1); }} />
          </div>
        }
        main={
          <>
            <Checklists card={detail} canEdit={detail.permissions.canEdit} onChanged={load} />
            <Attachments card={detail} uploading={uploading} onPick={(f) => void upload(f)} onChanged={load} />
            <Comments card={detail} people={board.mentionableUsers} draft={draft} setDraft={setDraft} onChanged={load} />
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="flex cursor-pointer items-center gap-1 text-sm font-semibold"
                aria-expanded={showHistory}
              >
                Histórico <span className="font-normal text-muted-foreground">({detail.events.length})</span>
                <ChevronDown className={`size-4 transition ${showHistory ? "rotate-180" : ""}`} />
              </button>
              {showHistory && (
                <ol className="space-y-2 border-l pl-4 text-sm">
                  {detail.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border" aria-hidden />
                      <span className="font-medium">{e.actorName}</span> {describeEvent(e)}
                      <div className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        }
        sideBottom={
          detail.permissions.canDelete && (
            <div className="border-t pt-4">
              <Button
                type="button" variant="ghost" size="sm" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir esta tarefa?",
                    description: "Ela sai do quadro e do dashboard. O histórico fica guardado.",
                    confirmLabel: "Excluir",
                    destructive: true,
                  });
                  if (!ok) return;
                  const r = await deleteCardAction(detail.id);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Tarefa excluída.");
                  onClose();
                }}
              >
                <Trash2 /> Excluir tarefa
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}
