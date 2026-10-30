"use client";
import { useTransition } from "react";
import { setBoardArchivedAction } from "@/server/actions/boards";
import { Button } from "@/components/ui/button";

export function RestoreBoardButton({ boardId }: { boardId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => void (await setBoardArchivedAction(boardId, false)))}>
      Restaurar
    </Button>
  );
}
