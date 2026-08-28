import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/3.2";
const unsupportedClaim = /<\s*2\s*min|94\s*%|menos de 2 minutos|under 2 minutes|aproximadamente 2 minutos|approximately 2 minutes/i;

test("public timing and AI claims stay qualified in PT-BR and EN", async ({ page }) => {
  const publicSources = [
    "frontend/app/page.tsx",
    "frontend/app/(auth)/login/page.tsx",
    "frontend/messages/pt-BR.json",
    "frontend/messages/en.json",
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  expect(publicSources).not.toMatch(unsupportedClaim);

  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const heroEvidence = page.getByTestId("landing-hero-evidence-stats");
  await expect(heroEvidence).toContainText("Prévia");
  await expect(heroEvidence).toContainText("antes da coleta");
  await expect(page.locator("body")).not.toContainText(unsupportedClaim);
  await page.screenshot({ path: `${evidenceDir}/home-qualified-claims.png`, fullPage: false, animations: "disabled" });

  const demo = page.getByTestId("landing-interactive-demo");
  await demo.scrollIntoViewIfNeeded();
  await demo.getByRole("textbox").fill("Comentário local para validar a linguagem pública");
  await demo.getByRole("button", { name: "Gerar exemplo ilustrativo", exact: true }).click();
  await expect(page.getByTestId("landing-demo-confidence")).toHaveText("Exemplo");
  await expect(demo).toContainText("sem precisão medida");
  await expect(demo).not.toContainText(/94\s*%/);
  await page.screenshot({ path: `${evidenceDir}/demo-without-fake-accuracy.png`, fullPage: false, animations: "disabled" });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("login-trust-stats")).toContainText("Origem dos dados");
  await expect(page.getByTestId("login-trust-stats")).toContainText("1 clique");
  await expect(page.getByTestId("login-trust-message")).toContainText("Período, cobertura e origem dos dados");
  await expect(page.locator("body")).not.toContainText(unsupportedClaim);
  await page.screenshot({ path: `${evidenceDir}/login-without-unsupported-accuracy.png`, fullPage: false, animations: "disabled" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("landing-hero-evidence-stats")).toContainText("antes da coleta");
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: `${evidenceDir}/mobile-qualified-claims.png`, fullPage: false, animations: "disabled" });
});
