"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { getToken, setTokens } from "@/lib/auth";

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

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 lg:p-0">
      {/* Glow blobs */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-cyan-100 rounded-full blur-3xl opacity-30 pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-violet-100 rounded-full blur-3xl opacity-30 pointer-events-none translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-[1100px] min-h-[600px] lg:h-[680px] bg-white lg:rounded-3xl shadow-dream-lg lg:shadow-2xl overflow-hidden flex flex-col lg:flex-row relative lg:my-8 border border-white/80">

        {/* Left panel */}
        <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between p-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-violet-50 opacity-90" />
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-cyan-100 rounded-full blur-3xl opacity-50 animate-blob" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-50 animate-blob" style={{ animationDelay: "2s" }} />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100">
              <svg fill="none" height="22" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="22">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span className="text-2xl font-sans font-medium tracking-tight text-slate-700">sentimenta</span>
          </div>

          {/* Illustration card */}
          <div className="relative z-10">
            <div className="relative w-full max-w-sm mx-auto mb-10">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan to-brand-lilac rounded-[36px] opacity-10 rotate-6 scale-95" />
              <div className="bg-gradient-to-tr from-cyan-50 to-violet-50 rounded-[36px] shadow-dream p-8 overflow-hidden">
                {/* Mini dashboard preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-medium text-slate-500">Score geral</span>
                    <span className="text-xs text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">▲ +0.3</span>
                  </div>
                  <div className="text-3xl font-sans font-semibold text-slate-700">7.4 <span className="text-sm text-slate-400">/ 10</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full w-[74%] bg-gradient-to-r from-brand-lilac to-brand-cyanDark rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[["62%", "Positivo", "text-emerald-600 bg-emerald-50"], ["28%", "Neutro", "text-amber-600 bg-amber-50"], ["10%", "Negativo", "text-rose-600 bg-rose-50"]].map(([pct, label, cls]) => (
                      <div key={label} className={`rounded-xl p-2 text-center ${cls.split(" ")[1]}`}>
                        <div className={`font-sans font-semibold text-sm ${cls.split(" ")[0]}`}>{pct}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating card */}
              <div className="absolute -right-4 top-6 bg-white p-3 rounded-2xl shadow-card border border-white/50 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 text-sm">✨</div>
                <div>
                  <p className="text-[10px] text-slate-400">Análise de hoje</p>
                  <p className="text-xs font-sans font-medium text-slate-700">Tudo calmo por aqui</p>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-sans font-medium text-slate-700 leading-tight mb-3">
              Entenda sua reputação com{" "}
              <span className="text-gradient">delicadeza</span>.
            </h2>
            <p className="text-slate-400 font-light">
              Monitoramento de sentimentos que traz paz, não ruído.
            </p>
          </div>

          <div className="relative z-10 flex gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-700" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 bg-white flex flex-col justify-center items-center p-8 md:p-12 lg:p-16 overflow-y-auto">
          <div className="w-full max-w-sm space-y-7">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 justify-center mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-md">
                <svg fill="none" height="18" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
                  <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
                </svg>
              </div>
              <span className="text-xl font-sans font-medium text-slate-700">sentimenta</span>
            </div>

            {/* Heading */}
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-sans font-medium text-slate-800 mb-1">
                {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
              </h3>
              <p className="text-slate-400 font-light text-sm">
                {mode === "login"
                  ? "Insira seus dados para acessar o painel zen."
                  : "Comece grátis por 14 dias, sem cartão."}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="p-1 bg-slate-50 rounded-xl flex gap-1 border border-slate-100">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-white shadow-sm text-slate-700 border border-slate-100"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  mode === "register"
                    ? "bg-white shadow-sm text-slate-700 border border-slate-100"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Cadastrar
              </button>
            </div>

            {/* Google button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all font-medium py-3 rounded-2xl shadow-input group"
              onClick={() => setError("Login com Google em breve. Use email/senha por enquanto.")}
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Entrar com Google</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-100" />
              <span className="flex-shrink-0 mx-4 text-[10px] text-slate-300 uppercase tracking-widest font-medium">ou e-mail</span>
              <div className="flex-grow border-t border-slate-100" />
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 ml-1" htmlFor="name">Nome</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 ml-1" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.com"
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-medium text-slate-500" htmlFor="password">Senha</label>
                  {mode === "login" && (
                    <button type="button" className="text-xs font-medium text-brand-lilacDark hover:text-brand-cyanDark transition-colors">
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 transition-all outline-none text-sm pr-12"
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
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white font-sans font-medium rounded-2xl shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === "login" ? "Entrando..." : "Criando conta..."}
                  </span>
                ) : mode === "login" ? (
                  "Entrar no Sentimenta"
                ) : (
                  "Criar minha conta"
                )}
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
