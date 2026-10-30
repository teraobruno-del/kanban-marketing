/** Cores sugeridas para áreas e etiquetas (boa leitura com texto branco ou preto). */
export const COLOR_PRESETS = [
  "#E11D48", "#EA580C", "#D97706", "#65A30D", "#16A34A", "#0D9488",
  "#0891B2", "#2563EB", "#4F46E5", "#7C3AED", "#C026D3", "#475569",
];

/** Escolhe a próxima cor ainda não usada (para cada item novo nascer com cor diferente). */
export function nextColor(used: string[]): string {
  const set = new Set(used.map((c) => c.toUpperCase()));
  return COLOR_PRESETS.find((c) => !set.has(c)) ?? COLOR_PRESETS[used.length % COLOR_PRESETS.length];
}

/** Letra preta ou branca, a que tiver mais contraste com o fundo (regra WCAG). */
export function readableTextColor(hex: string): "#000000" | "#FFFFFF" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastBlack > contrastWhite ? "#000000" : "#FFFFFF";
}
