"use client";
import { useActionState } from "react";
import { requestPasswordResetAction, type FormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordResetAction, {});
  return (
    <div className="space-y-4">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.success ? (
        <Alert>
          {state.success}
          <span className="mt-1 block text-xs text-muted-foreground">Abra o link neste mesmo navegador. Ele vale por pouco tempo.</span>
        </Alert>
      ) : (
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</Button>
        </form>
      )}
      <p className="text-center text-sm">
        <a href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Voltar para o login</a>
      </p>
    </div>
  );
}
