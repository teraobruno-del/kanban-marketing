"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Avisa a janela da tarefa aberta que outra pessoa mudou aquela tarefa. */
export const CARD_CHANGED_EVENT = "kanban:card-changed";

const FALLBACK_MS = 30_000; // plano B (P34)

/**
 * Atualização ao vivo do quadro (SPEC §9 / F3): escuta novos eventos do histórico deste quadro
 * pelo Supabase Realtime. Mudanças feitas por outras pessoas recarregam o quadro na hora.
 * Se a conexão ao vivo não abrir ou cair, recarrega a cada 30 segundos.
 */
export function useLiveBoard(boardId: string, currentUserId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let fallback: ReturnType<typeof setInterval> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const startFallback = () => {
      fallback ??= setInterval(() => router.refresh(), FALLBACK_MS);
    };
    const stopFallback = () => {
      if (fallback) clearInterval(fallback);
      fallback = null;
    };
    const notConnected = setTimeout(startFallback, 10_000);

    const channel = supabase.channel(`board-${boardId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "card_events", filter: `board_id=eq.${boardId}` },
      (payload) => {
        const row = payload.new as { card_id?: string; actor_id?: string };
        if (row.actor_id === currentUserId) return; // a própria mudança já foi atualizada
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => router.refresh(), 300);
        if (row.card_id) window.dispatchEvent(new CustomEvent(CARD_CHANGED_EVENT, { detail: { cardId: row.card_id } }));
      },
    );

    void (async () => {
      // Usa o login do usuário, para o Supabase aplicar as regras de quem pode ver o quê (RLS).
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(notConnected);
          stopFallback();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startFallback();
        }
      });
    })();

    return () => {
      clearTimeout(notConnected);
      if (debounce) clearTimeout(debounce);
      stopFallback();
      void supabase.removeChannel(channel);
    };
  }, [boardId, currentUserId, router]);
}

/** Escuta avisos novos do usuário (sininho) e chama `onNew`. */
export function useLiveNotifications(userId: string, onNew: () => void) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`notifications-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => onNew(),
    );
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    })();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onNew]);
}
