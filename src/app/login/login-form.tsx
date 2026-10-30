"use client";
import { useActionState, useState } from "react";
import { loginAction, type FormState } from "@/server/actions/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ initialError, googleEnabled }: { initialError?: string; googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, { error: initialError });
  const [googleLoading, setGoogleLoading] = useState(false);

  async function google() {
    setGoogleLoading(true);
    await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="space-y-4">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google} disabled={googleLoading}>
            {googleLoading ? "Abrindo o Google…" : "Entrar com Google"}
          </Button>
        </>
      )}
    </div>
  );
}
