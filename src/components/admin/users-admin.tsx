"use client";
import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, KeyRound, Power, Plus } from "lucide-react";
import { createUserAction, resetUserPasswordAction, setUserActiveAction, updateUserAction } from "@/server/actions/users";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { initials } from "@/lib/format";

type U = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };
const ROLES: Role[] = ["ADMIN", "MEMBER", "OBSERVER"];
const ROLE_HELP: Record<Role, string> = {
  ADMIN: "faz tudo, vê todos os quadros e o dashboard",
  MEMBER: "cria, edita e move tarefas nos quadros em que participa",
  OBSERVER: "só vê e comenta",
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-slate-800 text-white border-transparent",
  MEMBER: "bg-sky-100 text-sky-800 border-transparent",
  OBSERVER: "bg-muted text-muted-foreground border-transparent",
};

export function UsersAdmin({ users, currentUserId }: { users: U[]; currentUserId: string }) {
  const [dialog, setDialog] = useState<{ type: "new" } | { type: "edit" | "password"; user: U } | null>(null);
  const [, start] = useTransition();
  const confirm = useConfirm();

  const toggleActive = async (u: U) => {
    if (u.isActive) {
      const ok = await confirm({
        title: `Desativar ${u.name}?`,
        description: "A pessoa não conseguirá mais entrar. O histórico dela fica preservado e você pode reativar depois.",
        confirmLabel: "Desativar",
        destructive: true,
      });
      if (!ok) return;
    }
    start(async () => {
      const r = await setUserActiveAction(u.id, !u.isActive);
      if (!r.ok) toast.error(r.error);
      else toast.success(u.isActive ? `${u.name} foi desativado(a).` : `${u.name} foi reativado(a).`);
    });
  };

  const actions = (u: U) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações para ${u.name}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDialog({ type: "edit", user: u })}><Pencil /> Editar nome e papel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog({ type: "password", user: u })}><KeyRound /> Redefinir senha</DropdownMenuItem>
        {u.id !== currentUserId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant={u.isActive ? "destructive" : undefined} onSelect={() => void toggleActive(u)}>
              <Power /> {u.isActive ? "Desativar" : "Reativar"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const roleBadge = (u: U) => <Badge className={ROLE_BADGE[u.role as Role]}>{ROLE_LABELS[u.role as Role]}</Badge>;
  const status = (u: U) => u.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Desativado</Badge>;
  const avatar = (u: U) => (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${u.isActive ? "bg-slate-700 text-white" : "bg-muted text-muted-foreground"}`}>
      {initials(u.name)}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ type: "new" })}><Plus /> Novo usuário</Button>
      </div>

      {/* Notebook: tabela */}
      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-3 font-medium">Pessoa</th><th className="p-3 font-medium">Papel</th><th className="p-3 font-medium">Situação</th><th className="w-12 p-3"><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "text-muted-foreground"}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {avatar(u)}
                    <div className="min-w-0">
                      <div className="font-medium">{u.name}{u.id === currentUserId && <span className="font-normal text-muted-foreground"> (você)</span>}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{roleBadge(u)}</td>
                <td className="p-3">{status(u)}</td>
                <td className="p-3 text-right">{actions(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-xl border bg-background p-3">
            {avatar(u)}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{u.name}{u.id === currentUserId && " (você)"}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              <div className="mt-1.5 flex gap-1.5">{roleBadge(u)}{status(u)}</div>
            </div>
            {actions(u)}
          </li>
        ))}
      </ul>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {dialog?.type === "new" && (
            <UserForm
              title="Novo usuário"
              description="Defina uma senha provisória e repasse para a pessoa. Ela poderá trocar em “Minha conta”."
              withEmailAndPassword
              onSubmit={async (v) => {
                const r = await createUserAction(v);
                if (r.ok) { setDialog(null); toast.success(`${v.name} foi cadastrado(a). Lembre de dar acesso aos quadros.`); }
                return r.ok ? undefined : r.error;
              }}
            />
          )}
          {dialog?.type === "edit" && (
            <UserForm
              title={`Editar ${dialog.user.name}`}
              description={dialog.user.email}
              initial={{ name: dialog.user.name, role: dialog.user.role as Role, email: dialog.user.email }}
              onSubmit={async (v) => {
                const r = await updateUserAction(dialog.user.id, v);
                if (r.ok) { setDialog(null); toast.success("Alterações salvas."); }
                return r.ok ? undefined : r.error;
              }}
            />
          )}
          {dialog?.type === "password" && (
            <PasswordForm
              user={dialog.user}
              onSubmit={async (pw) => {
                const r = await resetUserPasswordAction(dialog.user.id, pw);
                if (r.ok) { setDialog(null); toast.success(`Nova senha provisória definida para ${dialog.user.name}.`); }
                return r.ok ? undefined : r.error;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({ title, description, initial, withEmailAndPassword, onSubmit }: {
  title: string; description: string; initial?: { name: string; role: Role; email?: string }; withEmailAndPassword?: boolean;
  onSubmit: (v: { name: string; email: string; role: Role; password: string }) => Promise<string | undefined>;
}) {
  const [v, setV] = useState({ name: initial?.name ?? "", email: initial?.email ?? "", role: initial?.role ?? ("MEMBER" as Role), password: "" });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(await onSubmit(v)); setSaving(false); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="u-name">Nome</Label><Input id="u-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
      <div className="space-y-2">
        <Label htmlFor="u-email">E-mail</Label>
        <Input id="u-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
        {!withEmailAndPassword && initial?.email && v.email.trim().toLowerCase() !== initial.email && (
          <p className="text-xs text-amber-700">A pessoa passará a entrar com este novo e-mail.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="u-role">Papel</Label>
        <NativeSelect id="u-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HELP[r]}</option>)}
        </NativeSelect>
      </div>
      {withEmailAndPassword && (
        <div className="space-y-2">
          <Label htmlFor="u-pw">Senha provisória</Label>
          <Input id="u-pw" type="text" autoComplete="off" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} minLength={8} required />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
        </div>
      )}
      <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </form>
  );
}

function PasswordForm({ user, onSubmit }: { user: U; onSubmit: (pw: string) => Promise<string | undefined> }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(await onSubmit(pw)); setSaving(false); }}>
      <DialogHeader>
        <DialogTitle>Redefinir senha</DialogTitle>
        <DialogDescription>Defina uma nova senha provisória para {user.name} e repasse para a pessoa.</DialogDescription>
      </DialogHeader>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Input type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required placeholder="Nova senha (mín. 8 caracteres)" />
      <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Definir senha"}</Button></DialogFooter>
    </form>
  );
}
