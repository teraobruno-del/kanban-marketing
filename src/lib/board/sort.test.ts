import { describe, expect, it } from "vitest";
import { groupCardsByColumn, type SortableCard } from "./sort";

const today = "2026-10-30";
type C = SortableCard & { id: string };
const card = (id: string, stage: C["stage"], dueDate: string | null, createdAt: string): C => ({
  id, stage, dueDate, createdAt: new Date(createdAt),
});

describe("Distribuição e ordenação dos cards", () => {
  const cards: C[] = [
    card("a", "ACTIVE", "2026-10-29", "2026-10-01T10:00:00Z"),
    card("b", "ACTIVE", "2026-10-30", "2026-10-02T10:00:00Z"),
    card("c", "ACTIVE", "2026-11-01", "2026-10-03T10:00:00Z"),
    card("d", "ACTIVE", "2026-11-20", "2026-10-04T10:00:00Z"),
    card("e", "NEW", null, "2026-10-05T10:00:00Z"),
    card("f", "NEW", null, "2026-10-01T09:00:00Z"),
    card("g", "APPROVAL", "2026-11-10", "2026-10-01T10:00:00Z"),
    card("h", "APPROVAL", "2026-11-03", "2026-10-09T10:00:00Z"),
    card("i", "APPROVAL", null, "2026-09-01T10:00:00Z"),
    card("j", "APPROVAL", "2026-11-03", "2026-10-02T10:00:00Z"),
  ];
  const g = groupCardsByColumn(cards, today);
  const ids = (k: keyof typeof g) => g[k].map((c) => c.id);

  it("cada card ACTIVE vai para a coluna calculada pelo prazo", () => {
    expect(ids("OVERDUE")).toEqual(["a"]);
    expect(ids("TODAY")).toEqual(["b"]);
    expect(ids("THIS_WEEK")).toEqual(["c"]);
    expect(ids("UPCOMING")).toEqual(["d"]);
  });

  it("sem prazo: ordem de criação", () => {
    expect(ids("NEW")).toEqual(["f", "e"]);
  });

  it("prazo crescente; empate pela criação; sem prazo no fim (P16)", () => {
    expect(ids("APPROVAL")).toEqual(["j", "h", "g", "i"]);
  });

  it("colunas vazias existem e estão vazias", () => {
    expect(ids("CHANGES")).toEqual([]);
    expect(ids("DONE")).toEqual([]);
  });
});
