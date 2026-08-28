import { expect, test, type Page } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/2.5";
const connectionAId = "00000000-0000-0000-0000-000000000251";
const connectionBId = "00000000-0000-0000-0000-000000000252";

const snapshot = {
  id: "00000000-0000-0000-0000-000000000255",
  user_id: "00000000-0000-0000-0000-000000000001",
  trigger_run_id: "00000000-0000-0000-0000-000000000901",
  schema_version: 1,
  period_start: "2026-08-03T00:00:00Z",
  period_end: "2026-08-24T23:59:59Z",
  last_attempt_at: "2026-08-26T10:00:00Z",
  last_success_at: "2026-08-26T10:00:00Z",
  source_platforms: ["instagram", "youtube"],
  profiles: [
    { connection_id: connectionAId, platform: "instagram", username: "mesmo-handle" },
    { connection_id: connectionBId, platform: "youtube", username: "mesmo-handle" },
  ],
  found_count: 80,
  eligible_count: 80,
  collected_count: 80,
  saved_count: 80,
  analyzed_count: 80,
  valid_count: 80,
  ignored_count: 0,
  coverage: { status: "complete", ratio: 1, reason_code: "complete_window" },
  health: "healthy",
  reason_code: "healthy",
  metrics: {
    global: {
      valid_count: 80,
      avg_score: 6.1,
      sentiment_distribution: { positive: 40, neutral: 20, negative: 20 },
    },
  },
  content_hash: "5".repeat(64),
  created_at: "2026-08-26T10:00:00Z",
  language_policy: {
    policy_version: 1,
    mode: "current",
    message_key: "current",
    health: "healthy",
    reason_code: "healthy",
    coverage_status: "complete",
    pipeline_status: "completed",
    present_tense_allowed: true,
    current_trend_allowed: true,
    no_alerts_claim_allowed: true,
    crisis_claim_allowed: true,
    action_mode: "operational",
    required_qualifier: null,
    forbidden_claims: [],
    next_action: { code: "keep_monitoring", href: "/dashboard", priority: "low" },
  },
};

const connections = [
  {
    id: connectionAId,
    platform: "instagram",
    username: "mesmo-handle",
    display_name: "Mesmo Handle no Instagram",
    profile_image_url: null,
    followers_count: 1200,
    status: "active",
    connected_at: "2026-08-01T10:00:00Z",
    last_sync_at: "2026-08-26T10:00:00Z",
    auto_sync: true,
  },
  {
    id: connectionBId,
    platform: "youtube",
    username: "mesmo-handle",
    display_name: "Mesmo Handle no YouTube",
    profile_image_url: null,
    followers_count: 900,
    status: "active",
    connected_at: "2026-08-01T10:00:00Z",
    last_sync_at: "2026-08-26T10:00:00Z",
    auto_sync: true,
  },
];

const trendA = [
  { period: "2026-08-17", avg_score: 7, positive: 7, neutral: 2, negative: 1, total_comments: 10, total_likes: 20 },
  { period: "2026-08-03", avg_score: 5, positive: 5, neutral: 3, negative: 2, total_comments: 10, total_likes: 10 },
  { period: "2026-08-10", avg_score: 6, positive: 6, neutral: 2, negative: 2, total_comments: 10, total_likes: 15 },
  { period: "2026-08-10", avg_score: 6, positive: 6, neutral: 2, negative: 2, total_comments: 10, total_likes: 15 },
];

const trendB = [
  { period: "2026-08-24", avg_score: 8, positive: 8, neutral: 1, negative: 1, total_comments: 10, total_likes: 25 },
  { period: "2026-08-10", avg_score: 4, positive: 4, neutral: 3, negative: 3, total_comments: 10, total_likes: 12 },
  { period: "2026-08-03", avg_score: 3, positive: 3, neutral: 3, negative: 4, total_comments: 10, total_likes: 8 },
];

async function installFixture(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "timeline-fixture-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown;

    if (path.endsWith("/auth/me")) {
      body = {
        id: snapshot.user_id,
        email: "qa-timeline@example.invalid",
        name: "QA Timeline",
        avatar_url: null,
        plan: "pro",
        email_verified: true,
        onboarding_data: { profile_type: "brand", main_goal: "benchmark" },
      };
    } else if (path.endsWith("/billing/credits")) {
      body = {
        plan_credits: 20000,
        pack_credits: 0,
        total: 20000,
        plan: "pro",
        packs: [],
        collection_limits: { max_posts_per_sync: 200, max_comments_per_post: 2000, sync_frequency: "weekly" },
      };
    } else if (path.endsWith("/connections")) {
      body = connections;
    } else if (path.endsWith("/data-snapshots/latest")) {
      body = snapshot;
    } else if (path.endsWith("/dashboard/compare-connections")) {
      const requestedIds = (url.searchParams.get("connection_ids") ?? "").split(",");
      body = {
        snapshot,
        days: Number(url.searchParams.get("days") ?? 0),
        connections: connections
          .filter(connection => requestedIds.includes(connection.id))
          .map((connection, index) => {
            const isProfileA = connection.id === connectionAId;
            const savedCount = isProfileA ? 40 : 20;
            const validCount = isProfileA ? 31 : 12;
            return ({
            connection_id: connection.id,
            platform: connection.platform,
            username: connection.username,
            display_name: connection.display_name,
            profile_image_url: null,
            total_comments: savedCount,
            total_analyzed: validCount,
            saved_count: savedCount,
            valid_count: validCount,
            observed_period_start: "2026-08-03T00:00:00Z",
            observed_period_end: isProfileA ? "2026-08-17T23:59:59Z" : "2026-08-24T23:59:59Z",
            avg_score: index === 0 ? 6 : 5,
            avg_polarity: index === 0 ? 0.2 : 0.1,
            sentiment_distribution: { positive: 20, neutral: 10, negative: 10 },
            positive_rate: 50,
            negative_rate: 25,
            emotions_distribution: {},
            health: {
              state: isProfileA ? "healthy" : "stale",
              reason_code: isProfileA ? "healthy" : "last_success_outside_sla",
              reason_codes: [isProfileA ? "healthy" : "last_success_outside_sla"],
              freshness_sla_hours: 36,
              last_attempt_at: isProfileA ? "2026-08-26T08:00:00Z" : "2026-08-20T08:00:00Z",
              last_attempt_status: "completed",
              last_success_at: isProfileA ? "2026-08-26T08:00:00Z" : "2026-08-20T08:00:00Z",
              fresh_until: isProfileA ? "2026-08-27T20:00:00Z" : "2026-08-21T20:00:00Z",
              data_age_hours: isProfileA ? 2 : 146,
              is_syncing: false,
              sync_frequency: "daily",
              next_scheduled_at: "2026-08-27T03:15:00Z",
            },
          }); }),
        generated_at: "2026-08-26T10:00:00Z",
      };
    } else if (path.endsWith("/dashboard/compare-radar")) {
      body = { connections: [] };
    } else if (path.endsWith("/dashboard/insights")) {
      body = null;
    } else if (path.endsWith("/dashboard/trends")) {
      const points = url.searchParams.get("connection_id") === connectionAId ? trendA : trendB;
      body = { data_points: points, granularity: "week", timezone: "UTC" };
    } else {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("comparison normalizes an out-of-order weekly timeline in explicit UTC", async ({ page }) => {
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await installFixture(page);
  await page.goto("/dashboard/analysis");

  await expect(page.getByRole("heading", { name: "Análise Comparativa" })).toBeVisible();
  await page.locator("select").nth(1).selectOption(connectionBId);

  const trendHeading = page.getByRole("heading", { name: "Tendência do Score" });
  await expect(trendHeading).toBeVisible();
  const trendSection = trendHeading.locator("xpath=../../..");
  await trendSection.scrollIntoViewIfNeeded();

  const chart = page.getByTestId("comparison-score-trend");
  await expect(chart).toHaveAttribute("data-timezone", "UTC");
  await expect(chart).toHaveAttribute("data-period-count", "4");
  await expect(chart).toHaveAttribute(
    "data-periods",
    "2026-08-03,2026-08-10,2026-08-17,2026-08-24",
  );
  await expect(chart).toContainText("Cada ponto representa o início da semana (segunda-feira), em UTC.");

  const ticks = await chart.locator("svg text.recharts-cartesian-axis-tick-value").allTextContents();
  expect(ticks.filter(value => value.includes("/"))).toEqual(["03/08", "10/08", "17/08", "24/08"]);
  const lines = chart.locator(".recharts-line-curve");
  await expect(lines).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    expect((await lines.nth(index).getAttribute("d"))?.length).toBeGreaterThan(20);
  }

  await trendSection.screenshot({ path: `${evidenceDir}/after-ordered-utc-timeline.png`, animations: "disabled" });
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("same handle on two platforms remains identifiable without the profile cards", async ({ page }) => {
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await installFixture(page);
  await page.goto("/dashboard/analysis");
  await page.locator("select").nth(1).selectOption(connectionBId);

  const cards = page.getByTestId("comparison-profile-cards");
  await expect(cards).toBeVisible();
  await cards.evaluate(element => { (element as HTMLElement).style.display = "none"; });
  await expect(cards).toBeHidden();
  const trendHeading = page.getByRole("heading", { name: "Tendência do Score" });
  await expect(trendHeading).toBeVisible();
  const trendSection = trendHeading.locator("xpath=../../..");
  await trendSection.scrollIntoViewIfNeeded();

  const legend = page.getByTestId("comparison-series-legend");
  await expect(legend).toBeVisible();
  const seriesA = page.getByTestId(`comparison-series-${connectionAId}`);
  const seriesB = page.getByTestId(`comparison-series-${connectionBId}`);
  await expect(seriesA).toHaveAttribute("data-platform", "instagram");
  await expect(seriesA).toHaveAttribute("data-username", "mesmo-handle");
  await expect(seriesA).toHaveAttribute("data-valid-count", "31");
  await expect(seriesA).toHaveAttribute("data-saved-count", "40");
  await expect(seriesA).toHaveAttribute("data-health-state", "healthy");
  await expect(seriesA).toContainText("Instagram · @mesmo-handle");
  await expect(seriesA).toContainText("31 análises válidas de 40 comentários salvos neste período.");
  await expect(seriesA).toContainText("Dados em dia");
  await expect(seriesA).toContainText("Último sucesso de coleta e análise");

  await expect(seriesB).toHaveAttribute("data-platform", "youtube");
  await expect(seriesB).toHaveAttribute("data-username", "mesmo-handle");
  await expect(seriesB).toHaveAttribute("data-valid-count", "12");
  await expect(seriesB).toHaveAttribute("data-saved-count", "20");
  await expect(seriesB).toHaveAttribute("data-health-state", "stale");
  await expect(seriesB).toContainText("YouTube · @mesmo-handle");
  await expect(seriesB).toContainText("12 análises válidas de 20 comentários salvos neste período.");
  await expect(seriesB).toContainText("Desatualizada");

  const denominatorNote = page.getByTestId("comparison-series-denominator-note");
  await expect(denominatorNote).toContainText("As séries usam bases diferentes.");
  await expect(page.getByTestId("comparison-score-trend").locator(".recharts-line-curve")).toHaveCount(2);
  await trendSection.screenshot({ path: "artifacts/product-audit-2026-08-26/evidence/2.6/after-series-identity-with-cards-hidden.png", animations: "disabled" });
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
