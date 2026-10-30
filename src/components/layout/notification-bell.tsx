"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Hourglass, CheckCircle2, XCircle, Send, Repeat } from "lucide-react";
import type { NotificationList, PendingApprovals } from "@/server/services/notifications";
import { getInboxAction, markNotificationsReadAction } from "@/server/actions/approval";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Inbox {
  notifications: NotificationList;
  pending: PendingApprovals;
}

type Item = NotificationList["items"][number];

function describe(n: Item): { icon: React.ReactNode; text: React.ReactNode } {
  const title = <strong className="font-medium">“{n.card.title}”</strong>;
  switch (n.type) {
    case "APPROVAL_REQUESTED":
      return { icon: <Send className="text-violet-600" />, text: <>{n.actorName} enviou {title} para sua aprovação</> };
    case "CARD_APPROVED":
      return { icon: <CheckCircle2 className="text-emerald-600" />, text: <>{n.actorName} aprovou {title}</> };
    case "RECURRENCE_CREATED":
      return { icon: <Repeat className="text-sky-600" />, text: <>Nova tarefa da série: {title}</> };
    case "CARD_REJECTED":
      return {
        icon: <XCircle className="text-red-600" />,
        text: <>{n.actorName} reprovou {title}{n.message && <span className="block text-muted-foreground">“{n.message}”</span>}</>,
      };
  }
}

/** Sininho de avisos (SPEC §6.E). Atualiza ao abrir e a cada minuto. */
export function NotificationBell({ initial }: { initial: Inbox }) {
  const [inbox, setInbox] = useState(initial);
  const router = useRouter();

  const refresh = useCallback(() => {
    getInboxAction().then((r) => {
      if (r.ok && r.data) setInbox(r.data);
    });
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const unread = inbox.notifications.unread;
  const open = (n: { cardId: string; boardId: string; notificationId?: string }) => {
    if (n.notificationId) void markNotificationsReadAction([n.notificationId]).then(refresh);
    router.push(`/boards/${n.boardId}?card=${n.cardId}`);
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && refresh()}>
      <DropdownMenuTrigger
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={unread > 0 ? `Avisos: ${unread} não lidos` : "Avisos"}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[75vh] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Avisos</span>
          {unread > 0 && (
            <button
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => void markNotificationsReadAction().then(refresh)}
            >
              Marcar todos como lidos
            </button>
          )}
        </div>

        {inbox.pending.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-violet-700">
              Aguardando sua aprovação ({inbox.pending.length})
            </DropdownMenuLabel>
            {inbox.pending.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => open({ cardId: p.id, boardId: p.boardId })} className="items-start">
                <Hourglass className="mt-0.5 text-violet-600" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">{p.boardName}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        {inbox.notifications.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
        ) : (
          inbox.notifications.items.map((n) => {
            const d = describe(n);
            return (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => open({ cardId: n.card.id, boardId: n.card.boardId, notificationId: n.id })}
                className={cn("items-start", !n.read && "bg-sky-50/70")}
              >
                <span className="mt-0.5 [&_svg]:size-4">{d.icon}</span>
                <span className="min-w-0 flex-1 text-sm leading-snug">
                  {d.text}
                  <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-600" aria-label="Não lido" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
