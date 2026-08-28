import { expect, test, type Page } from "@playwright/test";

const snapshot = {
  id: "11111111-2222-4333-8444-555555555555",
  user_id: "00000000-0000-0000-0000-000000000001",
  trigger_run_id: "00000000-0000-0000-0000-000000000901",
  schema_version: 1,
  period_start: "2026-08-22T09:00:00Z",
  period_end: "2026-08-26T09:00:00Z",
  last_attempt_at: "2026-08-26T10:00:00Z",
  last_success_at: "2026-08-26T10:00:00Z",
  source_platforms: ["youtube"],
  profiles: [{ connection_id: "00000000-0000-0000-0000-000000000101", platform: "youtube", username: "perfil-snapshot" }],
  found_count: 5,
  eligible_count: 5,
  collected_count: 5,
  saved_count: 5,
  analyzed_count: 5,
  valid_count: 5,
  ignored_count: 0,
  coverage: { status: "unknown", ratio: null, reason_code: "expected_window_not_recorded" },
  health: "healthy",
  reason_code: "healthy",
  metrics: {
    global: {
      valid_count: 5,
      avg_score: 6.2,
      sentiment_distribution: { positive: 3, neutral: 1, negative: 1 },
    },
  },
  content_hash: "a".repeat(64),
  created_at: "2026-08-26T10:00:00Z",
  language_policy: {
    policy_version: 1,
    mode: "qualified",
    message_key: "healthy_limited_coverage",
    health: "healthy",
    reason_code: "healthy",
    coverage_status: "unknown",
    pipeline_status: "completed",
    present_tense_allowed: false,
    current_trend_allowed: false,
    no_alerts_claim_allowed: false,
    crisis_claim_allowed: false,
    action_mode: "exploratory_only",
    required_qualifier: "observed_data_only",
    forbidden_claims: ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
    next_action: { code: "review_coverage", href: "/dashboard/logs", priority: "medium" },
  },
};

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "qa-snapshot@example.invalid",
  name: "QA Snapshot",
  avatar_url: null,
  plan: "pro",
  email_verified: true,
  onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" },
};

const connection = {
  id: "00000000-0000-0000-0000-000000000101",
  platform: "youtube",
  username: "perfil-snapshot",
  display_name: "Perfil de snapshot",
  profile_url: "https://youtube.com/@perfil-snapshot",
  profile_image_url: null,
  followers_count: 1234,
  following_count: 0,
  media_count: 1,
  status: "active",
  connected_at: "2026-08-01T12:00:00Z",
  last_sync_at: "2026-08-26T10:00:00Z",
  persona: null,
  health: {
    state: "healthy",
    reason_code: "healthy",
    reason_codes: ["healthy"],
    freshness_sla_hours: 36,
    last_attempt_at: "2026-08-26T10:00:00Z",
    last_attempt_status: "completed",
    last_success_at: "2026-08-26T10:00:00Z",
    fresh_until: "2026-08-27T22:00:00Z",
    data_age_hours: 0,
    is_syncing: false,
  },
};

const summary = {
  snapshot,
  total_connections: 1,
  total_posts: 1,
  total_comments: 5,
  total_analyzed: 5,
  avg_score: 6.2,
  avg_polarity: 0.2,
  sentiment_distribution: { positive: 3, neutral: 1, negative: 1 },
  emotions_distribution: null,
  topics_frequency: null,
  word_frequency: null,
  recent_posts: [],
  connections: [connection],
};

async function installFixture(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-snapshot-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown;

    if (path.endsWith("/auth/me")) body = user;
    else if (path.endsWith("/billing/credits")) {
      body = { plan_credits: 20000, pack_credits: 0, total: 20000, plan: "pro", packs: [] };
    } else if (path.endsWith("/connections")) body = [connection];
    else if (path.endsWith("/data-snapshots/latest")) body = snapshot;
    else if (path.endsWith("/dashboard/summary")) body = summary;
    else if (path.endsWith("/dashboard/health-report")) {
      body = {
        snapshot,
        report_basis: {
          contract_version: 1,
          snapshot_id: snapshot.id,
          period_start: snapshot.period_start,
          period_end: snapshot.period_end,
          coverage_status: snapshot.coverage.status,
          coverage_ratio: snapshot.coverage.ratio,
          health: snapshot.health,
          language_mode: snapshot.language_policy.mode,
          recommendation_mode: "historical_only",
          reason_code: snapshot.reason_code,
          generated_at: null,
          source: "none",
        },
        report_text: null,
        generated_at: null,
        data_summary: {},
        has_new_data: false,
      };
    } else if (path.endsWith("/dashboard/compare-connections")) {
      body = {
        snapshot,
        days: Number(url.searchParams.get("days") ?? 0),
        connections: [{
          connection_id: connection.id,
          platform: connection.platform,
          username: connection.username,
          display_name: connection.display_name,
          profile_image_url: null,
          total_comments: 5,
          total_analyzed: 5,
          avg_score: 6.2,
          avg_polarity: 0.2,
          sentiment_distribution: { positive: 3, neutral: 1, negative: 1 },
          positive_rate: 60,
          negative_rate: 20,
          emotions_distribution: {},
        }],
        generated_at: "2026-08-26T10:00:00Z",
      };
    } else {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("dashboard and comparison expose the same immutable score basis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await installFixture(page);

  await page.goto("/dashboard");
  const dashboardStamp = page.getByTestId("global-data-status");
  await expect(dashboardStamp).toBeVisible();
  await expect(dashboardStamp).toHaveAttribute("data-snapshot-id", snapshot.id);
  await expect(dashboardStamp).toHaveAttribute("data-snapshot-score", "6.2");
  await expect(dashboardStamp).toHaveAttribute("data-snapshot-valid-count", "5");
  await expect(dashboardStamp).toHaveAttribute("data-snapshot-saved-count", "5");
  await expect(dashboardStamp).toContainText("22 de ago. de 2026 a 26 de ago. de 2026");
  await expect(dashboardStamp).toContainText("5 válidos de 5 salvos");
  await expect(dashboardStamp).toContainText("26 de ago. de 2026, 10:00");
  await dashboardStamp.screenshot({
    path: "artifacts/product-audit-2026-08-26/evidence/0.2/dashboard-snapshot.png",
  });

  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/analysis$/);
  const comparisonStamp = page.getByTestId("global-data-status");
  await expect(comparisonStamp).toBeVisible();
  for (const [name, value] of [
    ["data-snapshot-id", snapshot.id],
    ["data-snapshot-score", "6.2"],
    ["data-snapshot-valid-count", "5"],
    ["data-snapshot-saved-count", "5"],
  ] as const) {
    await expect(comparisonStamp).toHaveAttribute(name, value);
  }
  await expect(comparisonStamp).toContainText("22 de ago. de 2026 a 26 de ago. de 2026");
  await expect(comparisonStamp).toContainText("5 válidos de 5 salvos");
  await comparisonStamp.screenshot({
    path: "artifacts/product-audit-2026-08-26/evidence/0.2/comparison-snapshot.png",
  });
});
