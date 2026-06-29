import { expect, test } from "@playwright/test";

test.describe("Public blog", () => {
  test("blog list, article and CTA are navigable", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: /Reputacao digital/i })).toBeVisible();

    await page.getByRole("link", { name: /Ler artigo/i }).first().click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Voltar para o blog/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Fazer um diagnostico|Ver como ficaria|Comecar pelo diagnostico/i })).toBeVisible();

    await page.getByRole("link", { name: /Voltar para o blog/i }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});
