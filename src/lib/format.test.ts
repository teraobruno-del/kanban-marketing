import { describe, expect, it } from "vitest";
import { describeDue, formatDateOnly, formatDateOnlyShort, formatDateTime, initials } from "./format";

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

describe("Prazo em linguagem natural", () => {
  const today = "2026-10-28"; // quarta
  it("atrasado, hoje, amanhã", () => {
    expect(describeDue("2026-10-27", today)).toEqual({ text: "Atrasado há 1 dia", tone: "overdue" });
    expect(describeDue("2026-10-20", today)).toEqual({ text: "Atrasado há 8 dias", tone: "overdue" });
    expect(describeDue(today, today)).toEqual({ text: "Hoje", tone: "today" });
    expect(describeDue("2026-10-29", today)).toEqual({ text: "Amanhã", tone: "soon" });
  });
  it("resto da semana mostra o dia; depois, só a data", () => {
    expect(describeDue("2026-10-30", today)).toEqual({ text: "sex 30/10", tone: "soon" });
    expect(describeDue("2026-11-01", today)).toEqual({ text: "dom 01/11", tone: "soon" });
    expect(describeDue("2026-11-02", today)).toEqual({ text: "02/11", tone: "normal" });
    expect(describeDue("2027-01-15", today)).toEqual({ text: "15/01/2027", tone: "normal" });
  });
  it("atraso conta dias de calendário, inclusive na virada do ano", () => {
    expect(describeDue("2025-12-31", "2026-01-02").text).toBe("Atrasado há 2 dias");
  });
});
