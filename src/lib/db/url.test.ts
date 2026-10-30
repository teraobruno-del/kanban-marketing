import { describe, expect, it } from "vitest";
import { normalizeDbUrl, readDbUrl } from "./url";

const good = "postgresql://postgres.abc:Senha123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

describe("Endereço do banco", () => {
  it("aceita erros comuns de copiar e colar", () => {
    expect(normalizeDbUrl(`  "${good}"  `)).toBe(good);
    expect(normalizeDbUrl(`'${good}'`)).toBe(good);
    expect(normalizeDbUrl(`DIRECT_URL=${good}`)).toBe(good);
    expect(normalizeDbUrl(`DIRECT_URL="${good}"`)).toBe(good);
  });

  it("variável vazia conta como não cadastrada", () => {
    expect(normalizeDbUrl("")).toBeUndefined();
    expect(normalizeDbUrl('""')).toBeUndefined();
    expect(readDbUrl("X", { X: "   " })).toBeUndefined();
  });

  it("explica o problema sem mostrar a senha", () => {
    const check = (v: string) => () => readDbUrl("DIRECT_URL", { DIRECT_URL: v });
    expect(check("https://abc.supabase.co")).toThrow(/DIRECT_URL não começa com postgresql/);
    expect(check("postgresql://postgres.abc:[YOUR-PASSWORD]@host.com:5432/postgres")).toThrow(/YOUR-PASSWORD/);
    expect(check("postgresql://postgres.abc:Senha123@host.com/postgres")).toThrow(/porta/);
    try {
      check("ftp://postgres:SegredoX@host")();
    } catch (e) {
      expect(String(e)).not.toContain("SegredoX");
    }
    expect(readDbUrl("DIRECT_URL", { DIRECT_URL: good })).toBe(good);
  });
});
