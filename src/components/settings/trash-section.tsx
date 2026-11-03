"use client";
import { useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { purgeCardAction, restoreCardAction } from "@/server/actions/trash";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";

export type TrashItem = {
  id: string; title: string; area: { name: string; color: string }; deletedAt: string; deletedBy: string;
  attachments: number; comments: number;
};

/** Lixeira do quadro (só Administrador): restaurar ou excluir definitivamente. */
export function TrashSection({ items }: { items: TrashItem[] }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lixeira</CardTitle>
        <CardDescription>
          Tarefas excluídas deste quadro. <strong>Restaurar</strong> devolve a tarefa para onde estava, com tudo.
          <strong> Excluir definitivamente</strong> apaga a tarefa, o histórico e os arquivos — não dá para desfazer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">A lixeira está vazia.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.area.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.area.name} · excluída por {t.deletedBy} em {formatDateTime(t.deletedAt)}
                    {t.attachments > 0 && ` · ${t.attachments} ${t.attachments === 1 ? "anexo" : "anexos"}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => start(async () => {
                      const r = await restoreCardAction(t.id);
                      if (r.ok) toast.success(`“${t.title}” voltou para o quadro.`); else toast.error(r.error);
                    })}>
                    <RotateCcw /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Excluir “${t.title}” definitivamente?`,
                        description: "A tarefa, o histórico, os comentários e os arquivos serão apagados. Não dá para desfazer.",
                        confirmLabel: "Excluir definitivamente", destructive: true,
                      });
                      if (!ok) return;
                      start(async () => {
                        const r = await purgeCardAction(t.id);
                        if (r.ok) toast.success("Tarefa excluída definitivamente."); else toast.error(r.error);
                      });
                    }}>
                    <Trash2 /> Excluir definitivamente
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
