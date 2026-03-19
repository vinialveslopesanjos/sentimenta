"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearTokens, getToken } from "@/lib/auth";
import { identifyUser } from "@/lib/tracking";
import SidebarNew from "@/components/SidebarNew";
import { ThemeProvider, useTheme } from "@/components/ThemeContext";
import { Bell, Plus, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import OnboardingModal from "@/components/OnboardingModal";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const tl = useTranslations("layout");
  const tc = useTranslations("common");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    authApi
      .me(token)
      .then((user) => {
        if (!user.email_verified) {
          router.replace("/verify-email");
          return;
        }
        identifyUser(user.id, { email: user.email, name: user.name, plan: user.plan });
        if (!user.onboarding_data) {
          setShowOnboarding(true);
        }
        setOk(true);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "email_not_verified") {
          router.replace("/verify-email");
          return;
        }
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  if (!ok) {
    return (
      <div className="fixed inset-0 grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse" style={{ backgroundColor: "var(--primary-bg)" }}>
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
          </div>
          <div className="h-1 w-24 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div className="h-full w-full progress-shimmer rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
      <SidebarNew />
      <div className="ml-0 md:ml-[240px] transition-all duration-300">
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 h-14 backdrop-blur-xl flex items-center justify-between px-4 md:px-8"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-card) 85%, transparent)",
            borderBottom: "1px solid var(--border)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
          }}
        >
          <div className="flex items-center gap-3">
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ color: "var(--text-muted)" }}
              title={theme === "light" ? tl("darkMode") : tl("lightMode")}
            >
              {theme === "light" ? <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <Sun className="w-[18px] h-[18px]" strokeWidth={1.5} />}
            </button>
            <button
              className="relative p-2 rounded-xl transition-colors"
              onClick={() => router.push("/dashboard/alerts")}
              style={{ color: "var(--text-muted)" }}
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--secondary)" }} />
            </button>
            <button
              onClick={() => router.push("/dashboard/connect")}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {tc("connectProfile")}
            </button>
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">
          <div className="max-w-[1320px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ThemeProvider>
  );
}
