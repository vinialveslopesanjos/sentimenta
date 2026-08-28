"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiRequestError, authApi } from "@/lib/api";
import { getToken, setTokens } from "@/lib/auth";
import { getAttribution, track, trackCompletedSignup } from "@/lib/tracking";
import SocialLogin from "@/components/SocialLogin";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";

type Mode = "login" | "register";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("login");
  const tl = useTranslations("landing");
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const oauthCode = searchParams.get("oauth_code");
    const oauthError = searchParams.get("error");

    if (oauthCode) {
      window.history.replaceState({}, "", "/login");
      setSocialLoading("exchanging");
      authApi.exchangeOAuthCode(oauthCode)
        .then((res) => {
          setTokens(res.access_token, res.refresh_token);
          setSuccess(t("socialLoginSuccess", { provider: res.provider || "social" }));
          if (res.pipeline_started) {
            localStorage.setItem("sentimenta_pipeline_started", Date.now().toString());
          }
          router.replace("/dashboard");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t("errors.socialLoginFailed"));
          setSocialLoading(null);
        });
      return;
    }

    if (oauthError) {
      setError(`${t("errors.socialLoginFailed")}: ${decodeURIComponent(oauthError)}`);
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
    setMounted(true);
  }, [router]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(""); setSuccess("");

    if (!email.trim() || !password) { setError(t("errors.fillEmailPassword")); return; }
    if (password.length < 8) { setError(t("errors.passwordMinLength")); return; }
    if (mode === "register" && !name.trim()) { setError(t("errors.enterName")); return; }
    if (mode === "register" && !acceptedTerms) { setError(t("errors.acceptTerms")); return; }

    setLoading(true);
    const attribution = getAttribution();
    track(mode === "login" ? "login_attempt" : "register_attempt", { attribution });
    try {
      const res = mode === "login"
        ? await authApi.login(email.trim(), password)
        : await authApi.register(email.trim(), password, name.trim() || undefined, acceptedTerms);

      setTokens(res.access_token, res.refresh_token);
      if (mode === "register") {
        await trackCompletedSignup({ attribution });
        setSuccess(t("accountCreated"));
        router.replace("/verify-email");
      } else {
        track("login_success", { attribution });
        router.replace("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.kind === "timeout") {
        setError(t("errors.timeout"));
      } else if (err instanceof ApiRequestError && err.kind === "network") {
        setError(t("errors.connection"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.authFailed"));
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left -- brand */}
      <div className="hidden lg:flex w-[460px] shrink-0 flex-col justify-between p-12 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0e2325 0%, #1d4649 40%, #226e77 100%)" }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 20% 80%, rgba(57,184,198,0.5) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-15" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(182,73,107,0.4) 0%, transparent 50%)" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-24">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #88d4dd, #61c6d1, #39b8c6)" }}>
              <svg fill="none" height="16" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="16">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: "1.05rem", color: "white", letterSpacing: "-0.02em" }}>sentimenta</span>
          </div>

          <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1.1, color: "white" }}>
              {t("brandHeadline")}<br />{" "}
              <span style={{ background: "linear-gradient(135deg, #61c6d1, #88d4dd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("brandHighlight")}</span>
            </h1>
            <p className="mt-5 max-w-[300px]" style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(255,255,255,0.4)" }}>
              {t("brandSubtitle")}
            </p>
          </div>
        </div>

        <div data-testid="login-trust-stats" className={`relative z-10 grid grid-cols-3 gap-4 mb-6 transition-all duration-500 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {[
            { label: t("stats.emotionsTracked"), value: "8" },
            { label: t("stats.platforms"), value: "4" },
            { label: t("stats.dataOrigin"), value: t("stats.oneClick") },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "white" }}>{stat.value}</p>
              <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div data-testid="login-trust-message" className={`relative z-10 rounded-2xl p-6 border border-white/[0.08] transition-all duration-500 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ backgroundColor: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.6)" }}>
            &ldquo;{t("testimonial")}&rdquo;
          </p>
          <p className="mt-3" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{t("testimonialAuthor")}</p>
        </div>
      </div>

      {/* Right -- form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-card)" }}>
        <div className={`w-full max-w-[380px] transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="lg:hidden mb-8">
            <Logo size="md" />
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {mode === "login" ? t("welcomeBack") : t("createAccount")}
          </h2>
          <p className="mt-1.5 mb-8" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {mode === "login" ? t("accessDashboard") : t("freePlanInfo")}
          </p>

          {/* Toggle */}
          <div className="flex mb-8 rounded-xl p-1" style={{ backgroundColor: "var(--bg-subtle)" }}>
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                className="flex-1 py-2.5 rounded-lg transition-all duration-200"
                style={{ fontSize: "0.85rem", fontWeight: 500, backgroundColor: mode === m ? "var(--bg-card)" : "transparent", color: mode === m ? "var(--text-primary)" : "var(--text-muted)", boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
              >
                {m === "login" ? t("loginTab") : t("registerTab")}
              </button>
            ))}
          </div>

          {/* Login social — sem senha, sem muro de verificação de e-mail */}
          <SocialLogin onError={setError} />

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
            <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{t("orEmail")}</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("nameLabel")}</label>
                <input
                  type="text"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl transition-all"
                  style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                />
              </div>
            )}
            <div>
              <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("emailLabel")}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
                <input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl transition-all"
                  style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <div>
              <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("passwordLabel")}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 rounded-xl transition-all"
                  style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text-faint)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[var(--primary)]"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {t("termsCheckbox")}{" "}
                  <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{t("termsOfUse")}</a>
                  {" "}{t("and")}{" "}
                  <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{t("privacyPolicy")}</a>.
                </span>
              </label>
            )}

            {mode === "login" && (
              <div className="text-right">
                <a href="/forgot-password" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>{t("forgotPassword")}</a>
              </div>
            )}

            {error && (
              <p role="alert" className="px-3 py-2 rounded-xl" style={{ fontSize: "0.78rem", color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>{error}</p>
            )}
            {success && (
              <p className="px-3 py-2 rounded-xl" style={{ fontSize: "0.78rem", color: "var(--sentiment-positive)", backgroundColor: "var(--sentiment-positive-bg)" }}>{success}</p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              className="!mt-6"
              disabled={loading || (mode === "register" && !acceptedTerms)}
            >
              {loading ? (mode === "login" ? t("loggingIn") : t("creatingAccount")) : mode === "login" ? t("loginButton") : t("registerButton")}
            </Button>
          </form>

          <p className="text-center mt-6" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
            {t("termsConsent")}{" "}
            <a href="/termos" style={{ color: "var(--primary)" }}>{t("terms")}</a> e{" "}
            <a href="/privacidade" style={{ color: "var(--primary)" }}>{t("privacy")}</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-card)" }}><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
