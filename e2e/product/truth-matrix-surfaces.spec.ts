import { expect, test, type Page } from "@playwright/test";

type Scenario = {
  name: string;
  health: "healthy" | "degraded" | "stale" | "failed" | "never_synced";
  reason: string;
  pipelineStatus: "completed" | "partial" | "failed" | null;
  mode: "current" | "historical" | "unavailable";
  messageKey: string;
  nextAction: string;
  nextActionLabel: string;
  href: string;
  priority: "low" | "high";
};

const scenarios: Scenario[] = [
  { name: "healthy", health: "healthy", reason: "healthy", pipelineStatus: "completed", mode: "current", messageKey: "current", nextAction: "keep_monitoring", nextActionLabel: "Continuar monitorando", href: "/dashboard", priority: "low" },
  { name: "degraded-partial", health: "degraded", reason: "latest_attempt_partial", pipelineStatus: "partial", mode: "historical", messageKey: "partial", nextAction: "review_partial_run", nextActionLabel: "Revisar execução parcial", href: "/dashboard/logs", priority: "high" },
  { name: "stale", health: "stale", reason: "last_success_outside_sla", pipelineStatus: "completed", mode: "historical", messageKey: "stale", nextAction: "sync_now", nextActionLabel: "Atualizar dados", href: "/dashboard/connect", priority: "high" },
  { name: "failed", health: "failed", reason: "latest_attempt_failed", pipelineStatus: "failed", mode: "historical", messageKey: "failed_with_history", nextAction: "retry_sync", nextActionLabel: "Tentar sincronizar novamente", href: "/dashboard/connect", priority: "high" },
  { name: "never-synced", health: "never_synced", reason: "never_synced", pipelineStatus: null, mode: "unavailable", messageKey: "never_synced", nextAction: "start_first_sync", nextActionLabel: "Iniciar primeira coleta", href: "/dashboard/connect", priority: "high" },
];

const connection = {
  id: "00000000-0000-0000-0000-000000000501",
  platform: "youtube",
  username: "perfil-matriz",
  display_name: "Perfil matriz",
  profile_url: "https://youtube.com/@perfil-matriz",
  profile_image_url: null,
  followers_count: 1000,
  following_count: 10,
  media_count: 10,
  status: "active",
  connected_at: "2026-08-01T10:00:00Z",
  last_sync_at: "2026-08-26T10:00:00Z",
  persona: null,
};

function snapshotFor(scenario: Scenario) {
  const hasHistory = scenario.health !== "never_synced";
  const complete = scenario.health === "healthy";
  const valid = hasHistory ? 50 : 0;
  const idSuffix = String(scenarios.indexOf(scenario) + 1).padStart(12, "0");
  const reference = {
    id: `55555555-6666-4777-8888-${idSuffix}`,
    schema_version: 1,
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    period_start: hasHistory ? "2026-08-20T10:00:00Z" : null,
    period_end: hasHistory ? "2026-08-26T10:00:00Z" : null,
    saved_count: valid,
    analyzed_count: valid,
    valid_count: valid,
    coverage: {
      status: complete ? "complete" : hasHistory ? "unknown" : "none",
      ratio: complete ? 1 : null,
      reason_code: complete ? "complete_window" : hasHistory ? "coverage_not_verified" : "no_saved_items",
    },
    health: scenario.health,
    reason_code: scenario.reason,
    metrics: { global: { valid_count: valid, avg_score: hasHistory ? 6.2 : null } },
    content_hash: String(scenarios.indexOf(scenario) + 1).repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode: scenario.mode,
      message_key: scenario.messageKey,
      health: scenario.health,
      reason_code: scenario.reason,
      coverage_status: complete ? "complete" : hasHistory ? "unknown" : "none",
      pipeline_status: scenario.pipelineStatus,
      present_tense_allowed: complete,
      current_trend_allowed: complete,
      no_alerts_claim_allowed: complete,
      crisis_claim_allowed: complete,
      action_mode: complete ? "current_if_supported" : hasHistory ? "restore_data_first" : "connect_or_restore_data",
      required_qualifier: complete ? null : hasHistory ? "historical_only" : "evaluation_unavailable",
      forbidden_claims: complete ? [] : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
      next_action: { code: scenario.nextAction, href: scenario.href, priority: scenario.priority },
    },
  };
  return {
    ...reference,
    user_id: "00000000-0000-0000-0000-000000000001",
    trigger_run_id: scenario.pipelineStatus ? "00000000-0000-0000-0000-000000000599" : null,
    last_attempt_at: scenario.pipelineStatus ? "2026-08-26T10:00:00Z" : null,
    last_success_at: hasHistory ? "2026-08-26T10:00:00Z" : null,
    found_count: valid,
    eligible_count: valid,
    collected_count: valid,
    ignored_count: 0,
  };
}

function connectionDashboard(snapshot: ReturnType<typeof snapshotFor>) {
  return {
    snapshot,
    connection,
    total_posts: 10,
    total_comments: snapshot.valid_count,
    total_analyzed: snapshot.valid_count,
    avg_score: snapshot.metrics.global.avg_score,
    avg_polarity: snapshot.valid_count ? 0.2 : null,
    weighted_avg_score: snapshot.metrics.global.avg_score,
    sentiment_distribution: snapshot.valid_count ? { positive: 25, neutral: 15, negative: 10 } : null,
    emotions_distribution: {},
    topics_frequency: {},
    word_frequency: {},
    posts: [],
    engagement_totals: { total_likes: 0, total_comments: 0, total_views: 0, total_shares: 0 },
    total_likes: 0,
    total_views: 0,
    total_shares: 0,
    engagement_rate: null,
    topics_with_scores: [],
  };
}

function healthReportFor(scenario: Scenario, snapshot: ReturnType<typeof snapshotFor>) {
  const recommendationMode = scenario.mode === "current"
    ? "current"
    : scenario.mode === "historical"
      ? "historical_only"
      : "blocked";
  return {
    snapshot,
    report_basis: {
      contract_version: 1,
      snapshot_id: snapshot.id,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      coverage_status: snapshot.coverage.status,
      coverage_ratio: snapshot.coverage.ratio,
      health: snapshot.health,
      language_mode: scenario.mode,
      recommendation_mode: recommendationMode,
      reason_code: snapshot.reason_code,
      generated_at: "2026-08-26T10:00:00Z",
      source: recommendationMode === "current" ? "llm" : recommendationMode === "historical_only" ? "llm_qualified" : "none",
    },
    report_text: recommendationMode === "blocked" ? null : `Diagnóstico vinculado ao snapshot ${snapshot.id.slice(0, 8)}.`,
    generated_at: recommendationMode === "blocked" ? null : "2026-08-26T10:00:00Z",
    data_summary: {},
    has_new_data: false,
  };
}

async function installFixture(page: Page, getScenario: () => Scenario) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-matrix-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const scenario = getScenario();
    const snapshot = snapshotFor(scenario);
    let body: unknown;

    if (path.endsWith("/auth/me")) body = { id: "u-matrix", email: "qa-matrix@example.invalid", name: "QA Matrix", plan: "pro", email_verified: true, onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" } };
    else if (path.endsWith("/billing/credits")) body = { total: 1000, plan_credits: 1000, plan_allocation: 1000, packs: [] };
    else if (path.endsWith("/connections")) body = [connection];
    else if (path.endsWith("/data-snapshots/latest")) body = snapshot;
    else if (path.endsWith("/dashboard/summary")) body = { snapshot, total_connections: 1, total_posts: 10, total_comments: snapshot.valid_count, total_analyzed: snapshot.valid_count, avg_score: snapshot.metrics.global.avg_score, avg_polarity: snapshot.valid_count ? 0.2 : null, sentiment_distribution: snapshot.valid_count ? { positive: 25, neutral: 15, negative: 10 } : null, emotions_distribution: null, topics_frequency: null, word_frequency: null, recent_posts: [], connections: [connection] };
    else if (path.endsWith(`/dashboard/connection/${connection.id}`)) body = connectionDashboard(snapshot);
    else if (path.endsWith("/dashboard/compare-connections")) body = { snapshot, days: Number(url.searchParams.get("days") ?? 0), connections: [{ connection_id: connection.id, platform: "youtube", username: connection.username, display_name: connection.display_name, profile_image_url: null, total_comments: snapshot.valid_count, total_analyzed: snapshot.valid_count, avg_score: snapshot.metrics.global.avg_score, avg_polarity: snapshot.valid_count ? 0.2 : null, sentiment_distribution: { positive: 25, neutral: 15, negative: 10 }, positive_rate: 50, negative_rate: 20, emotions_distribution: {} }], generated_at: "2026-08-26T10:00:00Z" };
    else if (path.endsWith("/dashboard/alerts")) body = { snapshot, days: 7, total_alerts: 0, alerts: [], evaluation: { status: scenario.health === "healthy" ? "no_alerts_valid_coverage" : "unable_to_evaluate", reason_code: scenario.health === "healthy" ? "evaluated_without_alerts" : scenario.health === "never_synced" ? "no_saved_items" : "data_health_not_healthy", coverage: snapshot.coverage, evaluated_count: snapshot.valid_count, min_analyzed_per_profile: 20 }, generated_at: "2026-08-26T10:00:00Z" };
    else if (path.endsWith("/dashboard/health-report")) body = healthReportFor(scenario, snapshot);
    else if (path.endsWith("/pipeline/runs")) body = scenario.pipelineStatus ? [{ id: "00000000-0000-0000-0000-000000000599", connection_id: connection.id, platform: "youtube", connection_username: connection.username, run_type: "full", status: scenario.pipelineStatus, posts_fetched: 10, comments_fetched: snapshot.valid_count, comments_analyzed: snapshot.valid_count, llm_calls: 1, errors_count: scenario.pipelineStatus === "completed" ? 0 : 1, total_cost_usd: 0, started_at: "2026-08-26T09:55:00Z", ended_at: "2026-08-26T10:00:00Z", notes: null, target_posts: 10, target_comments: snapshot.valid_count, snapshot }] : [];
    else if (path.endsWith("/comments")) body = { items: [], total: 0, limit: 200, offset: 0 };
    else {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("canonical fixtures keep state, period and action across every product surface", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  let active = scenarios[0];
  await installFixture(page, () => active);

  const surfaces = [
    { name: "dashboard", path: "/dashboard" },
    { name: "profile", path: `/dashboard/profile/${connection.id}` },
    { name: "comparison", path: "/dashboard/analysis" },
    { name: "alerts", path: "/dashboard/alerts" },
    { name: "activity", path: "/dashboard/logs" },
  ];

  for (const scenario of scenarios) {
    active = scenario;
    for (const surface of surfaces) {
      await page.goto(surface.path);
      await page.evaluate(() => window.scrollTo(0, 0));
      const stamp = page.getByTestId(surface.name === "activity" ? "snapshot-stamp" : "global-data-status");
      await expect(stamp).toBeVisible();
      await expect(stamp).toHaveAttribute("data-snapshot-health", scenario.health);
      await expect(stamp).toHaveAttribute("data-language-message", scenario.messageKey);
      await expect(stamp).toHaveAttribute("data-next-action", scenario.nextAction);
      await expect(stamp.getByRole("link", { name: scenario.nextActionLabel })).toHaveAttribute("href", scenario.href);
      if (scenario.health === "never_synced") {
        await expect(stamp).toContainText("Período não registrado");
      } else {
        await expect(stamp).toContainText("20 de ago. de 2026 a 26 de ago. de 2026");
      }

      if (surface.name === "dashboard" && scenario.name === "stale") {
        await expect(page.getByText(`Diagnóstico vinculado ao snapshot ${snapshotFor(scenario).id.slice(0, 8)}.`)).toBeVisible();
      }
      if (scenario.name === "stale") {
        await stamp.screenshot({ path: `artifacts/product-audit-2026-08-26/evidence/0.5/stale-${surface.name}.png` });
        await page.screenshot({ path: `artifacts/product-audit-2026-08-26/evidence/0.5/stale-${surface.name}-page.png`, fullPage: false });
      }
    }

    await page.goto("/dashboard");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("global-data-status").screenshot({ path: `artifacts/product-audit-2026-08-26/evidence/0.5/${scenario.name}.png` });
  }
});
