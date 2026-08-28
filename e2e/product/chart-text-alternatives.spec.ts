import { expect, test, type Page } from "@playwright/test";

const email = "qa.healthy_recent@example.com";
const password = "QaSeed123!";

async function login(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status", { name: "Status global dos dados" })).toBeVisible();
  const declineCookies = page.getByRole("button", { name: /Recusar|Decline/ });
  if (await declineCookies.isVisible().catch(() => false)) {
    await declineCookies.click();
  }
}

async function expectEveryVisibleChartHasTextData(page: Page, minimumCharts: number) {
  const chartIds = await page.locator("[data-chart-visual]:visible").evaluateAll((elements) =>
    Array.from(new Set(elements.map((element) => element.getAttribute("data-chart-visual")).filter(Boolean))) as string[],
  );

  expect(chartIds.length).toBeGreaterThanOrEqual(minimumCharts);

  const unwrappedApplications = await page.locator('[role="application"]:visible').evaluateAll((elements) =>
    elements.filter((element) => !element.closest("[data-chart-visual]")).length,
  );
  expect(unwrappedApplications).toBe(0);

  for (const chartId of chartIds) {
    const alternative = page.locator(`[data-chart-alternative-for="${chartId}"]`);
    await expect(alternative, `${chartId} needs one text alternative`).toHaveCount(1);
    await expect(alternative.getByTestId(`${chartId}-summary`)).not.toHaveText("");
    await expect(alternative.getByTestId(`${chartId}-period`)).not.toHaveText("");
    await expect(alternative.getByTestId(`${chartId}-unit`)).not.toHaveText("");

    const details = alternative.getByTestId(`${chartId}-data-details`);
    await details.locator("summary").click();
    const table = alternative.getByTestId(`${chartId}-data-table`);
    await expect(table).toBeVisible();
    expect(await table.locator("thead th").count()).toBeGreaterThanOrEqual(2);
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);
  }
}

test("decisions and exact chart values remain available without reading color or geometry", async ({ page }) => {
  test.setTimeout(60_000);

  const pageErrors: string[] = [];
  const failedApiResponses: string[] = [];
  const mutations: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await login(page);
  await expect(page.getByTestId("dashboard-score-trend-text-alternative")).toBeVisible();

  const trendSummary = page.getByTestId("dashboard-score-trend-summary");
  await expect(trendSummary).toContainText(/caiu \d+(?:,\d+)? pontos, de \d+(?:,\d+)? para \d+(?:,\d+)?/);
  await expectEveryVisibleChartHasTextData(page, 7);
  await expect(page.getByTestId("dashboard-emotion-radar-summary")).toContainText("Maior valor no período: Confiança, com 100%.");
  await expect(page.getByTestId("dashboard-activity-heatmap-summary")).toContainText("1 comentário");

  const trendTable = page.getByTestId("dashboard-score-trend-data-table");
  await expect(trendTable.getByRole("columnheader", { name: "Período" })).toBeVisible();
  await expect(trendTable.getByRole("columnheader", { name: "Score" })).toBeVisible();
  await expect(trendTable.locator("tbody tr")).toHaveCount(2);
  const firstScore = Number(
    (await trendTable.locator("tbody tr").first().locator("td").nth(1).innerText()).replace(",", "."),
  );
  const lastScore = Number(
    (await trendTable.locator("tbody tr").last().locator("td").nth(1).innerText()).replace(",", "."),
  );
  const scoreDrop = firstScore - lastScore;
  expect(scoreDrop).toBeGreaterThan(0);
  const ptNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const enNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  await expect(trendSummary).toContainText(
    `caiu ${ptNumber.format(scoreDrop)} pontos, de ${ptNumber.format(firstScore)} para ${ptNumber.format(lastScore)}`,
  );

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(trendSummary).toContainText(
    `fell ${enNumber.format(scoreDrop)} points, from ${enNumber.format(firstScore)} to ${enNumber.format(lastScore)}`,
  );
  await page.getByRole("button", { name: "PT", exact: true }).click();
  await expect(trendSummary).toContainText(`caiu ${ptNumber.format(scoreDrop)} pontos`);

  const profileHref = await page.locator('a[href*="/dashboard/profile/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();

  await page.goto("/dashboard/analysis");
  await expect(page.getByTestId("comparison-score-trend-text-alternative")).toBeVisible();
  await expect(page.getByTestId("comparison-score-trend-summary")).toContainText(`caiu ${ptNumber.format(scoreDrop)} pontos`);
  await expectEveryVisibleChartHasTextData(page, 2);

  await page.goto(profileHref!);
  await expect(page.getByTestId("profile-temporal-volume-text-alternative")).toBeVisible();
  await expectEveryVisibleChartHasTextData(page, 6);

  const temporalCard = page.getByRole("heading", { name: "Análise Temporal", exact: true }).locator("xpath=../../..");
  await temporalCard.getByRole("button", { name: "Score", exact: true }).click();
  await expect(page.getByTestId("profile-temporal-score-summary")).toContainText(`caiu ${ptNumber.format(scoreDrop)} pontos`);
  await temporalCard.getByRole("button", { name: "Sentimento", exact: true }).click();
  await expect(page.getByTestId("profile-temporal-sentiment-data-table")).toHaveCount(1);
  await temporalCard.getByRole("button", { name: "Emoções", exact: true }).click();
  await expect(page.getByTestId("profile-temporal-emotions-data-table")).toHaveCount(1);
  await temporalCard.getByRole("button", { name: "Tópicos", exact: true }).click();
  await expect(page.getByTestId("profile-temporal-topics-data-table")).toHaveCount(1);

  const postHref = await page.locator('a[href*="/dashboard/post/"]').first().getAttribute("href");
  expect(postHref).toBeTruthy();
  await page.goto(postHref!);
  await expect(page.getByTestId("post-emotion-radar-text-alternative")).toBeVisible();
  await expect(page.getByTestId("post-word-cloud-text-alternative")).toBeVisible();
  await expectEveryVisibleChartHasTextData(page, 2);

  expect(pageErrors).toEqual([]);
  expect(failedApiResponses).toEqual([]);
  expect(mutations).toEqual(["POST /api/v1/auth/login"]);
});
