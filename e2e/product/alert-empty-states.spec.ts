import { expect, test, type Page } from "@playwright/test";

type Scenario = {
  name: "clear" | "no-coverage" | "interrupted" | "error";
  apiError: boolean;
  evaluation: "no_alerts_valid_coverage" | "unable_to_evaluate";
  reason: string;
  health: "healthy" | "stale";
  coverage: "complete" | "unknown";
  mode: "current" | "qualified" | "historical";
  messageKey: "current" | "healthy_limited_coverage" | "stale";
  action: { code: "keep_monitoring" | "review_coverage" | "sync_now"; label: string; href: string; priority: "low" | "medium" | "high" };
  productState: "clear" | "no_coverage" | "monitoring_interrupted" | "error";
  title: string;
  explanation: string;
  background: string;
};

const scenarios: Scenario[] = [
  {
    name: "clear",
    apiError: false,
    evaluation: "no_alerts_valid_coverage",
    reason: "evaluated_without_alerts",
    health: "healthy",
    coverage: "complete",
    mode: "current",
    messageKey: "current",
    action: { code: "keep_monitoring", label: "Continuar monitorando", href: "/dashboard", priority: "low" },
    productState: "clear",
    title: "Nenhum alerta com cobertura válida",
    explanation: "Avaliamos 50 análises válidas em toda a janela de 7 dias.",
    background: "rgb(229, 248, 239)",
  },
  {
    name: "no-coverage",
    apiError: false,
    evaluation: "unable_to_evaluate",
    reason: "coverage_not_verified",
    health: "healthy",
    coverage: "unknown",
    mode: "qualified",
    messageKey: "healthy_limited_coverage",
    action: { code: "review_coverage", label: "Revisar cobertura", href: "/dashboard/logs", priority: "medium" },
    productState: "no_coverage",
    title: "Cobertura insuficiente para avaliar",
    explanation: "A cobertura da janela não pôde ser verificada.",
    background: "rgb(248, 237, 240)",
  },
  {
    name: "interrupted",
    apiError: false,
    evaluation: "unable_to_evaluate",
    reason: "data_health_not_healthy",
    health: "stale",
    coverage: "unknown",
    mode: "historical",
    messageKey: "stale",
    action: { code: "sync_now", label: "Atualizar dados", href: "/dashboard/connect", priority: "high" },
    productState: "monitoring_interrupted",
    title: "Monitoramento interrompido",
    explanation: "A coleta ou a análise não concluiu de forma saudável. Os alertas não representam a janela solicitada.",
    background: "rgb(248, 242, 237)",
  },
  {
    name: "error",
    apiError: true,
    evaluation: "no_alerts_valid_coverage",
    reason: "evaluated_without_alerts",
    health: "healthy",
    coverage: "complete",
    mode: "current",
    messageKey: "current",
    action: { code: "keep_monitoring", label: "Tentar novamente", href: "", priority: "low" },
    productState: "error",
    title: "Não foi possível carregar Alertas",
    explanation: "A consulta falhou. Ainda não sabemos se existem alertas nesta janela.",
    background: "rgb(249, 234, 240)",
  },
];

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "qa-alert-states@example.com",
  name: "QA Alert States",
  plan: "pro",
  email_verified: true,
  onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" },
};

const connection = {
  id: "00000000-0000-0000-0000-000000000421",
  platform: "youtube",
  username: "qa-alert-states",
  display_name: "Perfil sintético",
  profile_image_url: null,
  followers_count: 1000,
  status: "active",
  last_sync_at: "2026-08-26T10:00:00Z",
};

function snapshotFor(scenario: Scenario) {
  return {
    id: `81111111-2222-4333-8444-00000000000${scenarios.indexOf(scenario) + 1}`,
    user_id: user.id,
    trigger_run_id: "00000000-0000-0000-0000-000000000994",
    schema_version: 1,
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    period_start: "2026-08-20T10:00:00Z",
    period_end: "2026-08-26T10:00:00Z",
    last_attempt_at: "2026-08-26T10:00:00Z",
    last_success_at: scenario.health === "stale" ? "2026-08-16T10:00:00Z" : "2026-08-26T10:00:00Z",
    found_count: 50,
    eligible_count: scenario.coverage === "complete" ? 50 : null,
    collected_count: 50,
    saved_count: 50,
    analyzed_count: 50,
    valid_count: 50,
    ignored_count: 0,
    coverage: {
      status: scenario.coverage,
      ratio: scenario.coverage === "complete" ? 1 : null,
      reason_code: scenario.coverage === "complete" ? "complete_window" : "coverage_not_verified",
    },
    health: scenario.health,
    reason_code: scenario.health === "stale" ? "last_success_outside_sla" : "healthy",
    metrics: { global: { valid_count: 50, avg_score: 6.2 } },
    content_hash: String(scenarios.indexOf(scenario) + 1).repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode: scenario.mode,
      message_key: scenario.messageKey,
      health: scenario.health,
      reason_code: scenario.health === "stale" ? "last_success_outside_sla" : "healthy",
      coverage_status: scenario.coverage,
      pipeline_status: "completed",
      present_tense_allowed: scenario.mode === "current",
      current_trend_allowed: scenario.mode === "current",
      no_alerts_claim_allowed: scenario.mode === "current",
      crisis_claim_allowed: scenario.mode === "current",
      action_mode: scenario.mode === "current" ? "current_if_supported" : scenario.mode === "qualified" ? "exploratory_only" : "restore_data_first",
      required_qualifier: scenario.mode === "current" ? null : scenario.mode === "qualified" ? "observed_data_only" : "historical_only",
      forbidden_claims: scenario.mode === "current" ? [] : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
      next_action: { code: scenario.action.code, href: scenario.action.href || "/dashboard", priority: scenario.action.priority },
    },
  };
}

async function installFixture(
  page: Page,
  getScenario: () => Scenario,
  shouldFailAlerts: () => boolean,
) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-alert-states-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const scenario = getScenario();
    const snapshot = snapshotFor(scenario);
    let body: unknown;

    if (path.endsWith("/auth/me")) body = user;
    else if (path.endsWith("/billing/credits")) body = { total: 20_000, plan_credits: 20_000, plan_allocation: 20_000, packs: [] };
    else if (path.endsWith("/connections")) body = [connection];
    else if (path.endsWith("/data-snapshots/latest")) body = snapshot;
    else if (path.endsWith("/dashboard/alerts")) {
      if (shouldFailAlerts()) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Synthetic alerts outage" }) });
        return;
      }
      body = {
        snapshot,
        days: 7,
        total_alerts: 0,
        alerts: [],
        evaluation: {
          status: scenario.evaluation,
          reason_code: scenario.reason,
          coverage: snapshot.coverage,
          evaluated_count: 50,
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

test("four alert empty states explain title, window, evidence and next action", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  let active = scenarios[0];
  let failAlerts = false;
  await installFixture(page, () => active, () => failAlerts);

  for (const scenario of scenarios) {
    active = scenario;
    failAlerts = scenario.apiError;
    await page.goto("/dashboard/alerts");
    await page.evaluate(() => window.scrollTo(0, 0));

    const notice = scenario.apiError
      ? page.getByTestId("alerts-load-error")
      : page.getByTestId("alerts-evaluation");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("data-product-state", scenario.productState);
    await expect(notice.getByRole("heading", { name: scenario.title })).toBeVisible();
    await expect(notice).toContainText(scenario.explanation);
    await expect(notice).toContainText("Últimos 7 dias");
    if (!scenario.apiError) {
      await expect(notice).toContainText("20 de ago. de 2026 a 26 de ago. de 2026");
      await expect(notice.getByRole("link", { name: scenario.action.label })).toHaveAttribute("href", scenario.action.href);
    } else {
      await expect(notice.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    }
    expect(await notice.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(scenario.background);
    await expect(page.getByText("Tudo limpo!", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0 não lido(s)", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Todos", exact: true })).toHaveCount(0);

    await page.screenshot({
      path: `artifacts/product-audit-2026-08-26/evidence/1.3/${scenario.name}.png`,
      fullPage: false,
    });

    if (scenario.apiError) {
      failAlerts = false;
      await notice.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByTestId("alerts-evaluation")).toHaveAttribute("data-product-state", "clear");
    }
  }
});
