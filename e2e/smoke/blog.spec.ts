import { expect, test } from "@playwright/test";

test.describe("Public blog", () => {
  test("blog list, article and CTA are navigable", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: /Reputa[cç][aã]o digital/i })).toBeVisible();

    await page.getByRole("link", { name: /Ler artigo/i }).first().click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Voltar para o blog/i })).toBeVisible();
    // The CTA label is editable from the blog admin. Its destination and
    // accessible name are the stable public contract.
    const articleCta = page.locator('a[href^="/diagnostico"]').first();
    await expect(articleCta).toBeVisible();
    await expect(articleCta).not.toHaveAccessibleName("");

    await page.getByRole("link", { name: /Voltar para o blog/i }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});
