"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { authApi } from "@/lib/api";
import { getToken, setTokens } from "@/lib/auth";
import FogBackground from "@/components/FogBackground";

type Mode = "login" | "register";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Handle OAuth callback — exchange one-time code for tokens via POST
  useEffect(() => {
    const oauthCode = searchParams.get("oauth_code");
    const oauthError = searchParams.get("error");

    if (oauthCode) {
      // Clean URL immediately so code is not visible
      window.history.replaceState({}, "", "/login");
      setSocialLoading("exchanging");

      authApi.exchangeOAuthCode(oauthCode)
        .then((res) => {
          setTokens(res.access_token, res.refresh_token);
          setSuccess(`Login via ${res.provider || "social"} realizado!`);
          if (res.pipeline_started) {
            localStorage.setItem("sentimenta_pipeline_started", Date.now().toString());
          }
          router.replace("/dashboard");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Falha ao autenticar via login social.");
          setSocialLoading(null);
        });
      return;
    }

    if (oauthError) {
      setError(`Falha no login social: ${decodeURIComponent(oauthError)}`);
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
    setMounted(true);
  }, [router]);

  const handleSocialLogin = async (provider: "instagram" | "tiktok") => {
    setSocialLoading(provider);
    setError("");
    try {
      const res =
        provider === "instagram"
          ? await authApi.instagramAuthUrl()
          : await authApi.tiktokAuthUrl();
      window.location.href = res.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Falha ao conectar com ${provider}.`);
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Preencha email e senha.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await authApi.login(email.trim(), password)
          : await authApi.register(email.trim(), password, name.trim() || undefined);

      setTokens(res.access_token, res.refresh_token);
      if (mode === "register") {
        setSuccess("Conta criada! Verifique seu email.");
        router.replace("/verify-email");
      } else {
        setSuccess("Login realizado!");
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#FDFBFF]">
      {/* Fog canvas background */}
      <FogBackground />

      {/* Extra subtle glow overlay */}
      <div className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_top,rgba(196,181,253,0.12)_0%,transparent_60%)]" />

      {/* Main frosted panel */}
      <div
        className={`relative z-10 w-full max-w-[1060px] min-h-[580px] lg:h-[660px] frosted-panel lg:rounded-3xl overflow-hidden flex flex-col lg:flex-row transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
      >
        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-[44%] relative flex-col justify-between p-12 overflow-hidden">
          {/* Inner fog accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/70 via-white/30 to-cyan-50/60 pointer-events-none" />

          {/* Logo */}
          <div
            className={`relative z-10 flex items-center gap-3 transition-all duration-500 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100">
              <svg fill="none" height="22" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="22">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span className="text-2xl font-sans font-bold tracking-tight text-slate-700">sentimenta</span>
          </div>

          {/* Hero text */}
          <div className="relative z-10 space-y-4">
            <div
              className={`transition-all duration-500 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
            >
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Plataforma de sentimentos</p>
              <h2 className="text-4xl font-sans font-bold text-slate-800 leading-[1.1] tracking-tight">
                {mode === "login" ? (
                  <>Escute o que o<br /><span className="text-gradient">mundo sente.</span></>
                ) : (
                  <>Transforme ruído<br />em <span className="text-gradient">clareza.</span></>
                )}
              </h2>
            </div>

            <p
              className={`text-slate-500 font-light leading-relaxed transition-all duration-500 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
            >
              Clareza emocional em tempo real. Monitoramento de sentimentos que traz paz, não ruído.
            </p>

            {/* Mini stat cards */}
            <div
              className={`grid grid-cols-2 gap-3 pt-2 transition-all duration-500 delay-[400ms] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
            >
              <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl p-4 shadow-sm col-span-2">
                <p className="text-sm text-slate-500 font-light leading-relaxed">Analise de sentimento para redes sociais. Conecte seu perfil e entenda o que seu publico sente.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right panel — form */}
        <div className="flex-1 bg-white/60 backdrop-blur-xl flex flex-col justify-center items-center p-8 md:p-12 overflow-y-auto">
          <div
            className={`w-full max-w-sm space-y-6 transition-all duration-500 delay-[200ms] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
          >
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 justify-center mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-md">
                <svg fill="none" height="18" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
                  <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
                </svg>
              </div>
              <span className="text-xl font-sans font-bold text-slate-700">sentimenta</span>
            </div>

            {/* Heading */}
            <div>
              <h3 className="text-2xl font-sans font-bold text-slate-800 mb-1">
                {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
              </h3>
              <p className="text-slate-400 font-light text-sm">
                {mode === "login" ? "Clareza emocional em tempo real." : "Comece grátis por 14 dias, sem cartão."}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="p-1 bg-slate-50/80 rounded-2xl flex gap-1 border border-slate-100">
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${mode === m
                      ? "bg-white shadow-sm text-brand-lilacDark border border-white"
                      : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {m === "login" ? "Login" : "Cadastrar"}
                </button>
              ))}
            </div>

            {/* Social login buttons */}
            <div className="space-y-2.5">
              {/* Instagram */}
              <button
                type="button"
                onClick={() => handleSocialLogin("instagram")}
                disabled={socialLoading !== null}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-medium py-3 rounded-2xl shadow-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {socialLoading === "instagram" ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                )}
                <span>{socialLoading === "instagram" ? "Redirecionando..." : "Entrar com Instagram"}</span>
              </button>

              {/* TikTok */}
              <button
                type="button"
                onClick={() => handleSocialLogin("tiktok")}
                disabled={socialLoading !== null}
                className="w-full flex items-center justify-center gap-3 bg-black text-white font-medium py-3 rounded-2xl shadow-sm hover:shadow-lg hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {socialLoading === "tiktok" ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.14v-3.47a4.85 4.85 0 01-3.77-1.75V6.69h3.77z" />
                  </svg>
                )}
                <span>{socialLoading === "tiktok" ? "Redirecionando..." : "Entrar com TikTok"}</span>
              </button>

            </div>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-100" />
              <span className="flex-shrink-0 mx-4 text-[10px] text-slate-300 uppercase tracking-widest font-medium">ou e-mail</span>
              <div className="flex-grow border-t border-slate-100" />
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 ml-1" htmlFor="name">Nome</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-brand-lilac">person</span>
                    <input
                      id="name" type="text" value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/70 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1" htmlFor="email">Email</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-brand-lilac">mail</span>
                  <input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@exemplo.com"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/70 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-slate-500" htmlFor="password">Senha</label>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-brand-lilac">lock</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3.5 rounded-2xl bg-white/70 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    Li e aceito os{" "}
                    <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 underline">Termos de Uso</a>
                    {" "}e a{" "}
                    <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 underline">Política de Privacidade</a>.
                  </span>
                </label>
              )}

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
              )}
              {success && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{success}</p>
              )}

              <button
                type="submit"
                disabled={loading || (mode === "register" && !acceptedTerms)}
                className="w-full py-4 bg-slate-900 text-white font-sans font-bold rounded-2xl shadow-lg shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-300/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === "login" ? "Conectando..." : "Criando conta..."}
                  </span>
                ) : mode === "login" ? "Conectar" : "Criar conta"}
              </button>
            </form>

            <p className="text-center text-xs text-slate-300 leading-relaxed">
              Ao continuar, você concorda com nossos{" "}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-lilacDark transition-colors underline">Termos de Uso</a>
              {" "}e{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-lilacDark transition-colors underline">Privacidade</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FDFBFF]"><div className="animate-spin h-8 w-8 border-2 border-violet-300 border-t-transparent rounded-full" /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
