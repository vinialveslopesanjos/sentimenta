"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "sentimenta_cookie_consent";

export default function CookieBanner() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
    window.dispatchEvent(new Event("analytics-consent"));
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-4 sm:p-6">
      <div
        className="max-w-3xl mx-auto backdrop-blur-lg rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg-card) 94%, transparent)",
          border: "1px solid var(--border)",
          boxShadow: "0 10px 30px -12px rgba(0, 0, 0, 0.22)",
        }}
      >
        <p className="text-sm flex-1 text-center sm:text-left" style={{ color: "var(--text-secondary)" }}>
          {t("message")}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/privacidade"
            className="text-sm transition-colors whitespace-nowrap"
            style={{ color: "var(--text-muted)" }}
          >
            {t("learnMore")}
          </Link>
          <button
            onClick={handleDecline}
            className="px-5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)" }}
          >
            {t("decline")}
          </button>
          <button
            onClick={handleAccept}
            className="px-5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
            style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
