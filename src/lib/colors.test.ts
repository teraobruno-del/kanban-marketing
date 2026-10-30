import { describe, expect, it } from "vitest";
import { COLOR_PRESETS, nextColor, readableTextColor } from "./colors";

describe("Cores", () => {
  it("texto legível: preto em fundos claros, branco em escuros", () => {
    expect(readableTextColor("#FFFF00")).toBe("#000000");
    expect(readableTextColor("#FDE68A")).toBe("#000000");
    expect(readableTextColor("#1E293B")).toBe("#FFFFFF");
    expect(readableTextColor("#2563EB")).toBe("#FFFFFF");
  });
  it("cada item novo recebe uma cor ainda não usada", () => {
    expect(nextColor([])).toBe(COLOR_PRESETS[0]);
    expect(nextColor([COLOR_PRESETS[0].toLowerCase()])).toBe(COLOR_PRESETS[1]);
  });
});
