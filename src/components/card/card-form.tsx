"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { BoardView } from "@/server/services/cards";
import type { CardInput } from "@/lib/validation/schemas";
import { readableTextColor } from "@/lib/colors";
import { describeRecurrence, type Frequency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { PeoplePicker } from "./people-picker";

export interface CardFormValues {
  title: string;
  description: string;
  dueDate: string | null;
  requesterAreaId: string;
  labelIds: string[];
  assigneeIds: string[];
  observerIds: string[];
  recurrence: { frequency: Frequency | null; endDate: string | null };
}

interface Props {
  board: Pick<BoardView, "areas" | "labels" | "assignableUsers" | "observableUsers">;
  initial: CardFormValues;
  /** Pode editar os campos (Admin/Membro). */
  canEdit: boolean;
  /** Pode alterar o prazo (Admin, ou Membro que criou o card). */
  canChangeDueDate: boolean;
  /** Pode incluir/retirar observadores (quem criou a tarefa ou Admin). */
  canManageObservers: boolean;
  submitLabel: string;
  /** Mostra o botão de salvar mesmo sem alterações (criação). */
  alwaysShowSubmit?: boolean;
  onSubmit: (values: CardInput) => Promise<string | undefined>;
  onDirtyChange?: (dirty: boolean) => void;
  /** Conteúdo extra da coluna principal (checklists, histórico). */
  main?: React.ReactNode;
  /** Conteúdo extra no topo da barra lateral (etapa atual) e no fim (ações). */
  sideTop?: React.ReactNode;
  sideBottom?: React.ReactNode;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function CardForm(props: Props) {
  const { board, initial, canEdit, canChangeDueDate, canManageObservers, submitLabel, alwaysShowSubmit, onSubmit, onDirtyChange } = props;
  const [v, setV] = useState<CardFormValues>(initial);
  const [tab, setTab] = useState<"write" | "preview">(initial.description ? "preview" : "write");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const dirty =
    v.title !== initial.title ||
    v.description !== initial.description ||
    (v.dueDate ?? null) !== (initial.dueDate ?? null) ||
    v.requesterAreaId !== initial.requesterAreaId ||
    !sameSet(v.labelIds, initial.labelIds) ||
    !sameSet(v.assigneeIds, initial.assigneeIds) ||
    !sameSet(v.observerIds, initial.observerIds) ||
    v.recurrence.frequency !== initial.recurrence.frequency ||
    (v.recurrence.frequency !== null && (v.recurrence.endDate ?? null) !== (initial.recurrence.endDate ?? null));

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Itens desativados só aparecem se já estiverem no card (decisão 6A).
  const areas = board.areas.filter((a) => a.isActive || a.id === initial.requesterAreaId);
  const labels = board.labels.filter((l) => l.isActive || initial.labelIds.includes(l.id));
  const users = [
    ...board.assignableUsers,
    ...initial.assigneeIds
      .filter((id) => !board.assignableUsers.some((u) => u.id === id))
      .map((id) => ({ id, name: "(sem acesso)", email: "", role: "MEMBER" })),
  ];
  const toggle = (key: "labelIds" | "assigneeIds", id: string) =>
    setV((s) => ({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] }));

  const canSubmit = !saving && v.title.trim() !== "" && v.requesterAreaId !== "" && (dirty || alwaysShowSubmit);
  const showBar = canEdit && (dirty || alwaysShowSubmit);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        const err = await onSubmit({
          ...v,
          dueDate: v.dueDate || null,
          recurrence: v.recurrence.frequency ? { frequency: v.recurrence.frequency, endDate: v.recurrence.endDate || null } : { frequency: null, endDate: null },
        });
        setSaving(false);
        setError(err);
      }}
    >
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-5">
          <div>
            <Label htmlFor="title" className="sr-only">Título</Label>
            <Input
              id="title" value={v.title} disabled={!canEdit} required maxLength={200} placeholder="Título da tarefa"
              onChange={(e) => setV({ ...v, title: e.target.value })}
              className="h-11 border-transparent px-2 text-lg font-semibold shadow-none hover:border-input focus-visible:border-ring disabled:opacity-100 md:text-lg"
            />
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Descrição</h3>
              {canEdit && (
                <div className="flex rounded-md border p-0.5 text-xs" role="tablist">
                  {(["write", "preview"] as const).map((t) => (
                    <button
                      key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                      className={cn("cursor-pointer rounded px-2 py-0.5", tab === t ? "bg-secondary font-medium" : "text-muted-foreground")}
                    >
                      {t === "write" ? "Escrever" : "Visualizar"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {canEdit && tab === "write" ? (
              <>
                <Textarea
                  id="desc" rows={6} value={v.description} placeholder="Detalhes, links, referências…"
                  onChange={(e) => setV({ ...v, description: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Dica: **negrito**, *itálico*, - listas, [link](https://…)</p>
              </>
            ) : (
              <div
                className={cn("rounded-md border bg-muted/30 p-3", canEdit && "cursor-text hover:bg-muted/50")}
                onClick={() => canEdit && setTab("write")}
              >
                <Markdown>{v.description}</Markdown>
              </div>
            )}
          </section>

          {props.main}
        </div>

        {/* Barra lateral */}
        <aside className="space-y-5 max-md:order-first max-md:border-b max-md:pb-5 md:border-l md:pl-5">
          {props.sideTop}

          <div className="space-y-1.5">
            <Label htmlFor="due" className="text-xs text-muted-foreground">Prazo</Label>
            <div className="flex items-center gap-1">
              <Input
                id="due" type="date" value={v.dueDate ?? ""} disabled={!canChangeDueDate}
                onChange={(e) => setV({ ...v, dueDate: e.target.value || null, ...(e.target.value ? {} : { recurrence: { frequency: null, endDate: null } }) })}
              />
              {canChangeDueDate && v.dueDate && (
                <Button type="button" variant="ghost" size="icon" aria-label="Remover prazo" title="Remover prazo"
                  onClick={() => setV({ ...v, dueDate: null, recurrence: { frequency: null, endDate: null } })}>
                  <X />
                </Button>
              )}
            </div>
            {canEdit && !canChangeDueDate && (
              <p className="text-xs text-muted-foreground">Só o Administrador ou quem criou a tarefa pode mudar o prazo.</p>
            )}
            {canChangeDueDate && !v.dueDate && (
              <p className="text-xs text-muted-foreground">Sem prazo, a tarefa fica em NOVAS DEMANDAS.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat" className="text-xs text-muted-foreground">Repetir</Label>
            <NativeSelect
              id="repeat" value={v.recurrence.frequency ?? ""} disabled={!canChangeDueDate || !v.dueDate}
              onChange={(e) => setV({ ...v, recurrence: { ...v.recurrence, frequency: (e.target.value || null) as Frequency | null } })}
            >
              <option value="">Não repete</option>
              <option value="DAILY">Todo dia</option>
              <option value="WEEKLY">Toda semana</option>
              <option value="MONTHLY">Todo mês</option>
            </NativeSelect>
            {v.recurrence.frequency && (
              <>
                <Label htmlFor="repeat-end" className="text-xs text-muted-foreground">Até (opcional)</Label>
                <Input
                  id="repeat-end" type="date" min={v.dueDate ?? undefined} value={v.recurrence.endDate ?? ""} disabled={!canChangeDueDate}
                  onChange={(e) => setV({ ...v, recurrence: { ...v.recurrence, endDate: e.target.value || null } })}
                />
                <p className="text-xs text-sky-800">
                  🔁 {describeRecurrence(v.recurrence.frequency, v.dueDate, v.recurrence.endDate || null)}.
                  Ao finalizar, a próxima tarefa é criada sozinha.
                </p>
              </>
            )}
            {canChangeDueDate && !v.dueDate && <p className="text-xs text-muted-foreground">Defina um prazo para poder repetir.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="area" className="text-xs text-muted-foreground">Área solicitante</Label>
            <NativeSelect id="area" value={v.requesterAreaId} disabled={!canEdit} required
              onChange={(e) => setV({ ...v, requesterAreaId: e.target.value })}>
              <option value="" disabled>Escolha…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (desativada)"}</option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Etiquetas</legend>
            {labels.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma etiqueta neste quadro.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const on = v.labelIds.includes(l.id);
                  if (!canEdit && !on) return null;
                  return (
                    <button
                      key={l.id} type="button" disabled={!canEdit} onClick={() => toggle("labelIds", l.id)} aria-pressed={on}
                      className={cn(
                        "cursor-pointer rounded-md border-2 px-2 py-0.5 text-xs font-medium transition disabled:cursor-default",
                        !on && "bg-background hover:bg-accent",
                      )}
                      style={on ? { backgroundColor: l.color, borderColor: l.color, color: readableTextColor(l.color) } : { borderColor: l.color }}
                    >
                      {on && "✓ "}{l.name}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <PeoplePicker
            id="assignee-picker" label="Responsáveis" people={users} selected={v.assigneeIds} disabled={!canEdit}
            onChange={(ids) => setV({ ...v, assigneeIds: ids })}
            emptyText="Nenhum Administrador ou Membro com acesso"
          />

          <div className="space-y-1">
            <PeoplePicker
              id="observer-picker" label="Observadores" people={board.observableUsers} selected={v.observerIds}
              disabled={!canManageObservers} onChange={(ids) => setV({ ...v, observerIds: ids })}
              emptyText="Nenhum Observador com acesso ao quadro"
            />
            {canEdit && !canManageObservers && (
              <p className="text-xs text-muted-foreground">Só quem criou a tarefa ou um Administrador inclui observadores.</p>
            )}
          </div>

          {props.sideBottom}
        </aside>
      </div>

      {showBar && (
        <div className="sticky bottom-0 z-10 -mx-6 mt-6 -mb-6 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
          {dirty && !alwaysShowSubmit && (
            <>
              <span className="mr-auto text-xs text-amber-700">Alterações não salvas</span>
              <Button type="button" variant="ghost" onClick={() => { setV(initial); onDirtyChange?.(false); }}>Descartar</Button>
            </>
          )}
          <Button type="submit" disabled={!canSubmit}>{saving ? "Salvando…" : submitLabel}</Button>
        </div>
      )}
    </form>
  );
}
