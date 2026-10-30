import { describe, expect, it } from "vitest";
import { formatDateOnly, formatDateOnlyShort, formatDateTime, initials } from "./format";

describe("Formatação para a tela", () => {
  it("datas no padrão brasileiro", () => {
    expect(formatDateOnly("2028-02-29")).toBe("29/02/2028");
    expect(formatDateOnlyShort("2026-01-05")).toBe("05/01");
  });
  it("data e hora no fuso de São Paulo", () => {
    expect(formatDateTime("2026-03-01T02:30:00Z")).toBe("28/02/2026 às 23:30");
  });
  it("iniciais do nome", () => {
    expect(initials("Ana Maria Souza")).toBe("AS");
    expect(initials("Bia")).toBe("B");
  });
});
