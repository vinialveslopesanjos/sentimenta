import { expect, test, type Locator, type Page } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/2.4";
const platforms = ["instagram", "youtube", "tiktok", "twitter"] as const;
const surfaces = ["home", "dashboard", "profiles", "settings"] as const;

type Surface = typeof surfaces[number];
type CapabilitySignature = Record<string, {
  status: string | null;
  posts: string | null;
  comments: string | null;
  history: string | null;
  frequency: string | null;
}>;

async function readSignature(matrix: Locator, surface: Surface): Promise<CapabilitySignature> {
  const signature: CapabilitySignature = {};
  for (const platform of platforms) {
    const row = matrix.getByTestId(`platform-capability-${surface}-${platform}`);
    await expect(row).toBeVisible();
    signature[platform] = {
      status: await row.getAttribute("data-status"),
      posts: await row.getAttribute("data-posts"),
      comments: await row.getAttribute("data-comments"),
      history: await row.getAttribute("data-history"),
      frequency: await row.getAttribute("data-frequency"),
    };
  }
  return signature;
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("qa.healthy_recent@example.com");
  await page.locator('input[type="password"]').fill("QaSeed123!");
  const loginResponse = page.waitForResponse(response => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });
}

test("home, dashboard, profiles and settings publish one platform capability contract", async ({ page }) => {
  test.setTimeout(120_000);
  const unsafeApiRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];
  const signatures: Partial<Record<Surface, CapabilitySignature>> = {};

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });

  page.on("request", request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  const homeMatrix = page.getByTestId("platform-capability-matrix-home");
  await homeMatrix.scrollIntoViewIfNeeded();
  signatures.home = await readSignature(homeMatrix, "home");
  await expect(page.getByTestId("platform-capability-option-home-twitter")).toBeDisabled();
  await expect(page.getByTestId("platform-capability-option-home-twitter")).toHaveAttribute("data-status", "planned");
  await expect(page.getByTestId("platform-capability-option-home-tiktok")).toContainText("Beta");
  await expect(page.getByText("A cada hora", { exact: true })).toHaveCount(0);
  await homeMatrix.screenshot({ path: `${evidenceDir}/after-home-matrix.png`, animations: "disabled" });

  await login(page);

  const dashboardMatrix = page.getByTestId("platform-capability-matrix-dashboard");
  await dashboardMatrix.scrollIntoViewIfNeeded();
  signatures.dashboard = await readSignature(dashboardMatrix, "dashboard");
  await dashboardMatrix.screenshot({ path: `${evidenceDir}/after-dashboard-matrix.png`, animations: "disabled" });

  await page.goto("/dashboard/connect");
  const profilesMatrix = page.getByTestId("platform-capability-matrix-profiles");
  await profilesMatrix.scrollIntoViewIfNeeded();
  signatures.profiles = await readSignature(profilesMatrix, "profiles");
  const twitterCard = page.getByTestId("connect-platform-twitter");
  await expect(twitterCard).toHaveAttribute("data-status", "planned");
  await expect(twitterCard).toContainText("Planejado");
  await expect(twitterCard.getByRole("button")).toBeDisabled();
  await profilesMatrix.screenshot({ path: `${evidenceDir}/after-profiles-matrix.png`, animations: "disabled" });

  await page.goto("/dashboard/settings?tab=integrations");
  const settingsMatrix = page.getByTestId("platform-capability-matrix-settings");
  await settingsMatrix.scrollIntoViewIfNeeded();
  signatures.settings = await readSignature(settingsMatrix, "settings");
  await settingsMatrix.screenshot({ path: `${evidenceDir}/after-settings-matrix.png`, animations: "disabled" });

  const canonical = signatures.home;
  expect(canonical).toEqual({
    instagram: { status: "available", posts: "supported", comments: "supported", history: "start_date", frequency: "plan_schedule" },
    youtube: { status: "available", posts: "supported", comments: "supported", history: "recent_only", frequency: "plan_schedule" },
    tiktok: { status: "beta", posts: "beta", comments: "beta", history: "recent_only", frequency: "plan_schedule" },
    twitter: { status: "planned", posts: "unavailable", comments: "unavailable", history: "unavailable", frequency: "unavailable" },
  });
  for (const surface of surfaces.slice(1)) {
    expect(signatures[surface]).toEqual(canonical);
  }

  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
