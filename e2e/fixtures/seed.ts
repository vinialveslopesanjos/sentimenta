import { APIRequestContext } from "@playwright/test";
import { createTestUser, authHeaders, type TestUser } from "./auth";

const API_BASE = "http://localhost:8000/api/v1";

/** Stable seed user for tests that need predictable state. */
export const SEED_EMAIL = "e2e-seed@e2e.sentimenta.com.br";
export const SEED_PASSWORD = "Seed@12345678";
export const SEED_NAME = "E2E Seed User";

let _seedUser: TestUser | null = null;

/**
 * Get or create the seed user. Reuses across tests in same worker.
 */
export async function getSeedUser(request: APIRequestContext): Promise<TestUser> {
  if (_seedUser) return _seedUser;
  _seedUser = await createTestUser(request, {
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    name: SEED_NAME,
  });
  return _seedUser;
}

/**
 * Ensure seed user has completed onboarding.
 */
export async function ensureOnboarded(request: APIRequestContext, user: TestUser): Promise<void> {
  const meRes = await request.get(`${API_BASE}/auth/me`, {
    headers: authHeaders(user),
  });
  if (!meRes.ok()) return;

  const me = await meRes.json();
  if (me.onboarding_data?.completed_at) return;

  await request.post(`${API_BASE}/auth/onboarding`, {
    headers: authHeaders(user),
    data: {
      profile_type: "criador",
      main_goal: "monitorar_sentimento",
      description: "E2E test persona for automated smoke tests",
    },
  });
}

/**
 * Reset cached seed user (call if test modifies user state).
 */
export function resetSeedCache() {
  _seedUser = null;
}
