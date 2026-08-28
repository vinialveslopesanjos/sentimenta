import { expect, test, type Page } from "@playwright/test";

type Scenario = {
  name: string;
  health: "healthy" | "degraded" | "stale" | "failed" | "never_synced";
  reason: string;
  mode: "current" | "historical" | "unavailable";
  messageKey: string;
  stateLabel: string;
  qualifier: string;
  actionCode: string;
  actionLabel: string;
  actionHref: string;
  background: string;
  saved: number;
  valid: number;
  lastSuccess: string | null;
};

const scenarios: Scenario[] = [
  {
    name: "healthy",
    health: "healthy",
    reason: "healthy",
    mode: "current",
    messageKey: "current",
    stateLabel: "Dados em dia",
    qualifier: "Janela válida: esta leitura pode representar o momento monitorado.",
    actionCode: "keep_monitoring",
    actionLabel: "Continuar monitorando",
    actionHref: "/dashboard",
    background: "rgb(229, 248, 239)",
    saved: 24,
    valid: 24,
    lastSuccess: "2026-08-26T10:00:00Z",
  },
  {
    name: "partial",
    health: "degraded",
    reason: "latest_attempt_partial",
    mode: "historical",
    messageKey: "partial",
    stateLabel: "Execução parcial",
    qualifier: "Execução parcial: esta leitura considera somente os dados válidos preservados.",
    actionCode: "review_partial_run",
    actionLabel: "Revisar execução parcial",
    actionHref: "/dashboard/logs",
    background: "rgb(248, 242, 237)",
    saved: 24,
    valid: 12,
    lastSuccess: "2026-08-26T10:00:00Z",
  },
  {
    name: "stale",
    health: "stale",
    reason: "last_success_outside_sla",
    mode: "historical",
    messageKey: "stale",
    stateLabel: "Dados desatualizados",
    qualifier: "Leitura histórica: os dados estão fora do prazo de atualização.",
    actionCode: "sync_now",
    actionLabel: "Atualizar dados",
    actionHref: "/dashboard/connect",
    background: "rgb(248, 242, 237)",
    saved: 24,
    valid: 24,
    lastSuccess: "2026-08-16T10:00:00Z",
  },
  {
    name: "failed",
    health: "failed",
    reason: "latest_attempt_failed",
    mode: "historical",
    messageKey: "failed_with_history",
    stateLabel: "A última atualização falhou",
    qualifier: "A atualização falhou; esta é somente a última leitura histórica válida.",
    actionCode: "retry_sync",
    actionLabel: "Tentar sincronizar novamente",
    actionHref: "/dashboard/connect",
    background: "rgb(249, 234, 240)",
    saved: 24,
    valid: 24,
    lastSuccess: "2026-08-25T10:00:00Z",
  },
  {
    name: "never-synced",
    health: "never_synced",
    reason: "never_synced",
    mode: "unavailable",
    messageKey: "never_synced",
    stateLabel: "Sem coleta concluída",
    qualifier: "Ainda não existe uma coleta concluída para avaliar este perfil.",
    actionCode: "start_first_sync",
    actionLabel: "Iniciar primeira coleta",
    actionHref: "/dashboard/connect",
    background: "rgb(235, 248, 249)",
    saved: 0,
    valid: 0,
    lastSuccess: null,
  },
];

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "qa-global-status@example.com",
  name: "QA Global Status",
  plan: "pro",
  email_verified: true,
  onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" },
};

const connection = {
  id: "00000000-0000-0000-0000-000000000111",
  platform: "youtube",
  username: "qa-global-status",
  display_name: "Perfil sintético",
  profile_url: "https://example.invalid/qa-global-status",
  profile_image_url: null,
  followers_count: 1000,
  following_count: 0,
  media_count: 10,
  status: "active",
  connected_at: "2026-08-01T10:00:00Z",
  last_sync_at: "2026-08-26T10:00:00Z",
  persona: null,
  auto_sync: true,
  has_oauth_token: false,
};

function snapshotFor(scenario: Scenario) {
  const hasHistory = scenario.lastSuccess !== null;
  const idSuffix = String(scenarios.indexOf(scenario) + 1).padStart(12, "0");
  return {
    id: `71111111-2222-4333-8444-${idSuffix}`,
    user_id: user.id,
    trigger_run_id: hasHistory ? "00000000-0000-0000-0000-000000000991" : null,
    schema_version: 1,
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    period_start: hasHistory ? "2026-08-20T10:00:00Z" : null,
    period_end: hasHistory ? "2026-08-26T10:00:00Z" : null,
    last_attempt_at: hasHistory ? "2026-08-26T10:00:00Z" : null,
    last_success_at: scenario.lastSuccess,
    found_count: scenario.saved,
    eligible_count: scenario.saved,
    collected_count: scenario.saved,
    saved_count: scenario.saved,
    analyzed_count: scenario.valid,
    valid_count: scenario.valid,
    ignored_count: 0,
    coverage: {
      status: scenario.health === "healthy" ? "complete" : hasHistory ? "unknown" : "none",
      ratio: scenario.health === "healthy" ? 1 : null,
      reason_code: scenario.health === "healthy" ? "complete_window" : hasHistory ? "coverage_not_verified" : "no_saved_items",
    },
    health: scenario.health,
    reason_code: scenario.reason,
    metrics: { global: { valid_count: scenario.valid, avg_score: hasHistory ? 6.2 : null } },
    content_hash: String(scenarios.indexOf(scenario) + 1).repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode: scenario.mode,
      message_key: scenario.messageKey,
      health: scenario.health,
      reason_code: scenario.reason,
      coverage_status: scenario.health === "healthy" ? "complete" : hasHistory ? "unknown" : "none",
      pipeline_status: hasHistory ? scenario.name === "partial" ? "partial" : scenario.name === "failed" ? "failed" : "completed" : null,
      present_tense_allowed: scenario.mode === "current",
      current_trend_allowed: scenario.mode === "current",
      no_alerts_claim_allowed: scenario.mode === "current",
      crisis_claim_allowed: scenario.mode === "current",
      action_mode: scenario.mode === "current" ? "current_if_supported" : hasHistory ? "restore_data_first" : "connect_or_restore_data",
      required_qualifier: scenario.mode === "current" ? null : hasHistory ? "historical_only" : "evaluation_unavailable",
      forbidden_claims: scenario.mode === "current" ? [] : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
      next_action: { code: scenario.actionCode, href: scenario.actionHref, priority: scenario.mode === "current" ? "low" : "high" },
    },
  };
}

async function installFixture(
  page: Page,
  getScenario: () => Scenario,
  latestMode: "snapshot" | "empty" | "legacy" | "error" = "snapshot",
) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-global-status-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const scenario = getScenario();
    const snapshot = snapshotFor(scenario);
    let body: unknown;

    if (path.endsWith("/auth/me")) body = user;
    else if (path.endsWith("/billing/credits")) body = { total: 20_000, plan_credits: 20_000, plan_allocation: 20_000, packs: [] };
    else if (path.endsWith("/connections")) body = [connection];
    else if (path.endsWith("/data-snapshots/latest")) {
      if (latestMode === "error") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Synthetic status outage" }) });
        return;
      }
      body = latestMode === "empty" || latestMode === "legacy" ? null : snapshot;
    }
    else if (path.endsWith("/dashboard/summary")) {
      body = {
        snapshot: latestMode === "legacy" ? null : snapshot,
        total_connections: 1,
        total_posts: scenario.saved ? 1 : 0,
        total_comments: scenario.saved,
        total_analyzed: scenario.valid,
        avg_score: scenario.lastSuccess ? 6.2 : null,
        avg_polarity: scenario.lastSuccess ? 0.2 : null,
        sentiment_distribution: scenario.valid ? { positive: 12, neutral: 7, negative: 5 } : null,
        emotions_distribution: null,
        topics_frequency: null,
        word_frequency: null,
        recent_posts: [],
        connections: [connection],
      };
    } else if (path.endsWith("/dashboard/compare-connections")) {
      body = { snapshot, days: 0, connections: [], generated_at: "2026-08-26T10:00:00Z" };
    } else if (path.endsWith("/dashboard/alerts")) {
      body = {
        snapshot,
        days: 7,
        total_alerts: 0,
        alerts: [],
        evaluation: {
          status: scenario.health === "healthy" ? "no_alerts_valid_coverage" : "unable_to_evaluate",
          reason_code: scenario.health === "healthy" ? "evaluated_without_alerts" : "data_health_not_healthy",
          coverage: snapshot.coverage,
          evaluated_count: scenario.valid,
          min_analyzed_per_profile: 20,
        },
        generated_at: "2026-08-26T10:00:00Z",
      };
    } else {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("status, period, last success and action precede insights on three analytical surfaces", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  let active = scenarios[0];
  await installFixture(page, () => active);

  const surfaces = [
    { name: "dashboard", path: "/dashboard" },
    { name: "comparison", path: "/dashboard/analysis" },
    { name: "alerts", path: "/dashboard/alerts" },
  ];

  for (const scenario of scenarios) {
    active = scenario;
    for (const surface of surfaces) {
      await page.goto(surface.path);
      await page.evaluate(() => window.scrollTo(0, 0));
      const status = page.getByTestId("global-data-status");
      await expect(status).toBeVisible();
      await expect(status).toHaveAttribute("data-snapshot-health", scenario.health);
      await expect(status).toHaveAttribute("data-snapshot-reason", scenario.reason);
      await expect(status).toHaveAttribute("data-language-mode", scenario.mode);
      await expect(status).toHaveAttribute("data-next-action", scenario.actionCode);
      await expect(status).toHaveAttribute("data-last-success-at", scenario.lastSuccess ?? "never");
      await expect(status).toContainText(scenario.stateLabel);
      await expect(status.getByTestId("trust-language")).toHaveText(scenario.qualifier);
      await expect(status.getByRole("link", { name: scenario.actionLabel })).toHaveAttribute("href", scenario.actionHref);
      await expect(status).toContainText(scenario.lastSuccess ? "Último sucesso" : "Nenhum sucesso registrado");
      await expect(status).toContainText(`${scenario.valid} válidos de ${scenario.saved} salvos`);
      expect(await status.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(scenario.background);

      const statusBox = await status.boundingBox();
      const mainBox = await page.locator("main").boundingBox();
      expect(statusBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      expect(statusBox!.y).toBeGreaterThanOrEqual(0);
      expect(statusBox!.y).toBeLessThan(mainBox!.y);
      expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(950);

      await status.screenshot({
        path: `artifacts/product-audit-2026-08-26/evidence/1.1/${scenario.name}-${surface.name}.png`,
      });
      if (scenario.name === "stale") {
        await page.screenshot({
          path: `artifacts/product-audit-2026-08-26/evidence/1.1/stale-${surface.name}-page.png`,
          fullPage: false,
        });
      }
    }

    await page.goto("/dashboard");
    await expect(page.getByTestId("global-data-status")).toHaveAttribute("data-snapshot-health", scenario.health);
    await page.screenshot({
      path: `artifacts/product-audit-2026-08-26/evidence/1.1/${scenario.name}-dashboard-page.png`,
      fullPage: false,
    });
  }
});

test("partial status keeps every critical fact and action at 320 CSS pixels", async ({ page }) => {
  const partial = scenarios.find((scenario) => scenario.name === "partial")!;
  await page.setViewportSize({ width: 320, height: 800 });
  await installFixture(page, () => partial);
  await page.goto("/dashboard");

  const status = page.getByTestId("global-data-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Execução parcial");
  await expect(status).toContainText("20 de ago. de 2026 a 26 de ago. de 2026");
  await expect(status).toContainText("26 de ago. de 2026, 10:00");
  await expect(status).toContainText("12 válidos de 24 salvos");
  await expect(status.getByRole("link", { name: "Revisar execução parcial" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  await page.screenshot({
    path: "artifacts/product-audit-2026-08-26/evidence/1.1/partial-mobile-320.png",
    fullPage: false,
  });
});

test("sidebar navigation returns a scrolled user to the global status", async ({ page }) => {
  const stale = scenarios.find((scenario) => scenario.name === "stale")!;
  await page.setViewportSize({ width: 1440, height: 800 });
  await installFixture(page, () => stale);
  await page.goto("/dashboard");
  await expect(page.getByTestId("global-data-status")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/analysis$/);

  const status = page.getByTestId("global-data-status");
  await expect(status).toBeVisible();
  const box = await status.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(800);
});

test("missing status evidence blocks interpretation instead of failing silently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await installFixture(page, () => scenarios[0], "error");
  await page.goto("/dashboard");

  const errorStatus = page.getByTestId("global-data-status-error");
  await expect(errorStatus).toBeVisible();
  await expect(errorStatus).toContainText("Status dos dados indisponível");
  await expect(errorStatus).toContainText("Evite interpretar os insights");
  await expect(errorStatus.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.getByTestId("global-data-status")).toHaveCount(0);

  const statusBox = await errorStatus.boundingBox();
  const mainBox = await page.locator("main").boundingBox();
  expect(statusBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(statusBox!.y).toBeLessThan(mainBox!.y);

  await page.screenshot({
    path: "artifacts/product-audit-2026-08-26/evidence/1.1/status-api-error.png",
    fullPage: false,
  });
});

test("an account without any snapshot gets a neutral collection-recovery action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await installFixture(page, () => scenarios[4], "empty");
  await page.goto("/dashboard/alerts");

  const status = page.getByTestId("global-data-status");
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("data-status-state", "no_snapshot");
  await expect(status).toContainText("Sem snapshot de coleta comprovado");
  await expect(status).toContainText("Se já existem dados históricos, trate-os somente como histórico");
  await expect(status.getByRole("link", { name: "Revisar perfis e coletar" })).toHaveAttribute("href", "/dashboard/connect");

  await status.screenshot({
    path: "artifacts/product-audit-2026-08-26/evidence/1.1/no-snapshot.png",
  });
});

test("legacy analyses without a snapshot are labeled historical instead of nonexistent", async ({ page }) => {
  const stale = scenarios.find((scenario) => scenario.name === "stale")!;
  await page.setViewportSize({ width: 1440, height: 950 });
  await installFixture(page, () => stale, "legacy");
  await page.goto("/dashboard");

  const status = page.getByTestId("global-data-status");
  await expect(status).toContainText("Sem snapshot de coleta comprovado");

  const reputation = page.getByTestId("dashboard-reputation-summary");
  await expect(reputation).toHaveAttribute("data-evidence-state", "historical");
  await expect(reputation).toContainText("Leitura histórica");
  await expect(reputation).toContainText("não sustenta conclusões ou recomendações para o presente");
});
