// Gera as imagens da página de Ajuda (public/ajuda/*.png) a partir do site de teste.
// Uso: SKIP_BUILD=1 bash e2e/run.sh --keep && node e2e/help-shots.cjs && bash e2e/run.sh --stop
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "..", "public", "ajuda");

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1 });
  const shot = async (name, locator, pad = 8) => {
    const box = await locator.boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: Math.min(box.height + pad * 2, 760) } });
  };
  await page.goto("http://localhost:3000/login");
  await page.fill("#email", "chefe@empresa.com");
  await page.fill("#password", "senha-inicial-123");
  await page.click("button[type=submit]");
  await page.waitForURL("http://localhost:3000/");
  await page.getByText("Marketing Institucional").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "quadro.png") });
  await shot("filtros", page.getByRole("search", { name: "Filtrar tarefas" }), 6);

  // Tarefa aberta
  await page.locator("section").getByText("Briefing campanha", { exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByText("Etapa atual").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "tarefa.png") });
  await shot("etapa-e-aprovacao", dlg.locator("aside > div").first(), 6);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Aprovação: tarefa aguardando
  const approvalCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "APROVAÇÃO", exact: true }) }).locator("[aria-roledescription]").first();
  if (await approvalCard.count()) {
    await approvalCard.click();
    await dlg.getByText("Etapa atual").waitFor();
    await page.waitForTimeout(400);
    await shot("aprovar-reprovar", dlg.locator("aside > div").first(), 6);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  // Sininho
  await page.getByRole("button", { name: /Avisos/ }).click();
  await page.waitForTimeout(400);
  await shot("sininho", page.getByRole("menu"), 4);
  await page.keyboard.press("Escape");

  // Dashboard
  await page.goto("http://localhost:3000/dashboard");
  await page.getByText("Concluídas no período", { exact: true }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "dashboard.png") });
  await b.close();
  console.log("imagens geradas em public/ajuda");
})().catch((e) => { console.error(e.message); process.exit(1); });
