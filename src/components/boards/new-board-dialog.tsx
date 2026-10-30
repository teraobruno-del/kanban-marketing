"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createBoardAction } from "@/server/actions/boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function NewBoardDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setError(undefined); } }}>
      <DialogTrigger asChild>
        <Button><Plus /> Novo quadro</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createBoardAction(name);
              if (!r.ok) return setError(r.error);
              router.push(`/boards/${r.data!.id}/settings`);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Novo quadro</DialogTitle>
            <DialogDescription>Depois de criar, você cadastra as áreas, etiquetas e quem tem acesso.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="board-name">Nome</Label>
            <Input id="board-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lançamento X" autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Criando…" : "Criar quadro"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
