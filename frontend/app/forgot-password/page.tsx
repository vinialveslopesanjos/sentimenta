"use client";

import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ds/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Digite seu email");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-card)" }}>
      <div className="w-full max-w-[400px]">
        <Link href="/login" className="inline-flex items-center gap-1.5 mb-8" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Esqueceu a senha?
        </h1>
        <p className="mt-2 mb-8" style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Digite o email da sua conta e enviaremos um link para redefinir sua senha.
        </p>

        {sent ? (
          <div className="rounded-xl p-6" style={{ backgroundColor: "var(--sentiment-positive-bg)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--sentiment-positive)", fontWeight: 500 }}>
              Email enviado!
            </p>
            <p className="mt-2" style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Se existe uma conta com esse email, voce recebera um link para redefinir sua senha. Verifique tambem a caixa de spam.
            </p>
            <Link href="/login">
              <Button className="mt-4" fullWidth>
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl transition-all"
                  style={{ fontSize: "0.85rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p className="px-3 py-2 rounded-xl" style={{ fontSize: "0.78rem", color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de redefinicao"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
