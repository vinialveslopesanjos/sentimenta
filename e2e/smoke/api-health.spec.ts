import { expect, test } from "@playwright/test";

const apiURL = process.env.API_URL || "http://127.0.0.1:8000";

test.describe("API health", () => {
  test("health endpoint is available", async ({ request }) => {
    const response = await request.get(`${apiURL}/health`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("public billing plans endpoint has stable shape", async ({ request }) => {
    const response = await request.get(`${apiURL}/api/v1/billing/plans`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.plans)).toBe(true);
    const slugs = body.plans.map((plan: { slug: string }) => plan.slug);
    expect(slugs).toEqual(expect.arrayContaining(["starter", "pro", "enterprise"]));
    expect(slugs).not.toContain("free");
    expect(body.plans.find((plan: { slug: string; price_brl: number }) => plan.slug === "starter")?.price_brl).toBe(197);
    expect(body.plans.find((plan: { slug: string; price_brl: number }) => plan.slug === "pro")?.price_brl).toBe(497);
  });
});
