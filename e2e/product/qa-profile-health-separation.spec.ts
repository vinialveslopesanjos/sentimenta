import { expect, test, type Page } from "@playwright/test";

const password = "QaSeed123!";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.5";

const accounts = [
  {
    name: "healthy",
    email: "qa.healthy_recent@example.com",
    connectionId: "6b679ae4-8837-5124-be3a-f50c8ccadbef",
    health: "healthy",
    healthLabel: "Saudável",
    reason: "Última coleta e análise concluídas dentro do prazo.",
    screenshot: "healthy-connected.png",
  },
  {
    name: "stale-49-days",
    email: "qa.stale_snapshot@example.com",
    connectionId: "832f312a-b53e-55db-9cbb-ef472852c587",
    health: "stale",
    healthLabel: "Desatualizada",
    reason: "O último dado válido está fora do prazo de atualização.",
    screenshot: "stale-49-days-connected.png",
  },
] as const;

async function login(page: Page, email: string) {
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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
}

test.describe("Registration and data health through real QA accounts", () => {
  test.describe.configure({ mode: "serial" });

  for (const account of accounts) {
    test(`${account.name} keeps registration separate from data health`, async ({ page }) => {
      await login(page, account.email);
      await page.goto("/dashboard/connect");
      await expect(page.getByRole("heading", { name: "Conectar Perfis" })).toBeVisible();

      const row = page.getByTestId(`connection-health-row-${account.connectionId}`);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row).toHaveAttribute("data-registration-status", "active");
      await expect(row).toHaveAttribute("data-health-state", account.health);
      await expect(row).toContainText("Perfil conectado");
      await expect(row).toContainText(account.healthLabel);
      await expect(row).toContainText(account.reason);
      await expect(row).toContainText("Última tentativa");
      await expect(row).toContainText("Frescor · último sucesso");
      await expect(row).toContainText("Próxima execução automática");
      await expect(row.getByText("Ativo", { exact: true })).toHaveCount(0);

      const lastAttemptAt = await row.getAttribute("data-last-attempt-at");
      const lastSuccessAt = await row.getAttribute("data-last-success-at");
      const nextScheduledAt = await row.getAttribute("data-next-scheduled-at");
      expect(lastAttemptAt).not.toBe("never");
      expect(lastSuccessAt).not.toBe("never");
      expect(nextScheduledAt).not.toBe("not_scheduled");

      if (account.health === "stale") {
        expect(lastAttemptAt).toMatch(/^2026-07-08T/);
        expect(lastSuccessAt).toMatch(/^2026-07-08T/);
        await expect(row).toContainText(/49 dias/);
      }

      await row.screenshot({
        path: `${evidenceDir}/${account.screenshot}`,
        animations: "disabled",
      });
    });
  }
});
