import { expect, test, type Page } from "@playwright/test";

const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/4.1";

const scenarios = [
  {
    name: "healthy_recent",
    email: "qa.healthy_recent@example.com",
    health: "healthy",
    mode: "current",
    action: "keep_monitoring",
    valid: "24",
    saved: "24",
  },
  {
    name: "partial_run",
    email: "qa.partial_run@example.com",
    health: "degraded",
    mode: "historical",
    action: "review_partial_run",
    valid: "12",
    saved: "24",
  },
  {
    name: "never_synced",
    email: "qa.never_synced@example.com",
    health: "never_synced",
    mode: "unavailable",
    action: "start_first_sync",
    valid: "0",
    saved: "0",
  },
] as const;

async function loginThroughTheProduct(page: Page, email: string) {
  const unsafeApiRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith("/api/v1/")
      && !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes("/api/v1/auth/login"),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

test.describe("Synthetic QA accounts through the real local product", () => {
  test.describe.configure({ mode: "serial" });

  for (const scenario of scenarios) {
    test(`${scenario.name} logs in and exposes its frozen truth state`, async ({ page }) => {
      await loginThroughTheProduct(page, scenario.email);

      const stamp = page.getByTestId("global-data-status");
      await expect(stamp).toHaveAttribute("data-snapshot-health", scenario.health);
      await expect(stamp).toHaveAttribute("data-language-mode", scenario.mode);
      await expect(stamp).toHaveAttribute("data-next-action", scenario.action);
      await expect(stamp).toHaveAttribute("data-snapshot-valid-count", scenario.valid);
      await expect(stamp).toHaveAttribute("data-snapshot-saved-count", scenario.saved);

      await page.screenshot({
        path: `${evidenceDir}/${scenario.name}-dashboard.png`,
        fullPage: false,
      });
    });
  }
});
