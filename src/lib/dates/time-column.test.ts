import { describe, expect, it } from "vitest";
import { addDaysToDateOnly, dateOnlyFromDb, dateOnlyToDb, isoWeekday, todayInSaoPaulo } from "./day";
import { getTimeColumn, isOverdue } from "./time-column";

describe("getTimeColumn — regras básicas (segunda-feira 26/10/2026)", () => {
  const monday = "2026-10-26";

  it("a data de referência é mesmo uma segunda-feira", () => {
    expect(isoWeekday(monday)).toBe(1);
  });

  it("prazo antes de hoje → ATRASADAS", () => {
    expect(getTimeColumn("2026-10-25", monday)).toBe("OVERDUE");
    expect(getTimeColumn("2025-01-01", monday)).toBe("OVERDUE");
  });

  it("prazo igual a hoje → HOJE", () => {
    expect(getTimeColumn(monday, monday)).toBe("TODAY");
  });

  it("de amanhã até domingo → ESTA SEMANA", () => {
    expect(getTimeColumn("2026-10-27", monday)).toBe("THIS_WEEK");
    expect(getTimeColumn("2026-11-01", monday)).toBe("THIS_WEEK"); // domingo
  });

  it("a partir da segunda seguinte → ESTE MÊS / PRÓXIMOS", () => {
    expect(getTimeColumn("2026-11-02", monday)).toBe("UPCOMING");
    expect(getTimeColumn("2027-06-15", monday)).toBe("UPCOMING");
  });
});

describe("getTimeColumn — domingo (01/11/2026)", () => {
  const sunday = "2026-11-01";

  it("a data de referência é mesmo um domingo", () => {
    expect(isoWeekday(sunday)).toBe(7);
  });

  it("no domingo, a coluna ESTA SEMANA fica sempre vazia", () => {
    for (let i = -30; i <= 60; i++) {
      expect(getTimeColumn(addDaysToDateOnly(sunday, i), sunday)).not.toBe("THIS_WEEK");
    }
  });

  it("segunda-feira seguinte já é PRÓXIMOS; sábado anterior é ATRASADA", () => {
    expect(getTimeColumn("2026-11-02", sunday)).toBe("UPCOMING");
    expect(getTimeColumn("2026-10-31", sunday)).toBe("OVERDUE");
    expect(getTimeColumn(sunday, sunday)).toBe("TODAY");
  });
});

describe("getTimeColumn — viradas de mês e de ano", () => {
  it("virada de mês: quinta 30/04/2026", () => {
    const today = "2026-04-30";
    expect(getTimeColumn("2026-05-01", today)).toBe("THIS_WEEK");
    expect(getTimeColumn("2026-05-03", today)).toBe("THIS_WEEK"); // domingo
    expect(getTimeColumn("2026-05-04", today)).toBe("UPCOMING");
  });

  it("virada de ano: quarta 31/12/2025", () => {
    const today = "2025-12-31";
    expect(isoWeekday(today)).toBe(3);
    expect(getTimeColumn("2025-12-30", today)).toBe("OVERDUE");
    expect(getTimeColumn("2026-01-01", today)).toBe("THIS_WEEK");
    expect(getTimeColumn("2026-01-04", today)).toBe("THIS_WEEK"); // domingo
    expect(getTimeColumn("2026-01-05", today)).toBe("UPCOMING");
  });
});

describe("getTimeColumn — 29 de fevereiro (2028 é bissexto)", () => {
  it("segunda 28/02/2028: 29/02 cai em ESTA SEMANA", () => {
    expect(isoWeekday("2028-02-28")).toBe(1);
    expect(getTimeColumn("2028-02-29", "2028-02-28")).toBe("THIS_WEEK");
    expect(getTimeColumn("2028-03-05", "2028-02-28")).toBe("THIS_WEEK");
    expect(getTimeColumn("2028-03-06", "2028-02-28")).toBe("UPCOMING");
  });

  it("no próprio 29/02, o prazo é HOJE e 28/02 está ATRASADO", () => {
    expect(getTimeColumn("2028-02-29", "2028-02-29")).toBe("TODAY");
    expect(getTimeColumn("2028-02-28", "2028-02-29")).toBe("OVERDUE");
  });

  it("recusa 29/02 em ano que não é bissexto", () => {
    expect(() => getTimeColumn("2027-02-29", "2027-02-28")).toThrow();
  });
});

describe("Fuso horário (oficial: America/Sao_Paulo)", () => {
  it("23h30 de 28/02 em São Paulo (já 01/03 em UTC) ainda é 28/02", () => {
    expect(todayInSaoPaulo(new Date("2026-03-01T02:30:00Z"))).toBe("2026-02-28");
    expect(todayInSaoPaulo(new Date("2026-03-01T03:00:00Z"))).toBe("2026-03-01");
  });

  it("virada de ano acontece à meia-noite de São Paulo, não de UTC", () => {
    expect(todayInSaoPaulo(new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
    expect(todayInSaoPaulo(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });

  it("card com prazo 28/02 às 23h30 de São Paulo está em HOJE, não em ATRASADAS", () => {
    const today = todayInSaoPaulo(new Date("2026-03-01T02:30:00Z"));
    expect(getTimeColumn("2026-02-28", today)).toBe("TODAY");
  });

  it("os testes rodam no fuso configurado (padrão: UTC+14, longe de São Paulo)", () => {
    expect(process.env.TZ).toBe(process.env.TEST_TZ ?? "Pacific/Kiritimati");
  });

  it("datas do banco (coluna DATE) não mudam de dia por causa do fuso", () => {
    expect(dateOnlyFromDb(new Date("2026-02-28T00:00:00Z"))).toBe("2026-02-28");
    expect(dateOnlyFromDb(dateOnlyToDb("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("isOverdue (selo vermelho)", () => {
  it("só marca prazos anteriores a hoje", () => {
    expect(isOverdue("2026-10-29", "2026-10-30")).toBe(true);
    expect(isOverdue("2026-10-30", "2026-10-30")).toBe(false);
    expect(isOverdue(null, "2026-10-30")).toBe(false);
  });
});
