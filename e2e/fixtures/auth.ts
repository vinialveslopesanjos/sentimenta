import { APIRequestContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

const API_BASE = "http://localhost:8000/api/v1";
const VERIFY_SCRIPT = path.join(__dirname, "verify-email.sh");

export interface TestUser {
  email: string;
  password: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Verify a user's email directly in the database so they can log in.
 */
function verifyEmailInDb(email: string): void {
  execSync(`bash "${VERIFY_SCRIPT}" "${email}"`, { stdio: "pipe" });
}

/**
 * Register a new test user. If 409 (already exists), falls back to login.
 * Automatically verifies email in the DB after registration.
 */
export async function createTestUser(
  request: APIRequestContext,
  overrides?: { email?: string; name?: string; password?: string },
): Promise<TestUser> {
  const email = overrides?.email ?? `test-${Date.now()}@e2e.sentimenta.com.br`;
  const password = overrides?.password ?? "Test@12345678";
  const name = overrides?.name ?? "E2E Test User";

  // Try register
  const regRes = await request.post(`${API_BASE}/auth/register`, {
    data: { email, password, name, accepted_terms: true },
  });

  if (regRes.ok()) {
    const body = await regRes.json();
    // Verify email so login and authenticated endpoints work
    verifyEmailInDb(email);
    return { email, password, name, accessToken: body.access_token, refreshToken: body.refresh_token };
  }

  // 409 = already exists, try login
  if (regRes.status() === 409) {
    // Ensure verified in case previous run left it unverified
    verifyEmailInDb(email);
    return loginTestUser(request, email, password);
  }

  throw new Error(`Register failed: ${regRes.status()} ${await regRes.text()}`);
}

/**
 * Login an existing test user.
 */
export async function loginTestUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<TestUser> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }

  const body = await res.json();
  return { email, password, name: "", accessToken: body.access_token, refreshToken: body.refresh_token };
}

/**
 * Get auth headers for API calls.
 */
export function authHeaders(user: TestUser) {
  return { Authorization: `Bearer ${user.accessToken}` };
}
