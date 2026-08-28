import { expect, test, type Page } from "@playwright/test";

const healthyEmail = "qa.healthy_recent@example.com";
const neverSyncedEmail = "qa.never_synced@example.com";
const password = "QaSeed123!";
const connectionId = "6b679ae4-8837-5124-be3a-f50c8ccadbef";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.6";

async function loginThroughTheProduct(page: Page, email: string) {
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
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

test("one canonical funnel reconciles dashboard, profile, comparison, and logs", async ({ page }) => {
  await loginThroughTheProduct(page, healthyEmail);

  const surfaces = [
    { name: "dashboard", path: "/dashboard", ready: page.getByTestId("dashboard-reputation-summary") },
    { name: "profile", path: `/dashboard/profile/${connectionId}`, ready: page.getByTestId("profile-reputation-summary") },
    { name: "comparison", path: "/dashboard/analysis", ready: page.getByRole("heading", { name: "Análise Comparativa" }) },
    { name: "logs", path: "/dashboard/logs", ready: page.getByRole("heading", { name: "Logs de Pipeline" }) },
  ];
  const observed: Array<Record<string, string | null>> = [];

  for (const surface of surfaces) {
    const comparisonResponse = surface.name === "comparison"
      ? page.waitForResponse((response) => response.url().includes("/api/v1/dashboard/compare-connections"))
      : null;
    await page.goto(surface.path);
    await expect(surface.ready).toBeVisible({ timeout: 15_000 });
    if (comparisonResponse) await comparisonResponse;
    if (surface.name === "logs") {
      await expect(page.getByTestId("snapshot-stamp")).toBeVisible({ timeout: 15_000 });
    }

    const funnel = page.getByTestId(`count-funnel-${surface.name}`);
    await expect(funnel).toBeVisible({ timeout: 15_000 });
    await expect(funnel).toHaveAttribute("data-count-reconciled", "true");
    await expect(funnel).toHaveAttribute("data-count-found", "30");
    await expect(funnel).toHaveAttribute("data-count-eligible", "24");
    await expect(funnel).toHaveAttribute("data-count-collected", "24");
    await expect(funnel).toHaveAttribute("data-count-saved", "24");
    await expect(funnel).toHaveAttribute("data-count-analyzed", "24");
    await expect(funnel).toHaveAttribute("data-count-valid", "24");
    await expect(funnel).toHaveAttribute("data-count-ignored", "6");
    await expect(funnel).toContainText("30");
    await expect(funnel).toContainText("6 itens encontrados ficaram fora dos critérios de elegibilidade.");
    for (const label of ["Encontrados", "Elegíveis", "Coletados", "Salvos", "Analisados", "Válidos", "Ignorados"]) {
      await expect(funnel.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(funnel.getByText("N/D", { exact: true })).toHaveCount(0);

    observed.push({
      snapshot: await funnel.getAttribute("data-snapshot-id"),
      found: await funnel.getAttribute("data-count-found"),
      eligible: await funnel.getAttribute("data-count-eligible"),
      collected: await funnel.getAttribute("data-count-collected"),
      saved: await funnel.getAttribute("data-count-saved"),
      analyzed: await funnel.getAttribute("data-count-analyzed"),
      valid: await funnel.getAttribute("data-count-valid"),
      ignored: await funnel.getAttribute("data-count-ignored"),
    });

    if (surface.name === "logs") {
      await expect(page.getByText("Contagens operacionais somente desta execução.", { exact: false })).toBeVisible();
      await expect(page.getByText("COLETADOS / ALVO", { exact: true })).toBeVisible();
    }

    await page.screenshot({ path: `${evidenceDir}/after-${surface.name}.png`, fullPage: false, animations: "disabled" });
  }

  expect(new Set(observed.map((entry) => JSON.stringify(entry))).size).toBe(1);
});

test("uninstrumented stages stay unknown instead of being estimated", async ({ page }) => {
  await loginThroughTheProduct(page, neverSyncedEmail);
  const funnel = page.getByTestId("count-funnel-dashboard");
  await expect(funnel).toBeVisible({ timeout: 15_000 });
  await expect(funnel).toHaveAttribute("data-count-reconciled", "partial");
  await expect(funnel).toHaveAttribute("data-count-found", "unknown");
  await expect(funnel).toHaveAttribute("data-count-eligible", "unknown");
  await expect(funnel).toHaveAttribute("data-count-collected", "unknown");
  await expect(funnel).toHaveAttribute("data-count-saved", "0");
  await expect(funnel).toHaveAttribute("data-count-analyzed", "0");
  await expect(funnel).toHaveAttribute("data-count-valid", "0");
  await expect(funnel).toHaveAttribute("data-count-ignored", "unknown");
  await expect(funnel.getByText("N/D", { exact: true })).toHaveCount(4);
  await expect(funnel).toContainText("o produto não estima o valor");
  await page.screenshot({ path: `${evidenceDir}/unknown-not-estimated.png`, fullPage: false, animations: "disabled" });
});
