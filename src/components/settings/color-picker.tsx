"use client";
import { COLOR_PRESETS } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** Paleta de cores prontas + opção de cor personalizada. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const custom = !COLOR_PRESETS.includes(value.toUpperCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cor">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c} type="button" role="radio" aria-checked={value.toUpperCase() === c} aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            "size-6 cursor-pointer rounded-full border-2 border-transparent transition hover:scale-110",
            value.toUpperCase() === c && "ring-2 ring-foreground ring-offset-2",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <label
        className={cn("relative size-6 cursor-pointer overflow-hidden rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]", custom && "ring-2 ring-foreground ring-offset-2")}
        title="Outra cor"
      >
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Outra cor" />
      </label>
    </div>
  );
}
