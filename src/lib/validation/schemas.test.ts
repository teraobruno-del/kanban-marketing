import { describe, expect, it } from "vitest";
import { boardItemSchema, cardInputSchema, createUserSchema, firstError } from "./schemas";

const area = "3f1c2b8e-7d4a-4c1e-9b2a-1a2b3c4d5e6f";

describe("Validação de card", () => {
  it("aceita card válido e normaliza prazo vazio para null", () => {
    const r = cardInputSchema.parse({ title: "  Post Instagram ", dueDate: "", requesterAreaId: area });
    expect(r).toMatchObject({ title: "Post Instagram", dueDate: null, labelIds: [], assigneeIds: [], description: "" });
  });
  it("recusa título vazio, prazo inexistente e área ausente", () => {
    const r1 = cardInputSchema.safeParse({ title: " ", dueDate: null, requesterAreaId: area });
    expect(r1.success).toBe(false);
    if (!r1.success) expect(firstError(r1.error)).toBe("Título é obrigatório.");
    expect(cardInputSchema.safeParse({ title: "x", dueDate: "2027-02-29", requesterAreaId: area }).success).toBe(false);
    expect(cardInputSchema.safeParse({ title: "x", dueDate: null, requesterAreaId: "" }).success).toBe(false);
  });
});

describe("Validação de usuário", () => {
  it("normaliza e-mail e exige senha de 8+ caracteres", () => {
    const ok = createUserSchema.parse({ name: "Ana", email: " ANA@Empresa.com ", role: "MEMBER", password: "12345678" });
    expect(ok.email).toBe("ana@empresa.com");
    expect(createUserSchema.safeParse({ name: "Ana", email: "ana@x.com", role: "MEMBER", password: "123" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "Ana", email: "não-é-email", role: "MEMBER", password: "12345678" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "Ana", email: "a@x.com", role: "CHEFE", password: "12345678" }).success).toBe(false);
  });
});

describe("Validação de área/label", () => {
  it("exige cor #RRGGBB", () => {
    expect(boardItemSchema.safeParse({ name: "RH", color: "#E11D48" }).success).toBe(true);
    expect(boardItemSchema.safeParse({ name: "RH", color: "vermelho" }).success).toBe(false);
  });
});
