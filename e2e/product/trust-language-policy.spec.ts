import { expect, test, type Page } from "@playwright/test";

type Scenario = {
  name: string;
  health: "healthy" | "degraded" | "stale" | "failed";
  reason: string;
  coverage: string;
  pipeline: string;
  mode: "current" | "qualified" | "historical";
  messageKey: string;
  copy: string;
};

const scenarios: Scenario[] = [
  {
    name: "current",
    health: "healthy",
    reason: "healthy",
    coverage: "complete",
    pipeline: "completed",
    mode: "current",
    messageKey: "current",
    copy: "Janela válida: esta leitura pode representar o momento monitorado.",
  },
  {
    name: "limited-coverage",
    health: "healthy",
    reason: "healthy",
    coverage: "unknown",
    pipeline: "completed",
    mode: "qualified",
    messageKey: "healthy_limited_coverage",
    copy: "Dados recentes, mas a cobertura ainda não permite afirmar o momento atual.",
  },
  {
    name: "partial",
    health: "degraded",
    reason: "latest_attempt_partial",
    coverage: "complete",
    pipeline: "partial",
    mode: "historical",
    messageKey: "partial",
    copy: "Execução parcial: esta leitura considera somente os dados válidos preservados.",
  },
  {
    name: "stale",
    health: "stale",
    reason: "last_success_outside_sla",
    coverage: "complete",
    pipeline: "completed",
    mode: "historical",
    messageKey: "stale",
    copy: "Leitura histórica: os dados estão fora do prazo de atualização.",
  },
  {
    name: "failed-with-history",
    health: "failed",
    reason: "latest_attempt_failed",
    coverage: "complete",
    pipeline: "failed",
    mode: "historical",
    messageKey: "failed_with_history",
    copy: "A atualização falhou; esta é somente a última leitura histórica válida.",
  },
];

const connection = {
  id: "00000000-0000-0000-0000-000000000301",
  platform: "youtube",
  username: "mesmo-perfil",
  display_name: "Mesmo perfil",
  profile_image_url: null,
  followers_count: 1000,
  status: "active",
  last_sync_at: "2026-08-26T10:00:00Z",
};

function makeSnapshot(scenario: Scenario) {
  const forbidden = scenario.mode === "current"
    ? []
    : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"];
  return {
    id: "33333333-4444-4555-8666-777777777777",
    user_id: "00000000-0000-0000-0000-000000000001",
    trigger_run_id: "00000000-0000-0000-0000-000000000902",
    schema_version: 1,
    period_start: "2026-08-22T09:00:00Z",
    period_end: "2026-08-26T09:00:00Z",
    last_attempt_at: "2026-08-26T10:00:00Z",
    last_success_at: "2026-08-26T10:00:00Z",
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    found_count: 50,
    eligible_count: 50,
    collected_count: 50,
    saved_count: 50,
    analyzed_count: 50,
    valid_count: 50,
    ignored_count: 0,
    coverage: { status: scenario.coverage, ratio: scenario.coverage === "complete" ? 1 : null },
    health: scenario.health,
    reason_code: scenario.reason,
    metrics: { global: { valid_count: 50, avg_score: 6.2 } },
    content_hash: "b".repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode: scenario.mode,
      message_key: scenario.messageKey,
      health: scenario.health,
      reason_code: scenario.reason,
      coverage_status: scenario.coverage,
      pipeline_status: scenario.pipeline,
      present_tense_allowed: scenario.mode === "current",
      current_trend_allowed: scenario.mode === "current",
      no_alerts_claim_allowed: scenario.mode === "current",
      crisis_claim_allowed: scenario.mode === "current",
      action_mode: scenario.mode === "current" ? "current_if_supported" : scenario.mode === "qualified" ? "exploratory_only" : "restore_data_first",
      required_qualifier: scenario.mode === "current" ? null : scenario.mode === "qualified" ? "observed_data_only" : "historical_only",
      forbidden_claims: forbidden,
      next_action: scenario.mode === "current"
        ? { code: "keep_monitoring", href: "/dashboard", priority: "low" }
        : scenario.reason === "latest_attempt_partial"
          ? { code: "review_partial_run", href: "/dashboard/logs", priority: "high" }
          : scenario.health === "stale"
            ? { code: "sync_now", href: "/dashboard/connect", priority: "high" }
            : scenario.health === "failed"
              ? { code: "retry_sync", href: "/dashboard/connect", priority: "high" }
              : { code: "review_coverage", href: "/dashboard/logs", priority: "medium" },
    },
  };
}

async function installFixture(page: Page, getScenario: () => Scenario) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-language-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "u1",
          email: "qa-language@example.invalid",
          name: "QA Language",
          plan: "pro",
          email_verified: true,
          onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" },
        }),
      });
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(makeSnapshot(getScenario())) });
      return;
    }
    if (path.endsWith("/dashboard/summary")) {
      const snapshot = makeSnapshot(getScenario());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          snapshot,
          total_connections: 1,
          total_posts: 10,
          total_comments: 50,
          total_analyzed: 50,
          avg_score: 6.2,
          avg_polarity: 0.2,
          sentiment_distribution: { positive: 25, neutral: 15, negative: 10 },
          emotions_distribution: null,
          topics_frequency: null,
          word_frequency: null,
          recent_posts: [],
          connections: [connection],
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
  });
}

test("changing only trust state changes certainty while history stays fixed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let active = scenarios[0];
  await installFixture(page, () => active);

  for (const scenario of scenarios) {
    active = scenario;
    await page.goto("/dashboard");
    const stamp = page.getByTestId("global-data-status");
    await expect(stamp).toBeVisible();

    // Historical evidence is intentionally identical across every state.
    await expect(stamp).toHaveAttribute("data-snapshot-id", "33333333-4444-4555-8666-777777777777");
    await expect(stamp).toHaveAttribute("data-snapshot-score", "6.2");
    await expect(stamp).toHaveAttribute("data-snapshot-valid-count", "50");
    await expect(stamp).toHaveAttribute("data-snapshot-saved-count", "50");
    await expect(stamp).toContainText("22 de ago. de 2026 a 26 de ago. de 2026");

    await expect(stamp).toHaveAttribute("data-snapshot-health", scenario.health);
    await expect(stamp).toHaveAttribute("data-language-mode", scenario.mode);
    await expect(stamp).toHaveAttribute("data-language-message", scenario.messageKey);
    await expect(page.getByTestId("trust-language")).toHaveText(scenario.copy);
    await stamp.screenshot({
      path: `artifacts/product-audit-2026-08-26/evidence/0.3/${scenario.name}.png`,
    });
  }
});
