import { describe, expect, it } from "vitest";
import { checkKey, checkSupabaseUrl } from "./clean";
import { configProblems, configProblemsHtml } from "./check";

describe("Variáveis do Supabase", () => {
  it("limpa erros comuns de copiar e colar no endereço do projeto", () => {
    expect(checkSupabaseUrl(' "https://abc.supabase.co/" ').value).toBe("https://abc.supabase.co");
    expect(checkSupabaseUrl("NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co/rest/v1/").value).toBe("https://abc.supabase.co");
  });
  it("explica endereços errados", () => {
    expect(checkSupabaseUrl("").problem).toMatch(/não foi cadastrada/);
    expect(checkSupabaseUrl("abc.supabase.co").problem).toMatch(/não é um endereço válido/);
    expect(checkSupabaseUrl("https://supabase.com/dashboard/project/abc").problem).toMatch(/painel/);
  });
  it("chaves: vazias ou quebradas são recusadas; aspas são removidas", () => {
    expect(checkKey('"sb_publishable_123"').value).toBe("sb_publishable_123");
    expect(checkKey("").problem).toBeTruthy();
    expect(checkKey("sb_publishable_1 23").problem).toMatch(/espaços/);
  });
});

describe("Página de configuração incompleta", () => {
  it("lista só nomes de variáveis, nunca valores", () => {
    const problems = configProblems({ DATABASE_URL: "https://segredo-123", SUPABASE_SECRET_KEY: "" });
    const names = problems.map((p) => p.name);
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("SUPABASE_SECRET_KEY");
    const html = configProblemsHtml(problems);
    expect(html).toContain("Redeploy");
    expect(html).not.toContain("segredo-123");
  });
});
