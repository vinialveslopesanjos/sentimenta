import { expect, test, type Page } from "@playwright/test";

type EvaluationStatus = "alerts_found" | "no_alerts_valid_coverage" | "unable_to_evaluate";

type Scenario = {
  name: string;
  evaluation: EvaluationStatus;
  reason: string;
  alerts: Array<Record<string, unknown>>;
  health: "healthy" | "never_synced";
  coverageStatus: "complete" | "unknown" | "none";
  coverageRatio: number | null;
  validCount: number;
  expectedTitle: string;
};

const scenarios: Scenario[] = [
  {
    name: "alerts-found",
    evaluation: "alerts_found",
    reason: "threshold_exceeded",
    alerts: [{
      connection_id: "00000000-0000-0000-0000-000000000401",
      platform: "youtube",
      username: "perfil-alerta",
      severity: "critical",
      negative_rate: 62,
      sarcasm_rate: 5,
      total_analyzed: 50,
      avg_score: 2.8,
      message: "Pico de negatividade em @perfil-alerta: 62% dos comentários analisados estão negativos.",
    }],
    health: "healthy",
    coverageStatus: "unknown",
    coverageRatio: null,
    validCount: 50,
    expectedTitle: "Alertas encontrados",
  },
  {
    name: "no-alerts-valid-coverage",
    evaluation: "no_alerts_valid_coverage",
    reason: "evaluated_without_alerts",
    alerts: [],
    health: "healthy",
    coverageStatus: "complete",
    coverageRatio: 1,
    validCount: 50,
    expectedTitle: "Nenhum alerta com cobertura válida",
  },
  {
    name: "unable-no-data",
    evaluation: "unable_to_evaluate",
    reason: "no_saved_items",
    alerts: [],
    health: "never_synced",
    coverageStatus: "none",
    coverageRatio: null,
    validCount: 0,
    expectedTitle: "Cobertura insuficiente para avaliar",
  },
];

const connection = {
  id: "00000000-0000-0000-0000-000000000401",
  platform: "youtube",
  username: "perfil-alerta",
  display_name: "Perfil de alerta",
  profile_image_url: null,
  followers_count: 1000,
  status: "active",
  last_sync_at: "2026-08-26T10:00:00Z",
};

function snapshotFor(scenario: Scenario) {
  const unavailable = scenario.validCount === 0;
  const current = scenario.coverageStatus === "complete" && !unavailable;
  return {
    id: `44444444-5555-4666-8777-00000000040${scenarios.indexOf(scenario) + 1}`,
    user_id: "00000000-0000-0000-0000-000000000001",
    trigger_run_id: unavailable ? null : "00000000-0000-0000-0000-000000000903",
    schema_version: 1,
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    period_start: unavailable ? null : "2026-08-20T10:00:00Z",
    period_end: unavailable ? null : "2026-08-26T10:00:00Z",
    last_attempt_at: unavailable ? null : "2026-08-26T10:00:00Z",
    last_success_at: unavailable ? null : "2026-08-26T10:00:00Z",
    found_count: scenario.validCount,
    eligible_count: scenario.validCount,
    collected_count: scenario.validCount,
    saved_count: scenario.validCount,
    analyzed_count: scenario.validCount,
    valid_count: scenario.validCount,
    ignored_count: 0,
    coverage: { status: scenario.coverageStatus, ratio: scenario.coverageRatio, reason_code: scenario.reason },
    health: scenario.health,
    reason_code: scenario.health === "healthy" ? "healthy" : "never_synced",
    metrics: { global: { valid_count: scenario.validCount, avg_score: unavailable ? null : 6.2 } },
    content_hash: "c".repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode: unavailable ? "unavailable" : current ? "current" : "qualified",
      message_key: unavailable ? "never_synced" : current ? "current" : "healthy_limited_coverage",
      health: scenario.health,
      reason_code: scenario.health === "healthy" ? "healthy" : "never_synced",
      coverage_status: scenario.coverageStatus,
      pipeline_status: unavailable ? null : "completed",
      present_tense_allowed: current,
      current_trend_allowed: current,
      no_alerts_claim_allowed: current,
      crisis_claim_allowed: current,
      action_mode: unavailable ? "connect_or_restore_data" : current ? "current_if_supported" : "exploratory_only",
      required_qualifier: unavailable ? "evaluation_unavailable" : current ? null : "observed_data_only",
      forbidden_claims: current ? [] : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
      next_action: unavailable
        ? { code: "start_first_sync", href: "/dashboard/connect", priority: "high" }
        : current
          ? { code: "keep_monitoring", href: "/dashboard", priority: "low" }
          : { code: "review_coverage", href: "/dashboard/logs", priority: "medium" },
    },
  };
}

async function installFixture(page: Page, getScenario: () => Scenario) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-alert-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "u-alert", email: "qa-alert@example.invalid", name: "QA Alert", plan: "pro", email_verified: true, onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" } }) });
      return;
    }
    if (path.endsWith("/billing/credits")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 1000, plan_credits: 1000, plan_allocation: 1000, packs: [] }) });
      return;
    }
    if (path.endsWith("/connections")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([connection]) });
      return;
    }
    if (path.endsWith("/data-snapshots/latest")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshotFor(getScenario())) });
      return;
    }
    if (path.endsWith("/dashboard/alerts")) {
      const scenario = getScenario();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          snapshot: snapshotFor(scenario),
          days: 7,
          total_alerts: scenario.alerts.length,
          alerts: scenario.alerts,
          evaluation: {
            status: scenario.evaluation,
            reason_code: scenario.reason,
            coverage: { status: scenario.coverageStatus, ratio: scenario.coverageRatio, reason_code: scenario.reason },
            evaluated_count: scenario.validCount,
            min_analyzed_per_profile: 20,
          },
          generated_at: "2026-08-26T10:00:00Z",
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
  });
}

test("alerts found, verified absence, and inability to evaluate are distinct", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  let active = scenarios[0];
  await installFixture(page, () => active);

  for (const scenario of scenarios) {
    active = scenario;
    await page.goto("/dashboard/alerts");
    await page.evaluate(() => window.scrollTo(0, 0));
    const notice = page.getByTestId("alerts-evaluation");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("data-evaluation-status", scenario.evaluation);
    await expect(notice).toHaveAttribute("data-evaluation-reason", scenario.reason);
    await expect(notice.getByRole("heading", { name: scenario.expectedTitle })).toBeVisible();
    await expect(page.getByText("Tudo limpo!", { exact: true })).toHaveCount(0);

    if (scenario.name === "unable-no-data") {
      await expect(notice).toContainText("Nenhum dado foi salvo na janela");
      await expect(notice.getByRole("link", { name: "Iniciar primeira coleta" })).toHaveAttribute("href", "/dashboard/connect");
      await expect(notice).toContainText("Período não comprovado");
    }
    if (scenario.name === "no-alerts-valid-coverage") {
      await expect(notice).toContainText("toda a janela de 7 dias");
      await expect(notice.getByRole("link", { name: "Continuar monitorando" })).toHaveAttribute("href", "/dashboard");
    }
    if (scenario.name === "alerts-found") {
      await expect(page.getByRole("heading", { name: "Pico de negatividade em @perfil-alerta" })).toBeVisible();
    }

    await page.screenshot({
      path: `artifacts/product-audit-2026-08-26/evidence/0.4/${scenario.name}.png`,
      fullPage: false,
    });
  }
});
