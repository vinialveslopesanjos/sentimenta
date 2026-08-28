import { expect, test, type Page } from "@playwright/test";

const appURL = "http://127.0.0.1:3000";
const evidenceDir = "artifacts/login-loading-recovery";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
});

async function seedSessionMarker(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: appURL },
    { name: "sentimenta_session", value: "1", url: appURL },
  ]);
}

test("an expired session marker does not loop forever between login and dashboard", async ({ page }) => {
  await seedSessionMarker(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Invalid token"}' }),
  );
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Invalid refresh token"}' }),
  );

  const refreshResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/auth/refresh"),
  );
  await page.goto("/login", { waitUntil: "commit" });
  expect((await refreshResponse).status()).toBe(401);

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some((cookie) => cookie.name === "sentimenta_session");
    })
    .toBe(false);

  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await page.screenshot({
    path: `${evidenceDir}/expired-session-returns-to-login.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("a stalled session check becomes a recoverable state instead of an infinite loader", async ({ page }) => {
  test.setTimeout(20_000);
  await seedSessionMarker(page);

  let releaseRequest!: () => void;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await requestGate;
    await route.abort("timedout").catch(() => {});
  });

  try {
    await page.goto("/dashboard", { waitUntil: "commit" });
    const recovery = page.getByTestId("session-load-recovery");
    await expect(recovery).toBeVisible({ timeout: 12_000 });
    await expect(recovery).toContainText("Não foi possível confirmar sua sessão");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    await page.screenshot({
      path: `${evidenceDir}/stalled-session-recovery.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Entrar novamente" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  } finally {
    releaseRequest();
  }
});

test("a stalled login request restores the form with a clear timeout message", async ({ page }) => {
  test.setTimeout(20_000);
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: appURL }]);

  let releaseRequest!: () => void;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await requestGate;
    await route.abort("timedout").catch(() => {});
  });

  try {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("qa.auth-timeout@example.invalid");
    await page.locator('input[type="password"]').fill("QaTimeout123!");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Conectando..." })).toBeDisabled();

    await expect(page.locator('p[role="alert"]')).toContainText(
      "O login demorou mais que o esperado",
      { timeout: 12_000 },
    );
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
    await page.screenshot({
      path: `${evidenceDir}/stalled-login-restores-form.png`,
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    releaseRequest();
  }
});
