import { expect, test, type Page } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.8";
const connectionId = "6b679ae4-8837-5124-be3a-f50c8ccadbef";
const postId = "3180628a-7c50-5b02-b5d8-b6d07c2ed1fb";
const profilePath = `/dashboard/profile/${connectionId}`;
const postPath = `/dashboard/post/${postId}`;

async function login(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("qa.healthy_recent@example.com");
  await page.locator('input[type="password"]').fill("QaSeed123!");
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });
}

async function expectPostReady(page: Page) {
  await expect(page.getByTestId("post-load-error")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Conteúdo sintético: Saudável e recente/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("post-comments-evidence")).toContainText("24 comentários coletados vinculados a este post");
  await expect(page.locator("[data-testid='post-comments-evidence'] tbody tr")).toHaveCount(20);
  await expect(page.getByTestId("post-profile-link")).toHaveAttribute("href", profilePath);
}

test("every main card drills down to the exact profile, post and comment evidence", async ({ page }) => {
  test.setTimeout(90_000);
  const unsafeApiRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await login(page);
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);

  const compactProfileCard = page.getByTestId(`dashboard-connected-profile-${connectionId}`);
  await compactProfileCard.scrollIntoViewIfNeeded();
  await expect(compactProfileCard).toHaveAttribute("href", profilePath);
  await compactProfileCard.click();
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`));
  await expect(page.getByTestId("profile-reputation-summary")).toBeVisible({ timeout: 15_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });

  const healthProfileCard = page.getByTestId(`dashboard-profile-health-${connectionId}`);
  await healthProfileCard.scrollIntoViewIfNeeded();
  await expect(healthProfileCard).toHaveAttribute("href", profilePath);
  await healthProfileCard.screenshot({ path: `${evidenceDir}/after-dashboard-exact-profile-links.png`, animations: "disabled" });
  await healthProfileCard.click();
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`));
  await expect(page.getByTestId("profile-reputation-summary")).toBeVisible({ timeout: 15_000 });

  const profilePost = page.getByTestId(`profile-post-${postId}`);
  await profilePost.scrollIntoViewIfNeeded();
  await expect(profilePost).toHaveAttribute("href", `${postPath}?from=profile&connection_id=${connectionId}`);
  await page.screenshot({ path: `${evidenceDir}/after-profile-post-link.png`, fullPage: false, animations: "disabled" });
  const profilePostResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/posts/${postId}`));
  await profilePost.click();
  expect((await profilePostResponse).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${postPath.replaceAll("/", "\\/")}\\?from=profile&connection_id=${connectionId}$`));
  await expectPostReady(page);
  await expect(page.getByTestId("post-context-back")).toHaveAttribute("href", profilePath);
  await page.screenshot({ path: `${evidenceDir}/after-post-detail.png`, fullPage: false, animations: "disabled" });

  await page.getByTestId("post-comments-evidence-trigger").click();
  await expect(page.getByTestId("post-comments-evidence")).toBeFocused();
  await page.screenshot({ path: `${evidenceDir}/after-comments-evidence.png`, fullPage: false, animations: "disabled" });

  const refreshResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/posts/${postId}`));
  await page.reload();
  expect((await refreshResponse).status()).toBe(200);
  await expectPostReady(page);
  await page.screenshot({ path: `${evidenceDir}/after-refresh.png`, fullPage: false, animations: "disabled" });

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`));
  await expect(page.getByTestId(`profile-post-${postId}`)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${evidenceDir}/after-browser-back-profile.png`, fullPage: false, animations: "disabled" });

  const directResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/posts/${postId}`));
  await page.goto(postPath);
  expect((await directResponse).status()).toBe(200);
  await expectPostReady(page);
  await expect(page).toHaveURL(new RegExp(`${postPath}$`));
  await page.screenshot({ path: `${evidenceDir}/after-direct-link.png`, fullPage: false, animations: "disabled" });

  const directRefreshResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/posts/${postId}`));
  await page.reload();
  expect((await directRefreshResponse).status()).toBe(200);
  await expectPostReady(page);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`));

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-reputation-summary")).toBeVisible({ timeout: 15_000 });
  const dashboardPost = page.getByTestId(`dashboard-post-${postId}`);
  await dashboardPost.scrollIntoViewIfNeeded();
  await expect(dashboardPost).toHaveAttribute("href", `${postPath}?from=dashboard&connection_id=${connectionId}`);
  await dashboardPost.click();
  await expectPostReady(page);
  await expect(page.getByTestId("post-context-back")).toHaveAttribute("href", "/dashboard");
  await page.getByTestId("post-context-back").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
