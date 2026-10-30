import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listNotifications, listPendingApprovals } from "@/server/services/notifications";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, pending] = await Promise.all([
    listNotifications(prisma, user),
    listPendingApprovals(prisma, user),
  ]);
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <AppHeader user={{ name: user.name, email: user.email, role: user.role }} inbox={{ notifications, pending }} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
