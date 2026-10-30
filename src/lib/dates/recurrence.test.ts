import { describe, expect, it } from "vitest";
import { getNextRecurrenceDate } from "./recurrence";

const today = "2026-10-30"; // sexta-feira

describe("getNextRecurrenceDate — diária", () => {
  it("avança um dia", () => {
    expect(getNextRecurrenceDate({ dueDate: today, frequency: "DAILY", today })).toBe("2026-10-31");
  });

  it("virada de mês e de ano", () => {
    expect(getNextRecurrenceDate({ dueDate: "2027-01-31", frequency: "DAILY", today })).toBe("2027-02-01");
    expect(getNextRecurrenceDate({ dueDate: "2026-12-31", frequency: "DAILY", today })).toBe("2027-01-01");
  });

  it("29/02: de 28/02 vai para 29/02 em ano bissexto e para 01/03 em ano comum", () => {
    expect(getNextRecurrenceDate({ dueDate: "2028-02-28", frequency: "DAILY", today })).toBe("2028-02-29");
    expect(getNextRecurrenceDate({ dueDate: "2027-02-28", frequency: "DAILY", today })).toBe("2027-03-01");
  });
});

describe("getNextRecurrenceDate — semanal", () => {
  it("avança 7 dias, inclusive na virada de ano", () => {
    expect(getNextRecurrenceDate({ dueDate: "2026-12-28", frequency: "WEEKLY", today })).toBe("2027-01-04");
  });

  it("domingo continua domingo; segunda continua segunda", () => {
    expect(getNextRecurrenceDate({ dueDate: "2026-11-01", frequency: "WEEKLY", today })).toBe("2026-11-08");
    expect(getNextRecurrenceDate({ dueDate: "2026-11-02", frequency: "WEEKLY", today })).toBe("2026-11-09");
  });

  it("passa por 29/02 em ano bissexto", () => {
    expect(getNextRecurrenceDate({ dueDate: "2028-02-22", frequency: "WEEKLY", today })).toBe("2028-02-29");
  });
});

describe("getNextRecurrenceDate — mensal (aritmética de calendário)", () => {
  it("31/01 vira 28/02 em ano comum (não '+30 dias')", () => {
    expect(getNextRecurrenceDate({ dueDate: "2027-01-31", frequency: "MONTHLY", today })).toBe("2027-02-28");
  });

  it("31/01 vira 29/02 em ano bissexto", () => {
    expect(getNextRecurrenceDate({ dueDate: "2028-01-31", frequency: "MONTHLY", today })).toBe("2028-02-29");
  });

  it("dia-âncora 31 volta a ser 31 depois de fevereiro (decisão 3A)", () => {
    expect(
      getNextRecurrenceDate({ dueDate: "2027-02-28", frequency: "MONTHLY", today, anchorDay: 31 }),
    ).toBe("2027-03-31");
    expect(
      getNextRecurrenceDate({ dueDate: "2027-03-31", frequency: "MONTHLY", today, anchorDay: 31 }),
    ).toBe("2027-04-30");
  });

  it("sem dia-âncora, usa o dia do prazo atual", () => {
    expect(getNextRecurrenceDate({ dueDate: "2027-02-28", frequency: "MONTHLY", today })).toBe("2027-03-28");
  });

  it("virada de ano: 15/12 → 15/01", () => {
    expect(getNextRecurrenceDate({ dueDate: "2026-12-15", frequency: "MONTHLY", today })).toBe("2027-01-15");
  });

  it("série no dia 29: 29/01 → 29/02 (bissexto) e 28/02 (comum)", () => {
    expect(getNextRecurrenceDate({ dueDate: "2028-01-29", frequency: "MONTHLY", today })).toBe("2028-02-29");
    expect(getNextRecurrenceDate({ dueDate: "2027-01-29", frequency: "MONTHLY", today })).toBe("2027-02-28");
  });
});

describe("getNextRecurrenceDate — prazo original no passado", () => {
  it("diária: avança até hoje (hoje é aceito)", () => {
    expect(getNextRecurrenceDate({ dueDate: "2026-01-10", frequency: "DAILY", today })).toBe(today);
  });

  it("semanal: mantém o dia da semana e para no primeiro dia ≥ hoje", () => {
    // 02/10/2026 é sexta, como hoje → cai exatamente hoje
    expect(getNextRecurrenceDate({ dueDate: "2026-10-02", frequency: "WEEKLY", today })).toBe(today);
    // 01/10/2026 é quinta → próxima quinta
    expect(getNextRecurrenceDate({ dueDate: "2026-10-01", frequency: "WEEKLY", today })).toBe("2026-11-05");
  });

  it("mensal: avança meses mantendo o dia-âncora", () => {
    expect(getNextRecurrenceDate({ dueDate: "2026-05-15", frequency: "MONTHLY", today })).toBe("2026-11-15");
    expect(
      getNextRecurrenceDate({ dueDate: "2026-01-31", frequency: "MONTHLY", today, anchorDay: 31 }),
    ).toBe("2026-10-31");
  });

  it("atravessa a virada de ano", () => {
    expect(
      getNextRecurrenceDate({ dueDate: "2025-11-20", frequency: "MONTHLY", today: "2026-01-05" }),
    ).toBe("2026-01-20");
  });
});

describe("getNextRecurrenceDate — data final", () => {
  it("próxima data igual à data final ainda gera card", () => {
    expect(
      getNextRecurrenceDate({ dueDate: "2026-11-02", frequency: "WEEKLY", today, endDate: "2026-11-09" }),
    ).toBe("2026-11-09");
  });

  it("próxima data depois da data final → não gera card (null)", () => {
    expect(
      getNextRecurrenceDate({ dueDate: "2026-11-02", frequency: "WEEKLY", today, endDate: "2026-11-08" }),
    ).toBeNull();
  });

  it("pular ciclos do passado também respeita a data final", () => {
    expect(
      getNextRecurrenceDate({ dueDate: "2026-01-10", frequency: "MONTHLY", today, endDate: "2026-10-31" }),
    ).toBeNull();
  });
});

describe("getNextRecurrenceDate — entradas inválidas", () => {
  it("recusa datas mal formatadas ou inexistentes", () => {
    expect(() => getNextRecurrenceDate({ dueDate: "30/10/2026", frequency: "DAILY", today })).toThrow();
    expect(() => getNextRecurrenceDate({ dueDate: "2027-02-29", frequency: "DAILY", today })).toThrow();
    expect(() =>
      getNextRecurrenceDate({ dueDate: today, frequency: "MONTHLY", today, anchorDay: 32 }),
    ).toThrow();
  });
});
