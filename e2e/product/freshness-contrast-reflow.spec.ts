import { expect, test, type Page } from "@playwright/test";

const email = "qa.zero_valid_analyses@example.com";
const password = "QaSeed123!";
const connectionId = "2fd7523d-aa40-510e-930d-505dadad82e3";
const evidenceDir = "artifacts/product-audit-2026-08-26/evidence/3.4";

type ContrastMetric = {
  background: string;
  color: string;
  contrast: number;
  fontSize: number;
  role: string;
  text: string;
};

async function measureCriticalText(page: Page, rootSelector: string): Promise<ContrastMetric[]> {
  return page.locator(`${rootSelector}[data-contrast-role], ${rootSelector} [data-contrast-role]`).evaluateAll((elements) => {
    const parseColor = (value: string): [number, number, number, number] | null => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (channels.length < 3) return null;
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const composite = (
      foreground: [number, number, number, number],
      background: [number, number, number, number],
    ): [number, number, number, number] => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha === 0) return [255, 255, 255, 1];
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };
    const effectiveBackground = (element: Element): [number, number, number, number] => {
      const layers: Array<[number, number, number, number]> = [];
      let current: Element | null = element;
      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0) layers.push(parsed);
        current = current.parentElement;
      }
      let result: [number, number, number, number] = document.documentElement.classList.contains("dark")
        ? [8, 18, 18, 1]
        : [255, 255, 255, 1];
      for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
      return result;
    };
    const luminance = ([red, green, blue]: [number, number, number, number]) => {
      const channels = [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const serialize = (color: [number, number, number, number]) => `rgb(${color.slice(0, 3).map((channel) => Math.round(channel)).join(", ")})`;

    return elements
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const foreground = parseColor(style.color) ?? [0, 0, 0, 1];
        const background = effectiveBackground(element);
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(background);
        const contrast = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
          / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
        return {
          background: serialize(background),
          color: style.color,
          contrast,
          fontSize: Number.parseFloat(style.fontSize),
          role: element.getAttribute("data-contrast-role") ?? "unknown",
          text: element.textContent?.trim().replace(/\s+/g, " ") ?? "",
        };
      });
  });
}

async function expectReadableCriticalText(page: Page, rootSelector: string, surface: string) {
  const metrics = await measureCriticalText(page, rootSelector);
  expect(metrics.length, `${surface} should expose measurable critical text`).toBeGreaterThan(0);

  for (const metric of metrics) {
    expect(
      metric.contrast,
      `${surface}: "${metric.text}" has ${metric.contrast.toFixed(2)}:1 (${metric.color} on ${metric.background})`,
    ).toBeGreaterThanOrEqual(4.5);

    const minimumFontSize = metric.role === "critical-label"
      ? 11
      : metric.role === "critical-state"
        ? 14
        : 12;
    expect(
      metric.fontSize,
      `${surface}: "${metric.text}" is ${metric.fontSize}px`,
    ).toBeGreaterThanOrEqual(minimumFontSize);
  }
}

async function loginThroughTheProduct(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sentimenta_cookie_consent", "declined");
  });
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("global-data-status")).toBeVisible({ timeout: 15_000 });
}

test("freshness, coverage and failure remain prominent, contrasted and readable at 200%", async ({ page }) => {
  test.setTimeout(60_000);
  const unsafeApiRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafeApiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/v1/") && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await loginThroughTheProduct(page);

  const evidence = page.getByTestId("global-data-evidence");
  await expect(evidence.locator(":scope > div").first()).toHaveAttribute("data-testid", "global-data-freshness");
  await expect(page.getByTestId("global-data-freshness")).toContainText("Nenhum sucesso registrado");
  await expect(page.getByTestId("dashboard-last-success-badge")).toContainText("Último sucesso: nunca");
  await expect(page.getByTestId("dashboard-last-success-badge")).toHaveAttribute("data-last-success-at", "never");
  await expectReadableCriticalText(page, '[data-testid="global-data-status"]', "global status light theme");
  await expectReadableCriticalText(page, '[data-testid="dashboard-last-success-badge"]', "dashboard freshness badge light theme");
  await page.screenshot({ path: `${evidenceDir}/after-global-freshness-hierarchy.png`, fullPage: false, animations: "disabled" });

  await page.getByRole("button", { name: "Modo escuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectReadableCriticalText(page, '[data-testid="global-data-status"]', "global status dark theme");
  await expectReadableCriticalText(page, '[data-testid="dashboard-last-success-badge"]', "dashboard freshness badge dark theme");
  await page.screenshot({ path: `${evidenceDir}/after-global-freshness-dark.png`, fullPage: false, animations: "disabled" });
  await page.getByRole("button", { name: "Modo claro", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // 720 CSS px is the layout width of a 1440 px browser viewport at 200% zoom.
  await page.setViewportSize({ width: 720, height: 500 });
  await expect(page.getByTestId("global-data-status")).toBeVisible();
  const globalOverflow = await page.getByTestId("global-data-status").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(globalOverflow, "global status overflows at the 200% equivalent width").toBeLessThanOrEqual(1);
  await expect(page.getByTestId("global-data-freshness")).toBeVisible();
  await expect(page.getByTestId("global-data-period")).toBeVisible();
  await expect(page.getByTestId("global-data-basis")).toBeVisible();
  await expect(page.getByTestId("global-data-score")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/after-global-freshness-200-percent-equivalent.png`, fullPage: false, animations: "disabled" });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/connect");
  const connectionFreshness = page.getByTestId(`connection-freshness-${connectionId}`);
  await expect(connectionFreshness).toBeVisible();
  await expect(connectionFreshness.locator(":scope > div").first()).toHaveAttribute("data-testid", `connection-last-success-${connectionId}`);
  await expect(page.getByTestId(`connection-last-success-${connectionId}`)).toContainText("Frescor · último sucesso");
  await expect(page.getByTestId(`connection-last-success-${connectionId}`)).toContainText("Nenhum sucesso registrado");
  await expectReadableCriticalText(page, `[data-testid="connection-freshness-${connectionId}"]`, "profile freshness table");
  await expectReadableCriticalText(page, `[data-testid="connection-health-row-${connectionId}"]`, "profile health state");
  await page.screenshot({ path: `${evidenceDir}/after-profile-freshness-table.png`, fullPage: true, animations: "disabled" });

  await page.goto("/dashboard/alerts");
  await expect(page.getByTestId("alerts-evidence-window")).toBeVisible();
  await expectReadableCriticalText(page, '[data-testid="alerts-evaluation"]', "alerts evidence and failure state");
  await page.screenshot({ path: `${evidenceDir}/after-alerts-period-contrast.png`, fullPage: false, animations: "disabled" });

  await page.goto("/dashboard/logs");
  await expect(page.getByTestId("snapshot-stamp-freshness")).toContainText("Nenhum sucesso registrado");
  await expectReadableCriticalText(page, '[data-testid="snapshot-stamp"]', "pipeline snapshot freshness");
  await page.setViewportSize({ width: 720, height: 500 });
  const stampOverflow = await page.getByTestId("snapshot-stamp").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(stampOverflow, "pipeline snapshot overflows at the 200% equivalent width").toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${evidenceDir}/after-logs-freshness-200-percent-equivalent.png`, fullPage: false, animations: "disabled" });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await page.getByTestId("dashboard-score-provenance-trigger").click();
  await expect(page.getByTestId("provenance-freshness")).toBeVisible();
  await expect(page.getByTestId("provenance-coverage")).toBeVisible();
  await expectReadableCriticalText(page, '[data-testid="provenance-freshness"]', "provenance freshness");
  await expectReadableCriticalText(page, '[data-testid="provenance-coverage"]', "provenance coverage");
  await page.screenshot({ path: `${evidenceDir}/after-provenance-freshness-coverage.png`, fullPage: false, animations: "disabled" });

  expect(unsafeApiRequests).toEqual(["POST /api/v1/auth/login"]);
  expect(failedApiResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});
