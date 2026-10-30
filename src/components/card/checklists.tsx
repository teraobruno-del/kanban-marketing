"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CardDetail } from "@/server/services/cards";
import {
  addChecklistAction, addChecklistItemAction, deleteChecklistAction, deleteChecklistItemAction, toggleChecklistItemAction,
} from "@/server/actions/cards";
import type { ActionResult } from "@/server/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface Props {
  card: CardDetail;
  canEdit: boolean;
  /** Recarrega o card depois de cada alteração. */
  onChanged: () => Promise<void>;
}

export function Checklists({ card, canEdit, onChanged }: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function act(p: Promise<ActionResult<unknown>>) {
    setBusy(true);
    const r = await p;
    if (!r.ok) setError(r.error);
    else setError(undefined);
    await onChanged();
    setBusy(false);
    return r.ok;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Checklists</h3>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {card.checklists.length === 0 && !canEdit && <p className="text-sm text-muted-foreground">Nenhuma checklist.</p>}

      {card.checklists.map((cl) => {
        const done = cl.items.filter((i) => i.isDone).length;
        const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
        return (
          <div key={cl.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{cl.title}</span>
              <span className="text-xs text-muted-foreground">{done}/{cl.items.length}</span>
              {canEdit && (
                <Button
                  variant="ghost" size="icon" className="ml-auto size-7" disabled={busy} aria-label="Excluir checklist"
                  onClick={() => confirm(`Excluir a checklist “${cl.title}”?`) && act(deleteChecklistAction(card.id, cl.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={pct === 100 ? "h-full bg-emerald-500" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-1">
              {cl.items.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.isDone} disabled={!canEdit || busy}
                    onCheckedChange={(v) => act(toggleChecklistItemAction(card.id, item.id, v === true))}
                    aria-label={item.text}
                  />
                  <span className={item.isDone ? "text-muted-foreground line-through" : ""}>{item.text}</span>
                  {canEdit && (
                    <button
                      className="ml-auto text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                      onClick={() => act(deleteChecklistItemAction(card.id, item.id))} aria-label="Remover item" disabled={busy}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && <AddItem disabled={busy} onAdd={(text) => act(addChecklistItemAction(card.id, cl.id, text))} />}
          </div>
        );
      })}

      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(addChecklistAction(card.id, newTitle))) setNewTitle("");
          }}
        >
          <Input placeholder="Nova checklist (ex.: Etapas)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button type="submit" variant="outline" disabled={busy || !newTitle.trim()}>Adicionar</Button>
        </form>
      )}
    </section>
  );
}

function AddItem({ onAdd, disabled }: { onAdd: (text: string) => Promise<boolean>; disabled: boolean }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(text)) setText("");
      }}
    >
      <Input className="h-8" placeholder="Novo item" value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" size="sm" variant="secondary" disabled={disabled || !text.trim()}>+ Item</Button>
    </form>
  );
}
