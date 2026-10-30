"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Pede o motivo da reprovação (obrigatório — SPEC §6.E). */
export function RejectDialog({
  open, taskTitle, onCancel, onConfirm,
}: {
  open: boolean;
  taskTitle?: string;
  onCancel: () => void;
  /** Devolve uma mensagem de erro, ou nada se deu certo. */
  onConfirm: (reason: string) => Promise<string | undefined>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const close = () => { setReason(""); setError(undefined); onCancel(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const err = await onConfirm(reason);
            setSaving(false);
            if (err) setError(err);
            else { setReason(""); setError(undefined); }
          }}
        >
          <DialogHeader>
            <DialogTitle>Reprovar tarefa</DialogTitle>
            <DialogDescription>
              {taskTitle ? <>“{taskTitle}” vai para ALTERAÇÃO. </> : "A tarefa vai para ALTERAÇÃO. "}
              Explique o que precisa ser ajustado: os responsáveis serão avisados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea id="reject-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
              placeholder="Ex.: trocar a foto da capa e revisar o texto do 2º parágrafo." />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={saving || reason.trim().length < 3}>
              {saving ? "Enviando…" : "Reprovar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
