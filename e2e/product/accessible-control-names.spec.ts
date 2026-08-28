import { expect, test, type Locator, type Page } from "@playwright/test";

const email = "qa.zero_valid_analyses@example.com";
const password = "QaSeed123!";
const connectionId = "2fd7523d-aa40-510e-930d-505dadad82e3";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/3.3";

async function expectNamed(locator: Locator, context: string) {
  await expect(locator, context).toHaveAccessibleName(/\S/);
}

async function expectVisibleControlsNamed(page: Page, surface: string) {
  const controls = page.locator('button:visible, [role="switch"]:visible');
  expect(await controls.count(), `${surface} should expose interactive controls`).toBeGreaterThan(0);

  let exposedControls = 0;
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    const hiddenByModal = await control.evaluate((element) => Boolean(element.closest('[aria-hidden="true"], [inert]')));
    if (hiddenByModal) continue;
    exposedControls += 1;
    await expectNamed(control, `${surface}: exposed control ${index + 1} has no accessible name`);
  }
  expect(exposedControls, `${surface} should expose named controls to the accessibility tree`).toBeGreaterThan(0);

  const switches = page.getByRole("switch");
  for (let index = 0; index < await switches.count(); index += 1) {
    const toggle = switches.nth(index);
    if (!(await toggle.isVisible())) continue;
    await expectNamed(toggle, `${surface}: switch ${index + 1} has no target name`);
    await expect(toggle, `${surface}: switch ${index + 1} has no exposed state`).toHaveAttribute("aria-checked", /^(true|false)$/);
  }
}

async function preparePublicPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
}

async function loginThroughTheProduct(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
}

test.describe("Accessible names and switch state", () => {
  test.beforeEach(async ({ page }) => {
    await preparePublicPage(page);
  });

  test("public login exposes a named password control", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expectVisibleControlsNamed(page, "login");
    const passwordToggle = page.getByRole("button", { name: "Mostrar senha" });
    await expect(passwordToggle).toBeVisible();
    await passwordToggle.click();
    await expect(page.getByRole("button", { name: "Ocultar senha" })).toBeVisible();

    await page.screenshot({
      path: `${evidenceDir}/after-login-named-password-toggle.png`,
      fullPage: false,
      animations: "disabled",
    });
  });

  test("core authenticated surfaces have no unnamed visible button or switch", async ({ page }) => {
    test.setTimeout(60_000);
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

    await loginThroughTheProduct(page);
    await expectVisibleControlsNamed(page, "dashboard expanded sidebar");

    await page.getByRole("button", { name: "Recolher", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expandir", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "dashboard collapsed sidebar");
    await page.getByRole("button", { name: "Expandir", exact: true }).click();

    await page.goto("/dashboard/connect");
    await expect(page.getByRole("heading", { name: "Conectar Perfis", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "connect profiles");
    const autoSync = page.getByRole("switch", { name: /sync automática de @qa-zero_valid_analyses/ });
    await expect(autoSync).toBeVisible();
    await expect(autoSync).toHaveAttribute("aria-checked", "true");

    await page.goto("/dashboard/logs");
    await expect(page.getByRole("heading", { name: "Atividade", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "pipeline logs");
    await expect(page.getByRole("button", { name: /^Excluir execução #[a-f0-9]{8}$/ })).toBeVisible();

    await page.goto("/dashboard/alerts");
    await expect(page.getByRole("heading", { name: "Alertas", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "alerts history");
    await page.getByRole("button", { name: "Configuração", exact: true }).click();
    await expect(page.getByText("PALAVRAS MONITORADAS", { exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "alerts configuration");
    await expect(page.getByRole("button", { name: /^Remover palavra-chave / }).first()).toBeVisible();

    await page.goto("/dashboard/settings?tab=profile");
    await expect(page.getByRole("heading", { name: "Configurações da Conta", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "settings profile");
    await expect(page.getByRole("button", { name: "Alteração de foto indisponível nesta versão" })).toBeDisabled();

    await page.goto("/dashboard/settings?tab=notifications");
    await expect(page.getByRole("heading", { name: "Canais de Notificação", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "settings notifications");
    await expect(page.getByRole("switch")).toHaveCount(7);
    const emailSwitch = page.getByRole("switch", { name: "Email", exact: true });
    const emailStateBefore = await emailSwitch.getAttribute("aria-checked");
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute("aria-checked", emailStateBefore === "true" ? "false" : "true");
    await page.screenshot({
      path: `${evidenceDir}/after-settings-named-switches.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/dashboard/settings?tab=security");
    await expect(page.getByRole("heading", { name: "Alterar Senha", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "settings security");
    await expect(page.getByRole("switch", { name: "Autenticação por App", exact: true })).toHaveAttribute("aria-checked", /^(true|false)$/);

    await page.goto(`/dashboard/profile/${connectionId}`);
    await expect(page.getByRole("heading", { name: "@qa-zero_valid_analyses", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "profile detail");
    await expect(page.getByRole("button", { name: "Voltar ao dashboard", exact: true })).toBeVisible();

    await page.goto("/dashboard");
    const postLink = page.getByRole("link", { name: /Conteúdo sintético: Zero análises válidas/ });
    const postHref = await postLink.getAttribute("href");
    expect(postHref).toBeTruthy();
    await page.goto(postHref!);
    await expect(page.getByTestId("post-comments-evidence-trigger")).toBeVisible();
    await expectVisibleControlsNamed(page, "post detail");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const openMenu = page.getByRole("button", { name: "Abrir menu de navegação", exact: true });
    await expect(openMenu).toBeVisible();
    await openMenu.click();
    await expect(page.getByRole("button", { name: "Fechar menu de navegação", exact: true })).toBeVisible();
    await expectVisibleControlsNamed(page, "mobile navigation");
    await page.screenshot({
      path: `${evidenceDir}/after-mobile-named-icon-controls.png`,
      fullPage: false,
      animations: "disabled",
    });

    expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
    expect(failedApiResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
