"use client";
import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; email?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Escolha de pessoas compacta: mostra só as escolhidas (com ×) e um campo que filtra ao digitar
 * (nome ou e-mail, sem diferenciar acentos/maiúsculas). Setas escolhem, Enter adiciona.
 */
export function PeoplePicker({
  id, label, people, selected, onChange, disabled, emptyText, placeholder = "Adicionar pessoa…",
}: {
  id: string;
  label: string;
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyText?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const byId = new Map(people.map((p) => [p.id, p]));
  const chosen = selected.map((id) => byId.get(id) ?? { id, name: "(sem acesso)" });
  const q = fold(query.trim());
  const options = people
    .filter((p) => !selected.includes(p.id))
    .filter((p) => !q || fold(p.name).includes(q) || (p.email && fold(p.email).includes(q)))
    .slice(0, 8);

  const add = (p: Person) => {
    onChange([...selected, p.id]);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label} escolhidos`}>
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-0.5 text-xs font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-white">{initials(p.name)}</span>
              {p.name}
              {!disabled && (
                <button type="button" onClick={() => onChange(selected.filter((x) => x !== p.id))}
                  className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remover ${p.name}`}>
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {chosen.length === 0 && disabled && <p className="text-xs text-muted-foreground">Ninguém.</p>}

      {!disabled && (
        <div className="relative">
          <input
            ref={input}
            id={id}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={people.length === 0 ? (emptyText ?? "Ninguém disponível") : placeholder}
            disabled={people.length === 0}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (open && options[active]) add(options[active]); }
              else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
              else if (e.key === "Backspace" && !query && selected.length) onChange(selected.slice(0, -1));
            }}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {open && options.length > 0 && (
            <ul id={listId} role="listbox" data-escape-local className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
              {options.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); add(p); }} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm", i === active && "bg-accent")}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{initials(p.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{p.name}</span>
                      {p.email && <span className="block truncate text-xs text-muted-foreground">{p.email}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query && options.length === 0 && (
            <p className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-2 text-xs text-muted-foreground shadow-md">Ninguém encontrado.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
