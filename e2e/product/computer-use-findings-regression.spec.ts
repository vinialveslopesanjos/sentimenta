import { expect, test, type Page } from "@playwright/test";

const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/4.3/after";

type BrowserSignals = {
  apiFailures: string[];
  consoleProblems: string[];
  pageErrors: string[];
  mutations: string[];
};

function observeBrowser(page: Page): BrowserSignals {
  const signals: BrowserSignals = {
    apiFailures: [],
    consoleProblems: [],
    pageErrors: [],
    mutations: [],
  };
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      signals.apiFailures.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      signals.consoleProblems.push(`${message.type()}: ${message.text()}`);
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

async function login(page: Page, fixture: string): Promise<BrowserSignals> {
  const signals = observeBrowser(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(`qa.${fixture}@example.com`);
  await page.locator('input[type="password"]').fill(password);
  const response = page.waitForResponse((candidate) => candidate.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
  return signals;
}

function expectCleanReadOnlyJourney(signals: BrowserSignals) {
  expect(signals.apiFailures).toEqual([]);
  expect(signals.consoleProblems).toEqual([]);
  expect(signals.pageErrors).toEqual([]);
  expect(signals.mutations).toEqual(["POST /api/v1/auth/login"]);
}

test("zero valid analyses never become zero scores, topics, emotions, or raw activity insights", async ({ page }) => {
  test.setTimeout(90_000);
  const signals = await login(page, "zero_valid_analyses");

  const profileHref = await page.locator('a[href^="/dashboard/profile/"]').first().getAttribute("href");
  const postHref = await page.locator('a[href^="/dashboard/post/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  expect(postHref).toBeTruthy();

  await expect(page.getByTestId("dashboard-reputation-summary")).toHaveAttribute("data-evidence-state", "unavailable");
  await expect(page.locator('[data-chart-visual="dashboard-activity-heatmap"]')).toHaveCount(0);
  await expect(page.locator('[data-chart-visual="dashboard-temporal-volume"]')).toHaveCount(0);
  await expect(page.locator('[data-chart-visual="dashboard-engagement-peak"]')).toHaveCount(0);
  await expect(page.getByText(/maior valor foi 0 comentários/i)).toHaveCount(0);

  const provenanceTrigger = page.getByTestId("dashboard-score-provenance-trigger");
  await expect(provenanceTrigger).toHaveAccessibleName("Ver origem dos dados");
  await provenanceTrigger.click();
  const provenance = page.getByRole("dialog", { name: "Por que não há score disponível?" });
  await expect(provenance).toBeVisible();
  await expect(provenance).toHaveAttribute("data-score-available", "false");
  await expect(provenance).toContainText("53");
  await page.getByTestId("provenance-close").click();

  await page.goto(profileHref!);
  await expect(page.getByTestId("profile-reputation-summary")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-chart-visual="profile-topic-treemap"]')).toHaveCount(0);
  await expect(page.locator('[data-chart-visual="profile-activity-heatmap"]')).toHaveCount(0);
  await expect(page.getByText(/0 ocorrências e score 0/i)).toHaveCount(0);
  await expect(page.getByText("Volume coletado ao longo do tempo", { exact: true })).toBeVisible();
  await expect(page.getByText(/não representa sentimento, score ou análise/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Volume", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/zero-valid-profile-after.png`, fullPage: true, animations: "disabled" });

  await page.goto(postHref!);
  await expect(page.getByTestId("post-analysis-unavailable")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Emoções", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tópicos", exact: true })).toHaveCount(0);
  await expect(page.getByText("Confiança", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Fixture", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/zero-valid-after.png`, fullPage: true, animations: "disabled" });

  expectCleanReadOnlyJourney(signals);
});

test("historical profile keeps its time boundary beside lower-page priorities", async ({ page }) => {
  const signals = await login(page, "stale_snapshot");
  const profileHref = await page.locator('a[href^="/dashboard/profile/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  await page.goto(profileHref!);
  await expect(page.getByTestId("profile-reputation-summary")).toHaveAttribute("data-evidence-state", "historical");

  const boundary = page.getByTestId("profile-historical-boundary");
  await boundary.scrollIntoViewIfNeeded();
  await expect(boundary).toContainText("não são recomendações para o presente");
  await expect(page.getByRole("heading", { name: "Onde estavam os sinais mais extremos no período observado?" })).toBeVisible();
  await expect(page.getByText("Risco observado no período", { exact: true })).toBeVisible();
  await expect(page.getByText("Sinal positivo observado no período", { exact: true })).toBeVisible();
  await expect(page.getByText("Oportunidade para amplificar", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quais temas puxaram a conversa no período observado?" })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/historical-priorities-after.png`, fullPage: false, animations: "disabled" });

  expectCleanReadOnlyJourney(signals);
});

for (const fixture of ["healthy_recent", "recovered_after_failure"] as const) {
  test(`${fixture} cannot recommend passive monitoring when Alert coverage is insufficient`, async ({ page }) => {
    const signals = await login(page, fixture);
    await page.goto("/dashboard/alerts");
    const notice = page.getByTestId("alerts-evaluation");
    await expect(notice).toHaveAttribute("data-product-state", "no_coverage");
    await expect(notice.getByRole("heading", { name: "Cobertura insuficiente para avaliar" })).toBeVisible();
    await expect(notice.getByRole("link", { name: "Revisar cobertura" })).toHaveAttribute("href", "/dashboard/connect");
    await expect(notice.getByRole("link", { name: "Continuar monitorando" })).toHaveCount(0);
    await page.screenshot({ path: `${evidenceDir}/${fixture}-alerts-after.png`, fullPage: false, animations: "disabled" });
    expectCleanReadOnlyJourney(signals);
  });
}

test("partial-run technical-log action expands, announces, scrolls, and focuses its evidence", async ({ page }) => {
  const signals = await login(page, "partial_run");
  await page.goto("/dashboard/logs");
  const summary = page.locator('[data-summary-reason="partial_analysis"]').first();
  await expect(summary).toBeVisible({ timeout: 15_000 });
  const action = summary.locator('[data-testid^="execution-next-action-"]');
  await expect(action).toHaveAccessibleName("Revisar log técnico");
  const technicalLogId = await action.getAttribute("aria-controls");
  expect(technicalLogId).toBeTruthy();
  await action.click();
  const technicalLog = page.locator(`#${technicalLogId}`);
  await expect(action).toHaveAttribute("aria-expanded", "true");
  await expect(summary.getByRole("button", { name: "Ocultar log técnico", exact: true })).toBeVisible();
  await expect(technicalLog).toBeVisible();
  await expect(technicalLog).toBeFocused();
  await page.screenshot({ path: `${evidenceDir}/partial-log-after.png`, fullPage: false, animations: "disabled" });
  expectCleanReadOnlyJourney(signals);
});

test("connected 0/0 profile is described as completed without analyzable data", async ({ page }) => {
  const signals = await login(page, "no_alert_window_data");
  const hero = page.getByTestId("dashboard-reputation-summary");
  await expect(hero).toContainText("Perfil conectado, ainda sem uma leitura disponível.");
  await expect(hero).not.toContainText("Conecte e sincronize um perfil");

  await page.goto("/dashboard/connect");
  const row = page.locator('[data-testid^="connection-health-row-"]').first();
  await expect(row).toHaveAttribute("data-health-state", "healthy");
  await expect(row.getByText("Concluída · sem dados", { exact: true })).toBeVisible();
  await expect(row).toContainText("não encontrou dados analisáveis");
  await expect(row.getByText("Saudável", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/no-alert-data-after.png`, fullPage: false, animations: "disabled" });
  expectCleanReadOnlyJourney(signals);
});

test("never-synced journey never invents a prior collection or asks to reconnect", async ({ page }) => {
  const signals = await login(page, "never_synced");
  await expect(page.getByTestId("dashboard-reputation-summary")).toContainText("Perfil conectado, aguardando a primeira coleta.");
  await expect(page.getByTestId("dashboard-reputation-summary")).not.toContainText("Conecte e sincronize um perfil");

  const profileHref = await page.locator('a[href^="/dashboard/profile/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  await page.goto(profileHref!);
  await expect(page.getByText("O perfil está conectado, mas a primeira coleta ainda não foi concluída.", { exact: true })).toBeVisible();
  await expect(page.getByText(/A coleta existe|A atualização não produziu/i)).toHaveCount(0);

  await page.goto("/dashboard/logs");
  await expect(page.getByText("Perfil conectado, ainda sem execuções", { exact: true })).toBeVisible();
  await expect(page.getByText("Conecte um perfil e inicie uma análise", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/never-synced-after.png`, fullPage: false, animations: "disabled" });
  expectCleanReadOnlyJourney(signals);
});
