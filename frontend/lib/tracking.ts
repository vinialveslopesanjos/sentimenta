import posthog from "posthog-js";

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
  // Connections
  | "profile_connected"
  | "profile_deleted"
  | "sync_triggered"
  | "sync_all_triggered"
  // Dashboard
  | "filter_changed"
  | "period_changed"
  | "post_clicked";

// ---------------------------------------------------------------------------
// Consent helpers
// ---------------------------------------------------------------------------
const COOKIE_CONSENT_KEY = "sentimenta_cookie_consent";

export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
}

// ---------------------------------------------------------------------------
// Init / Shutdown
// ---------------------------------------------------------------------------
let initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;
  if (initialized) return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
    });
  }

  // Microsoft Clarity — inject script
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (clarityId && !document.getElementById("clarity-script")) {
    const script = document.createElement("script");
    script.id = "clarity-script";
    script.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`;
    document.head.appendChild(script);
  }

  initialized = true;
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------
export function track(event: TrackEvent, properties?: Record<string, unknown>) {
  if (!hasConsent() || !initialized) return;
  posthog.capture(event, properties);
}

// ---------------------------------------------------------------------------
// Identify / Reset
// ---------------------------------------------------------------------------
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
) {
  if (!hasConsent() || !initialized) return;
  posthog.identify(userId, traits);
}

export function resetTracking() {
  if (!initialized) return;
  posthog.reset();
}
