import { expect, test } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/3.1";

test("public previews and interactions cannot be mistaken for live monitoring", async ({ page }) => {
  const unsafeApiRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const heroTicker = page.getByTestId("landing-hero-example-ticker");
  const previewDisclosure = page.getByTestId("landing-preview-disclosure");
  await expect(heroTicker).toHaveAttribute("data-demo-mode", "illustrative");
  await expect(heroTicker).toContainText("EXEMPLO ILUSTRATIVO");
  await expect(previewDisclosure).toBeVisible();
  await expect(previewDisclosure).toContainText("Exemplo ilustrativo — não é monitoramento ao vivo");
  await expect(previewDisclosure).toContainText("Perfil fictício");
  await expect(previewDisclosure).toContainText("Período simulado");
  await expect(previewDisclosure).toContainText("Fonte: dados criados para demonstrar a interface");
  await expect(page.getByText("AO VIVO", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Exemplo ilustrativo", exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/after-hero-illustrative.png`, fullPage: false, animations: "disabled" });

  await page.locator("#demo").scrollIntoViewIfNeeded();
  const demo = page.getByTestId("landing-interactive-demo");
  const disclosure = page.getByTestId("landing-interactive-demo-disclosure");
  await expect(demo).toHaveAttribute("data-demo-mode", "illustrative");
  await expect(demo).toHaveAttribute("data-live-monitoring", "false");
  await expect(page.getByRole("heading", { name: "Digite um comentário de exemplo. Veja como o resultado seria exibido." })).toBeVisible();
  await expect(disclosure).toContainText("Simulação local, sem consulta às redes");
  await expect(disclosure).toContainText("não chama a IA de produção nem monitora um perfil real");
  await expect(disclosure).toContainText("Perfil: nenhum");
  await expect(disclosure).toContainText("Período: não se aplica");
  await expect(disclosure).toContainText("Fonte: texto digitado ou sugestões fictícias");
  await expect(page.getByText("TESTE AO VIVO", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/after-interactive-disclosure.png`, fullPage: false, animations: "disabled" });

  await demo.getByRole("textbox").fill("Comentário criado somente para validar o exemplo");
  await demo.getByRole("button", { name: "Gerar exemplo ilustrativo", exact: true }).click();
  await expect(page.getByTestId("landing-demo-result-label")).toHaveText("RESULTADO ILUSTRATIVO");
  await expect(demo).toContainText("valor ilustrativo, não medido");
  await demo.screenshot({ path: `${evidenceDir}/after-result-still-illustrative.png`, animations: "disabled" });

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByText("Illustrative example — not live monitoring", { exact: true })).toBeVisible();
  await expect(page.getByText("LIVE", { exact: true })).toHaveCount(0);

  expect(unsafeApiRequests).toEqual([]);
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
