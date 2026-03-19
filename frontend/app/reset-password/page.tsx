"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ds/Button";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-card)" }}>
        <div className="w-full max-w-[400px] text-center">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Link invalido
          </h1>
          <p className="mt-2 mb-6" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Este link de redefinicao de senha e invalido ou expirou.
          </p>
          <Link href="/forgot-password">
            <Button fullWidth>Solicitar novo link</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas nao coincidem");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-card)" }}>
        <div className="w-full max-w-[400px] text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--sentiment-positive)" }} />
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Senha redefinida!
          </h1>
          <p className="mt-2 mb-6" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Sua senha foi atualizada com sucesso. Faca login com sua nova senha.
          </p>
          <Link href="/login">
            <Button fullWidth size="lg">Ir para o login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-card)" }}>
      <div className="w-full max-w-[400px]">
        <Link href="/login" className="inline-flex items-center gap-1.5 mb-8" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Criar nova senha
        </h1>
        <p className="mt-2 mb-8" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Digite sua nova senha abaixo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>Nova senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl transition-all"
                style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                autoFocus
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>Confirmar senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl transition-all"
                style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
            Minimo 8 caracteres, com letras maiusculas, minusculas e numeros.
          </p>

          {error && (
            <p className="px-3 py-2 rounded-xl" style={{ fontSize: "0.78rem", color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>
              {error}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-card)" }}><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} /></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
