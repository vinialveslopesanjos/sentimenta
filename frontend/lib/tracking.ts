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

// ---------------------------------------------------------------------------
// Consent helpers
// ---------------------------------------------------------------------------
const COOKIE_CONSENT_KEY = "sentimenta_cookie_consent";
const ATTRIBUTION_KEY = "sentimenta_attribution";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  first_path?: string;
  captured_at?: string;
};

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

export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  if (!hasConsent()) return null;

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 120);
  }

  if (Object.keys(attribution).length === 0) {
    return readStoredAttribution();
  }

  const existing = readStoredAttribution() || {};
  const next: Attribution = {
    ...existing,
    ...attribution,
    first_path: existing.first_path || window.location.pathname,
    captured_at: existing.captured_at || new Date().toISOString(),
  };

  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  return next;
}

export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  return readStoredAttribution();
}

// ---------------------------------------------------------------------------
// Init / Shutdown
// ---------------------------------------------------------------------------
let initialized = false;

type ClarityWindow = Window & {
  clarity?: (...args: unknown[]) => void;
};

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;
  if (initialized) return;

  // Microsoft Clarity — inject script
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (clarityId && !document.getElementById("clarity-script")) {
    const script = document.createElement("script");
    script.id = "clarity-script";
    script.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`;
    document.head.appendChild(script);
  }

  initialized = true;
  const attribution = captureAttribution();
  if (attribution?.utm_source) {
    track("campaign_landing", attribution);
  }
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------
export function track(event: TrackEvent, properties?: Record<string, unknown>) {
  if (!hasConsent() || !initialized) return;
  const clarity = (window as ClarityWindow).clarity;
  if (typeof clarity === "function") {
    clarity("event", event, properties || {});
  }
}

// ---------------------------------------------------------------------------
// Identify / Reset
// ---------------------------------------------------------------------------
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
) {
  if (!hasConsent() || !initialized) return;
  const clarity = (window as ClarityWindow).clarity;
  if (typeof clarity === "function") {
    clarity("identify", userId, undefined, undefined, traits || {});
  }
}

export function resetTracking() {
  initialized = false;
}
