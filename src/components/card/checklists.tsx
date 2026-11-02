"use client";
import { useState } from "react";
import { Trash2, Plus, Pencil } from "lucide-react";
import type { CardDetail } from "@/server/services/cards";
import {
  addChecklistAction, addChecklistItemAction, deleteChecklistAction, deleteChecklistItemAction, editChecklistItemAction,
  renameChecklistAction, toggleChecklistItemAction,
} from "@/server/actions/cards";
import type { ActionResult } from "@/server/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";

interface Props {
  card: CardDetail;
  canEdit: boolean;
  /** Recarrega o card depois de cada alteração. */
  onChanged: () => Promise<void>;
}

/**
 * Checklists do card. Fica dentro do formulário do card, por isso não usa <form>:
 * Enter nos campos e os botões chamam as ações diretamente.
 */
export function Checklists({ card, canEdit, onChanged }: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  /** O que está sendo editado: id do item, ou "cl-<id>" para o título da checklist. */
  const [editing, setEditing] = useState<string | null>(null);
  const confirm = useConfirm();

  async function act(p: Promise<ActionResult<unknown>>) {
    setBusy(true);
    const r = await p;
    if (!r.ok) toast.error(r.error);
    await onChanged();
    setBusy(false);
    return r.ok;
  }

  async function addChecklist() {
    if (!newTitle.trim()) return;
    if (await act(addChecklistAction(card.id, newTitle))) setNewTitle("");
  }

  if (!canEdit && card.checklists.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Checklists</h3>

      {card.checklists.map((cl) => {
        const done = cl.items.filter((i) => i.isDone).length;
        const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
        return (
          <div key={cl.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              {editing === `cl-${cl.id}` ? (
                <InlineEdit
                  initial={cl.title} label="Título da checklist"
                  onCancel={() => setEditing(null)}
                  onSave={async (title) => { if (await act(renameChecklistAction(card.id, cl.id, title))) setEditing(null); }}
                />
              ) : (
                <>
                  <span className="text-sm font-medium">{cl.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{done}/{cl.items.length}</span>
                </>
              )}
              {canEdit && editing !== `cl-${cl.id}` && (
                <Button
                  type="button" variant="ghost" size="icon" className="ml-auto size-7" disabled={busy} aria-label={`Renomear checklist ${cl.title}`}
                  onClick={() => setEditing(`cl-${cl.id}`)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {canEdit && (
                <Button
                  type="button" variant="ghost" size="icon" className="size-7" disabled={busy} aria-label={`Excluir checklist ${cl.title}`}
                  onClick={async () => {
                    const ok = await confirm({ title: `Excluir a checklist “${cl.title}”?`, description: "Todos os itens dela serão apagados.", confirmLabel: "Excluir", destructive: true });
                    if (ok) await act(deleteChecklistAction(card.id, cl.id));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={pct === 100 ? "h-full bg-emerald-500 transition-all" : "h-full bg-primary transition-all"} style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-0.5">
              {cl.items.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={item.isDone} disabled={!canEdit || busy}
                    onCheckedChange={(v) => act(toggleChecklistItemAction(card.id, item.id, v === true))}
                  />
                  {editing === item.id ? (
                    <InlineEdit
                      initial={item.text} label="Texto do item"
                      onCancel={() => setEditing(null)}
                      onSave={async (text) => { if (await act(editChecklistItemAction(card.id, item.id, text))) setEditing(null); }}
                    />
                  ) : (
                    <label
                      htmlFor={`item-${item.id}`}
                      className={item.isDone ? "flex-1 cursor-pointer text-muted-foreground line-through" : "flex-1 cursor-pointer"}
                      onDoubleClick={(e) => { if (canEdit) { e.preventDefault(); setEditing(item.id); } }}
                    >
                      {item.text}
                    </label>
                  )}
                  {canEdit && editing !== item.id && (
                    <button
                      type="button"
                      className="cursor-pointer text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                      onClick={() => setEditing(item.id)} aria-label={`Editar item ${item.text}`} disabled={busy}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {canEdit && editing !== item.id && (
                    <button
                      type="button"
                      className="cursor-pointer text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      onClick={() => act(deleteChecklistItemAction(card.id, item.id))} aria-label={`Remover item ${item.text}`} disabled={busy}
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
        <div className="flex gap-2">
          <Input
            placeholder="Nova checklist (ex.: Etapas)" value={newTitle} aria-label="Nome da nova checklist"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addChecklist(); } }}
          />
          <Button type="button" variant="outline" disabled={busy || !newTitle.trim()} onClick={addChecklist}>
            <Plus /> Checklist
          </Button>
        </div>
      )}
    </section>
  );
}

function AddItem({ onAdd, disabled }: { onAdd: (text: string) => Promise<boolean>; disabled: boolean }) {
  const [text, setText] = useState("");
  const add = async () => {
    if (text.trim() && (await onAdd(text))) setText("");
  };
  return (
    <div className="flex gap-2">
      <Input
        className="h-8" placeholder="Adicionar item" value={text} aria-label="Novo item"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
      />
      <Button type="button" size="sm" variant="secondary" disabled={disabled || !text.trim()} onClick={add}>
        <Plus /> Item
      </Button>
    </div>
  );
}

/** Campo de edição na própria linha: Enter salva, Esc cancela. */
function InlineEdit({ initial, label, onSave, onCancel }: {
  initial: string; label: string; onSave: (v: string) => Promise<void>; onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const save = () => (value.trim() && value.trim() !== initial ? onSave(value) : onCancel());
  return (
    <span className="flex flex-1 items-center gap-1.5" data-escape-local>
      <Input
        className="h-8" value={value} aria-label={label} autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void save(); }
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }}
      />
      <Button type="button" size="sm" disabled={!value.trim()} onClick={() => void save()}>Salvar</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
    </span>
  );
}
