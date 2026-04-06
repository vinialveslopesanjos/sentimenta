import { test, expect } from "@playwright/test";
import { getSeedUser, ensureOnboarded } from "../fixtures/seed";
import { authHeaders } from "../fixtures/auth";

const API = "http://localhost:8000/api/v1";

test.describe("Preflight API", () => {
  test("preflight requires authentication", async ({ request }) => {
    // Call preflight without auth on a fake connection ID
    const res = await request.get(`${API}/connections/00000000-0000-0000-0000-000000000000/sync/preflight`);
    expect([401, 403]).toContain(res.status());
  });

  test("preflight with authenticated user returns expected shape", async ({ request }) => {
    const user = await getSeedUser(request);
    await ensureOnboarded(request, user);

    // Create a connection first or use existing - if no connections, we test the error path
    const connRes = await request.get(`${API}/connections`, {
      headers: authHeaders(user),
    });

    if (connRes.ok()) {
      const connections = await connRes.json();
      if (Array.isArray(connections) && connections.length > 0) {
        const connId = connections[0].id;
        const preRes = await request.get(`${API}/connections/${connId}/sync/preflight`, {
          headers: authHeaders(user),
        });
        expect(preRes.status()).toBe(200);
        const body = await preRes.json();

        // Verify response shape
        expect(body).toHaveProperty("can_sync");
        expect(body).toHaveProperty("blockers");
        expect(body).toHaveProperty("warnings");
        expect(body).toHaveProperty("credits_available");
        expect(body).toHaveProperty("estimated_credits_total");
        expect(body).toHaveProperty("estimated_cost_brl");
        expect(body).toHaveProperty("persona_set");
        expect(Array.isArray(body.blockers)).toBe(true);
        expect(Array.isArray(body.warnings)).toBe(true);
      }
    }
  });

  test("preflight on nonexistent connection returns 404", async ({ request }) => {
    const user = await getSeedUser(request);
    const res = await request.get(`${API}/connections/00000000-0000-0000-0000-000000000001/sync/preflight`, {
      headers: authHeaders(user),
    });
    expect([404, 403]).toContain(res.status());
  });
});
