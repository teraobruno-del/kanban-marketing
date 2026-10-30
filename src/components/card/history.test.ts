import { describe, expect, it } from "vitest";
import { describeEvent } from "./history";

const ev = (type: string, extra: object = {}) =>
  ({ id: "1", type, fromStage: null, toStage: null, data: null, actorName: "Ana", createdAt: "", ...extra }) as never;

describe("Texto do histórico", () => {
  it("descreve movimentos e prazos em português", () => {
    expect(describeEvent(ev("STAGE_CHANGED", { fromStage: "APPROVAL", toStage: "CHANGES" }))).toBe("moveu de APROVAÇÃO para ALTERAÇÃO");
    expect(describeEvent(ev("DUE_DATE_CHANGED", { data: { from: null, to: "2026-11-05" } }))).toBe("alterou o prazo de sem prazo para 05/11/2026");
    expect(describeEvent(ev("COMPLETED"))).toBe("finalizou o card");
    expect(describeEvent(ev("APPROVAL_REQUESTED"))).toBe("enviou para aprovação");
    expect(describeEvent(ev("RECURRENCE_SPAWNED", { data: { dueDate: "2026-11-30" } }))).toBe("criou a próxima tarefa da série (vence 30/11/2026)");
    expect(describeEvent(ev("CHECKLIST_CHANGED", { data: { action: "all_completed", count: 2 } }))).toBe("marcou 2 itens pendentes da checklist como concluídos");
    expect(describeEvent(ev("REJECTED", { data: { reason: "Trocar a foto" } }))).toBe("reprovou: “Trocar a foto”");
    expect(describeEvent(ev("CHECKLIST_CHANGED", { data: { action: "item_checked", text: "Legenda" } }))).toBe("concluiu o item “Legenda”");
  });
});
