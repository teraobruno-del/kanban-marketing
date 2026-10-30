import { dbUrlProblem, normalizeDbUrl } from "@/lib/db/url";
import { checkKey } from "./clean";
import { publicSupabaseConfig } from "./public";

export interface ConfigProblem {
  name: string;
  problem: string;
}

/** Lista as variáveis de ambiente com problema (só nomes e explicação — nunca valores). */
export function configProblems(env: Record<string, string | undefined> = process.env): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const { url, key } = publicSupabaseConfig();
  if (url.problem) problems.push({ name: "NEXT_PUBLIC_SUPABASE_URL", problem: url.problem });
  if (key.problem) problems.push({ name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: key.problem });

  const secret = checkKey(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (secret.problem) problems.push({ name: "SUPABASE_SECRET_KEY", problem: secret.problem });

  const db = normalizeDbUrl(env.DATABASE_URL);
  if (!db) problems.push({ name: "DATABASE_URL", problem: "não foi cadastrada (ou está vazia)." });
  else {
    const p = dbUrlProblem(db);
    if (p) problems.push({ name: "DATABASE_URL", problem: p });
  }
  return problems;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Página simples, em português, explicando o que corrigir na Vercel. */
export function configProblemsHtml(problems: ConfigProblem[]): string {
  const items = problems
    .map((p) => `<li><code>${escape(p.name)}</code> ${escape(p.problem)}</li>`)
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configuração incompleta · Kanban Marketing</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f6f6;color:#222;margin:0;padding:24px}
main{max-width:640px;margin:40px auto;background:#fff;border:1px solid #ddd;border-radius:12px;padding:24px 28px}
h1{font-size:20px;margin:0 0 8px}li{margin:10px 0;line-height:1.45}code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-weight:600}
ol{padding-left:20px}.muted{color:#666;font-size:14px}</style></head><body><main>
<h1>⚙️ O site ainda não está configurado corretamente</h1>
<p class="muted">Encontramos problema nestas variáveis cadastradas na Vercel:</p>
<ul>${items}</ul>
<p><strong>Como corrigir:</strong></p>
<ol><li>Na Vercel, abra o projeto → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
<li>Corrija o valor de cada variável acima (sem aspas e sem espaços).</li>
<li>Vá em <strong>Deployments</strong> → três pontinhos da publicação do topo → <strong>Redeploy</strong>.
(Mudanças em variáveis só valem depois de publicar de novo.)</li></ol>
<p class="muted">Por segurança, esta página nunca mostra os valores das variáveis.</p>
</main></body></html>`;
}
