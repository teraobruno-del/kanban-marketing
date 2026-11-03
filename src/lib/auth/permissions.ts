/**
 * Regras de permissão (SPEC §7 + decisões). Funções puras: o servidor chama
 * estas funções antes de qualquer alteração. O banco repete as regras via RLS.
 */

export type Role = "ADMIN" | "MEMBER" | "OBSERVER";

export interface Actor {
  id: string;
  role: Role;
  isActive: boolean;
}

/** Se o usuário está na lista de acesso do quadro. */
export interface BoardAccess {
  isBoardMember: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MEMBER: "Membro",
  OBSERVER: "Observador",
};

export function isAdmin(actor: Actor): boolean {
  return actor.isActive && actor.role === "ADMIN";
}

/** Ver o quadro e seus cards: Admin vê todos; demais, só quadros em que participam. */
export function canViewBoard(actor: Actor, access: BoardAccess): boolean {
  if (!actor.isActive) return false;
  return actor.role === "ADMIN" || access.isBoardMember;
}

/** Criar, editar (título, descrição, responsáveis, labels, checklist, anexos) e mover cards. */
export function canEditCards(actor: Actor, access: BoardAccess): boolean {
  return canViewBoard(actor, access) && (actor.role === "ADMIN" || actor.role === "MEMBER");
}

/** Alterar prazo: Admin em qualquer card; Membro só nos cards que ele criou. */
export function canChangeDueDate(
  actor: Actor,
  access: BoardAccess,
  card: { createdById: string },
): boolean {
  if (!canEditCards(actor, access)) return false;
  return actor.role === "ADMIN" || card.createdById === actor.id;
}

/** Comentar: todos que veem o quadro, inclusive Observador. */
export function canComment(actor: Actor, access: BoardAccess): boolean {
  return canViewBoard(actor, access);
}

/** Excluir card (lixeira): só Admin. */
export function canDeleteCard(actor: Actor): boolean {
  return isAdmin(actor);
}

/** Gerenciar quadros, áreas, labels, acessos e usuários; ver o dashboard: só Admin. */
export function canManage(actor: Actor): boolean {
  return isAdmin(actor);
}

/**
 * Pode ser responsável por um card (decisão 7A): usuário ativo, Admin ou Membro,
 * com acesso ao quadro (Admin tem acesso a todos).
 */
export function canBeAssignee(user: Actor, access: BoardAccess): boolean {
  return canEditCards(user, access);
}

/**
 * Aprovar ou reprovar (tirar o card de APROVAÇÃO — SPEC §6.E): quem criou o card
 * (se ainda puder editar no quadro) ou qualquer Administrador.
 */
export function canApprove(actor: Actor, access: BoardAccess, card: { createdById: string }): boolean {
  if (!canEditCards(actor, access)) return false;
  return actor.role === "ADMIN" || card.createdById === actor.id;
}

/** Editar comentário: só quem escreveu (decisão F3-3A). */
export function canEditComment(actor: Actor, comment: { authorId: string }): boolean {
  return actor.isActive && comment.authorId === actor.id;
}

/** Excluir comentário: quem escreveu ou Administrador. */
export function canDeleteComment(actor: Actor, comment: { authorId: string }): boolean {
  return actor.isActive && (actor.role === "ADMIN" || comment.authorId === actor.id);
}

/** Excluir anexo: quem enviou ou Administrador (decisão F3-7A), desde que ainda possa editar no quadro. */
export function canDeleteAttachment(actor: Actor, access: BoardAccess, attachment: { uploadedById: string }): boolean {
  return canEditCards(actor, access) && (actor.role === "ADMIN" || attachment.uploadedById === actor.id);
}

/** Pode ser observador da tarefa: usuário ativo com papel Observador e acesso ao quadro. */
export function canBeObserver(user: Actor, access: BoardAccess): boolean {
  return user.isActive && user.role === "OBSERVER" && access.isBoardMember;
}

/** Incluir/retirar observadores da tarefa: quem criou a tarefa ou Administrador. */
export function canManageObservers(actor: Actor, access: BoardAccess, card: { createdById: string }): boolean {
  if (!canEditCards(actor, access)) return false;
  return actor.role === "ADMIN" || card.createdById === actor.id;
}
