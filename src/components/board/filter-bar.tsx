"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, UserRound, X } from "lucide-react";
import type { BoardView } from "@/server/services/cards";
import { hasActiveFilters, NO_ASSIGNEE, type BoardFilters } from "@/lib/board/filters";
import { NativeSelect } from "@/components/ui/select-native";
import { cn } from "@/lib/utils";

/** Barra de filtros do quadro. Os filtros ficam no endereço (link compartilhável). */
export function FilterBar({ view, filters, shown, total }: {
  view: BoardView; filters: BoardFilters; shown: number; total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(filters.q);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    next.delete("card");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Busca: espera a pessoa parar de digitar por um instante antes de atualizar.
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [q]);

  const active = hasActiveFilters(filters);
  const select = "h-8 w-auto max-w-44 text-xs";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" role="search" aria-label="Filtrar tarefas">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo título…" aria-label="Buscar pelo título"
          className="h-8 w-48 rounded-md border border-input bg-transparent pr-2 pl-7 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <button
        type="button" aria-pressed={filters.mine} onClick={() => update({ mine: filters.mine ? null : "1" })}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition",
          filters.mine ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
        )}
      >
        <UserRound className="size-3.5" /> Minhas tarefas
      </button>
      <NativeSelect aria-label="Responsável" className={select} value={filters.assignee ?? ""} onChange={(e) => update({ assignee: e.target.value || null })}>
        <option value="">Responsável: todos</option>
        <option value={NO_ASSIGNEE}>Sem responsável</option>
        {view.assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Área" className={select} value={filters.area ?? ""} onChange={(e) => update({ area: e.target.value || null })}>
        <option value="">Área: todas</option>
        {view.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </NativeSelect>
      {view.labels.length > 0 && (
        <NativeSelect aria-label="Etiqueta" className={select} value={filters.label ?? ""} onChange={(e) => update({ label: e.target.value || null })}>
          <option value="">Etiqueta: todas</option>
          {view.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
      )}
      {active && (
        <>
          <span className="text-xs text-muted-foreground" role="status">Mostrando {shown} de {total} tarefas</span>
          <button type="button" onClick={() => { setQ(""); update({ q: null, mine: null, assignee: null, area: null, label: null }); }}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-3.5" /> Limpar filtros
          </button>
        </>
      )}
    </div>
  );
}
