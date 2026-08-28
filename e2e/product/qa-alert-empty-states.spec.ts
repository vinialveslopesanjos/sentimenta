import { expect, test, type Page } from "@playwright/test";

const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.3";

const scenarios = [
  {
    name: "qa-no-coverage",
    email: "qa.no_alert_window_data@example.com",
    productState: "no_coverage",
    reason: "no_saved_items",
    title: "Cobertura insuficiente para avaliar",
    explanation: "Nenhum dado foi salvo na janela; não há base suficiente para avaliar.",
    action: { label: "Executar análise", href: "/dashboard/connect" },
  },
  {
    name: "qa-interrupted",
    email: "qa.stale_snapshot@example.com",
    productState: "monitoring_interrupted",
    reason: "data_health_not_healthy",
    title: "Monitoramento interrompido",
    explanation: "A coleta ou a análise não concluiu de forma saudável.",
    action: { label: "Atualizar dados", href: "/dashboard/connect" },
  },
] as const;

async function loginAndOpenAlerts(page: Page, email: string) {
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

  await page.getByRole("button", { name: "Alertas", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/alerts$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

test.describe("Alert empty states through real synthetic QA accounts", () => {
  test.describe.configure({ mode: "serial" });

  for (const scenario of scenarios) {
    test(`${scenario.name} preserves the evidence boundary`, async ({ page }) => {
      await loginAndOpenAlerts(page, scenario.email);

      const notice = page.getByTestId("alerts-evaluation");
      await expect(notice).toHaveAttribute("data-product-state", scenario.productState);
      await expect(notice).toHaveAttribute("data-evaluation-reason", scenario.reason);
      await expect(notice.getByRole("heading", { name: scenario.title })).toBeVisible();
      await expect(notice).toContainText(scenario.explanation);
      await expect(notice).toContainText("Últimos 7 dias");
      await expect(notice.getByRole("link", { name: scenario.action.label })).toHaveAttribute("href", scenario.action.href);
      await expect(page.getByText("Tudo limpo!", { exact: true })).toHaveCount(0);

      await page.screenshot({
        path: `${evidenceDir}/${scenario.name}.png`,
        fullPage: false,
      });

      await page.getByRole("link", { name: "sentimenta beta" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      const diagnosisEvidence = page.getByTestId("diagnosis-evidence");
      if (scenario.productState === "monitoring_interrupted") {
        await expect(diagnosisEvidence).toHaveAttribute("data-recommendation-mode", "historical_only");
        await expect(diagnosisEvidence).toHaveAttribute("data-report-source", "none");
        await expect(diagnosisEvidence).toContainText(
          /\d{2} de [a-zç]+\. de \d{4} a \d{2} de [a-zç]+\. de \d{4}/i,
        );
        await expect(page.getByRole("heading", { name: "Leitura histórica do período observado." })).toBeVisible();
        await expect(page.getByText(/o momento favorece/i)).toHaveCount(0);
        await diagnosisEvidence.scrollIntoViewIfNeeded();
        await page.screenshot({ path: "artifacts/product-audit-2026-08-26/evidence/1.2/qa-historical.png", fullPage: false });
      } else {
        await expect(diagnosisEvidence).toHaveAttribute("data-recommendation-mode", "blocked");
        await expect(diagnosisEvidence.getByRole("heading", { name: "Diagnóstico sem base confiável" })).toBeVisible();
        await expect(page.getByTestId("diagnosis-report-text")).toHaveCount(0);
        await diagnosisEvidence.scrollIntoViewIfNeeded();
        await page.screenshot({ path: "artifacts/product-audit-2026-08-26/evidence/1.2/qa-blocked.png", fullPage: false });
      }
    });
  }
});
