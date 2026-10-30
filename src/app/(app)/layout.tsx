import { requireUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <AppHeader user={{ name: user.name, email: user.email, role: user.role }} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
