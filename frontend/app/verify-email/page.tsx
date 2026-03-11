"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { authApi } from "@/lib/api";
import { getToken, clearTokens } from "@/lib/auth";
import FogBackground from "@/components/FogBackground";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "pending" | "verified" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  const checkVerification = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const user = await authApi.me(token);
      setEmail(user.email);

      if (user.email_verified) {
        setStatus("verified");
        setMessage("Email verificado com sucesso!");
        setTimeout(() => router.replace("/dashboard"), 2000);
      } else {
        setStatus("pending");
      }
    } catch {
      clearTokens();
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
    const verified = searchParams.get("verified");
    const tokenParam = searchParams.get("token");

    if (verified === "true") {
      // Came back from backend redirect after successful verification
      // Clean URL
      window.history.replaceState({}, "", "/verify-email");
      // Re-check user status
      checkVerification();
      return;
    }

    if (tokenParam) {
      // Should not happen — the backend GET /auth/verify-email handles the redirect.
      // But if somehow token is in URL, redirect to backend endpoint
      window.location.href = `/api/v1/auth/verify-email?token=${tokenParam}`;
      return;
    }

    checkVerification();
  }, [searchParams, router, checkVerification]);

  const handleResend = async () => {
    const token = getToken();
    if (!token) return;

    setResendLoading(true);
    setResendMessage("");
    try {
      const res = await authApi.sendVerification(token);
      setResendMessage(res.message);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Erro ao reenviar email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#FDFBFF]">
      <FogBackground />
      <div className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_top,rgba(196,181,253,0.12)_0%,transparent_60%)]" />

      <div
        className={`relative z-10 w-full max-w-md frosted-panel rounded-3xl overflow-hidden transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="bg-white/60 backdrop-blur-xl p-8 md:p-12 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2 justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100">
              <svg fill="none" height="22" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="22">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span className="text-2xl font-sans font-bold tracking-tight text-slate-700">sentimenta</span>
          </div>

          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="animate-spin h-8 w-8 border-2 border-violet-300 border-t-transparent rounded-full" />
              <p className="text-slate-400 text-sm">Carregando...</p>
            </div>
          )}

          {status === "verified" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Email verificado!</h3>
              <p className="text-slate-400 text-sm">
                Redirecionando para o dashboard...
              </p>
              <div className="h-1 w-24 mx-auto bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-full progress-shimmer rounded-full" />
              </div>
            </div>
          )}

          {status === "pending" && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-400 text-3xl">mail</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Verifique seu email</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Enviamos um link de verificacao para{" "}
                  {email ? (
                    <span className="font-semibold text-slate-600">{email}</span>
                  ) : (
                    "seu email"
                  )}
                  . Clique no link para ativar sua conta.
                </p>
              </div>

              <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-2">
                <p className="text-xs text-slate-400">
                  Nao recebeu o email? Verifique a pasta de spam ou clique abaixo para reenviar.
                </p>
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="w-full py-3 bg-slate-900 text-white font-sans font-bold rounded-2xl shadow-lg shadow-slate-200/60 hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {resendLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando...
                    </span>
                  ) : (
                    "Reenviar email de verificacao"
                  )}
                </button>
              </div>

              {resendMessage && (
                <p className={`text-xs px-3 py-2 rounded-xl ${
                  resendMessage.includes("enviado") || resendMessage.includes("verificado")
                    ? "text-emerald-600 bg-emerald-50 border border-emerald-100"
                    : "text-rose-600 bg-rose-50 border border-rose-100"
                }`}>
                  {resendMessage}
                </p>
              )}

              <button
                onClick={() => checkVerification()}
                className="text-sm text-violet-500 hover:text-violet-700 transition-colors font-medium"
              >
                Ja verifiquei, atualizar status
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-rose-400 text-3xl">error</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Erro na verificacao</h3>
              <p className="text-slate-400 text-sm">{message}</p>
              <button
                onClick={() => router.replace("/login")}
                className="text-sm text-violet-500 hover:text-violet-700 transition-colors font-medium"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFBFF]">
          <div className="animate-spin h-8 w-8 border-2 border-violet-300 border-t-transparent rounded-full" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
