import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listActiveUsers } from "@/server/services/users";
import { listTrash } from "@/server/services/trash";
import { BoardSettings } from "@/components/settings/board-settings";

export default async function BoardSettingsPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: { select: { userId: true } },
      areas: { orderBy: { name: "asc" } },
      labels: { orderBy: { name: "asc" } },
    },
  });
  if (!board) notFound();
  const [users, trash] = await Promise.all([listActiveUsers(prisma, user), listTrash(prisma, user, board.id)]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href={`/boards/${board.id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">← Voltar ao quadro</Link>
        <h1 className="mt-1 text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">{board.name}</p>
      </div>
      <BoardSettings
        board={{ id: board.id, name: board.name, archived: board.archivedAt !== null }}
        memberIds={board.members.map((m) => m.userId)}
        users={users}
        areas={board.areas.map(({ id, name, color, isActive }) => ({ id, name, color, isActive }))}
        labels={board.labels.map(({ id, name, color, isActive }) => ({ id, name, color, isActive }))}
        trash={trash}
      />
    </main>
  );
}
