import { expect, test } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.7";

test("score provenance opens in one click and returns without losing context", async ({ page }) => {
  const unsafeApiRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
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
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);

  const trigger = page.getByTestId("dashboard-score-provenance-trigger");
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText("Ver origem");
  const urlBefore = page.url();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: `${evidenceDir}/after-score-card.png`, fullPage: false, animations: "disabled" });

  await trigger.click();
  const drawer = page.getByTestId("provenance-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-snapshot-id", "830d0bf2-fc83-583c-8ec3-5acb805078eb");
  await expect(drawer).toHaveAttribute("data-coverage-status", "complete");
  await expect(drawer).toHaveAttribute("data-collection-mode", "all");
  await expect(drawer.getByRole("heading", { name: "Como este score foi calculado" })).toBeVisible();
  await expect(drawer).toContainText(
    /\d{2} de [a-zç]+\. de \d{4} a \d{2} de [a-zç]+\. de \d{4}/i,
  );
  await expect(drawer).toContainText("YouTube · @qa-healthy_recent");
  await expect(drawer).toContainText("Todos os itens elegíveis");
  await expect(drawer).toContainText("Completa");
  await expect(drawer).toContainText("100%");
  await expect(drawer).toContainText("1 / 1");
  await expect(drawer).toContainText("Última tentativa");
  await expect(drawer).toContainText("Último sucesso");
  await page.screenshot({ path: `${evidenceDir}/drawer-open.png`, fullPage: false, animations: "disabled" });

  const funnel = drawer.getByTestId("count-funnel-provenance");
  await funnel.scrollIntoViewIfNeeded();
  await expect(funnel).toHaveAttribute("data-count-found", "30");
  await expect(funnel).toHaveAttribute("data-count-eligible", "24");
  await expect(funnel).toHaveAttribute("data-count-valid", "24");
  await expect(funnel).toHaveAttribute("data-count-ignored", "6");
  const technicalReference = drawer.getByText(/snapshot 830d0bf2/);
  await expect(technicalReference).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/drawer-counts-and-reference.png`, fullPage: false, animations: "disabled" });
  await technicalReference.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/drawer-technical-reference.png`, fullPage: false, animations: "disabled" });

  await page.getByTestId("provenance-close").click();
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(page.url()).toBe(urlBefore);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(1);
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
  await page.screenshot({ path: `${evidenceDir}/after-return-to-score.png`, fullPage: false, animations: "disabled" });

  await page.goto("/dashboard/profile/6b679ae4-8837-5124-be3a-f50c8ccadbef");
  await expect(page.getByTestId("profile-reputation-summary")).toBeVisible({ timeout: 15_000 });
  const profileTrigger = page.getByTestId("profile-score-provenance-trigger");
  await profileTrigger.scrollIntoViewIfNeeded();
  await profileTrigger.click();
  await expect(page.getByTestId("provenance-drawer")).toHaveAttribute("data-snapshot-id", "830d0bf2-fc83-583c-8ec3-5acb805078eb");
  await page.screenshot({ path: `${evidenceDir}/profile-one-click.png`, fullPage: false, animations: "disabled" });
});
