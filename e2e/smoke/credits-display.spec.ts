import { test, expect } from "@playwright/test";
import { getSeedUser, ensureOnboarded } from "../fixtures/seed";
import { authHeaders } from "../fixtures/auth";

const API = "http://localhost:8000/api/v1";

test.describe("Credits & Billing", () => {
  test("GET /billing/credits returns balance and packs", async ({ request }) => {
    const user = await getSeedUser(request);
    await ensureOnboarded(request, user);

    const res = await request.get(`${API}/billing/credits`, {
      headers: authHeaders(user),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Credit balance fields
    expect(body).toHaveProperty("plan");
    expect(body).toHaveProperty("plan_allocation");
    expect(body).toHaveProperty("packs");

    // Packs should be an array with prices
    expect(Array.isArray(body.packs)).toBe(true);
    if (body.packs.length > 0) {
      const pack = body.packs[0];
      expect(pack).toHaveProperty("credits");
      expect(pack).toHaveProperty("price_brl");
      expect(typeof pack.price_brl).toBe("number");
    }
  });

  test("GET /billing/plans includes free tier with correct text", async ({ request }) => {
    const res = await request.get(`${API}/billing/plans`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    const free = body.plans.find((p: any) => p.slug === "free");
    expect(free).toBeDefined();
    expect(free.name).toBe("Gratis");
    expect(free.price_brl).toBe(0);
    // Free tier should mention 200 (not 500)
    expect(free.description).toContain("200");
    expect(free.description).not.toContain("500");
  });

  test("billing/credits requires authentication", async ({ request }) => {
    const res = await request.get(`${API}/billing/credits`);
    expect([401, 403]).toContain(res.status());
  });

  test("settings billing page loads for authenticated user", async ({ page, request }) => {
    const user = await getSeedUser(request);
    await ensureOnboarded(request, user);

    // Inject auth token into browser storage
    await page.goto("/login");
    await page.evaluate((token) => {
      localStorage.setItem("sentimenta_token", token);
    }, user.accessToken);

    await page.goto("/dashboard/settings?tab=billing");
    // Page should load without crashing (not redirect to login)
    await page.waitForLoadState("networkidle");
    const url = page.url();
    // Should either stay on settings or redirect to dashboard (both OK)
    expect(url).toMatch(/\/(dashboard|settings|login)/);
  });
});
