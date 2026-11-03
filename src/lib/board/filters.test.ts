import { describe, expect, it } from "vitest";
import { filterCards, hasActiveFilters, NO_ASSIGNEE, parseBoardFilters, type BoardFilters } from "./filters";

const card = (title: string, o: Partial<{ area: string; labels: string[]; assignees: string[]; observers: string[] }> = {}) => ({
  title, area: { id: o.area ?? "rh" }, labels: (o.labels ?? []).map((id) => ({ id })),
  assignees: (o.assignees ?? []).map((id) => ({ id })), observerIds: o.observers ?? [],
});
const cards = [
  card("Vídeo institucional", { area: "dir", labels: ["video"], assignees: ["ana"] }),
  card("Post Instagram", { labels: ["social"], assignees: ["bia"], observers: ["ana"] }),
  card("Newsletter de novembro"),
];
const none: BoardFilters = { q: "", mine: false, assignee: null, area: null, label: null };
const titles = (f: Partial<BoardFilters>, me = "ana") => filterCards(cards, { ...none, ...f }, me).map((c) => c.title);

describe("Filtros do quadro", () => {
  it("sem filtros mostra tudo", () => {
    expect(titles({})).toHaveLength(3);
    expect(hasActiveFilters(none)).toBe(false);
  });
  it("busca no título sem acentos e sem diferenciar maiúsculas", () => {
    expect(titles({ q: "video" })).toEqual(["Vídeo institucional"]);
    expect(titles({ q: "NOVEMBRO" })).toEqual(["Newsletter de novembro"]);
  });
  it("Minhas tarefas = sou responsável ou observadora", () => {
    expect(titles({ mine: true })).toEqual(["Vídeo institucional", "Post Instagram"]);
    expect(titles({ mine: true }, "bia")).toEqual(["Post Instagram"]);
  });
  it("responsável, sem responsável, área e etiqueta — combinados", () => {
    expect(titles({ assignee: "bia" })).toEqual(["Post Instagram"]);
    expect(titles({ assignee: NO_ASSIGNEE })).toEqual(["Newsletter de novembro"]);
    expect(titles({ area: "rh" })).toEqual(["Post Instagram", "Newsletter de novembro"]);
    expect(titles({ area: "rh", label: "social" })).toEqual(["Post Instagram"]);
    expect(titles({ area: "dir", label: "social" })).toEqual([]);
  });
  it("lê os filtros do endereço", () => {
    const p = new URLSearchParams("q=%20post%20&mine=1&area=rh");
    expect(parseBoardFilters(p)).toEqual({ q: "post", mine: true, assignee: null, area: "rh", label: null });
  });
});
