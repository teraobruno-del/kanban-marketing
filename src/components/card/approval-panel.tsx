"use client";
import { useState } from "react";
import { Send, Check, XCircle, MessageSquareWarning } from "lucide-react";
import type { CardDetail } from "@/server/services/cards";
import { approveCardAction, rejectCardAction, requestApprovalAction } from "@/server/actions/approval";
import { canRequestApprovalFrom } from "@/lib/board/moves";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { RejectDialog } from "./reject-dialog";
import { askChecklistConfirmation, finishedToast } from "./finish";
import { useConfirm } from "@/components/ui/confirm";

/** Botões e avisos de aprovação dentro da tarefa (SPEC §6.E). */
export function ApprovalPanel({ card, currentUserId, dirty, onChanged }: {
  card: CardDetail; currentUserId: string; dirty: boolean; onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { canEdit, canApprove } = card.permissions;
  const confirm = useConfirm();
  const pending = card.checklists.reduce((n, cl) => n + cl.items.filter((i) => !i.isDone).length, 0);

  async function approve() {
    if (dirty) return toast.warning("Salve ou descarte as alterações da tarefa antes.");
    const opts = await askChecklistConfirmation(confirm, pending);
    if (!opts) return;
    setBusy(true);
    const r = await approveCardAction(card.id, opts);
    if (!r.ok) toast.error(r.error);
    else finishedToast("Tarefa aprovada e finalizada.", r.data?.nextRecurrence);
    await onChanged();
    setBusy(false);
  }

  async function run(p: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (dirty) return toast.warning("Salve ou descarte as alterações da tarefa antes.");
    setBusy(true);
    const r = await p();
    if (!r.ok) toast.error(r.error);
    else toast.success(success);
    await onChanged();
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {card.lastRejection && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <MessageSquareWarning className="size-4" /> Reprovada por {card.lastRejection.actorName}
          </div>
          <p className="whitespace-pre-wrap">{card.lastRejection.reason}</p>
          <p className="mt-1 text-xs text-amber-800/80">{formatDateTime(card.lastRejection.createdAt)}</p>
        </div>
      )}

      {canEdit && canRequestApprovalFrom(card.stage) && (
        <>
          <Button type="button" variant="outline" className="w-full border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
            disabled={busy} onClick={() => run(() => requestApprovalAction(card.id), "Enviada para aprovação.")}>
            <Send /> Enviar para aprovação
          </Button>
          <p className="text-xs text-muted-foreground">
            {card.createdBy.id === currentUserId
              ? "Você criou esta tarefa: depois de enviar, você mesmo(a) pode aprovar."
              : `${card.createdBy.name} ${card.lastRejection ? "será avisado(a) de que a tarefa foi corrigida." : "será avisado(a)."}`}
          </p>
        </>
      )}

      {card.stage === "APPROVAL" &&
        (canApprove ? (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy}
              onClick={approve}>
              <Check /> Aprovar
            </Button>
            <Button type="button" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={busy}
              onClick={() => (dirty ? toast.warning("Salve ou descarte as alterações da tarefa antes.") : setRejecting(true))}>
              <XCircle /> Reprovar
            </Button>
          </div>
        ) : (
          <p className="rounded-md bg-violet-50 p-2.5 text-xs text-violet-800">
            Aguardando aprovação de <strong>{card.createdBy.name}</strong> ou de um Administrador.
          </p>
        ))}

      <RejectDialog
        open={rejecting}
        taskTitle={card.title}
        onCancel={() => setRejecting(false)}
        onConfirm={async (reason) => {
          const r = await rejectCardAction(card.id, reason);
          if (!r.ok) return r.error;
          setRejecting(false);
          toast.success("Tarefa reprovada. Os responsáveis foram avisados.");
          await onChanged();
        }}
      />
    </div>
  );
}
