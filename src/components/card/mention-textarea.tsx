"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { activeMentionQuery } from "@/lib/mentions";
import { initials } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Caixa de texto que abre a lista de pessoas ao digitar "@" (P18). */
export function MentionTextarea({
  value, onChange, people, onMention, onSubmit, placeholder, autoFocus, id,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  onMention: (id: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  // Posição do cursor depois de inserir um nome: aplicada assim que o texto novo aparece na tela.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const matches = query
    ? people.filter((p) => fold(p.name).includes(fold(query.query))).slice(0, 6)
    : [];

  const update = (text: string, caret: number) => {
    setQuery(activeMentionQuery(text, caret));
    setActive(0);
  };

  const pick = (p: Person) => {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart;
    const next = `${value.slice(0, query.start)}@${p.name} ${value.slice(caret)}`;
    pendingCaret.current = query.start + p.name.length + 2;
    onChange(next);
    onMention(p.id);
    setQuery(null);
  };

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={ref}
        rows={3}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        onChange={(e) => {
          onChange(e.target.value);
          update(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => update(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (matches.length > 0) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[active]); return; }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit?.(); }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 w-64 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                className={cn("flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm", i === active && "bg-accent")}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white">{initials(p.name)}</span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
