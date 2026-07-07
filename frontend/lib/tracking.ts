// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------
export type TrackEvent =
  // Auth
  | "login_attempt"
  | "login_success"
  | "register_attempt"
  | "register_success"
  | "social_login"
  // Landing
  | "landing_cta_clicked"
  | "campaign_landing"
  | "blog_cta_clicked"
  | "diagnostic_request_submitted"
  // Connections
  | "profile_connected"
  | "profile_deleted"
  | "sync_triggered"
  | "sync_all_triggered"
  // Dashboard
  | "filter_changed"
  | "period_changed"
  | "post_clicked"
  // Credits
  | "credits_pack_clicked"
  | "credits_pack_purchased"
  | "credits_depleted"
  | "plan_upgraded";

type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

type ClarityWindow = Window & {
  clarity?: (...args: unknown[]) => void;
};

type ConsentState = "accepted" | "declined" | "pending";
type TelemetryEventType = "page_view" | "click" | "custom";

// ---------------------------------------------------------------------------
// Consent and attribution helpers
// ---------------------------------------------------------------------------
const COOKIE_CONSENT_KEY = "sentimenta_cookie_consent";
const ATTRIBUTION_KEY = "sentimenta_attribution";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_term",
  "utm_content",
] as const;

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "msclkid"] as const;

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> &
  Partial<Record<(typeof CLICK_ID_KEYS)[number], string>> & {
    client_telemetry_id?: string;
    first_path?: string;
    captured_at?: string;
  };

type WebTelemetryPayload = {
  type: TelemetryEventType;
  event?: TrackEvent;
  path: string;
  url: string;
  title?: string;
  referrer?: string;
  attribution?: Attribution | null;
  consent_state: ConsentState;
  client_telemetry_id: string;
  properties?: Record<string, unknown>;
  target?: Record<string, unknown>;
};

let initialized = false;
let paidTrackingInitialized = false;
let campaignLandingTracked = false;
let pageInstanceId: string | null = null;

function clientTelemetryId() {
  if (pageInstanceId) return pageInstanceId;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    pageInstanceId = crypto.randomUUID();
  } else {
    pageInstanceId = `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return pageInstanceId;
}

function readStoredAttribution(): Attribution | null {
  const stored = localStorage.getItem(ATTRIBUTION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Attribution;
  } catch {
    localStorage.removeItem(ATTRIBUTION_KEY);
    return null;
  }
}

export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
}

function consentState(): ConsentState {
  if (typeof window === "undefined") return "pending";
  const value = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (value === "accepted" || value === "declined") return value;
  return "pending";
}

function parseAttributionFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 120);
  }

  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 160);
  }

  return attribution;
}

function attributionQueryString(search: string): string {
  const params = new URLSearchParams(search);
  const safe = new URLSearchParams();

  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    const value = params.get(key);
    if (value) safe.set(key, value.slice(0, 160));
  }

  const query = safe.toString();
  return query ? `?${query}` : "";
}

export function currentAttributionPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${attributionQueryString(window.location.search)}`.slice(0, 2000);
}

function withSessionAttribution(attribution: Attribution | null): Attribution {
  return {
    ...(attribution || {}),
    client_telemetry_id: clientTelemetryId(),
  };
}

export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;

  const attribution = parseAttributionFromUrl();
  if (Object.keys(attribution).length === 0) {
    return withSessionAttribution(hasConsent() ? readStoredAttribution() : null);
  }

  const existing = readStoredAttribution() || {};
  const next: Attribution = {
    ...existing,
    ...attribution,
    first_path: existing.first_path || window.location.pathname,
    captured_at: existing.captured_at || new Date().toISOString(),
  };

  if (hasConsent()) {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  }

  return withSessionAttribution(next);
}

export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;

  const current = parseAttributionFromUrl();
  if (Object.keys(current).length > 0) {
    return withSessionAttribution(current);
  }

  return withSessionAttribution(hasConsent() ? readStoredAttribution() : null);
}

// ---------------------------------------------------------------------------
// Third-party tags
// ---------------------------------------------------------------------------
function googleTagId() {
  return process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "";
}

function signupConversionLabel() {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL || "";
}

function signupConversionSendTo() {
  const tagId = googleTagId();
  const label = signupConversionLabel();
  if (!tagId || !label) return "";
  return `${tagId}/${label}`;
}

function leadConversionLabel() {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_CONVERSION_LABEL || "";
}

function leadConversionSendTo() {
  const tagId = googleTagId();
  const label = leadConversionLabel();
  if (!tagId || !label) return "";
  return `${tagId}/${label}`;
}

function getCspNonce(): string | undefined {
  return document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content || undefined;
}

function ensureGtagShim(): (...args: unknown[]) => void {
  const googleWindow = window as GoogleWindow;
  googleWindow.dataLayer = googleWindow.dataLayer || [];
  if (!googleWindow.gtag) {
    googleWindow.gtag = function gtagShim() {
      // gtag.js only processes `arguments` objects pushed to dataLayer — a
      // plain array is silently ignored, dropping queued commands (e.g. the
      // signup conversion fired before the script finished loading).
      // eslint-disable-next-line prefer-rest-params
      googleWindow.dataLayer?.push(arguments);
    };
  }
  return googleWindow.gtag;
}

const GOOGLE_CONSENT_KEYS = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
] as const;

function googleConsentPayload(value: "granted" | "denied") {
  return Object.fromEntries(GOOGLE_CONSENT_KEYS.map((key) => [key, value]));
}

let googleConsentGranted = false;

function updateGoogleConsent(granted: boolean) {
  if (typeof window === "undefined" || granted === googleConsentGranted) return;
  const gtag = ensureGtagShim();
  gtag("consent", "update", googleConsentPayload(granted ? "granted" : "denied"));
  googleConsentGranted = granted;
}

function ensureGoogleTag() {
  const tagId = googleTagId();
  if (!tagId || document.getElementById("google-tag-script")) return;

  const gtag = ensureGtagShim();

  // Consent Mode v2: the tag loads for everyone starting as "denied" — Google
  // receives cookieless pings and models Ads conversions for visitors who
  // never accept the banner. Upgraded to "granted" via updateGoogleConsent.
  gtag("consent", "default", { ...googleConsentPayload("denied"), wait_for_update: 500 });
  gtag("set", "ads_data_redaction", true);
  gtag("set", "url_passthrough", true);
  gtag("js", new Date());
  gtag("config", tagId);

  const script = document.createElement("script");
  script.id = "google-tag-script";
  script.async = true;
  const nonce = getCspNonce();
  if (nonce) script.nonce = nonce;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
  document.head.appendChild(script);
}

function initPaidTracking() {
  // Google tag runs consent-aware for every visitor (Consent Mode v2).
  ensureGoogleTag();
  updateGoogleConsent(hasConsent());

  if (!hasConsent() || paidTrackingInitialized) return;

  // Clarity records sessions and uses storage, so it stays consent-gated.
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (clarityId && !document.getElementById("clarity-script")) {
    const script = document.createElement("script");
    script.id = "clarity-script";
    const nonce = getCspNonce();
    if (nonce) script.nonce = nonce;
    script.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarityId)});`;
    document.head.appendChild(script);
  }

  paidTrackingInitialized = true;
}

export function initAnalytics() {
  if (typeof window === "undefined") return;
  initialized = true;
  initPaidTracking();

  const attribution = captureAttribution();
  if (attribution?.utm_source && !campaignLandingTracked) {
    campaignLandingTracked = true;
    track("campaign_landing", attribution);
  }
}

// ---------------------------------------------------------------------------
// First-party web telemetry
// ---------------------------------------------------------------------------
function currentPageContext() {
  return {
    path: window.location.pathname,
    url: window.location.href,
    title: document.title,
    referrer: document.referrer || undefined,
  };
}

function sendWebTelemetry(payload: Omit<WebTelemetryPayload, "client_telemetry_id" | "consent_state">) {
  if (typeof window === "undefined" || !initialized) return;

  const body = JSON.stringify({
    ...payload,
    consent_state: consentState(),
    client_telemetry_id: clientTelemetryId(),
  } satisfies WebTelemetryPayload);

  const endpoint = "/api/v1/analytics/web";
  try {
    if (navigator.sendBeacon && body.length < 60_000) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}

function maskPotentialPii(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d ().-]{7,}\d/g, "[phone]")
    .slice(0, 160);
}

function clickTargetPayload(target: EventTarget | null): Record<string, unknown> | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(
    "a,button,[role='button'],input[type='button'],input[type='submit'],input[type='checkbox'],label,select,textarea",
  );
  if (!element || element.closest("[data-analytics-ignore],.ph-no-capture")) return null;

  const anchor = element instanceof HTMLAnchorElement ? element : element.closest<HTMLAnchorElement>("a[href]");
  const rawText = element instanceof HTMLInputElement ? element.value : element.innerText || element.textContent || "";
  const label = element.getAttribute("aria-label") || element.getAttribute("title") || rawText;
  const href = anchor?.href ? new URL(anchor.href, window.location.href) : null;

  return {
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute("role") || undefined,
    type: element instanceof HTMLInputElement ? element.type : undefined,
    label: label ? maskPotentialPii(label.trim().replace(/\s+/g, " ")) : undefined,
    href_path: href ? href.pathname.slice(0, 500) : undefined,
    outbound: href ? href.hostname !== window.location.hostname : undefined,
    id: element.id ? maskPotentialPii(element.id) : undefined,
    analytics_id: element.dataset.analyticsId || undefined,
  };
}

export function trackPageView() {
  if (typeof window === "undefined") return;
  initAnalytics();
  sendWebTelemetry({
    type: "page_view",
    ...currentPageContext(),
    attribution: getAttribution(),
    properties: {
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: window.screen?.width,
      screen_height: window.screen?.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
}

export function trackClick(event: MouseEvent) {
  if (typeof window === "undefined") return;
  initAnalytics();
  const target = clickTargetPayload(event.target);
  if (!target) return;

  sendWebTelemetry({
    type: "click",
    ...currentPageContext(),
    attribution: getAttribution(),
    target,
  });
}

export function track(event: TrackEvent, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  initAnalytics();
  sendWebTelemetry({
    type: "custom",
    event,
    ...currentPageContext(),
    attribution: getAttribution(),
    properties,
  });

  if (hasConsent()) {
    const clarity = (window as ClarityWindow).clarity;
    if (typeof clarity === "function") {
      clarity("event", event, properties || {});
    }
  }
}

function fireGoogleAdsConversion(
  sendTo: string,
  defaults: Record<string, unknown>,
  properties?: Record<string, unknown>,
): Promise<void> {
  // No consent gate: under Consent Mode v2 the ping goes out cookieless when
  // consent is denied and Google Ads models the conversion.
  if (!initialized || typeof window === "undefined") return Promise.resolve();

  ensureGoogleTag();

  const gtag = (window as GoogleWindow).gtag;
  if (!sendTo || typeof gtag !== "function") return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 500);
    gtag("event", "conversion", {
      send_to: sendTo,
      value: 1.0,
      currency: "BRL",
      ...defaults,
      ...properties,
      event_callback: () => {
        window.clearTimeout(timeout);
        resolve();
      },
    });
  });
}

export function trackGoogleAdsSignupConversion(properties?: Record<string, unknown>): Promise<void> {
  return fireGoogleAdsConversion(
    signupConversionSendTo(),
    { event_category: "signup", event_label: "completed_registration" },
    properties,
  );
}

export function trackGoogleAdsLeadConversion(properties?: Record<string, unknown>): Promise<void> {
  return fireGoogleAdsConversion(
    leadConversionSendTo(),
    { event_category: "lead", event_label: "diagnostic_request" },
    properties,
  );
}

export async function trackCompletedSignup(properties?: Record<string, unknown>) {
  track("register_success", properties);
  await trackGoogleAdsSignupConversion();
}

export async function trackDiagnosticLead(properties?: Record<string, unknown>) {
  track("diagnostic_request_submitted", properties);
  await trackGoogleAdsLeadConversion();
}

// ---------------------------------------------------------------------------
// Identify / Reset
// ---------------------------------------------------------------------------
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  initAnalytics();

  if (hasConsent()) {
    const clarity = (window as ClarityWindow).clarity;
    if (typeof clarity === "function") {
      clarity("identify", userId, undefined, undefined, traits || {});
    }
  }
}

export function resetTracking() {
  initialized = false;
  paidTrackingInitialized = false;
  campaignLandingTracked = false;
}
