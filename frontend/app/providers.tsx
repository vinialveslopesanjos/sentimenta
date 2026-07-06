"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, trackClick, trackPageView } from "@/lib/tracking";

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();

    // Listen for consent event from CookieBanner
    const onConsent = () => initAnalytics();
    window.addEventListener("analytics-consent", onConsent);
    document.addEventListener("click", trackClick, { capture: true });

    return () => {
      window.removeEventListener("analytics-consent", onConsent);
      document.removeEventListener("click", trackClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return <>{children}</>;
}
