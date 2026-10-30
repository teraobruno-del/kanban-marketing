"use client";
import { useCallback, useEffect, useState } from "react";
import type { BoardView, CardDetail } from "@/server/services/cards";
import {
  createCardAction,
  deleteCardAction,
  getCardDetailAction,
  updateCardAction,
} from "@/server/actions/cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import { CardForm, type CardFormValues } from "./card-form";
import { Checklists } from "./checklists";
import { describeEvent } from "./history";

interface Props {
  /** "new" = criar; id = abrir card existente; null = fechado. */
  cardId: string | "new" | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  board: BoardView;
  currentUserId: string;
}

const EMPTY: CardFormValues = {
  title: "",
  description: "",
  dueDate: null,
  requesterAreaId: "",
  labelIds: [],
  assigneeIds: [],
};

export function CardDialog(props: Props) {
  return (
    <Dialog open={props.cardId !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {/* key: cada card aberto começa do zero */}
        {props.cardId !== null && (
          <CardDialogBody key={props.cardId} {...props} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardDialogBody({ cardId, onOpenChange, onCreated, board }: Props) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    if (!cardId || cardId === "new") return;
    const r = await getCardDetailAction(cardId);
    if (r.ok) {
      setDetail(r.data!);
      setError(undefined);
    } else setError(r.error);
  }, [cardId]);

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

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isNew ? "Nova tarefa" : (detail?.title ?? "Carregando…")}
        </DialogTitle>
        <DialogDescription>
          {isNew
            ? "Com prazo, a tarefa vai direto para a coluna de prazo. Sem prazo, fica em NOVAS DEMANDAS."
            : detail
              ? `Criado por ${detail.createdBy.name} em ${formatDateTime(detail.createdAt)}`
              : " "}
        </DialogDescription>
      </DialogHeader>

      {error && <Alert variant="destructive">{error}</Alert>}

      {isNew && (
        <CardForm
          board={board}
          initial={EMPTY}
          canEdit
          canChangeDueDate
          submitLabel="Criar tarefa"
          onSubmit={async (values) => {
            const r = await createCardAction(board.board.id, values);
            if (!r.ok) return r.error;
            onCreated(r.data!.id);
          }}
        />
      )}

      {!isNew && detail && (
        <div className="space-y-6">
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
            }}
            canEdit={detail.permissions.canEdit}
            canChangeDueDate={detail.permissions.canChangeDueDate}
            submitLabel="Salvar alterações"
            onSubmit={async (values) => {
              const r = await updateCardAction(detail.id, values);
              if (!r.ok) return r.error;
              await load();
              setVersion((v) => v + 1);
            }}
          />

          <Checklists
            card={detail}
            canEdit={detail.permissions.canEdit}
            onChanged={load}
          />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Histórico</h3>
            <ul className="space-y-1.5 text-sm">
              {detail.events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-1.5">
                  <span className="font-medium">{e.actorName}</span>
                  <span>{describeEvent(e)}</span>
                  <span className="text-xs text-muted-foreground">
                    · {formatDateTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {detail.permissions.canDelete && (
            <div className="flex justify-end border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (
                    !confirm(
                      "Excluir esta tarefa? Ela sairá do quadro e do dashboard.",
                    )
                  )
                    return;
                  const r = await deleteCardAction(detail.id);
                  if (!r.ok) setError(r.error);
                  else onOpenChange(false);
                }}
              >
                Excluir tarefa
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
