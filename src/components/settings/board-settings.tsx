"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBoardItemAction, deleteBoardAction, deleteBoardItemAction, renameBoardAction, setBoardArchivedAction,
  setBoardItemActiveAction, setBoardMembersAction, updateBoardItemAction,
} from "@/server/actions/boards";
import type { ActionResult } from "@/server/errors";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type Item = { id: string; name: string; color: string; isActive: boolean };
type UserOption = { id: string; name: string; email: string; role: string };

interface Props {
  board: { id: string; name: string; archived: boolean };
  memberIds: string[];
  users: UserOption[];
  areas: Item[];
  labels: Item[];
}

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const exec = (fn: () => Promise<ActionResult<unknown>>, success?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); setOk(undefined); }
      else { setError(undefined); setOk(success); after?.(); }
    });
  return { pending, error, ok, exec };
}

export function BoardSettings({ board, memberIds, users, areas, labels }: Props) {
  return (
    <div className="space-y-6">
      <GeneralSection board={board} />
      <AccessSection boardId={board.id} memberIds={memberIds} users={users} />
      <ItemsSection kind="area" boardId={board.id} items={areas}
        title="Áreas solicitantes" description="Quem pede as tarefas (ex.: RH, DIRETORIA). Obrigatória em todo card; alimenta o gráfico “Áreas demandantes”." />
      <ItemsSection kind="label" boardId={board.id} items={labels}
        title="Etiquetas" description="Tipo de entrega (ex.: Rede Social, Vídeo, E-mail). Um card pode ter várias." />
    </div>
  );
}

function GeneralSection({ board }: { board: Props["board"] }) {
  const [name, setName] = useState(board.name);
  const [confirmName, setConfirmName] = useState("");
  const a = useAction();
  const router = useRouter();
  return (
    <Card>
      <CardHeader><CardTitle>Geral</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {a.error && <Alert variant="destructive">{a.error}</Alert>}
        {a.ok && <Alert>{a.ok}</Alert>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.exec(() => renameBoardAction(board.id, name), "Nome salvo."); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
          <Button type="submit" variant="outline" disabled={a.pending || name.trim() === board.name}>Renomear</Button>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={a.pending}
            onClick={() => a.exec(() => setBoardArchivedAction(board.id, !board.archived), board.archived ? "Quadro restaurado." : "Quadro arquivado.")}>
            {board.archived ? "Restaurar quadro" : "Arquivar quadro"}
          </Button>
          <span className="text-xs text-muted-foreground">Quadros arquivados somem da lista dos usuários, mas nada é apagado.</span>
        </div>
        <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
          <p className="text-sm font-medium text-destructive">Excluir quadro definitivamente</p>
          <p className="text-xs text-muted-foreground">Apaga o quadro e todas as tarefas dele. Não dá para desfazer. Digite o nome do quadro para confirmar.</p>
          <div className="flex gap-2">
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={board.name} className="max-w-sm" />
            <Button variant="destructive" disabled={a.pending || confirmName !== board.name}
              onClick={() => a.exec(() => deleteBoardAction(board.id, confirmName), undefined, () => router.push("/"))}>
              Excluir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
        <CardTitle>Acesso</CardTitle>
        <CardDescription>Quem pode ver este quadro. Administradores veem todos os quadros automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {a.error && <Alert variant="destructive">{a.error}</Alert>}
        {a.ok && <Alert>{a.ok}</Alert>}
        {nonAdmins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum Membro ou Observador cadastrado ainda. Cadastre em Usuários.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {nonAdmins.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  id={`m-${u.id}`} checked={selected.has(u.id)}
                  onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v === true) n.add(u.id); else n.delete(u.id); return n; })}
                />
                <label htmlFor={`m-${u.id}`} className="flex-1 cursor-pointer">
                  {u.name} <span className="text-muted-foreground">· {u.email}</span>
                </label>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role as Role]}</span>
              </li>
            ))}
          </ul>
        )}
        <Button disabled={a.pending || !dirty} onClick={() => a.exec(() => setBoardMembersAction(boardId, [...selected]), "Acessos salvos.")}>
          Salvar acessos
        </Button>
      </CardContent>
    </Card>
  );
}

const PALETTE = ["#E11D48", "#EA580C", "#CA8A04", "#16A34A", "#0891B2", "#2563EB", "#7C3AED", "#DB2777", "#475569"];

function ItemsSection({ kind, boardId, items, title, description }: {
  kind: "area" | "label"; boardId: string; items: Item[]; title: string; description: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[items.length % PALETTE.length]);
  const a = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {a.error && <Alert variant="destructive">{a.error}</Alert>}
        <ul className="divide-y rounded-lg border">
          {items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum item ainda.</li>}
          {items.map((it) => <ItemRow key={it.id} kind={kind} boardId={boardId} item={it} exec={a.exec} pending={a.pending} />)}
        </ul>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            a.exec(() => createBoardItemAction(kind, boardId, { name, color }), undefined, () => setName(""));
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-9 w-10 cursor-pointer rounded border" aria-label="Cor" />
          <Input placeholder={kind === "area" ? "Nova área (ex.: RH)" : "Nova etiqueta (ex.: Vídeo)"} value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Button type="submit" variant="outline" disabled={a.pending || !name.trim()}>Adicionar</Button>
        </form>
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
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      {editing ? (
        <>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-8 w-9 cursor-pointer rounded border" aria-label="Cor" />
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-xs" />
          <Button size="sm" disabled={pending} onClick={() => exec(() => updateBoardItemAction(kind, boardId, item.id, { name, color }), undefined, () => setEditing(false))}>Salvar</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(item.name); setColor(item.color); }}>Cancelar</Button>
        </>
      ) : (
        <>
          <span className="size-4 rounded" style={{ backgroundColor: item.color }} />
          <span className={item.isActive ? "" : "text-muted-foreground line-through"}>{item.name}</span>
          {!item.isActive && <span className="text-xs text-muted-foreground">(desativado)</span>}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => exec(() => setBoardItemActiveAction(kind, boardId, item.id, !item.isActive))}>
              {item.isActive ? "Desativar" : "Reativar"}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}
              onClick={() => confirm(`Excluir “${item.name}”?`) && exec(() => deleteBoardItemAction(kind, boardId, item.id))}>
              Excluir
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
