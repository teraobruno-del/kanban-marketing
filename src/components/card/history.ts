import type { CardDetail } from "@/server/services/cards";
import { formatDateOnly } from "@/lib/format";

const STAGE: Record<string, string> = {
  NEW: "NOVAS DEMANDAS",
  ACTIVE: "coluna de prazo",
  APPROVAL: "APROVAÇÃO",
  CHANGES: "ALTERAÇÃO",
  DONE: "FINALIZADAS",
};
const FIELD: Record<string, string> = { title: "o título", description: "a descrição", requesterArea: "a área solicitante", recurrence: "a repetição" };

type Ev = CardDetail["events"][number];

/** Texto em português para cada evento do histórico. */
export function describeEvent(e: Ev): string {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === "string" ? formatDateOnly(v) : "sem prazo");
  switch (e.type) {
    case "CREATED": return d.recurrenceOf ? "finalizou a tarefa anterior e esta foi criada pela repetição da série" : "criou o card";
    case "STAGE_CHANGED":
      return d.reason === "dueDate"
        ? `card foi para ${STAGE[e.toStage ?? ""]} por causa do prazo`
        : `moveu de ${STAGE[e.fromStage ?? ""]} para ${STAGE[e.toStage ?? ""]}`;
    case "COMPLETED": return "finalizou o card";
    case "REOPENED": return `reabriu o card (foi para ${STAGE[e.toStage ?? ""]})`;
    case "DUE_DATE_CHANGED": return `alterou o prazo de ${date(d.from)} para ${date(d.to)}`;
    case "UPDATED": {
      const fields = Array.isArray(d.fields) ? d.fields.map((f) => FIELD[String(f)] ?? String(f)) : [];
      return fields.length ? `editou ${fields.join(", ")}` : "editou o card";
    }
    case "ASSIGNEES_CHANGED": return "alterou os responsáveis";
    case "LABELS_CHANGED": return "alterou as etiquetas";
    case "CHECKLIST_CHANGED":
      switch (d.action) {
        case "checklist_added": return `criou a checklist “${d.title}”`;
        case "checklist_removed": return `removeu a checklist “${d.title}”`;
        case "item_added": return `adicionou o item “${d.text}”`;
        case "item_checked": return `concluiu o item “${d.text}”`;
        case "item_unchecked": return `desmarcou o item “${d.text}”`;
        case "item_removed": return `removeu o item “${d.text}”`;
        case "item_edited": return `editou o item “${d.from}” para “${d.text}”`;
        case "checklist_renamed": return `renomeou a checklist “${d.from}” para “${d.title}”`;
        case "all_completed": return `marcou ${d.count} ${d.count === 1 ? "item pendente" : "itens pendentes"} da checklist como concluídos`;
        default: return "alterou a checklist";
      }
    case "DELETED": return "excluiu o card";
    case "RESTORED": return "restaurou o card";
    case "COMMENTED": return "comentou";
    case "ATTACHMENT_ADDED": return typeof d.name === "string" ? `anexou “${d.name}”` : "anexou um arquivo";
    case "ATTACHMENT_REMOVED": return typeof d.name === "string" ? `removeu o anexo “${d.name}”` : "removeu um anexo";
    case "COVER_CHANGED": return d.removed ? "removeu a capa" : "alterou a capa";
    case "RECURRENCE_SPAWNED": return `criou a próxima tarefa da série (vence ${date(d.dueDate)})`;
    case "APPROVAL_REQUESTED": return "enviou para aprovação";
    case "APPROVED": return "aprovou a tarefa";
    case "REJECTED": return typeof d.reason === "string" ? `reprovou: “${d.reason}”` : "reprovou a tarefa";
    default: return "alterou o card";
  }
}
