"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { BOARD_COLUMNS } from "@/lib/board/columns";
import { getTimeColumn } from "@/lib/dates/time-column";
import { isDateOnly, type DateOnly } from "@/lib/dates/day";
import { describeDue, formatDateOnly } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface DueDateRequest {
  cardId: string;
  title: string;
  currentDue: DateOnly | null;
  targetLabel: string;
  suggested: DateOnly;
}

/** Janela de "ajustar data" ao soltar numa coluna de prazo (SPEC §6.A, decisão F2-1A). */
export function DueDateDialog({
  request, today, onCancel, onConfirm,
}: {
  request: DueDateRequest | null;
  today: DateOnly;
  onCancel: () => void;
  onConfirm: (date: DateOnly) => Promise<string | undefined>;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {request && <Body key={request.cardId + request.suggested} request={request} today={today} onCancel={onCancel} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ request, today, onCancel, onConfirm }: {
  request: DueDateRequest; today: DateOnly; onCancel: () => void; onConfirm: (d: DateOnly) => Promise<string | undefined>;
}) {
  const [date, setDate] = useState(request.suggested);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const valid = isDateOnly(date) && date >= today;
  const column = valid ? BOARD_COLUMNS.find((c) => c.key === getTimeColumn(date, today)) : null;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        const err = await onConfirm(date);
        setSaving(false);
        setError(err);
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo prazo para “{request.title}”</DialogTitle>
        <DialogDescription>
          {request.currentDue ? <>O prazo atual ({formatDateOnly(request.currentDue)}) não combina com {request.targetLabel}. </> : <>Esta tarefa ainda não tem prazo. </>}
          Sugerimos a data abaixo; você pode escolher outra.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="new-due">Prazo</Label>
        <Input id="new-due" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
        {valid && column ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> {describeDue(date, today).text} · vai para{" "}
            <strong className="text-foreground">{column.emoji} {column.label}</strong>
          </p>
        ) : (
          <p className="text-sm text-destructive">Escolha uma data a partir de hoje.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={!valid || saving}>{saving ? "Salvando…" : "Confirmar prazo"}</Button>
      </DialogFooter>
    </form>
  );
}
