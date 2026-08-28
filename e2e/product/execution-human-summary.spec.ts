import { expect, test, type Page } from "@playwright/test";

const zeroValidEmail = "qa.zero_valid_analyses@example.com";
const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/2.7";

async function loginThroughTheProduct(page: Page) {
  const unsafeApiRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(zeroValidEmail);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

test("the 53-comment failure can be understood and acted on from the human summary alone", async ({ page }) => {
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await loginThroughTheProduct(page);
  await page.goto("/dashboard/logs");
  await expect(page.getByRole("heading", { name: "Atividade" })).toBeVisible();

  const summary = page.locator('[data-testid^="execution-human-summary-"]').first();
  const runCard = page.locator('[data-testid^="pipeline-run-"]').first();
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await expect(summary).toHaveAttribute("data-raw-status", "completed");
  await expect(summary).toHaveAttribute("data-effective-status", "failed");
  await expect(summary).toHaveAttribute("data-summary-reason", "zero_valid_analyses");
  await expect(runCard).toHaveAttribute("data-effective-status", "failed");
  await expect(runCard.getByText("FALHOU", { exact: true })).toBeVisible();
  await expect(page.getByText("CONCLUÍDO", { exact: true })).toHaveCount(0);

  await expect(summary.getByText("O que aconteceu", { exact: true })).toBeVisible();
  await expect(summary.getByText("Impacto nos dados", { exact: true })).toBeVisible();
  await expect(summary.getByText("O que fazer agora", { exact: true })).toBeVisible();
  await expect(summary).toContainText("A coleta salvou 53 comentários, mas nenhum produziu uma análise válida.");
  await expect(summary).toContainText("Os 53 comentários salvos não entram no score, nas tendências nem nos alertas.");
  await expect(summary).toContainText("Tente sincronizar novamente.");

  const nextAction = summary.getByRole("link", { name: "Tentar sincronizar novamente", exact: true });
  await expect(nextAction).toHaveAttribute("href", "/dashboard/connect");
  await summary.screenshot({ path: `${evidenceDir}/after-human-summary-only.png`, animations: "disabled" });
  await page.screenshot({ path: `${evidenceDir}/after-effective-failure.png`, fullPage: true, animations: "disabled" });

  await summary.getByRole("button", { name: "Ver log técnico", exact: true }).click();
  const technicalLog = page.locator('[data-testid^="technical-log-"]').first();
  await expect(technicalLog).toBeVisible();
  await expect(technicalLog).toContainText("Zero análises válidas");
  await technicalLog.screenshot({ path: `${evidenceDir}/after-technical-log-second-level.png`, animations: "disabled" });

  // Simulated product decision: with the technical detail collapsed again,
  // the next action remains discoverable from the three-part summary alone.
  await summary.getByRole("button", { name: "Ocultar log técnico", exact: true }).click();
  await expect(technicalLog).toBeHidden();
  await nextAction.click();
  await expect(page).toHaveURL(/\/dashboard\/connect$/);
  await expect(page.getByRole("heading", { name: "Conectar Perfis" })).toBeVisible();

  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
