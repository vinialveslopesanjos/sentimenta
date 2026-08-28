import { expect, test, type Page } from "@playwright/test";

const evidencePath = "artifacts/product-audit-2026-08-26/evidence/0.1/five-connection-health-states.png";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "qa-health@example.invalid",
  name: "QA Health",
  avatar_url: null,
  plan: "pro",
  email_verified: true,
  onboarding_data: { profile_type: "brand", main_goal: "monitor", description: "Fixture QA" },
};

const credits = {
  plan_credits: 20_000,
  pack_credits: 0,
  total: 20_000,
  cycle_start: "2026-08-01T00:00:00Z",
  cycle_end: "2026-09-01T00:00:00Z",
  plan: "pro",
  plan_allocation: 20_000,
  demographic_cost: 5,
  packs: [],
};

function connection(
  id: string,
  state: "healthy" | "degraded" | "stale" | "failed" | "never_synced",
  reasonCode: string,
  lastSuccessAt: string | null,
) {
  return {
    id,
    platform: "youtube",
    username: "perfil-teste",
    display_name: "Mesmo perfil de demonstração",
    profile_url: "https://youtube.com/@perfil-teste",
    profile_image_url: null,
    followers_count: 12_345,
    following_count: 0,
    media_count: 42,
    status: "active",
    connected_at: "2026-08-01T12:00:00Z",
    last_sync_at: lastSuccessAt,
    persona: null,
    ignore_author_comments: true,
    auto_sync: true,
    has_oauth_token: false,
    health: {
      state,
      reason_code: reasonCode,
      reason_codes: [reasonCode],
      freshness_sla_hours: 36,
      last_attempt_at: state === "never_synced" ? null : state === "stale" ? lastSuccessAt : "2026-08-26T10:00:00Z",
      last_attempt_status:
        state === "failed" || state === "degraded"
          ? "failed"
          : state === "never_synced"
            ? null
            : "completed",
      last_success_at: lastSuccessAt,
      fresh_until: state === "stale" ? "2026-07-09T22:00:00Z" : lastSuccessAt ? "2026-08-27T22:00:00Z" : null,
      data_age_hours: state === "stale" ? 49 * 24 : lastSuccessAt ? 2 : null,
      is_syncing: false,
      sync_frequency: "daily",
      next_scheduled_at: "2026-08-27T03:15:00Z",
    },
  };
}

const connections = [
  connection("00000000-0000-0000-0000-000000000101", "healthy", "healthy", "2026-08-26T10:00:00Z"),
  connection("00000000-0000-0000-0000-000000000102", "degraded", "latest_attempt_failed", "2026-08-26T08:00:00Z"),
  connection("00000000-0000-0000-0000-000000000103", "stale", "last_success_outside_sla", "2026-07-08T10:00:00Z"),
  connection("00000000-0000-0000-0000-000000000104", "failed", "zero_valid_analyses", null),
  connection("00000000-0000-0000-0000-000000000105", "never_synced", "never_synced", null),
];

async function installDeterministicApi(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "deterministic-health-token");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    if (pathname.endsWith("/billing/credits")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(credits) });
      return;
    }
    if (pathname.endsWith("/connections")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(connections) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
  });
}

test.describe("Connection health product contract", () => {
  test("five identical profiles are understandable without opening details", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await installDeterministicApi(page);

    await page.goto("/dashboard/connect");
    await expect(page.getByRole("heading", { name: "Conectar Perfis" })).toBeVisible();

    for (const state of ["Saudável", "Degradada", "Desatualizada", "Falhou", "Nunca sincronizada"]) {
      await expect(page.getByText(state, { exact: true })).toHaveCount(1);
    }

    await expect(page.getByText("Perfil conectado", { exact: true })).toHaveCount(5);
    await expect(page.getByText("Ativo", { exact: true })).toHaveCount(0);
    await expect(page.getByText("EXECUÇÕES E AGENDA", { exact: true })).toBeVisible();
    await expect(page.getByText("SAÚDE DOS DADOS", { exact: true })).toBeVisible();
    await expect(page.getByText("Última tentativa", { exact: true })).toHaveCount(5);
    await expect(page.getByText("Frescor · último sucesso", { exact: true })).toHaveCount(5);
    await expect(page.getByText("Próxima execução automática", { exact: true })).toHaveCount(5);

    await expect(page.getByText("Última coleta e análise concluídas dentro do prazo.", { exact: true })).toBeVisible();
    await expect(page.getByText("A última tentativa falhou; o último dado válido foi preservado.", { exact: true })).toBeVisible();
    await expect(page.getByText("O último dado válido está fora do prazo de atualização.", { exact: true })).toBeVisible();
    await expect(page.getByText("A coleta não produziu nenhuma análise válida.", { exact: true })).toBeVisible();
    await expect(page.getByText("Ainda não há uma coleta e análise concluídas.", { exact: true })).toBeVisible();

    const healthyRow = page.getByTestId("connection-health-row-00000000-0000-0000-0000-000000000101");
    await expect(healthyRow).toHaveAttribute("data-registration-status", "active");
    await expect(healthyRow).toHaveAttribute("data-health-state", "healthy");
    await expect(healthyRow).toContainText("Perfil conectado");
    await expect(healthyRow).toContainText("Saudável");

    const staleRow = page.getByTestId("connection-health-row-00000000-0000-0000-0000-000000000103");
    await expect(staleRow).toHaveAttribute("data-registration-status", "active");
    await expect(staleRow).toHaveAttribute("data-health-state", "stale");
    await expect(staleRow).toHaveAttribute("data-last-success-at", "2026-07-08T10:00:00Z");
    await expect(staleRow).toHaveAttribute("data-next-scheduled-at", "2026-08-27T03:15:00Z");
    await expect(staleRow).toContainText("Perfil conectado");
    await expect(staleRow).toContainText("Desatualizada");
    await expect(staleRow).toContainText("O último dado válido está fora do prazo de atualização.");

    const table = page.getByRole("table", { name: "Perfis conectados e saúde dos dados" });
    await expect(table).toBeVisible();
    await table.screenshot({ path: evidencePath });
    await table.screenshot({ path: "artifacts/product-audit-2026-08-26/evidence/1.5/five-registration-and-health-states.png" });
  });
});
