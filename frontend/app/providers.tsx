"use client";

import { useEffect } from "react";
import { initAnalytics, hasConsent } from "@/lib/tracking";

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Init immediately if consent already granted
    if (hasConsent()) {
      initAnalytics();
    }

    // Listen for consent event from CookieBanner
    const onConsent = () => initAnalytics();
    window.addEventListener("analytics-consent", onConsent);
    return () => window.removeEventListener("analytics-consent", onConsent);
  }, []);

  return <>{children}</>;
}
