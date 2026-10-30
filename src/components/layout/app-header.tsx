"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, ChevronDown, LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { initials } from "@/lib/format";
import { NotificationBell } from "./notification-bell";
import type { NotificationList, PendingApprovals } from "@/server/services/notifications";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  user: { name: string; email: string; role: Role };
  inbox: { notifications: NotificationList; pending: PendingApprovals };
}

export function AppHeader({ user, inbox }: Props) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Quadros", icon: LayoutGrid, active: pathname === "/" || pathname.startsWith("/boards") },
    ...(user.role === "ADMIN"
      ? [{ href: "/admin/users", label: "Usuários", icon: Users, active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Kanban Marketing — início">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">📋</span>
          <span className="hidden md:inline">Kanban Marketing</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Menu principal">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto" />
        <NotificationBell initial={inbox} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex cursor-pointer items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Menu do usuário"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
              {initials(user.name)}
            </span>
            <span className="hidden max-w-40 truncate font-medium sm:inline">{user.name}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              <div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account"><UserRound /> Minha conta</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logoutAction()}>
              <LogOut /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
