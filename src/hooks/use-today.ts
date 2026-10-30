"use client";
import { useEffect, useState } from "react";
import { todayInSaoPaulo, type DateOnly } from "@/lib/dates/day";

/**
 * "Hoje" em São Paulo, atualizado sozinho na virada do dia (SPEC §4.2):
 * confere a cada minuto e quando a aba volta a ficar visível.
 */
export function useToday(initial: DateOnly): DateOnly {
  const [today, setToday] = useState(initial);
  useEffect(() => {
    const update = () => setToday(todayInSaoPaulo());
    update();
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}
