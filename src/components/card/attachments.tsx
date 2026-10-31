"use client";
import { useRef } from "react";
import { Paperclip, FileText, MoreHorizontal, ImageIcon, Trash2, ExternalLink, Loader2, ImageOff } from "lucide-react";
import type { CardDetail } from "@/server/services/cards";
import { deleteAttachmentAction, setCoverAction } from "@/server/actions/collab";
import { formatBytes } from "@/lib/attachments";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Anexos da tarefa: miniaturas, capa, abrir e excluir (SPEC §5, P30–P32). */
export function Attachments({
  card, uploading, onPick, onChanged,
}: {
  card: CardDetail;
  uploading: string[];
  onPick: (files: File[]) => void;
  onChanged: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const canEdit = card.permissions.canEdit;
  if (!canEdit && card.attachments.length === 0) return null;

  async function act(p: Promise<{ ok: boolean; error?: string }>, success: string) {
    const r = await p;
    if (!r.ok) toast.error(r.error);
    else toast.success(success);
    await onChanged();
  }

  return (
    <section className="space-y-3" aria-label="Anexos">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Anexos <span className="font-normal text-muted-foreground">({card.attachments.length})</span>
        </h3>
        {canEdit && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
              <Paperclip /> Anexar arquivo
            </Button>
            <input
              ref={input} type="file" multiple className="hidden" aria-label="Escolher arquivos"
              onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
          </>
        )}
      </div>
      {canEdit && (
        <p className="text-xs text-muted-foreground">Até 10 MB por arquivo. Você também pode arrastar arquivos para esta janela ou colar uma imagem (Ctrl + V).</p>
      )}

      {uploading.map((name, i) => (
        <div key={`${name}-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Enviando “{name}”…
        </div>
      ))}

      {card.attachments.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {card.attachments.map((a) => {
            const isCover = card.coverAttachmentId === a.id;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border p-2">
                <a href={a.url ?? undefined} target="_blank" rel="noopener noreferrer"
                  className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted" aria-label={`Abrir ${a.name}`}>
                  {a.isImage && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- link temporário do Supabase
                    <img src={a.url} alt="" className="size-full object-cover" />
                  ) : a.isImage ? <ImageIcon className="size-6 text-muted-foreground" /> : <FileText className="size-6 text-muted-foreground" />}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={a.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">{a.name}</a>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatBytes(a.size)} · {a.uploadedBy.name} · {formatDateTime(a.createdAt)}
                  </div>
                  {isCover && <Badge variant="secondary" className="mt-1">Capa</Badge>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Ações para ${a.name}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {a.url && (
                      <DropdownMenuItem asChild>
                        <a href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Abrir</a>
                      </DropdownMenuItem>
                    )}
                    {canEdit && a.isImage && (
                      isCover ? (
                        <DropdownMenuItem onSelect={() => act(setCoverAction(card.id, null), "Capa removida.")}><ImageOff /> Remover capa</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => act(setCoverAction(card.id, a.id), "Capa definida.")}><ImageIcon /> Usar como capa</DropdownMenuItem>
                      )
                    )}
                    {a.canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={async () => {
                          if (!(await confirm({ title: `Excluir “${a.name}”?`, description: "O arquivo será apagado.", confirmLabel: "Excluir", destructive: true }))) return;
                          await act(deleteAttachmentAction(card.id, a.id), "Anexo excluído.");
                        }}><Trash2 /> Excluir</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
