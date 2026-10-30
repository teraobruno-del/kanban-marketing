import { describe, expect, it } from "vitest";
import { BOARD_COLUMNS, getBoardColumn } from "./columns";

const today = "2026-10-30";

describe("Colunas do quadro", () => {
  it("são exatamente 8, na ordem da SPEC", () => {
    expect(BOARD_COLUMNS.map((c) => c.key)).toEqual([
      "NEW", "OVERDUE", "TODAY", "THIS_WEEK", "UPCOMING", "APPROVAL", "CHANGES", "DONE",
    ]);
  });

  it("etapas fixas aparecem na própria coluna, mesmo com prazo vencido", () => {
    expect(getBoardColumn({ stage: "APPROVAL", dueDate: "2026-01-01" }, today)).toBe("APPROVAL");
    expect(getBoardColumn({ stage: "CHANGES", dueDate: "2026-01-01" }, today)).toBe("CHANGES");
    expect(getBoardColumn({ stage: "DONE", dueDate: "2026-01-01" }, today)).toBe("DONE");
    expect(getBoardColumn({ stage: "NEW", dueDate: null }, today)).toBe("NEW");
  });

  it("cards ACTIVE usam a coluna calculada pelo prazo", () => {
    expect(getBoardColumn({ stage: "ACTIVE", dueDate: "2026-10-29" }, today)).toBe("OVERDUE");
    expect(getBoardColumn({ stage: "ACTIVE", dueDate: today }, today)).toBe("TODAY");
    expect(getBoardColumn({ stage: "ACTIVE", dueDate: "2026-11-01" }, today)).toBe("THIS_WEEK");
    expect(getBoardColumn({ stage: "ACTIVE", dueDate: "2026-11-02" }, today)).toBe("UPCOMING");
  });

  it("card ACTIVE sem prazo cai em NOVAS DEMANDAS (premissa P1)", () => {
    expect(getBoardColumn({ stage: "ACTIVE", dueDate: null }, today)).toBe("NEW");
  });
});
