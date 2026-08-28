import { expect, test, type Page, type Route } from "@playwright/test";

const evidence22 = "artifacts/product-audit-2026-08-26/evidence/2.2";
const evidence23 = "artifacts/product-audit-2026-08-26/evidence/2.3";

async function login(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
    window.localStorage.removeItem("sentimenta.sync.settings.v3");
    window.localStorage.removeItem("sentimenta.sync.settings.v4");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("qa.healthy_recent@example.com");
  await page.locator('input[type="password"]').fill("QaSeed123!");
  const loginResponse = page.waitForResponse(response => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });
}

async function respondWithPublicInstagramConnection(route: Route) {
  const response = await route.fetch();
  const connections = await response.json();
  await route.fulfill({
    response,
    json: connections.map((connection: Record<string, unknown>, index: number) => index === 0
      ? {
          ...connection,
          platform: "instagram",
          username: "qa-metodo-publico",
          display_name: "Fixture de método público",
          has_oauth_token: false,
          media_count: 1,
        }
      : connection),
  });
}

function forecastFor(url: string) {
  const query = new URL(url).searchParams;
  const engagement = query.get("comment_selection_mode") === "engagement";
  const periodApplied = Boolean(query.get("since_date"));
  const found = periodApplied ? 300 : 1000;
  const selected = engagement ? Math.min(found, 200) : found;
  const costMin = periodApplied ? 1.05 : engagement ? 3.5 : 4;
  const costMax = periodApplied ? 4.6 : engagement ? 14.4 : 16;

  return {
    model_version: "2026-08-28-e2e",
    selection_mode: engagement ? "engagement" : "all",
    engagement_priority_max_per_post: 200,
    target_profiles: 1,
    selection_applies_to_profiles: engagement ? 1 : 0,
    requested_posts_per_profile: Number(query.get("max_posts")),
    requested_comments_per_post: Number(query.get("max_comments_per_post")),
    request_comment_ceiling: Number(query.get("max_posts")) * Number(query.get("max_comments_per_post")),
    observed_posts: 1,
    requested_post_slots: 1,
    posts_with_known_counts: 1,
    found_status: "complete",
    found_known_comments: found,
    last_observed_at: "2026-08-28T12:00:00Z",
    estimated_candidate_comments_known: found,
    estimated_candidate_comments_max: found,
    estimated_selected_comments_known: selected,
    estimated_selected_comments_max: selected,
    estimated_analyzed_comments_max: selected,
    estimated_coverage_pct: Number(((selected / found) * 100).toFixed(1)),
    available_credits: 20_000,
    operational_cost_brl_min: costMin,
    operational_cost_brl_max: costMax,
    duration_minutes_min: periodApplied ? 2 : 3,
    duration_minutes_max: periodApplied ? 6 : 10,
    forecast_confidence: "medium",
    fixed_costs_included: false,
    explanation_codes: engagement
      ? ["engagement_is_biased", "engagement_does_not_reduce_candidate_fetch"]
      : ["last_observed_not_live"],
  };
}

test("changing method and period recalculates an honest forecast without starting collection", async ({ page }) => {
  test.setTimeout(90_000);
  const mutatingRequests: string[] = [];
  const failedResponses: string[] = [];
  const pageErrors: string[] = [];

  await page.route(/\/api\/v1\/connections$/, respondWithPublicInstagramConnection);
  await page.route(/\/api\/v1\/connections\/collection-preview\?/, async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(forecastFor(route.request().url())) });
  });

  page.on("request", request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutatingRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await login(page);
  await page.goto("/dashboard/connect");
  await expect(page.getByTestId("collection-plan-limits")).toContainText("2.000 comentários por post", { timeout: 15_000 });
  await page.getByTestId("collection-settings-toggle").click();
  await page.getByTestId("collection-post-limit").selectOption("20");
  await page.getByTestId("collection-comment-limit-plan").click();

  await page.getByTestId("collection-mode-all").click();
  await expect(page.getByTestId("collection-forecast")).toHaveAttribute("data-forecast-version", "2026-08-28-e2e");
  await expect(page.getByTestId("forecast-found")).toContainText("1.000 na última contagem");
  await expect(page.getByTestId("forecast-analyzed")).toContainText("até 1.000 comentários");
  await expect(page.getByTestId("forecast-coverage")).toContainText("100% da última contagem conhecida");
  await expect(page.getByTestId("forecast-cost")).toContainText("R$ 4,00–R$ 16,00");
  await page.getByTestId("collection-settings-panel").screenshot({
    path: `${evidence22}/all-within-limit.png`,
    animations: "disabled",
  });

  await page.getByTestId("collection-mode-engagement").click();
  await expect(page.getByTestId("collection-mode-description")).toContainText("favorece comentários populares");
  await expect(page.getByTestId("collection-mode-description")).toContainText("não é amostra estatística");
  await expect(page.getByTestId("forecast-candidates")).toContainText("até 1.000 comentários");
  await expect(page.getByTestId("forecast-analyzed")).toContainText("até 200 comentários");
  await expect(page.getByTestId("forecast-coverage")).toContainText("20% da última contagem conhecida");
  await expect(page.getByTestId("forecast-explanation")).toContainText("priorizados por curtidas");
  await expect(page.getByTestId("forecast-explanation")).toContainText("não cobrança");
  await page.getByTestId("collection-settings-panel").screenshot({
    path: `${evidence22}/engagement-bias.png`,
    animations: "disabled",
  });

  await page.getByTestId("collection-since-date").fill("2026-08-20");
  await expect(page.getByTestId("forecast-found")).toContainText("300 na última contagem");
  await expect(page.getByTestId("forecast-candidates")).toContainText("até 300 comentários");
  await expect(page.getByTestId("forecast-cost")).toContainText("R$ 1,05–R$ 4,60");
  await expect(page.getByTestId("forecast-duration")).toContainText("2–6 min · não é SLA");
  await expect(page.getByTestId("forecast-explanation")).toContainText("data inicial pode reduzir os posts do Instagram");
  await page.getByTestId("collection-settings-panel").screenshot({
    path: `${evidence23}/period-changes-forecast.png`,
    animations: "disabled",
  });

  expect(mutatingRequests).toEqual(["POST /api/v1/auth/login"]);
  expect(failedResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
