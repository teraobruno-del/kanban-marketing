"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoardAction } from "@/server/actions/boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewBoardForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createBoardAction(name);
          if (!r.ok) return setError(r.error);
          setName("");
          setError(undefined);
          router.push(`/boards/${r.data!.id}/settings`);
        });
      }}
    >
      <div className="flex gap-2">
        <Input placeholder="Nome do novo quadro" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
        <Button type="submit" disabled={pending || !name.trim()}>+ Novo quadro</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
