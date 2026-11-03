"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2, Plus, Archive, ArchiveRestore } from "lucide-react";
import {
  createBoardItemAction, deleteBoardAction, deleteBoardItemAction, renameBoardAction, setBoardArchivedAction,
  setBoardItemActiveAction, setBoardMembersAction, updateBoardItemAction,
} from "@/server/actions/boards";
import type { ActionResult } from "@/server/errors";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { nextColor, readableTextColor } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { ColorPicker } from "./color-picker";
import { TrashSection, type TrashItem } from "./trash-section";

type Item = { id: string; name: string; color: string; isActive: boolean };
type UserOption = { id: string; name: string; email: string; role: string };

interface Props {
  board: { id: string; name: string; archived: boolean };
  memberIds: string[];
  users: UserOption[];
  areas: Item[];
  labels: Item[];
  trash: TrashItem[];
}

/** Executa uma ação e mostra o resultado numa mensagem rápida. */
function useAction() {
  const [pending, start] = useTransition();
  const exec = (fn: () => Promise<ActionResult<unknown>>, success?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (success) toast.success(success);
        after?.();
      }
    });
  return { pending, exec };
}

export function BoardSettings({ board, memberIds, users, areas, labels, trash }: Props) {
  return (
    <Tabs defaultValue="general">
      <TabsList className="max-w-full">
        <TabsTrigger value="general">Geral</TabsTrigger>
        <TabsTrigger value="access">Acesso <Badge variant="secondary" className="px-1.5">{memberIds.length}</Badge></TabsTrigger>
        <TabsTrigger value="areas">Áreas <Badge variant="secondary" className="px-1.5">{areas.length}</Badge></TabsTrigger>
        <TabsTrigger value="labels">Etiquetas <Badge variant="secondary" className="px-1.5">{labels.length}</Badge></TabsTrigger>
        <TabsTrigger value="trash">Lixeira <Badge variant="secondary" className="px-1.5">{trash.length}</Badge></TabsTrigger>
      </TabsList>
      <TabsContent value="general"><GeneralSection board={board} /></TabsContent>
      <TabsContent value="access"><AccessSection boardId={board.id} memberIds={memberIds} users={users} /></TabsContent>
      <TabsContent value="areas">
        <ItemsSection kind="area" boardId={board.id} items={areas} title="Áreas solicitantes"
          description="Quem pede as tarefas (ex.: RH, DIRETORIA). Toda tarefa precisa de uma área; ela alimenta o gráfico “Áreas demandantes”." />
      </TabsContent>
      <TabsContent value="trash"><TrashSection items={trash} /></TabsContent>
      <TabsContent value="labels">
        <ItemsSection kind="label" boardId={board.id} items={labels} title="Etiquetas"
          description="Tipo de entrega (ex.: Rede Social, Vídeo, E-mail). Uma tarefa pode ter várias." />
      </TabsContent>
    </Tabs>
  );
}

function GeneralSection({ board }: { board: Props["board"] }) {
  const [name, setName] = useState(board.name);
  const [confirmName, setConfirmName] = useState("");
  const a = useAction();
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Nome do quadro</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); a.exec(() => renameBoardAction(board.id, name), "Nome salvo."); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-sm" aria-label="Nome do quadro" />
            <Button type="submit" disabled={a.pending || !name.trim() || name.trim() === board.name}>Salvar nome</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{board.archived ? "Quadro arquivado" : "Arquivar"}</CardTitle>
          <CardDescription>
            {board.archived
              ? "Este quadro está escondido da equipe. Restaure para ele voltar à lista."
              : "Esconde o quadro da lista da equipe. Nada é apagado e você pode restaurar quando quiser."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={a.pending}
            onClick={() => a.exec(() => setBoardArchivedAction(board.id, !board.archived), board.archived ? "Quadro restaurado." : "Quadro arquivado.")}>
            {board.archived ? <><ArchiveRestore /> Restaurar quadro</> : <><Archive /> Arquivar quadro</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de perigo: excluir quadro</CardTitle>
          <CardDescription>Apaga o quadro e todas as tarefas dele, sem volta. Para confirmar, digite o nome do quadro: <strong>{board.name}</strong></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={board.name} className="sm:max-w-sm" aria-label="Digite o nome do quadro para confirmar" />
          <Button variant="destructive" disabled={a.pending || confirmName !== board.name}
            onClick={() => a.exec(() => deleteBoardAction(board.id, confirmName), "Quadro excluído.", () => router.push("/"))}>
            <Trash2 /> Excluir definitivamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AccessSection({ boardId, memberIds, users }: { boardId: string; memberIds: string[]; users: UserOption[] }) {
  const [selected, setSelected] = useState(new Set(memberIds));
  const a = useAction();
  const nonAdmins = users.filter((u) => u.role !== "ADMIN");
  const dirty = selected.size !== memberIds.length || memberIds.some((id) => !selected.has(id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quem pode ver este quadro</CardTitle>
        <CardDescription>Marque as pessoas da equipe. Administradores veem todos os quadros automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nonAdmins.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum Membro ou Observador cadastrado ainda. Cadastre em <strong>Usuários</strong>.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {nonAdmins.map((u) => (
              <li key={u.id}>
                <label htmlFor={`m-${u.id}`} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                  <Checkbox
                    id={`m-${u.id}`} checked={selected.has(u.id)}
                    onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v === true) n.add(u.id); else n.delete(u.id); return n; })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <Badge variant="outline">{ROLE_LABELS[u.role as Role]}</Badge>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <Button disabled={a.pending || !dirty} onClick={() => a.exec(() => setBoardMembersAction(boardId, [...selected]), "Acessos salvos.")}>
            Salvar acessos
          </Button>
          {dirty && <span className="text-xs text-amber-700">Alterações não salvas</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemsSection({ kind, boardId, items, title, description }: {
  kind: "area" | "label"; boardId: string; items: Item[]; title: string; description: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => nextColor(items.map((i) => i.color)));
  const a = useAction();
  const noun = kind === "area" ? "área" : "etiqueta";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="space-y-3 rounded-lg border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.exec(() => createBoardItemAction(kind, boardId, { name, color }), `${noun[0].toUpperCase() + noun.slice(1)} adicionada.`, () => {
              setName("");
              setColor(nextColor([...items.map((i) => i.color), color]));
            });
          }}
        >
          <Label htmlFor={`new-${kind}`}>Nova {noun}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id={`new-${kind}`} placeholder={kind === "area" ? "Ex.: RH" : "Ex.: Vídeo"} value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-xs" />
            <Button type="submit" disabled={a.pending || !name.trim()}><Plus /> Adicionar</Button>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          {name.trim() && (
            <div className="text-xs text-muted-foreground">
              Prévia: <span className="rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: color, color: readableTextColor(color) }}>{name}</span>
            </div>
          )}
        </form>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma {noun} cadastrada ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((it) => <ItemRow key={it.id} kind={kind} boardId={boardId} item={it} exec={a.exec} pending={a.pending} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ItemRow({ kind, boardId, item, exec, pending }: {
  kind: "area" | "label"; boardId: string; item: Item; pending: boolean;
  exec: ReturnType<typeof useAction>["exec"];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [color, setColor] = useState(item.color);
  const confirm = useConfirm();

  if (editing) {
    return (
      <li className="space-y-3 p-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-xs" aria-label="Nome" />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button size="sm" disabled={pending || !name.trim()} onClick={() => exec(() => updateBoardItemAction(kind, boardId, item.id, { name, color }), "Alterações salvas.", () => setEditing(false))}>Salvar</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(item.name); setColor(item.color); }}>Cancelar</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${item.isActive ? "" : "opacity-50"}`}
        style={{ backgroundColor: item.color, color: readableTextColor(item.color) }}
      >
        {item.name}
      </span>
      {!item.isActive && <Badge variant="outline">Desativada</Badge>}
      <div className="ml-auto flex gap-0.5">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Editar ${item.name}`}><Pencil /> <span className="hidden sm:inline">Editar</span></Button>
        <Button size="sm" variant="ghost" disabled={pending} aria-label={item.isActive ? `Desativar ${item.name}` : `Reativar ${item.name}`}
          title={item.isActive ? "Some das opções para tarefas novas; continua nas antigas." : "Volta a aparecer nas opções."}
          onClick={() => exec(() => setBoardItemActiveAction(kind, boardId, item.id, !item.isActive), item.isActive ? "Desativada." : "Reativada.")}>
          <Power /> <span className="hidden sm:inline">{item.isActive ? "Desativar" : "Reativar"}</span>
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} aria-label={`Excluir ${item.name}`}
          onClick={async () => {
            const ok = await confirm({ title: `Excluir “${item.name}”?`, description: "Só é possível excluir itens que nunca foram usados em tarefas. Se já foi usado, desative.", confirmLabel: "Excluir", destructive: true });
            if (ok) exec(() => deleteBoardItemAction(kind, boardId, item.id), "Excluída.");
          }}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
