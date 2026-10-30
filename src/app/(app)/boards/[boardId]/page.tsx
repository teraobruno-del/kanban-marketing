import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canEditCards } from "@/lib/auth/permissions";
import { todayInSaoPaulo } from "@/lib/dates/day";
import { getBoardView } from "@/server/services/cards";
import { AppError } from "@/server/errors";
import { BoardView } from "@/components/board/board-view";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await requireUser();
  let view;
  try {
    view = await getBoardView(prisma, user, boardId);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  return (
    <BoardView
      view={view}
      initialToday={todayInSaoPaulo()}
      canEdit={canEditCards(user, view.access) && !view.board.archived}
      isAdmin={user.role === "ADMIN"}
      currentUserId={user.id}
    />
  );
}
