import { expect, test, type Page } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/2.1";

async function login(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
    window.localStorage.removeItem("sentimenta.sync.settings.v3");
    window.localStorage.removeItem("sentimenta.sync.settings.v4");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("qa.healthy_recent@example.com");
  await page.locator('input[type="password"]').fill("QaSeed123!");
  const loginResponse = page.waitForResponse(response => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });
}

test("three user perspectives can predict collection bounds before any run", async ({ page }) => {
  test.setTimeout(90_000);
  const unsafeApiRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];

  page.on("request", request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await login(page);
  await page.goto("/dashboard/connect");
  await expect(page.getByTestId("collection-plan-limits")).toContainText("até 60 posts por perfil e 2.000 comentários por post", { timeout: 15_000 });
  await page.getByTestId("collection-plan-limits").screenshot({
    path: `${evidenceDir}/after-server-confirmed-limits.png`,
    animations: "disabled",
  });
  await page.getByTestId("collection-settings-toggle").click();
  await expect(page.getByTestId("collection-scope-summary")).toBeVisible();

  const postOptions = await page.getByTestId("collection-post-limit").locator("option").allTextContents();
  expect(postOptions).toEqual([
    "1 post (teste)",
    "Até 10 posts",
    "Até 20 posts",
    "Até 50 posts",
    "Até 60 posts (limite do plano)",
  ]);
  await expect(page.getByTestId("collection-comment-limit-plan")).toHaveText("Até 2.000 (limite do plano)");

  // Persona 1: an analyst chooses a bounded complete collection and predicts 20 x 50.
  await page.getByTestId("collection-post-limit").selectOption("20");
  await page.getByTestId("collection-comment-limit-50").click();
  await page.getByTestId("collection-mode-all").click();
  await expect(page.getByTestId("collection-mode-description")).toContainText("“Todos” não significa acesso irrestrito");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("No máximo 20 por perfil");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("No máximo 50 por post");
  await expect(page.getByTestId("collection-volume-prediction")).toContainText("até 1.000 comentários");
  await page.getByTestId("collection-scope-summary").screenshot({
    path: `${evidenceDir}/after-all-within-limit.png`,
    animations: "disabled",
  });

  // Persona 2: a cost-conscious user selects an explicitly biased method, not a statistical sample.
  await page.getByTestId("collection-post-limit").selectOption("60");
  await page.getByTestId("collection-comment-limit-plan").click();
  await page.getByTestId("collection-mode-engagement").click();
  await expect(page.getByTestId("collection-mode-description")).toContainText("favorece comentários populares");
  await expect(page.getByTestId("collection-mode-description")).toContainText("não é amostra estatística");
  await expect(page.getByTestId("collection-mode-description")).toContainText("Instagram OAuth, YouTube e TikTok");
  await expect(page.getByTestId("collection-volume-prediction")).toContainText("até 120.000 comentários");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("não garante menor custo de coleta");
  await page.getByTestId("collection-settings-panel").screenshot({
    path: `${evidenceDir}/after-automatic-volume.png`,
    animations: "disabled",
  });

  // Persona 3: a cautious user sets the smallest run and a date, then verifies context before confirming.
  await page.getByTestId("collection-post-limit").selectOption("1");
  await page.getByTestId("collection-comment-limit-10").click();
  await page.getByTestId("collection-mode-all").click();
  await page.getByTestId("collection-since-date").fill("2026-08-01");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("No máximo 1 por perfil");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("No máximo 10 por post");
  await expect(page.getByTestId("collection-scope-summary")).toContainText(/Desde .*2026 \(Instagram\)/);
  await expect(page.getByTestId("collection-volume-prediction")).toContainText("até 10 comentários");
  await expect(page.getByTestId("collection-start")).toHaveText("Iniciar coleta com estes limites");

  // A table shortcut must review the same scope instead of starting a run immediately.
  await page.getByTestId("collection-settings-toggle").click();
  await page.getByRole("button", { name: /Configurar coleta para/ }).last().click();
  await expect(page.getByTestId("collection-settings-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("collection-scope-summary")).toContainText("qa-healthy_recent");
  await page.getByTestId("collection-scope-summary").screenshot({
    path: `${evidenceDir}/after-quick-action-review.png`,
    animations: "disabled",
  });

  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
