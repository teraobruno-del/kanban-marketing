"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { DashboardData } from "@/server/services/dashboard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Filtros do Dashboard (SPEC §8): período, quadros e área. Ficam no endereço da página. */
export function DashboardFilters({ filters }: { filters: DashboardData["filters"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(filters.period.from);
  const [to, setTo] = useState(filters.period.to);
  const [custom, setCustom] = useState(filters.preset === "custom");

  const push = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    next.delete("group"); // agrupamento volta ao automático quando o período muda
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const selected = new Set(filters.boardIds);
  const toggleBoard = (id: string, on: boolean) => {
    const s = new Set(selected);
    if (on) s.add(id); else s.delete(id);
    push({ boards: s.size === filters.boardOptions.length ? [] : [...s] });
  };
  const boardsLabel = selected.size === 0 ? "Todos os quadros"
    : selected.size === 1 ? filters.boardOptions.find((b) => selected.has(b.id))?.name ?? "1 quadro"
    : `${selected.size} quadros`;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-3">
      <div className="space-y-1">
        <Label htmlFor="f-period" className="text-xs text-muted-foreground">Período</Label>
        <NativeSelect
          id="f-period" className="w-44" value={custom ? "custom" : filters.preset}
          onChange={(e) => {
            if (e.target.value === "custom") return setCustom(true);
            setCustom(false);
            push({ period: e.target.value, from: null, to: null });
          }}
        >
          <option value="month">Este mês</option>
          <option value="quarter">Este trimestre</option>
          <option value="year">Este ano</option>
          <option value="custom">Escolher datas…</option>
        </NativeSelect>
      </div>
      {custom && (
        <>
          <div className="space-y-1">
            <Label htmlFor="f-from" className="text-xs text-muted-foreground">De</Label>
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-to" className="text-xs text-muted-foreground">Até</Label>
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="secondary" disabled={!from || !to} onClick={() => push({ period: "custom", from, to })}>Aplicar</Button>
        </>
      )}

      <div className="space-y-1">
        <span className="block text-xs font-medium text-muted-foreground">Quadros</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-52 justify-between font-normal">
              <span className="truncate">{boardsLabel}</span> <ChevronDown className="opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 p-2">
            <button className="mb-1 w-full cursor-pointer rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent" onClick={() => push({ boards: [] })}>
              Todos os quadros
            </button>
            {filters.boardOptions.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={selected.has(b.id)} onCheckedChange={(v) => toggleBoard(b.id, v === true)} />
                <span className="truncate">{b.name}{b.archived && <span className="text-muted-foreground"> (arquivado)</span>}</span>
              </label>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <Label htmlFor="f-area" className="text-xs text-muted-foreground">Área solicitante</Label>
        <NativeSelect id="f-area" className="w-48" value={filters.area ?? ""} onChange={(e) => push({ area: e.target.value || null })}>
          <option value="">Todas as áreas</option>
          {filters.areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </NativeSelect>
      </div>
    </div>
  );
}

/** Botões Semanas / Meses do gráfico de volume (decisão F4-5A). */
export function GranularityToggle({ value }: { value: "week" | "month" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Agrupar por">
      {(["week", "month"] as const).map((g) => (
        <button
          key={g} aria-pressed={value === g}
          className={`cursor-pointer rounded px-2 py-0.5 ${value === g ? "bg-secondary font-medium" : "text-muted-foreground"}`}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("group", g);
            router.push(`${pathname}?${next.toString()}`, { scroll: false });
          }}
        >
          {g === "week" ? "Semanas" : "Meses"}
        </button>
      ))}
    </div>
  );
}
