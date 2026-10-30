import { describe, expect, it } from "vitest";
import {
  completionFieldsForStageChange, eventTypeForStageChange, resolveDrop, stageAfterDueDateChange, stageForNewCard,
} from "./moves";

const friday = "2026-10-30";
const sunday = "2026-11-01";

describe("Roteamento por prazo", () => {
  it("card novo com prazo nasce ACTIVE; sem prazo nasce NEW", () => {
    expect(stageForNewCard("2026-11-05")).toBe("ACTIVE");
    expect(stageForNewCard(null)).toBe("NEW");
  });
  it("NEW que recebe prazo vira ACTIVE; ACTIVE sem prazo volta a NEW (P1)", () => {
    expect(stageAfterDueDateChange("NEW", "2026-11-05")).toBe("ACTIVE");
    expect(stageAfterDueDateChange("ACTIVE", null)).toBe("NEW");
  });
  it("APROVAÇÃO, ALTERAÇÃO e FINALIZADAS não mudam de etapa por causa do prazo", () => {
    expect(stageAfterDueDateChange("APPROVAL", "2020-01-01")).toBe("APPROVAL");
    expect(stageAfterDueDateChange("CHANGES", null)).toBe("CHANGES");
    expect(stageAfterDueDateChange("DONE", "2026-11-05")).toBe("DONE");
  });
});

describe("Arrastar e soltar (F1)", () => {
  it("ATRASADAS não aceita soltura", () => {
    const r = resolveDrop({ stage: "APPROVAL", dueDate: "2026-10-01" }, "OVERDUE", friday);
    expect(r.ok).toBe(false);
  });

  it("NOVAS DEMANDAS só aceita card sem prazo (decisão 4A)", () => {
    expect(resolveDrop({ stage: "APPROVAL", dueDate: null }, "NEW", friday)).toEqual({ ok: true, stage: "NEW" });
    expect(resolveDrop({ stage: "APPROVAL", dueDate: "2026-11-05" }, "NEW", friday).ok).toBe(false);
  });

  it("coluna de prazo só aceita quando o prazo já corresponde", () => {
    const card = { stage: "APPROVAL" as const, dueDate: friday };
    expect(resolveDrop(card, "TODAY", friday)).toEqual({ ok: true, stage: "ACTIVE" });
    expect(resolveDrop(card, "THIS_WEEK", friday).ok).toBe(false);
    expect(resolveDrop(card, "UPCOMING", friday).ok).toBe(false);
  });

  it("card sem prazo não vai para coluna de prazo", () => {
    expect(resolveDrop({ stage: "NEW", dueDate: null }, "TODAY", friday).ok).toBe(false);
  });

  it("no domingo, ESTA SEMANA não aceita nenhum card", () => {
    for (const due of ["2026-11-01", "2026-11-02", "2026-10-31"]) {
      expect(resolveDrop({ stage: "APPROVAL", dueDate: due }, "THIS_WEEK", sunday).ok).toBe(false);
    }
  });

  it("APROVAÇÃO, ALTERAÇÃO e FINALIZADAS aceitam qualquer card (inclusive sem prazo — P2)", () => {
    expect(resolveDrop({ stage: "ACTIVE", dueDate: friday }, "APPROVAL", friday)).toEqual({ ok: true, stage: "APPROVAL" });
    expect(resolveDrop({ stage: "APPROVAL", dueDate: friday }, "CHANGES", friday)).toEqual({ ok: true, stage: "CHANGES" });
    expect(resolveDrop({ stage: "NEW", dueDate: null }, "DONE", friday)).toEqual({ ok: true, stage: "DONE" });
  });

  it("soltar na mesma coluna não faz nada", () => {
    const r = resolveDrop({ stage: "ACTIVE", dueDate: friday }, "TODAY", friday);
    expect(r).toMatchObject({ ok: false, sameColumn: true });
  });
});

describe("Conclusão e reabertura", () => {
  it("finalizar no prazo (horário de São Paulo) → completedOnTime = true", () => {
    // 30/10 às 23h30 em São Paulo = 31/10 02h30 UTC → ainda no prazo de 30/10
    const now = new Date("2026-10-31T02:30:00Z");
    expect(completionFieldsForStageChange("APPROVAL", "DONE", "2026-10-30", now)).toEqual({
      completedAt: now,
      completedOnTime: true,
    });
  });
  it("finalizar depois do prazo → false; sem prazo → null (P2)", () => {
    const now = new Date("2026-10-31T03:00:00Z"); // 31/10 00h00 em SP
    expect(completionFieldsForStageChange("ACTIVE", "DONE", "2026-10-30", now)?.completedOnTime).toBe(false);
    expect(completionFieldsForStageChange("NEW", "DONE", null, now)?.completedOnTime).toBeNull();
  });
  it("sair de FINALIZADAS limpa os dois campos (P4)", () => {
    expect(completionFieldsForStageChange("DONE", "CHANGES", "2026-10-30", new Date())).toEqual({
      completedAt: null,
      completedOnTime: null,
    });
  });
  it("movimentos que não envolvem FINALIZADAS não mexem na conclusão", () => {
    expect(completionFieldsForStageChange("ACTIVE", "APPROVAL", null, new Date())).toBeUndefined();
  });
  it("tipo de evento registrado", () => {
    expect(eventTypeForStageChange("APPROVAL", "DONE")).toBe("COMPLETED");
    expect(eventTypeForStageChange("DONE", "CHANGES")).toBe("REOPENED");
    expect(eventTypeForStageChange("ACTIVE", "APPROVAL")).toBe("STAGE_CHANGED");
  });
});
