import { expect, test, type Page } from "@playwright/test";

const zeroValidEmail = "qa.zero_valid_analyses@example.com";
const password = "QaSeed123!";
const connectionId = "2fd7523d-aa40-510e-930d-505dadad82e3";
const partialEmail = "qa.partial_run@example.com";
const partialConnectionId = "3237c158-e870-5a72-804c-18d887017dc6";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.4";

async function loginThroughTheProduct(page: Page, email: string) {
  const unsafeApiRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith("/api/v1/")
      && !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes("/api/v1/auth/login"),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

async function expectCanonicalFailure(page: Page) {
  const status = page.getByTestId("global-data-status");
  await expect(status).toBeVisible({ timeout: 15_000 });
  await expect(status).toHaveAttribute("data-snapshot-health", "failed");
  await expect(status).toHaveAttribute("data-snapshot-reason", "zero_valid_analyses");
  await expect(status).toHaveAttribute("data-language-mode", "unavailable");
  await expect(status).toHaveAttribute("data-next-action", "retry_sync");
  await expect(status).toHaveAttribute("data-snapshot-saved-count", "53");
  await expect(status).toHaveAttribute("data-snapshot-valid-count", "0");
}

test.describe("53 saved comments and zero valid analyses", () => {
  test.describe.configure({ mode: "serial" });

  test("the real local account exposes one canonical failure across every analytical surface", async ({ page }) => {
    await loginThroughTheProduct(page, zeroValidEmail);

    const surfaces = [
      { name: "dashboard", path: "/dashboard", ready: "dashboard-reputation-summary" },
      { name: "profile", path: `/dashboard/profile/${connectionId}`, ready: "profile-reputation-summary" },
      { name: "comparison", path: "/dashboard/analysis", ready: "comparison-evidence-status" },
      { name: "alerts", path: "/dashboard/alerts", ready: "alerts-evaluation" },
    ] as const;

    for (const surface of surfaces) {
      await test.step(surface.name, async () => {
        await page.goto(surface.path);
        await expectCanonicalFailure(page);
        await expect(page.getByTestId(surface.ready)).toBeVisible({ timeout: 15_000 });

        const main = page.locator("main");
        await expect(main.getByText("Boa reputação", { exact: true })).toHaveCount(0);
        await expect(main.getByText("Tudo limpo", { exact: true })).toHaveCount(0);
        await expect(main.getByText("Sincronizado", { exact: true })).toHaveCount(0);

        if (surface.name === "dashboard") {
          const hero = page.getByTestId("dashboard-reputation-summary");
          await expect(hero).toHaveAttribute("data-evidence-state", "unavailable");
          await expect(hero).toHaveAttribute("data-snapshot-health", "failed");
          await expect(hero).toContainText("A atualização não produziu uma leitura de reputação.");
          await expect(hero).toContainText("Foram salvos 53 comentários");
          await expect(hero).not.toContainText("confiança");
          await expect(page.getByTestId(`dashboard-profile-health-${connectionId}`)).toHaveAttribute("data-health-state", "failed");
          await expect(page.getByTestId(`dashboard-profile-health-${connectionId}`)).toContainText("Falhou");
        }

        if (surface.name === "profile") {
          const notice = page.getByTestId("profile-evidence-status");
          const hero = page.getByTestId("profile-reputation-summary");
          await expect(notice).toHaveAttribute("data-evidence-state", "unavailable");
          await expect(notice).toHaveAttribute("data-snapshot-valid-count", "0");
          await expect(notice).toHaveAttribute("data-snapshot-saved-count", "53");
          await expect(hero).toContainText("A atualização não produziu uma leitura de reputação.");
          await expect(hero).not.toContainText("Reputação crítica");
          await expect(hero).not.toContainText("100% dos comentários");
          await expect(hero).not.toContainText("0.0");
          await expect(main.getByText("Perfil conectado", { exact: true })).toBeVisible();
        }

        if (surface.name === "comparison") {
          const notice = page.getByTestId("comparison-evidence-status");
          await expect(notice).toHaveAttribute("data-evidence-state", "unavailable");
          await expect(notice).toHaveAttribute("data-snapshot-health", "failed");
          await expect(notice).toContainText("0 análises válidas de 53 itens salvos");
          await expect(main.getByText("Score", { exact: true })).toHaveCount(0);
        }

        if (surface.name === "alerts") {
          const evaluation = page.getByTestId("alerts-evaluation");
          await expect(evaluation).toHaveAttribute("data-product-state", "monitoring_interrupted");
          await expect(evaluation).toHaveAttribute("data-evidence-state", "unavailable");
          await expect(evaluation).toHaveAttribute("data-snapshot-health", "failed");
          await expect(evaluation).toContainText("Monitoramento interrompido");
        }

        await page.screenshot({
          path: `${evidenceDir}/after-${surface.name}.png`,
          fullPage: false,
          animations: "disabled",
        });
      });
    }

    await page.goto("/dashboard");
    await expectCanonicalFailure(page);
    await expect(page.getByTestId("diagnosis-evidence")).toHaveAttribute(
      "data-recommendation-mode",
      "blocked",
    );
    await expect(page.getByTestId("diagnosis-evidence")).toContainText("Diagnóstico sem base confiável");
    await page.getByTestId("ai-diagnosis-section").screenshot({
      path: `${evidenceDir}/after-diagnosis.png`,
      animations: "disabled",
    });
  });

  test("a partial run remains historical across all five surfaces", async ({ page }) => {
    await loginThroughTheProduct(page, partialEmail);

    const expectPartialStatus = async () => {
      const status = page.getByTestId("global-data-status");
      await expect(status).toBeVisible({ timeout: 15_000 });
      await expect(status).toHaveAttribute("data-snapshot-health", "degraded");
      await expect(status).toHaveAttribute("data-snapshot-reason", "latest_attempt_partial");
      await expect(status).toHaveAttribute("data-language-mode", "historical");
      await expect(status).toHaveAttribute("data-next-action", "review_partial_run");
      await expect(status).toHaveAttribute("data-snapshot-valid-count", "12");
      await expect(status).toHaveAttribute("data-snapshot-saved-count", "24");
    };

    await page.goto("/dashboard");
    await expectPartialStatus();
    const dashboardHero = page.getByTestId("dashboard-reputation-summary");
    await expect(dashboardHero).toHaveAttribute("data-evidence-state", "historical");
    await expect(dashboardHero).toContainText("Leitura histórica");
    await expect(dashboardHero).not.toContainText("o momento favorece");
    await expect(page.getByTestId(`dashboard-profile-health-${partialConnectionId}`)).toHaveAttribute("data-health-state", "degraded");
    await expect(page.getByTestId(`dashboard-profile-health-${partialConnectionId}`)).toContainText("Degradada");
    await page.screenshot({ path: `${evidenceDir}/partial-dashboard.png`, fullPage: false, animations: "disabled" });

    await page.goto(`/dashboard/profile/${partialConnectionId}`);
    await expectPartialStatus();
    const profileNotice = page.getByTestId("profile-evidence-status");
    const profileHero = page.getByTestId("profile-reputation-summary");
    await expect(profileNotice).toHaveAttribute("data-evidence-state", "historical");
    await expect(profileNotice).toHaveAttribute("data-snapshot-valid-count", "12");
    await expect(profileNotice).toHaveAttribute("data-snapshot-saved-count", "24");
    await expect(profileHero).toHaveAttribute("data-evidence-state", "historical");
    await expect(profileHero).toContainText("Leitura histórica");
    await expect(page.getByRole("heading", { name: "Como estava a reputação no período observado?" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("o momento favorece");
    await page.screenshot({ path: `${evidenceDir}/partial-profile.png`, fullPage: false, animations: "disabled" });

    await page.goto("/dashboard/analysis");
    await expectPartialStatus();
    const comparisonNotice = page.getByTestId("comparison-evidence-status");
    await expect(comparisonNotice).toHaveAttribute("data-evidence-state", "historical");
    await expect(comparisonNotice).toHaveAttribute("data-snapshot-valid-count", "12");
    await expect(comparisonNotice).toContainText("Leitura histórica");
    await expect(page.locator("main").getByText("Score", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${evidenceDir}/partial-comparison.png`, fullPage: false, animations: "disabled" });

    await page.goto("/dashboard/alerts");
    await expectPartialStatus();
    const alertsEvaluation = page.getByTestId("alerts-evaluation");
    await expect(alertsEvaluation).toHaveAttribute("data-product-state", "monitoring_interrupted");
    await expect(alertsEvaluation).toHaveAttribute("data-evidence-state", "historical");
    await expect(alertsEvaluation).toContainText("Monitoramento interrompido");
    await page.screenshot({ path: `${evidenceDir}/partial-alerts.png`, fullPage: false, animations: "disabled" });

    await page.goto("/dashboard");
    await expectPartialStatus();
    const diagnosis = page.getByTestId("diagnosis-evidence");
    await expect(diagnosis).toHaveAttribute("data-recommendation-mode", "historical_only");
    await expect(diagnosis).toContainText("Leitura histórica — ação atual suspensa");
    await page.getByTestId("ai-diagnosis-section").screenshot({ path: `${evidenceDir}/partial-diagnosis.png`, animations: "disabled" });
  });
});
