const { chromium } = require("playwright");
const OUT = process.argv[2] ?? __dirname + "/out/audit";
require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const [tag, vp, mobile] of [["desk", { width: 1366, height: 768 }, false], ["mob", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("http://localhost:3000/login");
    await page.screenshot({ path: `${OUT}/${tag}-login.png` });
    await page.fill("#email", "chefe@empresa.com");
    await page.fill("#password", "senha-inicial-123");
    await page.click("button[type=submit]");
    await page.waitForURL("http://localhost:3000/");
    await page.screenshot({ path: `${OUT}/${tag}-home.png` });
    await page.getByText("Marketing Institucional").first().click();
    await page.waitForURL(/boards\//);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${tag}-board.png` });
    const boardUrl = page.url();
    await page.getByText("Vídeo institucional", { exact: true }).click();
    await page.getByText("Etapa atual").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${tag}-card.png` });
    await page.keyboard.press("Escape");
    if (!mobile) {
      await page.getByRole("button", { name: /Nova tarefa/ }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${tag}-newcard.png` });
      await page.keyboard.press("Escape");
    }
    await page.goto(boardUrl + "/settings");
    await page.screenshot({ path: `${OUT}/${tag}-settings.png`, fullPage: true });
    await page.goto("http://localhost:3000/admin/users");
    await page.screenshot({ path: `${OUT}/${tag}-users.png` });
    await ctx.close();
  }
  await browser.close();
  console.log("ok");
})().catch((e) => { console.error(e.message); process.exit(1); });
