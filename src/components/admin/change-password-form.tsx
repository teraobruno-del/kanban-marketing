"use client";
import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-background p-4">
      <h2 className="font-medium">Trocar senha</h2>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.success && <Alert>{state.success}</Alert>}
      <div className="space-y-2"><Label htmlFor="pw">Nova senha</Label><Input id="pw" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div className="space-y-2"><Label htmlFor="pw2">Repita a nova senha</Label><Input id="pw2" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></div>
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Trocar senha"}</Button>
    </form>
  );
}
