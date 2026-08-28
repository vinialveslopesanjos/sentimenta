import { expect, test, type Page } from "@playwright/test";

type ScenarioName = "current" | "historical-49-days" | "blocked";

const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/1.2";
const connection = {
  id: "00000000-0000-0000-0000-000000001201",
  platform: "youtube",
  username: "diagnostico-fixture",
  display_name: "Diagnóstico fixture",
  profile_url: "https://youtube.com/@diagnostico-fixture",
  profile_image_url: null,
  followers_count: 1200,
  following_count: 0,
  media_count: 2,
  status: "active",
  connected_at: "2026-06-01T10:00:00Z",
  last_sync_at: "2026-08-26T10:00:00Z",
  persona: null,
};

function snapshotFor(name: ScenarioName) {
  const historical = name === "historical-49-days";
  const blocked = name === "blocked";
  const periodStart = blocked ? null : historical ? "2026-07-01T10:00:00Z" : "2026-08-20T10:00:00Z";
  const periodEnd = blocked ? null : historical ? "2026-07-08T10:00:00Z" : "2026-08-26T10:00:00Z";
  const mode = blocked ? "unavailable" : historical ? "historical" : "current";
  const health = blocked ? "failed" : historical ? "stale" : "healthy";
  const valid = blocked ? 0 : 24;
  const action = blocked
    ? { code: "retry_sync", href: "/dashboard/connect", priority: "high" }
    : historical
      ? { code: "sync_now", href: "/dashboard/connect", priority: "high" }
      : { code: "keep_monitoring", href: "/dashboard", priority: "low" };
  return {
    id: `12121212-3434-4567-8901-${historical ? "000000000049" : blocked ? "000000000000" : "000000000001"}`,
    schema_version: 1,
    source_platforms: ["youtube"],
    profiles: [{ connection_id: connection.id, platform: "youtube", username: connection.username }],
    period_start: periodStart,
    period_end: periodEnd,
    saved_count: valid,
    analyzed_count: valid,
    valid_count: valid,
    coverage: {
      status: blocked ? "none" : "complete",
      ratio: blocked ? null : 1,
      reason_code: blocked ? "no_saved_items" : "complete_window",
    },
    health,
    reason_code: blocked ? "zero_valid_analyses" : historical ? "last_success_outside_sla" : "healthy",
    metrics: {
      global: {
        valid_count: valid,
        avg_score: blocked ? null : 6.2,
        sentiment_distribution: blocked ? { positive: 0, neutral: 0, negative: 0 } : { positive: 12, neutral: 8, negative: 4 },
      },
    },
    content_hash: (historical ? "4" : blocked ? "0" : "1").repeat(64),
    created_at: "2026-08-26T10:00:00Z",
    language_policy: {
      policy_version: 1,
      mode,
      message_key: blocked ? "failed_without_history" : historical ? "stale" : "current",
      health,
      reason_code: blocked ? "zero_valid_analyses" : historical ? "last_success_outside_sla" : "healthy",
      coverage_status: blocked ? "none" : "complete",
      pipeline_status: blocked ? "failed" : "completed",
      present_tense_allowed: name === "current",
      current_trend_allowed: name === "current",
      no_alerts_claim_allowed: name === "current",
      crisis_claim_allowed: name === "current",
      action_mode: blocked ? "connect_or_restore_data" : historical ? "restore_data_first" : "current_if_supported",
      required_qualifier: blocked ? "evaluation_unavailable" : historical ? "historical_only" : null,
      forbidden_claims: name === "current" ? [] : ["present_tense", "current_trend", "all_clear", "crisis", "current_action"],
      next_action: action,
    },
  };
}

function reportFor(name: ScenarioName, generated: boolean) {
  const snapshot = snapshotFor(name);
  const historical = name === "historical-49-days";
  const blocked = name === "blocked";
  const recommendationMode = blocked ? "blocked" : historical ? "historical_only" : "current";
  const generatedAt = generated && !blocked ? "2026-08-26T12:00:00Z" : null;
  return {
    snapshot,
    report_basis: {
      contract_version: 1,
      snapshot_id: snapshot.id,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      coverage_status: snapshot.coverage.status,
      coverage_ratio: snapshot.coverage.ratio,
      health: snapshot.health,
      language_mode: snapshot.language_policy.mode,
      recommendation_mode: recommendationMode,
      reason_code: snapshot.reason_code,
      generated_at: generatedAt,
      source: generated ? historical ? "llm_qualified" : "llm" : "none",
    },
    report_text: !generated || blocked
      ? null
      : historical
        ? "🕰️ **Leitura histórica**\n\nOs dados observados cobrem **01/07/2026 a 08/07/2026**.\n\nO recorte registrou **24 análises válidas**.\n\n⏸ **Recomendação atual suspensa**\n\nAtualize os dados antes de transformar esta leitura em uma ação para o presente."
        : "✨ **Resumo do período**\n\nO snapshot registra **24 análises válidas**.\n\n🚀 **Próximo passo sugerido**\n\nReforce o tema com melhor resposta no próximo conteúdo.",
    generated_at: generatedAt,
    data_summary: {},
    has_new_data: false,
  };
}

async function installFixture(page: Page, getScenario: () => ScenarioName) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.setItem("sentiment_access_token", "diagnosis-trust-fixture");
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const scenario = getScenario();
    const snapshot = snapshotFor(scenario);
    let body: unknown;

    if (path.endsWith("/auth/me")) body = { id: "diagnosis-user", email: "diagnosis@example.invalid", name: "QA Diagnosis", plan: "pro", email_verified: true, onboarding_data: {} };
    else if (path.endsWith("/billing/credits")) body = { total: 20_000, plan_credits: 20_000, plan_allocation: 20_000, packs: [] };
    else if (path.endsWith("/connections")) body = [connection];
    else if (path.endsWith("/data-snapshots/latest")) body = snapshot;
    else if (path.endsWith("/dashboard/summary")) body = {
      snapshot,
      total_connections: 1,
      total_posts: 2,
      total_comments: snapshot.valid_count,
      total_analyzed: snapshot.valid_count,
      avg_score: snapshot.metrics.global.avg_score,
      avg_polarity: snapshot.valid_count ? 0.2 : null,
      sentiment_distribution: snapshot.valid_count ? snapshot.metrics.global.sentiment_distribution : null,
      emotions_distribution: null,
      topics_frequency: null,
      word_frequency: null,
      recent_posts: [],
      connections: [connection],
    };
    else if (path.endsWith("/dashboard/health-report")) {
      const generated = scenario === "current" || route.request().method() === "POST";
      body = reportFor(scenario, generated);
    } else if (path.endsWith("/dashboard/health-report/prompt")) body = { prompt: "Prompt sintético" };
    else {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Fixture route not defined" }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("AI diagnosis separates data period, generation time and current recommendation policy", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  let active: ScenarioName = "current";
  await installFixture(page, () => active);

  await page.goto("/dashboard");
  let evidence = page.getByTestId("diagnosis-evidence");
  await expect(evidence).toHaveAttribute("data-recommendation-mode", "current");
  await expect(evidence).toHaveAttribute("data-report-source", "llm");
  await expect(evidence).toContainText("20 de ago. de 2026 a 26 de ago. de 2026");
  await expect(evidence).toContainText("26 de ago. de 2026");
  await expect(page.getByTestId("diagnosis-report-text")).toContainText("Próximo passo sugerido");
  await evidence.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/current.png`, fullPage: false });

  active = "historical-49-days";
  await page.goto("/dashboard");
  const section = page.getByTestId("ai-diagnosis-section");
  evidence = page.getByTestId("diagnosis-evidence");
  await expect(evidence).toHaveAttribute("data-recommendation-mode", "historical_only");
  await expect(evidence).toHaveAttribute("data-report-source", "none");
  await expect(evidence).toContainText("01 de jul. de 2026 a 08 de jul. de 2026");
  await expect(evidence).toContainText("Completa (100%)");
  await expect(evidence).toContainText("Ainda não gerado");
  await expect(evidence.getByRole("link", { name: "Atualizar dados" })).toHaveAttribute("href", "/dashboard/connect");
  const historicalHero = page.getByRole("heading", { name: "Leitura histórica do período observado." }).locator("..");
  await expect(historicalHero).toBeVisible();
  await expect(page.getByText(/o momento favorece/i)).toHaveCount(0);
  await expect(historicalHero).toContainText("O recorte não sustenta conclusões ou recomendações para o presente.");
  await expect(section.getByRole("button", { name: "Editar" })).toHaveCount(0);

  const response = page.waitForResponse((item) => item.url().includes("/dashboard/health-report") && item.request().method() === "POST");
  await section.getByRole("button", { name: "Gerar leitura histórica" }).click();
  expect((await response).status()).toBe(200);
  await expect(evidence).toHaveAttribute("data-report-source", "llm_qualified");
  await expect(evidence).toContainText("Diagnóstico gerado");
  await expect(evidence).toContainText("26 de ago. de 2026");
  await expect(evidence).toContainText(`ref. ${snapshotFor(active).id.slice(0, 8)}`);
  const historicalText = page.getByTestId("diagnosis-report-text");
  await expect(historicalText).toContainText("Leitura histórica");
  await expect(historicalText).toContainText("Recomendação atual suspensa");
  await expect(historicalText).not.toContainText("hoje", { ignoreCase: true });
  await expect(historicalText).not.toContainText("agora", { ignoreCase: true });
  await expect(historicalText).not.toContainText("poste", { ignoreCase: true });
  await evidence.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/historical-49-days.png`, fullPage: false });

  active = "blocked";
  await page.goto("/dashboard");
  evidence = page.getByTestId("diagnosis-evidence");
  await expect(evidence).toHaveAttribute("data-recommendation-mode", "blocked");
  await expect(evidence.getByRole("heading", { name: "Diagnóstico sem base confiável" })).toBeVisible();
  await expect(evidence).toContainText("Período não comprovado");
  await expect(evidence.getByRole("link", { name: "Tentar sincronizar novamente" })).toHaveAttribute("href", "/dashboard/connect");
  await expect(page.getByTestId("diagnosis-report-text")).toHaveCount(0);
  await expect(page.getByTestId("ai-diagnosis-section").getByRole("button", { name: "Atualizar", exact: true })).toHaveCount(0);
  await evidence.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/blocked.png`, fullPage: false });
});
