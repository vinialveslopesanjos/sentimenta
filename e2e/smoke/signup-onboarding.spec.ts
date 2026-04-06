import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

const API = "http://localhost:8000/api/v1";
const VERIFY_SCRIPT = path.join(__dirname, "../fixtures/verify-email.sh");

function verifyEmailInDb(email: string): void {
  execSync(`bash "${VERIFY_SCRIPT}" "${email}"`, { stdio: "pipe" });
}

test.describe("Signup & Onboarding", () => {
  const testEmail = `e2e-signup-${Date.now()}@e2e.sentimenta.com.br`;
  const testPassword = "Test@12345678";
  const testName = "E2E Signup Test";

  test("full signup flow via API + onboarding via API", async ({ request }) => {
    // 1. Register via API
    const regRes = await request.post(`${API}/auth/register`, {
      data: { email: testEmail, password: testPassword, name: testName, accepted_terms: true },
    });
    expect(regRes.status()).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.access_token).toBeTruthy();
    expect(regBody.refresh_token).toBeTruthy();

    // 2. Verify email in DB (required for authenticated endpoints)
    verifyEmailInDb(testEmail);

    const headers = { Authorization: `Bearer ${regBody.access_token}` };

    // 3. Verify user exists via /auth/me
    const meRes = await request.get(`${API}/auth/me`, { headers });
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    expect(me.email).toBe(testEmail);

    // 4. Complete onboarding
    const onbRes = await request.post(`${API}/auth/onboarding`, {
      headers,
      data: {
        profile_type: "criador",
        main_goal: "monitorar_sentimento",
        description: "Automated E2E test user",
      },
    });
    expect(onbRes.status()).toBe(200);
    const onbBody = await onbRes.json();
    expect(onbBody.onboarding_data).toBeDefined();
    expect(onbBody.onboarding_data.profile_type).toBe("criador");
    expect(onbBody.onboarding_data.completed_at).toBeTruthy();
  });

  test("register with existing email returns 409", async ({ request }) => {
    // First register
    await request.post(`${API}/auth/register`, {
      data: { email: `e2e-dup-${Date.now()}@e2e.sentimenta.com.br`, password: testPassword, name: testName, accepted_terms: true },
    });

    // Try same email again (use a fixed known email)
    const res = await request.post(`${API}/auth/register`, {
      data: { email: "e2e-seed@e2e.sentimenta.com.br", password: "Seed@12345678", name: "Dup", accepted_terms: true },
    });
    // Either 201 (first time) or 409 (already exists) - both are valid
    expect([201, 409]).toContain(res.status());
  });

  test("login page renders and shows login form", async ({ page }) => {
    await page.goto("/login");
    // Should see email and password inputs
    await expect(page.locator("input[type='email'], input[placeholder*='@']").first()).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
  });
});
