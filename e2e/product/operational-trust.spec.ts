import { expect, test, type Page } from "@playwright/test";

const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/4.4";

type Signals = {
  apiFailures: string[];
  consoleProblems: string[];
  pageErrors: string[];
  mutations: string[];
};

function observe(page: Page): Signals {
  const signals: Signals = { apiFailures: [], consoleProblems: [], pageErrors: [], mutations: [] };
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      signals.apiFailures.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) signals.consoleProblems.push(`${message.type()}: ${message.text()}`);
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

async function loginAsOpsAdmin(page: Page): Promise<Signals> {
  const signals = observe(page);
  await page.addInitScript(() => window.localStorage.setItem("sentimenta_cookie_consent", "declined"));
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("qa.ops_admin@example.com");
  await page.locator('input[type="password"]').fill(password);
  const response = page.waitForResponse((candidate) => candidate.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  return signals;
}

test("ops admin can act on every minimum trust signal from one internal surface", async ({ page }) => {
  const signals = await loginAsOpsAdmin(page);

  const operations = page.getByRole("button", { name: "Operações", exact: true });
  await expect(operations).toBeVisible({ timeout: 15_000 });
  await operations.click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/operations$/);

  const status = page.getByTestId("ops-status");
  await expect(status).toBeVisible({ timeout: 15_000 });
  await expect(status).toHaveAttribute("data-status", "critical");
  for (const testId of [
    "ops-success-rate",
    "ops-duration",
    "ops-partial-rate",
    "ops-stuck-runs",
    "ops-zero-valid",
    "ops-divergences",
    "ops-drilldown-404",
    "ops-trust-tickets",
  ]) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  await expect(page.getByTestId("ops-platform-youtube")).toBeVisible();
  await expect(page.getByTestId("ops-alert-zero_valid_analyses")).toBeVisible();
  await expect(page.getByTestId("ops-alert-drilldown_404")).toBeVisible();
  await expect(page.getByTestId("ops-alert-trust_tickets_high")).toBeVisible();
  const drilldownAction = page.getByTestId("ops-alert-drilldown_404").getByRole("link");
  await expect(drilldownAction).toHaveAttribute("href", "#ops-drilldown-details");
  await drilldownAction.click();
  await expect(page).toHaveURL(/#ops-drilldown-details$/);
  await expect(page.locator("#ops-drilldown-details")).toContainText("/api/v1/posts/{post_id}");
  await expect(page.locator("#ops-ticket-details")).toContainText("data_trust");
  await page.screenshot({ path: `${evidenceDir}/ops-dashboard.png`, fullPage: true, animations: "disabled" });

  expect(signals.apiFailures).toEqual([]);
  expect(signals.consoleProblems).toEqual([]);
  expect(signals.pageErrors).toEqual([]);
  expect(signals.mutations).toEqual(["POST /api/v1/auth/login"]);
});

test("support categorizes data-trust tickets before submission", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.addInitScript(() => window.localStorage.setItem("sentimenta_cookie_consent", "declined"));
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.route("**/api/v1/support/contact", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "qa-ticket", message: "Mensagem recebida.", email_sent: false }),
    });
  });
  await page.goto("/suporte");
  await page.getByPlaceholder("Seu nome").fill("Pessoa QA");
  await page.getByPlaceholder("seu@email.com").fill("pessoa.qa@example.com");
  await page.getByLabel("Sobre o que você precisa de ajuda?").selectOption("data_trust");
  await page.getByPlaceholder("Resumo do seu problema ou dúvida").fill("Origem do score");
  await page.getByPlaceholder("Descreva em detalhes como podemos ajudar...").fill("Quero entender quais comentários sustentam a leitura.");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Mensagem recebida!" })).toBeVisible();
  expect(submitted).toMatchObject({ category: "data_trust", source_path: "/suporte" });
  await page.screenshot({ path: `${evidenceDir}/support-category.png`, fullPage: false, animations: "disabled" });
});
