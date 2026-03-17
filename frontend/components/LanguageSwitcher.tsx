"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;

    // Set cookie
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    // Store in localStorage for persistence
    localStorage.setItem("sentimenta-locale", newLocale);

    // Refresh to apply
    startTransition(() => {
      router.refresh();
    });
  };

  if (compact) {
    return (
      <button
        onClick={() => switchLocale(locale === "pt-BR" ? "en" : "pt-BR")}
        className="p-2 rounded-xl transition-all"
        style={{ color: "var(--text-muted)" }}
        title={locale === "pt-BR" ? "Switch to English" : "Mudar para Português"}
      >
        <span style={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.02em" }}>
          {locale === "pt-BR" ? "EN" : "PT"}
        </span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center rounded-full p-0.5 transition-all"
      style={{
        backgroundColor: "var(--bg-subtle)",
        border: "1px solid var(--border)",
      }}
    >
      {(["pt-BR", "en"] as const).map((l) => {
        const isActive = locale === l;
        return (
          <button
            key={l}
            onClick={() => switchLocale(l)}
            disabled={isPending}
            className="relative px-3 py-1 rounded-full transition-all duration-200"
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
              backgroundColor: isActive ? "var(--primary)" : "transparent",
              color: isActive ? "white" : "var(--text-muted)",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {l === "pt-BR" ? "PT" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
