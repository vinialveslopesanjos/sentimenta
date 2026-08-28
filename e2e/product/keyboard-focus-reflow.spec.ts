import { expect, test, type Locator, type Page } from "@playwright/test";

const email = "qa.healthy_recent@example.com";
const password = "QaSeed123!";
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  if (await declineCookies.isVisible().catch(() => false)) await declineCookies.click();
}

async function expectFocusInside(page: Page, container: Locator) {
  expect(await container.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

async function expectDialogOnTop(container: Locator) {
  expect(await container.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 120));
    return Boolean(hit && element.contains(hit));
  })).toBe(true);
}

async function expectFocusLoop(page: Page, container: Locator) {
  const focusables = container.locator(focusableSelector);
  expect(await focusables.count()).toBeGreaterThan(1);

  await focusables.first().focus();
  await page.keyboard.press("Shift+Tab");
  await expectFocusInside(page, container);

  await focusables.last().focus();
  await page.keyboard.press("Tab");
  await expectFocusInside(page, container);
}

async function expectVisibleFocus(page: Page, control: Locator) {
  await control.focus();
  const state = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      intersectsViewport: rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.left < innerWidth
        && rect.bottom > 0
        && rect.top < innerHeight,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
    };
  });
  expect(state.intersectsViewport).toBe(true);
  expect(
    (state.outlineStyle !== "none" && state.outlineWidth >= 2)
      || state.boxShadow !== "none",
  ).toBe(true);
}

async function expectNoRootHorizontalOverflow(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.getByRole("button", { name: "PT", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(sizes.scrollWidth, `${path} must reflow at ${width} CSS px`).toBeLessThanOrEqual(sizes.clientWidth + 1);
}

test("the main product flow works by keyboard and reflows at 320px and 200% equivalent", async ({ page }) => {
  test.setTimeout(90_000);

  const pageErrors: string[] = [];
  const failedApiResponses: string[] = [];
  const mutations: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await login(page);
  const profileHref = await page.locator('a[href*="/dashboard/profile/"]').first().getAttribute("href");
  expect(profileHref).toBeTruthy();
  await page.goto(profileHref!);
  const postHref = await page.locator('a[href*="/dashboard/post/"]').first().getAttribute("href");
  expect(postHref).toBeTruthy();

  // A closed mobile navigation must not put off-screen controls in the tab order.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/dashboard");
  const menuTrigger = page.getByRole("button", { name: "Abrir menu de navegação" });
  await expectVisibleFocus(page, menuTrigger);
  await page.reload();
  await expect(page.getByRole("status", { name: "Status global dos dados" })).toBeVisible();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab");
    const focusIsVisible = await page.evaluate(() => {
      const rect = document.activeElement?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth);
    });
    expect(focusIsVisible, `tab stop ${index + 1} must not be off-screen`).toBe(true);
  }

  // The mobile sheet receives focus, traps it, closes with Escape and restores context.
  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  const mobileDialog = page.getByRole("dialog", { name: "Abrir menu de navegação" });
  await expect(mobileDialog).toBeVisible();
  await expect(mobileDialog).toHaveAttribute("aria-modal", "true");
  await expectDialogOnTop(mobileDialog);
  await expectFocusInside(page, mobileDialog);
  await expectFocusLoop(page, mobileDialog);
  await page.keyboard.press("Escape");
  await expect(mobileDialog).toBeHidden();
  await expect(menuTrigger).toBeFocused();

  // Redundant chart geometry does not add unexplained application stops.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-score-trend-text-alternative")).toBeVisible();
  await expect(page.locator('[data-chart-visual] [role="application"]')).toHaveCount(0);
  await expect(page.locator('[data-chart-visual] [tabindex="0"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /20\.000.*créd/i })).toBeVisible();
  await expectVisibleFocus(page, page.getByRole("button", { name: "Atualizar", exact: true }).first());

  // Provenance behaves as a modal drawer and restores the score trigger.
  const provenanceTrigger = page.getByTestId("dashboard-score-provenance-trigger");
  await provenanceTrigger.focus();
  await page.keyboard.press("Enter");
  const provenanceDialog = page.getByRole("dialog", { name: "Como este score foi calculado" });
  await expect(provenanceDialog).toBeVisible();
  await expect(provenanceDialog).toHaveAttribute("aria-modal", "true");
  await expectDialogOnTop(provenanceDialog);
  await expectFocusInside(page, provenanceDialog);
  await expectFocusLoop(page, provenanceDialog);
  await page.keyboard.press("Escape");
  await expect(provenanceDialog).toBeHidden();
  await expect(provenanceTrigger).toBeFocused();

  // The destructive confirmation is semantic, trapped and fully reversible here.
  await page.goto("/dashboard/settings");
  const deleteTrigger = page.getByRole("button", { name: "Excluir Conta", exact: true });
  await deleteTrigger.focus();
  await page.keyboard.press("Enter");
  const deleteDialog = page.getByRole("dialog", { name: "Confirmar Exclusão" });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toHaveAttribute("aria-modal", "true");
  await expectDialogOnTop(deleteDialog);
  await expect(deleteDialog.getByPlaceholder("DELETAR")).toBeFocused();
  await expectFocusLoop(page, deleteDialog);
  await page.keyboard.press("Escape");
  await expect(deleteDialog).toBeHidden();
  await expect(deleteTrigger).toBeFocused();

  // 320 CSS px and a 720 CSS px viewport (1440 physical px at 200% zoom).
  const routes = [
    "/dashboard",
    "/dashboard/connect",
    "/dashboard/logs",
    "/dashboard/analysis",
    "/dashboard/alerts",
    "/dashboard/settings",
    profileHref!,
    postHref!,
  ];
  for (const width of [320, 720]) {
    for (const route of routes) await expectNoRootHorizontalOverflow(page, route, width);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/dashboard");
  const heroHeadingWidth = await page.getByTestId("dashboard-reputation-summary").locator("h2").evaluate(
    element => element.getBoundingClientRect().width,
  );
  expect(heroHeadingWidth).toBeGreaterThanOrEqual(200);

  // Automatic onboarding uses the same modal guarantees without changing the account.
  const onboardingPage = await page.context().newPage();
  onboardingPage.on("pageerror", error => pageErrors.push(error.message));
  onboardingPage.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  onboardingPage.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await onboardingPage.route("**/api/v1/auth/me", async route => {
    const response = await route.fetch();
    const payload = await response.json();
    await route.fulfill({ response, json: { ...payload, onboarding_data: null } });
  });
  await onboardingPage.goto("/dashboard");
  const onboardingDialog = onboardingPage.getByTestId("onboarding-dialog");
  await expect(onboardingDialog).toBeVisible();
  await expect(onboardingDialog).toHaveAttribute("role", "dialog");
  await expect(onboardingDialog).toHaveAttribute("aria-modal", "true");
  await expect(onboardingDialog).toHaveAccessibleName(/.+/);
  await expectDialogOnTop(onboardingDialog);
  await expectFocusInside(onboardingPage, onboardingDialog);
  await expectFocusLoop(onboardingPage, onboardingDialog);
  await onboardingPage.keyboard.press("Escape");
  await expect(onboardingDialog).toBeHidden();
  await onboardingPage.close();

  expect(pageErrors).toEqual([]);
  expect(failedApiResponses).toEqual([]);
  expect(mutations).toEqual(["POST /api/v1/auth/login"]);
});
