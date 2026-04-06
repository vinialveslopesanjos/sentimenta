import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";

test.describe("Health Check", () => {
  test("GET /health returns 200", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("GET /api/v1/billing/plans returns plan list", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/billing/plans`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.plans).toBeDefined();
    expect(body.plans.length).toBeGreaterThanOrEqual(3);

    const free = body.plans.find((p: any) => p.slug === "free");
    expect(free).toBeDefined();
    expect(free.description).toContain("200");
  });

  test("GET /api/v1/billing/estimate returns cost estimates", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/billing/estimate?num_posts=10&avg_comments=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.num_posts).toBe(10);
    expect(body.avg_comments_per_post).toBe(50);
  });
});
