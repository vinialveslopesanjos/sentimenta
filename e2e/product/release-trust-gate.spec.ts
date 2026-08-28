import { expect, test, type Locator, type Page } from "@playwright/test";

const password = "QaSeed123!";
const healthyEmail = "qa.healthy_recent@example.com";
const staleEmail = "qa.stale_snapshot@example.com";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/4.2";

type BrowserSignals = {
  failedApiResponses: string[];
  pageErrors: string[];
  mutations: string[];
};

function observeBrowserSignals(page: Page): BrowserSignals {
  const signals: BrowserSignals = {
    failedApiResponses: [],
    pageErrors: [],
    mutations: [],
  };

  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      signals.failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", (error) => signals.pageErrors.push(error.message));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      signals.mutations.push(`${request.method()} ${pathname}`);
    }
  });

  return signals;
}

async function loginThroughTheProduct(page: Page, email: string) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
}

async function openMainRoute(page: Page, path: string, ready: Locator) {
  const documentResponse = await page.goto(path);
  expect(documentResponse, `${path} must return a document response`).not.toBeNull();
  expect(documentResponse!.status(), `${path} must not return 404 or another error`).toBeLessThan(400);
  await expect(ready, `${path} must render its product content`).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("404", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/página não encontrada|page not found/i)).toHaveCount(0);
}

test("all main product routes resolve against the isolated QA account", async ({ page }) => {
  test.setTimeout(90_000);
  const signals = observeBrowserSignals(page);
  await loginThroughTheProduct(page, healthyEmail);

  const profileHref = await page.locator('a[href^="/dashboard/profile/"]').first().getAttribute("href");
  const postHref = await page.locator('a[href^="/dashboard/post/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  expect(postHref).toBeTruthy();

  const routes: Array<{ path: string; ready: () => Locator }> = [
    { path: "/dashboard", ready: () => page.getByTestId("dashboard-reputation-summary") },
    { path: "/dashboard/connect", ready: () => page.getByRole("heading", { name: "Conectar Perfis" }) },
    { path: "/dashboard/logs", ready: () => page.getByRole("heading", { name: "Logs de Pipeline" }) },
    { path: "/dashboard/analysis", ready: () => page.getByRole("heading", { name: "Análise Comparativa" }) },
    { path: "/dashboard/alerts", ready: () => page.getByTestId("alerts-evaluation") },
    { path: "/dashboard/settings", ready: () => page.getByRole("heading", { name: "Configurações da Conta" }) },
    { path: profileHref!, ready: () => page.getByTestId("profile-reputation-summary") },
    { path: postHref!, ready: () => page.getByTestId("post-comments-evidence") },
  ];

  for (const route of routes) {
    await openMainRoute(page, route.path, route.ready());
  }

  await page.screenshot({
    path: `${evidenceDir}/after-main-route-matrix.png`,
    fullPage: false,
    animations: "disabled",
  });

  expect(signals.failedApiResponses).toEqual([]);
  expect(signals.pageErrors).toEqual([]);
  expect(signals.mutations).toEqual(["POST /api/v1/auth/login"]);
});

test("stale evidence stays historical and never produces an all-clear", async ({ page }) => {
  test.setTimeout(90_000);
  const signals = observeBrowserSignals(page);
  await loginThroughTheProduct(page, staleEmail);

  await page.setViewportSize({ width: 1256, height: 850 });
  await page.goto("/dashboard");

  const globalStatus = page.getByTestId("global-data-status");
  await expect(globalStatus).toHaveAttribute("data-snapshot-health", "stale");
  await expect(globalStatus).toHaveAttribute("data-language-mode", "historical");
  const trustCopyGeometry = await page.getByTestId("trust-language").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return { width: rect.width, visualLines: rect.height / lineHeight };
  });
  expect(trustCopyGeometry.width, "stale status copy must remain readable at a common notebook width").toBeGreaterThanOrEqual(280);
  expect(trustCopyGeometry.visualLines).toBeLessThanOrEqual(3.1);

  const dashboardSummary = page.getByTestId("dashboard-reputation-summary");
  await expect(dashboardSummary).toHaveAttribute("data-evidence-state", "historical");
  await expect(dashboardSummary.getByRole("heading", { name: "Leitura histórica do período observado." })).toBeVisible();
  await expect(dashboardSummary).toContainText("O recorte não sustenta conclusões ou recomendações para o presente.");
  await expect(dashboardSummary.getByText(/o momento favorece|está saudável|está crítica/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Como a reputação variou no período observado?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quais sinais explicaram o sentimento no período observado?" })).toBeVisible();
  await expect(page.getByText("Recorte atual", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Minha reputação está melhorando ou piorando?" })).toHaveCount(0);

  const diagnosis = page.getByTestId("diagnosis-evidence");
  await expect(diagnosis).toHaveAttribute("data-language-mode", "historical");
  await expect(diagnosis).toHaveAttribute("data-recommendation-mode", "historical_only");
  await expect(diagnosis).toContainText("Recomendações para o presente ficam suspensas");

  const profileHref = await page.locator('a[href^="/dashboard/profile/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  await openMainRoute(page, profileHref!, page.getByTestId("profile-reputation-summary"));
  const profileEvidence = page.getByTestId("profile-evidence-status");
  await expect(profileEvidence).toHaveAttribute("data-evidence-state", "historical");
  await expect(profileEvidence.getByRole("heading", { name: "Leitura histórica — atualização necessária" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como estava a reputação no período observado?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como está a reputação agora?" })).toHaveCount(0);

  await openMainRoute(page, "/dashboard/alerts", page.getByTestId("alerts-evaluation"));
  const alerts = page.getByTestId("alerts-evaluation");
  await expect(alerts).toHaveAttribute("data-product-state", "monitoring_interrupted");
  await expect(alerts).toHaveAttribute("data-evidence-state", "historical");
  await expect(alerts.getByRole("heading", { name: "Monitoramento interrompido" })).toBeVisible();
  await expect(page.getByText("Tudo limpo!", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nenhum alerta com cobertura válida" })).toHaveCount(0);

  await page.screenshot({
    path: `${evidenceDir}/after-stale-language-boundary.png`,
    fullPage: false,
    animations: "disabled",
  });

  expect(signals.failedApiResponses).toEqual([]);
  expect(signals.pageErrors).toEqual([]);
  expect(signals.mutations).toEqual(["POST /api/v1/auth/login"]);
});
