"use client";
import { useState, useTransition } from "react";
import { createUserAction, resetUserPasswordAction, setUserActiveAction, updateUserAction } from "@/server/actions/users";
import type { ActionResult } from "@/server/errors";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type U = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };
const ROLES: Role[] = ["ADMIN", "MEMBER", "OBSERVER"];
const ROLE_HELP: Record<Role, string> = {
  ADMIN: "faz tudo, vê todos os quadros e o dashboard",
  MEMBER: "cria, edita e move tarefas nos quadros em que participa",
  OBSERVER: "só vê e comenta",
};

export function UsersAdmin({ users, currentUserId }: { users: U[]; currentUserId: string }) {
  const [dialog, setDialog] = useState<{ type: "new" } | { type: "edit" | "password"; user: U } | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, start] = useTransition();

  const exec = (fn: () => Promise<ActionResult<unknown>>, success: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); setNotice(undefined); }
      else { setError(undefined); setNotice(success); }
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-h-5 text-sm">
          {error && <span className="text-destructive">{error}</span>}
          {notice && <span className="text-emerald-700">{notice}</span>}
        </div>
        <Button onClick={() => setDialog({ type: "new" })}>+ Novo usuário</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Papel</th><th className="p-3">Situação</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "text-muted-foreground"}>
                <td className="p-3 font-medium">{u.name}{u.id === currentUserId && " (você)"}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{ROLE_LABELS[u.role as Role]}</td>
                <td className="p-3">{u.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Desativado</Badge>}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "edit", user: u })}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "password", user: u })}>Redefinir senha</Button>
                    {u.id !== currentUserId && (
                      <Button
                        size="sm" variant="ghost" disabled={pending} className={u.isActive ? "text-destructive" : ""}
                        onClick={() => {
                          if (u.isActive && !confirm(`Desativar ${u.name}? A pessoa não conseguirá mais entrar.`)) return;
                          exec(() => setUserActiveAction(u.id, !u.isActive), u.isActive ? `${u.name} foi desativado(a).` : `${u.name} foi reativado(a).`);
                        }}
                      >
                        {u.isActive ? "Desativar" : "Reativar"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog?.type === "new" && (
            <UserForm
              title="Novo usuário"
              description="Informe uma senha provisória e repasse para a pessoa. Ela poderá trocar a senha em “Minha conta”."
              withEmailAndPassword
              onSubmit={async (v) => {
                const r = await createUserAction(v);
                if (r.ok) { setDialog(null); setNotice(`${v.name} foi cadastrado(a).`); setError(undefined); }
                return r.ok ? undefined : r.error;
              }}
            />
          )}
          {dialog?.type === "edit" && (
            <UserForm
              title={`Editar ${dialog.user.name}`}
              description={dialog.user.email}
              initial={{ name: dialog.user.name, role: dialog.user.role as Role }}
              onSubmit={async (v) => {
                const r = await updateUserAction(dialog.user.id, v);
                if (r.ok) { setDialog(null); setNotice("Alterações salvas."); setError(undefined); }
                return r.ok ? undefined : r.error;
              }}
            />
          )}
          {dialog?.type === "password" && (
            <PasswordForm
              user={dialog.user}
              onSubmit={async (pw) => {
                const r = await resetUserPasswordAction(dialog.user.id, pw);
                if (r.ok) { setDialog(null); setNotice(`Nova senha provisória definida para ${dialog.user.name}.`); setError(undefined); }
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
  title: string; description: string; initial?: { name: string; role: Role }; withEmailAndPassword?: boolean;
  onSubmit: (v: { name: string; email: string; role: Role; password: string }) => Promise<string | undefined>;
}) {
  const [v, setV] = useState({ name: initial?.name ?? "", email: "", role: initial?.role ?? ("MEMBER" as Role), password: "" });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(await onSubmit(v)); setSaving(false); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="u-name">Nome</Label><Input id="u-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
      {withEmailAndPassword && (
        <div className="space-y-2"><Label htmlFor="u-email">E-mail</Label><Input id="u-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></div>
      )}
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
