import { describe, expect, it } from "vitest";
import {
  approvalDrop, canRequestApprovalFrom, completionFieldsForStageChange, planDrop, suggestDueDate, eventTypeForStageChange, resolveDrop, stageAfterDueDateChange, stageForNewCard,
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

describe("Aprovação ao arrastar (F1.5)", () => {
  it("só envia para aprovação a partir de NOVAS, prazo ou ALTERAÇÃO", () => {
    expect(canRequestApprovalFrom("NEW")).toBe(true);
    expect(canRequestApprovalFrom("ACTIVE")).toBe(true);
    expect(canRequestApprovalFrom("CHANGES")).toBe(true);
    expect(canRequestApprovalFrom("APPROVAL")).toBe(false);
    expect(canRequestApprovalFrom("DONE")).toBe(false);
  });
  it("aprovador: FINALIZADAS = aprovar; ALTERAÇÃO = reprovar; outras colunas bloqueadas", () => {
    const c = { stage: "APPROVAL" as const };
    expect(approvalDrop(c, "DONE", true)).toEqual({ kind: "approve" });
    expect(approvalDrop(c, "CHANGES", true)).toEqual({ kind: "reject" });
    expect(approvalDrop(c, "TODAY", true).kind).toBe("blocked");
    expect(approvalDrop(c, "NEW", true).kind).toBe("blocked");
  });
  it("quem não aprova não tira o card de APROVAÇÃO", () => {
    expect(approvalDrop({ stage: "APPROVAL" }, "DONE", false).kind).toBe("blocked");
  });
  it("cards fora de APROVAÇÃO seguem a regra normal", () => {
    expect(approvalDrop({ stage: "ACTIVE" }, "DONE", false)).toEqual({ kind: "none" });
  });
});

describe("Plano ao soltar (tela = servidor)", () => {
  const today = "2026-10-30";
  it("entrar em APROVAÇÃO = enviar para aprovação; de FINALIZADAS não pode", () => {
    expect(planDrop({ stage: "ACTIVE", dueDate: today }, "APPROVAL", today, false)).toEqual({ kind: "request" });
    expect(planDrop({ stage: "CHANGES", dueDate: null }, "APPROVAL", today, false)).toEqual({ kind: "request" });
    expect(planDrop({ stage: "DONE", dueDate: null }, "APPROVAL", today, true).kind).toBe("blocked");
  });
  it("sair de APROVAÇÃO segue a regra de aprovação", () => {
    expect(planDrop({ stage: "APPROVAL", dueDate: today }, "DONE", today, true)).toEqual({ kind: "approve" });
    expect(planDrop({ stage: "APPROVAL", dueDate: today }, "CHANGES", today, true)).toEqual({ kind: "reject" });
    expect(planDrop({ stage: "APPROVAL", dueDate: today }, "TODAY", today, true).kind).toBe("blocked");
    expect(planDrop({ stage: "APPROVAL", dueDate: today }, "APPROVAL", today, true)).toEqual({ kind: "same" });
  });
  it("demais casos seguem as regras normais", () => {
    expect(planDrop({ stage: "ACTIVE", dueDate: today }, "DONE", today, false)).toEqual({ kind: "move", stage: "DONE" });
    expect(planDrop({ stage: "ACTIVE", dueDate: today }, "TODAY", today, false)).toEqual({ kind: "same" });
    expect(planDrop({ stage: "NEW", dueDate: null }, "OVERDUE", today, false, true).kind).toBe("blocked");
  });
});

describe("Data sugerida ao soltar (F2)", () => {
  // 26/10/2026 = segunda … 01/11/2026 = domingo
  it("HOJE = hoje; PRÓXIMOS = segunda seguinte", () => {
    expect(suggestDueDate("TODAY", "2026-10-28")).toBe("2026-10-28");
    expect(suggestDueDate("UPCOMING", "2026-10-26")).toBe("2026-11-02");
    expect(suggestDueDate("UPCOMING", "2026-11-01")).toBe("2026-11-02"); // domingo → amanhã já é a semana seguinte
  });
  it("ESTA SEMANA = sexta; se a sexta já chegou, amanhã; domingo bloqueado", () => {
    expect(suggestDueDate("THIS_WEEK", "2026-10-26")).toBe("2026-10-30"); // seg → sex
    expect(suggestDueDate("THIS_WEEK", "2026-10-29")).toBe("2026-10-30"); // qui → sex
    expect(suggestDueDate("THIS_WEEK", "2026-10-30")).toBe("2026-10-31"); // sex → sáb
    expect(suggestDueDate("THIS_WEEK", "2026-10-31")).toBe("2026-11-01"); // sáb → dom
    expect(suggestDueDate("THIS_WEEK", "2026-11-01")).toBeNull(); // dom
  });
  it("viradas de mês e de ano", () => {
    expect(suggestDueDate("THIS_WEEK", "2025-12-29")).toBe("2026-01-02");
    expect(suggestDueDate("UPCOMING", "2026-12-30")).toBe("2027-01-04");
    expect(suggestDueDate("THIS_WEEK", "2028-02-28")).toBe("2028-03-03");
  });
  it("a sugestão cai mesmo na coluna escolhida", () => {
    for (const today of ["2026-10-26", "2026-10-29", "2026-10-30", "2026-10-31"]) {
      for (const t of ["TODAY", "THIS_WEEK", "UPCOMING"] as const) {
        const d = suggestDueDate(t, today)!;
        expect(planDrop({ stage: "ACTIVE", dueDate: d }, t, today, false)).toEqual({ kind: "same" });
      }
    }
  });
});

describe("Janela de data ao soltar (F2)", () => {
  const today = "2026-10-28"; // quarta
  it("quem pode mudar o prazo recebe a janela com a sugestão", () => {
    expect(planDrop({ stage: "ACTIVE", dueDate: "2026-11-20" }, "TODAY", today, false, true))
      .toEqual({ kind: "pickDate", target: "TODAY", suggested: today });
    expect(planDrop({ stage: "NEW", dueDate: null }, "THIS_WEEK", today, false, true))
      .toEqual({ kind: "pickDate", target: "THIS_WEEK", suggested: "2026-10-30" });
    expect(planDrop({ stage: "DONE", dueDate: "2026-10-01" }, "UPCOMING", today, false, true).kind).toBe("pickDate");
  });
  it("quem não pode mudar o prazo é bloqueado com explicação (P22)", () => {
    const r = planDrop({ stage: "ACTIVE", dueDate: "2026-11-20" }, "TODAY", today, false, false);
    expect(r.kind).toBe("blocked");
    expect(r.kind === "blocked" && r.reason).toMatch(/pode mudar o prazo/);
  });
  it("domingo: ESTA SEMANA bloqueada mesmo para quem pode mudar o prazo", () => {
    expect(planDrop({ stage: "NEW", dueDate: null }, "THIS_WEEK", "2026-11-01", false, true).kind).toBe("blocked");
  });
  it("tarefa em APROVAÇÃO continua presa à regra de aprovação", () => {
    expect(planDrop({ stage: "APPROVAL", dueDate: null }, "TODAY", today, true, true).kind).toBe("blocked");
  });
});
