"use client";
import { useState } from "react";
import { MessageSquareWarning, Pencil, Trash2 } from "lucide-react";
import type { CardDetail } from "@/server/services/cards";
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/server/actions/collab";
import { mentionsToMarkdown } from "@/lib/mentions";
import { formatDateTime, initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MentionTextarea } from "./mention-textarea";

type Person = { id: string; name: string };

/** Rascunho do comentário fica fora do componente, para não se perder quando a tarefa recarrega. */
export interface CommentDraft {
  body: string;
  mentionIds: string[];
}

export function Comments({
  card, people, draft, setDraft, onChanged,
}: {
  card: CardDetail;
  people: Person[];
  draft: CommentDraft;
  setDraft: React.Dispatch<React.SetStateAction<CommentDraft>>;
  onChanged: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; mentionIds: string[] } | null>(null);
  const confirm = useConfirm();

  async function send() {
    if (!draft.body.trim() || sending) return;
    setSending(true);
    const r = await addCommentAction(card.id, draft.body, draft.mentionIds);
    setSending(false);
    if (!r.ok) return toast.error(r.error);
    setDraft({ body: "", mentionIds: [] });
    await onChanged();
  }

  return (
    <section className="space-y-3" aria-label="Comentários">
      <h3 className="text-sm font-semibold">
        Comentários <span className="font-normal text-muted-foreground">({card.comments.filter((c) => !c.deleted).length})</span>
      </h3>

      {card.permissions.canComment && (
        <div className="space-y-2">
          <MentionTextarea
            id="new-comment"
            value={draft.body}
            people={people}
            placeholder="Escreva um comentário… use @ para mencionar alguém"
            onChange={(body) => setDraft((d) => ({ ...d, body }))}
            onMention={(id) => setDraft((d) => ({ ...d, mentionIds: [...d.mentionIds, id] }))}
            onSubmit={send}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Ctrl + Enter para enviar</span>
            <Button type="button" size="sm" disabled={sending || !draft.body.trim()} onClick={send}>
              {sending ? "Enviando…" : "Comentar"}
            </Button>
          </div>
        </div>
      )}

      {card.comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
      ) : (
        <ul className="space-y-3">
          {card.comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white">
                {initials(c.author.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}{c.edited && !c.deleted && " (editado)"}
                  </span>
                  {(c.canEdit || c.canDelete) && editing?.id !== c.id && (
                    <span className="ml-auto flex gap-0.5">
                      {c.canEdit && (
                        <button type="button" className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Editar comentário"
                          onClick={() => setEditing({ id: c.id, body: c.body, mentionIds: c.mentions.map((m) => m.id) })}>
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {c.canDelete && (
                        <button type="button" className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir comentário"
                          onClick={async () => {
                            if (!(await confirm({ title: "Excluir este comentário?", confirmLabel: "Excluir", destructive: true }))) return;
                            const r = await deleteCommentAction(card.id, c.id);
                            if (!r.ok) toast.error(r.error);
                            await onChanged();
                          }}>
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {c.deleted ? (
                  <p className="text-sm text-muted-foreground italic">comentário excluído</p>
                ) : editing?.id === c.id ? (
                  <div className="mt-1 space-y-2">
                    <MentionTextarea
                      value={editing.body} people={people} autoFocus
                      onChange={(body) => setEditing((e) => (e ? { ...e, body } : e))}
                      onMention={(id) => setEditing((e) => (e ? { ...e, mentionIds: [...e.mentionIds, id] } : e))}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!editing.body.trim()} onClick={async () => {
                        const r = await editCommentAction(card.id, c.id, editing.body, editing.mentionIds);
                        if (!r.ok) return toast.error(r.error);
                        setEditing(null);
                        await onChanged();
                      }}>Salvar</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn("mt-1 rounded-lg px-3 py-2", c.kind === "REJECTION" ? "border border-red-200 bg-red-50" : "bg-muted/60")}>
                    {c.kind === "REJECTION" && (
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700">
                        <MessageSquareWarning className="size-3.5" /> Reprovou a tarefa
                      </div>
                    )}
                    <Markdown>{mentionsToMarkdown(c.body, c.mentions)}</Markdown>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
