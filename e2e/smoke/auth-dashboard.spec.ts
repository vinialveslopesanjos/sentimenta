import { expect, type APIRequestContext, test } from "@playwright/test";

const apiURL = process.env.API_URL || "http://127.0.0.1:8000";
const email = process.env.E2E_EMAIL || "e2e-seed@example.com";
const password = process.env.E2E_PASSWORD || "SeedPassword123!";

async function login(request: APIRequestContext) {
  const response = await request.post(`${apiURL}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.access_token).toBeTruthy();
  return body.access_token as string;
}

test.describe("Auth and dashboard smoke", () => {
  test("seed user can authenticate and read dashboard summary", async ({ request }) => {
    const token = await login(request);
    const summary = await request.get(`${apiURL}/api/v1/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(summary.status()).toBe(200);
    const body = await summary.json();
    expect(body.total_connections).toBeGreaterThanOrEqual(1);
    expect(body.total_posts).toBeGreaterThanOrEqual(1);
    expect(body.total_analyzed).toBeGreaterThanOrEqual(3);
    expect(body.avg_score).toBeGreaterThan(0);
  });

  test("login screen renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (text.includes("upgrade-insecure-requests") && text.includes("report-only policy")) return;
      errors.push(text);
    });
    await page.goto("/login");
    await expect(page.locator("input[type='email']").first()).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("protected dashboard can render with seeded token", async ({ page, request }) => {
    const token = await login(request);
    await page.goto("/login");
    await page.evaluate((value) => {
      localStorage.setItem("sentiment_access_token", value);
    }, token);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    await expect(page.locator("body")).toContainText(/Sentimenta|Dashboard|Reput/i);
  });
});
