"use client";
import { useState } from "react";
import type { BoardView } from "@/server/services/cards";
import type { CardInput } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export interface CardFormValues {
  title: string;
  description: string;
  dueDate: string | null;
  requesterAreaId: string;
  labelIds: string[];
  assigneeIds: string[];
}

interface Props {
  board: Pick<BoardView, "areas" | "labels" | "assignableUsers">;
  initial: CardFormValues;
  /** Pode editar os campos (Admin/Membro). */
  canEdit: boolean;
  /** Pode alterar o prazo (Admin, ou Membro que criou o card). */
  canChangeDueDate: boolean;
  submitLabel: string;
  onSubmit: (values: CardInput) => Promise<string | undefined>;
}

export function CardForm({ board, initial, canEdit, canChangeDueDate, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState<CardFormValues>(initial);
  const [tab, setTab] = useState<"write" | "preview">(initial.description ? "preview" : "write");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Itens desativados só aparecem se já estiverem no card (decisão 6A).
  const areas = board.areas.filter((a) => a.isActive || a.id === initial.requesterAreaId);
  const labels = board.labels.filter((l) => l.isActive || initial.labelIds.includes(l.id));
  const users = [
    ...board.assignableUsers,
    ...initial.assigneeIds.filter((id) => !board.assignableUsers.some((u) => u.id === id)).map((id) => ({ id, name: "(sem acesso)", role: "MEMBER" })),
  ];

  const toggle = (key: "labelIds" | "assigneeIds", id: string) =>
    setV((s) => ({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] }));

  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const err = await onSubmit({ ...v, dueDate: v.dueDate || null });
        setSaving(false);
        setError(err);
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" value={v.title} disabled={!canEdit} onChange={(e) => setV({ ...v, title: e.target.value })} required maxLength={200} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="area">Área solicitante</Label>
          <NativeSelect id="area" value={v.requesterAreaId} disabled={!canEdit} required onChange={(e) => setV({ ...v, requesterAreaId: e.target.value })}>
            <option value="" disabled>Escolha…</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (desativada)"}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due">Prazo</Label>
          <div className="flex gap-2">
            <Input
              id="due" type="date" value={v.dueDate ?? ""} disabled={!canChangeDueDate}
              onChange={(e) => setV({ ...v, dueDate: e.target.value || null })}
            />
            {canChangeDueDate && v.dueDate && (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setV({ ...v, dueDate: null })}>
                Remover
              </Button>
            )}
          </div>
          {canEdit && !canChangeDueDate && (
            <p className="text-xs text-muted-foreground">Só o Administrador ou quem criou o card pode alterar o prazo.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Etiquetas</Label>
        {labels.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada neste quadro.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => {
              const on = v.labelIds.includes(l.id);
              return (
                <button
                  key={l.id} type="button" disabled={!canEdit} onClick={() => toggle("labelIds", l.id)}
                  className={cn("rounded-md border px-2 py-1 text-xs font-medium transition disabled:cursor-default", on ? "text-white" : "bg-background opacity-60 hover:opacity-100")}
                  style={on ? { backgroundColor: l.color, borderColor: l.color } : { borderColor: l.color, color: l.color }}
                  aria-pressed={on}
                >
                  {on ? "✓ " : ""}{l.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Responsáveis</Label>
        <div className="flex flex-wrap gap-1.5">
          {users.map((u) => {
            const on = v.assigneeIds.includes(u.id);
            return (
              <button
                key={u.id} type="button" disabled={!canEdit} onClick={() => toggle("assigneeIds", u.id)}
                className={cn("rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-default", on ? "border-slate-700 bg-slate-700 text-white" : "bg-background text-muted-foreground hover:text-foreground")}
                aria-pressed={on}
              >
                {on ? "✓ " : ""}{u.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="desc">Descrição</Label>
          {canEdit && (
            <div className="flex rounded-md border p-0.5 text-xs">
              {(["write", "preview"] as const).map((t) => (
                <button
                  key={t} type="button" onClick={() => setTab(t)}
                  className={cn("rounded px-2 py-0.5", tab === t ? "bg-secondary font-medium" : "text-muted-foreground")}
                >
                  {t === "write" ? "Escrever" : "Visualizar"}
                </button>
              ))}
            </div>
          )}
        </div>
        {canEdit && tab === "write" ? (
          <>
            <Textarea id="desc" rows={6} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            <p className="text-xs text-muted-foreground">Aceita Markdown: **negrito**, *itálico*, - listas, [link](https://…)</p>
          </>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3"><Markdown>{v.description}</Markdown></div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !dirty || !v.title.trim() || !v.requesterAreaId}>
            {saving ? "Salvando…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
