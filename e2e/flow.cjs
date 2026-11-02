const { chromium } = require("playwright");
const SHOTS = __dirname + "/out";
require("fs").mkdirSync(SHOTS, { recursive: true });

const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const today = fmt(new Date());
const plus = (n) => fmt(new Date(Date.now() + n * 86400000));
const log = (...a) => console.log("✔", ...a);
const column = (page, name) => page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function drag(page, cardText, columnName) {
  await page.waitForTimeout(500); // como uma pessoa: espera as janelas terminarem de fechar
  const card = page.locator("section").getByText(cardText, { exact: true }).first();
  const col = column(page, columnName);
  const a = await card.boundingBox();
  const b = await col.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + 80, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

async function login(page, email, password) {
  await page.goto("http://localhost:3000/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}
async function logout(page) {
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL(/login/);
}

let PAGE;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2560, height: 1000 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  PAGE = page;
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

  await login(page, "chefe@empresa.com", "errada");
  await page.getByText("E-mail ou senha incorretos").waitFor();
  log("senha errada é recusada");
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Nenhum quadro ainda").waitFor();
  log("primeiro Administrador criado e logado");

  await page.getByRole("button", { name: "Novo quadro" }).first().click();
  await page.fill("#board-name", "Marketing Institucional");
  await page.getByRole("button", { name: "Criar quadro" }).click();
  await page.waitForURL(/settings/);
  const boardUrl = page.url().replace("/settings", "");
  await page.getByRole("tab", { name: /Áreas/ }).click();
  for (const n of ["RH", "DIRETORIA"]) {
    await page.fill("#new-area", n);
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByRole("listitem").getByText(n, { exact: true }).waitFor();
  }
  await page.getByRole("tab", { name: /Etiquetas/ }).click();
  for (const n of ["Vídeo", "Rede Social"]) {
    await page.fill("#new-label", n);
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByRole("listitem").getByText(n, { exact: true }).waitFor();
  }
  log("quadro, áreas e etiquetas criados (cores diferentes)");

  await page.goto("http://localhost:3000/admin/users");
  for (const [name, email, role] of [["Ana Lima", "ana@empresa.com", "MEMBER"], ["Otto Reis", "otto@empresa.com", "OBSERVER"]]) {
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.fill("#u-name", name);
    await page.fill("#u-email", email);
    await page.selectOption("#u-role", role);
    await page.fill("#u-pw", "provisoria1");
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.locator("table").getByText(email).waitFor();
  }
  log("Membro e Observador cadastrados");

  await page.goto(boardUrl + "/settings");
  await page.getByRole("tab", { name: /Acesso/ }).click();
  await page.click("label:has-text('Ana Lima')");
  await page.click("label:has-text('Otto Reis')");
  await page.getByRole("button", { name: "Salvar acessos" }).click();
  await page.getByText("Acessos salvos.").waitFor();
  log("acessos salvos");

  await page.goto(boardUrl);
  const dlg = () => page.getByRole("dialog");
  async function newCard(title, area, due, extra) {
    await page.getByRole("button", { name: "Nova tarefa" }).click();
    await page.fill("#title", title);
    await page.selectOption("#area", { label: area });
    if (due) await page.fill("#due", due);
    if (extra) await extra();
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    await dlg().getByText("Etapa atual").waitFor();
  }
  await newCard("Post Instagram", "RH", today, async () => {
    await dlg().getByRole("button", { name: "Vídeo" }).click();
    await dlg().getByRole("button", { name: /Ana Lima/ }).click();
    await page.fill("#desc", "**Importante:** usar a arte nova\n\n- legenda\n- hashtags");
  });
  await page.fill("input[placeholder='Nova checklist (ex.: Etapas)']", "Etapas");
  await page.keyboard.press("Enter");
  await page.fill("input[placeholder='Adicionar item']", "Escrever legenda");
  await page.keyboard.press("Enter");
  await dlg().getByText("Escrever legenda", { exact: true }).waitFor();
  // Editar item e título da checklist (Esc só cancela a edição, sem fechar a janela)
  await dlg().getByRole("button", { name: "Editar item Escrever legenda" }).click();
  await page.keyboard.press("Escape");
  await dlg().getByText("Escrever legenda", { exact: true }).waitFor();
  await dlg().getByRole("button", { name: "Editar item Escrever legenda" }).click();
  await page.getByRole("textbox", { name: "Texto do item" }).fill("Escrever legenda e hashtags");
  await page.keyboard.press("Enter");
  await dlg().getByText("Escrever legenda e hashtags", { exact: true }).waitFor();
  await dlg().getByRole("button", { name: "Renomear checklist Etapas" }).click();
  await page.getByRole("textbox", { name: "Título da checklist" }).fill("Etapas do post");
  await page.keyboard.press("Enter");
  await dlg().getByText("Etapas do post", { exact: true }).waitFor();
  log("editar item e título da checklist");
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "detached" });
  await newCard("Briefing campanha", "DIRETORIA", null);
  await page.keyboard.press("Escape");
  await newCard("Vídeo institucional", "DIRETORIA", plus(20));
  await page.keyboard.press("Escape");
  await newCard("Newsletter", "RH", plus(-2));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  for (const [t, c] of [["Post Instagram", "HOJE"], ["Briefing campanha", "NOVAS DEMANDAS"], ["Vídeo institucional", "ESTE MÊS / PRÓXIMOS"], ["Newsletter", "ATRASADAS"]]) {
    await column(page, c).getByText(t, { exact: true }).waitFor();
  }
  await column(page, "ATRASADAS").getByText("Atrasado há 2 dias").waitFor();
  log("cards nas colunas certas; prazo em linguagem natural");

  // Editar e tentar fechar sem salvar → pergunta
  await page.getByText("Briefing campanha", { exact: true }).click();
  await page.fill("#title", "Briefing campanha 2027");
  await page.getByText("Alterações não salvas").waitFor();
  await page.keyboard.press("Escape");
  await page.getByText("Descartar alterações?").waitFor();
  await page.getByRole("button", { name: "Continuar editando" }).click();
  await page.getByRole("button", { name: "Descartar" }).click();
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "detached" });
  log("aviso de alterações não salvas");

  await drag(page, "Briefing campanha", "HOJE");
  await page.getByText("Novo prazo para “Briefing campanha”").waitFor();
  if ((await page.inputValue("#new-due")) !== today) throw new Error("Sugestão de HOJE deveria ser hoje");
  await page.getByText("vai para").waitFor();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await column(page, "NOVAS DEMANDAS").getByText("Briefing campanha").waitFor();
  await drag(page, "Briefing campanha", "HOJE");
  await page.getByRole("button", { name: "Confirmar prazo" }).click();
  await page.getByText("Prazo atualizado.").waitFor();
  await column(page, "HOJE").getByText("Briefing campanha").waitFor();
  await drag(page, "Newsletter", "ATRASADAS");
  log("janela de data ao arrastar (cancelar e confirmar)");
  await drag(page, "Post Instagram", "APROVAÇÃO");
  await column(page, "APROVAÇÃO").getByText("Post Instagram").waitFor();
  await drag(page, "Post Instagram", "FINALIZADAS");
  await page.getByText("1 item da checklist será marcado como concluído").waitFor();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await column(page, "FINALIZADAS").getByText("Concluído").waitFor();
  await column(page, "FINALIZADAS").getByText("1/1").waitFor();
  log("aprovar com checklist pendente pede confirmação e marca os itens");
  await drag(page, "Newsletter", "APROVAÇÃO");
  await column(page, "APROVAÇÃO").getByText("Atrasado há 2 dias").waitFor();
  await page.reload();
  await column(page, "FINALIZADAS").getByText("Post Instagram").waitFor();
  log("mover funciona e persiste");

  await logout(page);
  await login(page, "ana@empresa.com", "provisoria1");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Marketing Institucional").click();
  await page.getByRole("button", { name: "Nova tarefa" }).waitFor();
  if (await page.getByRole("link", { name: /Configurações/ }).count()) throw new Error("Membro vê Configurações");
  await page.getByText("Vídeo institucional", { exact: true }).click();
  await page.getByText("Só o Administrador ou quem criou a tarefa").waitFor();
  if (!(await page.locator("#due").isDisabled())) throw new Error("Prazo deveria estar bloqueado para o Membro");

  // ── Aprovação: Ana envia a tarefa criada pelo chefe ──
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.getByText("Enviada para aprovação.").waitFor();
  await page.getByText("Aguardando aprovação de").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await column(page, "APROVAÇÃO").getByText("Vídeo institucional").waitFor();
  await drag(page, "Vídeo institucional", "FINALIZADAS");
  await page.getByText("Só quem criou a tarefa ou um Administrador").waitFor();
  await column(page, "APROVAÇÃO").getByText("Vídeo institucional").waitFor();
  log("Membro envia para aprovação e não consegue aprovar");

  await page.goto("http://localhost:3000/");
  await logout(page);
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByRole("button", { name: /Avisos: 1 não lido/ }).click();
  await page.getByText("Aguardando sua aprovação").waitFor();
  await page.getByRole("menuitem", { name: /enviou “Vídeo institucional” para sua aprovação/ }).click();
  await page.waitForURL(/card=/);
  await page.getByRole("dialog").getByText("Etapa atual").waitFor();
  await page.getByRole("button", { name: "Reprovar" }).click();
  await page.fill("#reject-reason", "Trocar a trilha sonora");
  await page.getByRole("dialog").filter({ hasText: "Reprovar tarefa" }).getByRole("button", { name: "Reprovar" }).click();
  await page.getByText("Tarefa reprovada").waitFor();
  await page.getByText("Reprovada por chefe").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await column(page, "ALTERAÇÃO").getByText("Vídeo institucional").waitFor();
  log("Administrador abre pelo sininho e reprova com motivo");

  await logout(page);
  await login(page, "ana@empresa.com", "provisoria1");
  await page.waitForURL("http://localhost:3000/");
  await page.getByRole("button", { name: /Avisos: 2 não lidos/ }).click();
  await page.getByRole("menuitem", { name: /aprovou “Post Instagram”/ }).waitFor(); // responsável é avisada da aprovação
  await page.getByRole("menuitem", { name: /reprovou “Vídeo institucional”/ }).getByText("Trocar a trilha sonora").waitFor();
  await page.getByRole("menuitem", { name: /reprovou “Vídeo institucional”/ }).click();
  await page.getByRole("dialog").getByText("Trocar a trilha sonora").first().waitFor();
  await page.getByRole("dialog").getByText("Reprovou a tarefa").waitFor(); // motivo também na conversa (F3-5A)
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.getByText("Enviada para aprovação.").waitFor();
  await page.keyboard.press("Escape");
  log("Membro recebe o motivo e reenvia");

  await logout(page);
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Marketing Institucional").click();
  await column(page, "APROVAÇÃO").getByText("Sua aprovação").first().waitFor();
  await drag(page, "Vídeo institucional", "FINALIZADAS");
  await page.getByText("Tarefa aprovada e finalizada.").waitFor();
  await column(page, "FINALIZADAS").getByText("Vídeo institucional").waitFor();
  log("Administrador aprova arrastando para FINALIZADAS");
  await logout(page);
  await login(page, "ana@empresa.com", "provisoria1");
  await page.waitForURL("http://localhost:3000/");

  await page.goto("http://localhost:3000/admin/users");
  await page.getByText("Página não encontrada").waitFor();
  if (await page.getByText("ana@empresa.com").count()) throw new Error("Membro viu a lista de usuários");
  log("Membro: cria tarefa, não altera prazo alheio, não acessa admin");

  await page.goto("http://localhost:3000/");
  await logout(page);
  await login(page, "otto@empresa.com", "provisoria1");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Marketing Institucional").click();
  await page.getByText("Somente leitura").waitFor();
  if (await page.getByRole("button", { name: "Nova tarefa" }).count()) throw new Error("Observador vê Nova tarefa");
  await drag(page, "Briefing campanha", "APROVAÇÃO");
  await column(page, "HOJE").getByText("Briefing campanha").waitFor();
  log("Observador só lê");

  await logout(page);
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("1 atrasadas").or(page.getByText(/1\s*atrasadas/)).first().waitFor();
  await page.goto("http://localhost:3000/admin/users");
  await page.getByRole("button", { name: "Ações para Otto Reis" }).click();
  await page.getByRole("menuitem", { name: "Desativar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
  await page.getByText("foi desativado").waitFor();
  await logout(page);
  await login(page, "otto@empresa.com", "provisoria1");
  await page.getByText("E-mail ou senha incorretos, ou usuário desativado").waitFor();
  log("usuário desativado não entra mais");

  // ── Recorrência ──
  await page.goto("http://localhost:3000/");
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Marketing Institucional").click();
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  await page.fill("#title", "Relatório mensal");
  await page.selectOption("#area", { label: "RH" });
  if (!(await page.locator("#repeat").isDisabled())) throw new Error("Repetir deveria exigir prazo");
  await page.fill("#due", today);
  await page.selectOption("#repeat", "MONTHLY");
  await page.getByText(/Repete todo mês \(dia \d+\), sem data para terminar/).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: /Ana Lima/ }).click();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await page.getByRole("dialog").getByText("Etapa atual").waitFor();
  await page.keyboard.press("Escape");
  await drag(page, "Relatório mensal", "FINALIZADAS");
  await page.getByText(/próxima tarefa da série vence em/).waitFor();
  await column(page, "FINALIZADAS").getByText("Relatório mensal").waitFor();
  await column(page, "ESTE MÊS / PRÓXIMOS").getByText("Relatório mensal").waitFor();
  await column(page, "ESTE MÊS / PRÓXIMOS").getByLabel("Tarefa recorrente").first().waitFor();
  log("tarefa mensal: ao finalizar, a próxima aparece sozinha");

  // ── F3: anexos, capa e comentários ──
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator("section").getByText("Briefing campanha", { exact: true }).click();
  await dlg().getByText("Etapa atual").waitFor();
  const fileInput = page.locator('input[aria-label="Escolher arquivos"]');
  await fileInput.setInputFiles({ name: "capa.png", mimeType: "image/png", buffer: PNG });
  await page.getByText("Arquivo anexado.").waitFor();
  await dlg().locator('img[src*="capa.png"]').waitFor();
  await fileInput.setInputFiles({ name: "instalador.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await page.getByText("Arquivos .exe não são aceitos").waitFor();
  await fileInput.setInputFiles({ name: "video-grande.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(11 * 1024 * 1024, 1) });
  await page.getByText("o limite é 10 MB").waitFor();
  await page.getByRole("button", { name: "Ações para capa.png" }).click();
  await page.getByRole("menuitem", { name: "Usar como capa" }).click();
  await page.getByText("Capa definida.").waitFor();
  log("anexo enviado; executável e arquivo grande recusados; capa definida");

  await page.click("#new-comment");
  await page.keyboard.type("Oi @an");
  await page.getByRole("option", { name: /Ana Lima/ }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("veja a capa nova");
  await page.getByRole("button", { name: "Comentar" }).click();
  await dlg().locator("span.bg-sky-100", { hasText: "@Ana Lima" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await column(page, "HOJE").locator('img[src*="capa.png"]').waitFor();
  await column(page, "HOJE").getByTitle("Comentários").getByText("1").waitFor();
  await column(page, "HOJE").getByTitle("Anexos").getByText("1").waitFor();
  log("comentário com @menção; capa e contadores no card");

  await logout(page);
  await login(page, "ana@empresa.com", "provisoria1");
  await page.waitForURL("http://localhost:3000/");
  await page.getByRole("button", { name: /Avisos/ }).click();
  await page.getByRole("menuitem", { name: /mencionou você em “Briefing campanha”/ }).click();
  await dlg().getByText("veja a capa nova").waitFor();
  await page.click("#new-comment");
  await page.keyboard.type("Combinado!");
  await page.keyboard.press("Control+Enter");
  await dlg().getByText("Combinado!").waitFor();
  if (await dlg().getByRole("button", { name: "Ações para capa.png" }).count()) {
    await dlg().getByRole("button", { name: "Ações para capa.png" }).click();
    if (await page.getByRole("menuitem", { name: "Excluir" }).count()) throw new Error("Ana não deveria excluir anexo do chefe");
    await page.keyboard.press("Escape");
  }
  await page.keyboard.press("Escape");
  log("Ana recebe a menção, abre pelo sininho e responde");

  await logout(page);
  await login(page, "chefe@empresa.com", "senha-inicial-123");
  await page.waitForURL("http://localhost:3000/");
  await page.getByRole("button", { name: /Avisos/ }).click();
  await page.getByRole("menuitem", { name: /Ana Lima comentou em “Briefing campanha”/ }).waitFor();
  log("criador da tarefa é avisado do comentário");

  await browser.close();
  console.log("TUDO OK");
})().catch(async (e) => { if (PAGE) await PAGE.screenshot({ path: SHOTS + "/falha.png" }).catch(() => {}); console.error("FALHOU:", e.message.split("\n").slice(0, 4).join("\n")); process.exit(1); });
