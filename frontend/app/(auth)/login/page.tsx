"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { getToken, setTokens } from "@/lib/auth";
import FogBackground from "@/components/FogBackground";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
    setMounted(true);
  }, [router]);

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
      setSuccess(mode === "login" ? "Login realizado!" : "Conta criada!");
      router.replace("/dashboard");
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
              {[
                { val: "8.4M", label: "comentários analisados" },
                { val: "2.000+", label: "perfis conectados" },
              ].map((s) => (
                <div key={s.val} className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl p-3 shadow-sm">
                  <p className="font-sans font-bold text-xl text-slate-800">{s.val}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="relative z-10 flex gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-lilacDark" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
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

            {/* Google button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white/80 border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 transition-all font-medium py-3 rounded-2xl shadow-sm group"
              onClick={() => setError("Login com Google em breve. Use email/senha por enquanto.")}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Entrar com Google</span>
            </button>

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
                  {mode === "login" && (
                    <button type="button" className="text-xs font-medium text-brand-lilacDark hover:text-brand-cyanDark transition-colors">
                      Esqueceu a senha?
                    </button>
                  )}
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

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
              )}
              {success && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{success}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white font-sans font-bold rounded-2xl shadow-lg shadow-violet-200/60 hover:shadow-xl hover:shadow-violet-300/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 text-sm"
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
              <button className="text-slate-400 hover:text-brand-lilacDark transition-colors underline">Termos de Uso</button>
              {" "}e{" "}
              <button className="text-slate-400 hover:text-brand-lilacDark transition-colors underline">Privacidade</button>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
