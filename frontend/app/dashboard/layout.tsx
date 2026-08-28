"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ApiRequestError, authApi, creditsApi, dataSnapshotsApi } from "@/lib/api";
import { clearTokens, getToken } from "@/lib/auth";
import type { DataSnapshot } from "@sentimenta/types";
import { identifyUser } from "@/lib/tracking";
import SidebarNew from "@/components/SidebarNew";
import { ThemeProvider, useTheme } from "@/components/ThemeContext";
import { AlertTriangle, Bell, Plus, Moon, RefreshCw, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import OnboardingModal from "@/components/OnboardingModal";
import { ActiveRunsProvider, ActiveRunPill } from "@/components/ActiveRunsContext";
import { CreditDepletedBanner } from "@/components/CreditBalance";
import { GlobalDataStatus } from "@/components/data/GlobalDataStatus";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";

const ANALYTIC_ROUTE_PREFIXES = [
  "/dashboard/analysis",
  "/dashboard/alerts",
  "/dashboard/profile/",
  "/dashboard/post/",
  "/dashboard/instagram",
  "/dashboard/youtube",
  "/dashboard/tiktok",
  "/dashboard/twitter",
];

function isAnalyticSurface(pathname: string): boolean {
  return pathname === "/dashboard"
    || ANALYTIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [sessionLoadState, setSessionLoadState] = useState<"loading" | "error">("loading");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [creditsDepleted, setCreditsDepleted] = useState(false);
  const [userPlan, setUserPlan] = useState("free");
  const [dataSnapshot, setDataSnapshot] = useState<DataSnapshot | null>(null);
  const [dataStatusLoadState, setDataStatusLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [dataStatusRetry, setDataStatusRetry] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [planChangedAt, setPlanChangedAt] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const tl = useTranslations("layout");
  const tc = useTranslations("common");

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    authApi
      .me(token)
      .then((user) => {
        if (cancelled) return;
        if (!user.email_verified) {
          router.replace("/verify-email");
          return;
        }
        identifyUser(user.id, { email: user.email, name: user.name, plan: user.plan });
        setUserPlan(user.plan);
        setSubscriptionStatus(user.subscription_status ?? null);
        setPlanChangedAt(user.plan_changed_at ?? null);
        if (!user.onboarding_data) {
          setShowOnboarding(true);
        }
        creditsApi.getCredits(token).then((c) => {
          if (c.total <= 0) setCreditsDepleted(true);
        }).catch(() => {});
        setOk(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.message === "email_not_verified") {
          router.replace("/verify-email");
          return;
        }
        if (err instanceof ApiRequestError && [401, 403].includes(err.status ?? 0)) {
          clearTokens();
          router.replace("/login");
          return;
        }
        setSessionLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [router, sessionRetry]);

  useEffect(() => {
    if (!ok || !isAnalyticSurface(pathname)) return;
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    setDataStatusLoadState((current) => current === "ready" ? "ready" : "loading");
    dataSnapshotsApi.latest(token)
      .catch(async (firstError) => {
        // This read is the trust boundary for every analytical screen. A
        // single transient proxy/JSON failure should be retried once before
        // asking the user to recover it manually.
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (cancelled) throw firstError;
        return dataSnapshotsApi.latest(token);
      })
      .then((snapshot) => {
        if (cancelled) return;
        setDataSnapshot(snapshot);
        setDataStatusLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setDataSnapshot(null);
        setDataStatusLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [dataStatusRetry, ok, pathname]);

  if (!ok) {
    if (sessionLoadState === "error") {
      return (
        <div
          className="fixed inset-0 grid place-items-center px-5"
          style={{ backgroundColor: "var(--bg-page)" }}
        >
          <div
            data-testid="session-load-recovery"
            role="alert"
            className="w-full max-w-md rounded-3xl border p-7 text-center shadow-sm"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div
              className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--secondary-bg)", color: "var(--secondary)" }}
            >
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {tl("sessionRecovery.title")}
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
              {tl("sessionRecovery.description")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setOk(false);
                  setSessionLoadState("loading");
                  setSessionRetry((current) => current + 1);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {tl("sessionRecovery.retry")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearTokens();
                  router.replace("/login");
                }}
                className="min-h-11 rounded-xl border px-5 py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {tl("sessionRecovery.signInAgain")}
              </button>
            </div>
          </div>
        </div>
      );
    }

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
    <ActiveRunsProvider>
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
            <ActiveRunPill />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "light" ? tl("darkMode") : tl("lightMode")}
              className="p-2 rounded-xl transition-colors"
              style={{ color: "var(--text-muted)" }}
              title={theme === "light" ? tl("darkMode") : tl("lightMode")}
            >
              {theme === "light" ? <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <Sun className="w-[18px] h-[18px]" strokeWidth={1.5} />}
            </button>
            <button
              type="button"
              className="relative p-2 rounded-xl transition-colors"
              onClick={() => router.push("/dashboard/alerts")}
              aria-label={tl("openAlerts")}
              title={tl("openAlerts")}
              style={{ color: "var(--text-muted)" }}
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--secondary)" }} />
            </button>
            <button
              type="button"
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
        {isAnalyticSurface(pathname) && (
          <GlobalDataStatus
            snapshot={dataSnapshot}
            loadState={dataStatusLoadState}
            onRetry={() => setDataStatusRetry((value) => value + 1)}
          />
        )}
        <main className="p-4 md:p-6 lg:p-8">
          <div className="max-w-[1320px] mx-auto">
            <div className="empty:hidden mb-0 [&>*]:mb-6">
              <SubscriptionBanner plan={userPlan} subscriptionStatus={subscriptionStatus} planChangedAt={planChangedAt} />
            </div>
            {creditsDepleted && userPlan !== "free" && (
              <div className="mb-6">
                <CreditDepletedBanner plan={userPlan} />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
    </ActiveRunsProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ThemeProvider>
  );
}
