import { describe, expect, it } from "vitest";
import {
  canApprove, canBeAssignee, canBeObserver, canChangeDueDate, canManageObservers, canComment, canDeleteAttachment, canDeleteCard, canDeleteComment, canEditCards, canEditComment, canManage, canViewBoard,
  type Actor,
} from "./permissions";

const admin: Actor = { id: "a", role: "ADMIN", isActive: true };
const member: Actor = { id: "m", role: "MEMBER", isActive: true };
const observer: Actor = { id: "o", role: "OBSERVER", isActive: true };
const inactiveAdmin: Actor = { id: "x", role: "ADMIN", isActive: false };
const inBoard = { isBoardMember: true };
const outBoard = { isBoardMember: false };

describe("Ver quadro", () => {
  it("Administrador vê todos os quadros, mesmo sem estar na lista", () => {
    expect(canViewBoard(admin, outBoard)).toBe(true);
  });
  it("Membro e Observador só veem quadros dos quais participam", () => {
    expect(canViewBoard(member, inBoard)).toBe(true);
    expect(canViewBoard(member, outBoard)).toBe(false);
    expect(canViewBoard(observer, inBoard)).toBe(true);
    expect(canViewBoard(observer, outBoard)).toBe(false);
  });
  it("usuário desativado não vê nada", () => {
    expect(canViewBoard(inactiveAdmin, inBoard)).toBe(false);
    expect(canViewBoard({ ...member, isActive: false }, inBoard)).toBe(false);
  });
});

describe("Criar, editar e mover cards", () => {
  it("Administrador e Membro podem; Observador não", () => {
    expect(canEditCards(admin, outBoard)).toBe(true);
    expect(canEditCards(member, inBoard)).toBe(true);
    expect(canEditCards(observer, inBoard)).toBe(false);
  });
  it("Membro não pode em quadro do qual não participa", () => {
    expect(canEditCards(member, outBoard)).toBe(false);
  });
});

describe("Alterar prazo", () => {
  it("Administrador altera em qualquer card", () => {
    expect(canChangeDueDate(admin, outBoard, { createdById: "outro" })).toBe(true);
  });
  it("Membro só altera prazo de card que ele mesmo criou", () => {
    expect(canChangeDueDate(member, inBoard, { createdById: "m" })).toBe(true);
    expect(canChangeDueDate(member, inBoard, { createdById: "outro" })).toBe(false);
  });
  it("Observador nunca altera prazo, nem de card 'dele'", () => {
    expect(canChangeDueDate(observer, inBoard, { createdById: "o" })).toBe(false);
  });
});

describe("Comentar, excluir e gerenciar", () => {
  it("todos que veem o quadro podem comentar", () => {
    expect(canComment(observer, inBoard)).toBe(true);
    expect(canComment(observer, outBoard)).toBe(false);
  });
  it("só Administrador exclui card e gerencia", () => {
    expect(canDeleteCard(admin)).toBe(true);
    expect(canDeleteCard(member)).toBe(false);
    expect(canManage(admin)).toBe(true);
    expect(canManage(member)).toBe(false);
    expect(canManage(observer)).toBe(false);
    expect(canManage(inactiveAdmin)).toBe(false);
  });
});

describe("Responsáveis (decisão 7A)", () => {
  it("Administrador e Membro com acesso podem ser responsáveis; Observador não", () => {
    expect(canBeAssignee(member, inBoard)).toBe(true);
    expect(canBeAssignee(admin, outBoard)).toBe(true);
    expect(canBeAssignee(observer, inBoard)).toBe(false);
    expect(canBeAssignee(member, outBoard)).toBe(false);
    expect(canBeAssignee({ ...member, isActive: false }, inBoard)).toBe(false);
  });
});

describe("Aprovar / reprovar (SPEC §6.E)", () => {
  it("quem criou (Membro) e qualquer Administrador aprovam", () => {
    expect(canApprove(member, inBoard, { createdById: "m" })).toBe(true);
    expect(canApprove(admin, outBoard, { createdById: "outro" })).toBe(true);
  });
  it("outro Membro e Observador não aprovam", () => {
    expect(canApprove(member, inBoard, { createdById: "outro" })).toBe(false);
    expect(canApprove(observer, inBoard, { createdById: "o" })).toBe(false);
  });
  it("criador que perdeu acesso ao quadro não aprova", () => {
    expect(canApprove(member, outBoard, { createdById: "m" })).toBe(false);
  });
});

describe("Comentários e anexos (F3)", () => {
  it("comentário: edita só quem escreveu; exclui quem escreveu ou Administrador", () => {
    expect(canEditComment(member, { authorId: "m" })).toBe(true);
    expect(canEditComment(admin, { authorId: "m" })).toBe(false);
    expect(canDeleteComment(admin, { authorId: "m" })).toBe(true);
    expect(canDeleteComment(observer, { authorId: "o" })).toBe(true);
    expect(canDeleteComment(member, { authorId: "o" })).toBe(false);
  });
  it("anexo: exclui quem enviou ou Administrador; Observador nunca", () => {
    expect(canDeleteAttachment(member, inBoard, { uploadedById: "m" })).toBe(true);
    expect(canDeleteAttachment(member, inBoard, { uploadedById: "outro" })).toBe(false);
    expect(canDeleteAttachment(admin, outBoard, { uploadedById: "outro" })).toBe(true);
    expect(canDeleteAttachment(observer, inBoard, { uploadedById: "o" })).toBe(false);
  });
});

describe("Observadores da tarefa", () => {
  it("só usuários com papel Observador e acesso ao quadro", () => {
    expect(canBeObserver(observer, inBoard)).toBe(true);
    expect(canBeObserver(observer, outBoard)).toBe(false);
    expect(canBeObserver(member, inBoard)).toBe(false);
    expect(canBeObserver({ ...observer, isActive: false }, inBoard)).toBe(false);
  });
  it("incluir/retirar: quem criou a tarefa ou Administrador", () => {
    expect(canManageObservers(member, inBoard, { createdById: "m" })).toBe(true);
    expect(canManageObservers(member, inBoard, { createdById: "outro" })).toBe(false);
    expect(canManageObservers(admin, outBoard, { createdById: "outro" })).toBe(true);
    expect(canManageObservers(observer, inBoard, { createdById: "o" })).toBe(false);
  });
});
