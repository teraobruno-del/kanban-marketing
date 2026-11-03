/** Filtros do quadro (decisão pós-SPEC 3). Ficam no endereço da página: ?q=&mine=1&assignee=&area=&label= */

export const NO_ASSIGNEE = "none";

export interface BoardFilters {
  q: string;
  mine: boolean;
  assignee: string | null; // id do usuário, ou NO_ASSIGNEE
  area: string | null; // id da área
  label: string | null; // id da etiqueta
}

type Params = { get(name: string): string | null };

export function parseBoardFilters(p: Params): BoardFilters {
  return {
    q: (p.get("q") ?? "").trim(),
    mine: p.get("mine") === "1",
    assignee: p.get("assignee") || null,
    area: p.get("area") || null,
    label: p.get("label") || null,
  };
}

export function hasActiveFilters(f: BoardFilters): boolean {
  return f.q !== "" || f.mine || f.assignee !== null || f.area !== null || f.label !== null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface FilterableCard {
  title: string;
  area: { id: string };
  labels: { id: string }[];
  assignees: { id: string }[];
  observerIds: string[];
}

/** Aplica os filtros (todos juntos: precisa atender a cada um que estiver ligado). */
export function filterCards<T extends FilterableCard>(cards: T[], f: BoardFilters, currentUserId: string): T[] {
  const q = fold(f.q);
  return cards.filter((c) => {
    if (q && !fold(c.title).includes(q)) return false;
    if (f.mine && !c.assignees.some((a) => a.id === currentUserId) && !c.observerIds.includes(currentUserId)) return false;
    if (f.assignee === NO_ASSIGNEE && c.assignees.length > 0) return false;
    if (f.assignee && f.assignee !== NO_ASSIGNEE && !c.assignees.some((a) => a.id === f.assignee)) return false;
    if (f.area && c.area.id !== f.area) return false;
    if (f.label && !c.labels.some((l) => l.id === f.label)) return false;
    return true;
  });
}
