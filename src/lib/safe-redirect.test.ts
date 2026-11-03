import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("Redirecionamento seguro", () => {
  it("aceita páginas do próprio site", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/boards/1?card=2")).toBe("/boards/1?card=2");
  });
  it("recusa outros sites e endereços estranhos", () => {
    expect(safeNextPath("https://site-falso.com")).toBe("/");
    expect(safeNextPath("//site-falso.com")).toBe("/");
    expect(safeNextPath("/\\site-falso.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("/a\nb")).toBe("/");
  });
});
