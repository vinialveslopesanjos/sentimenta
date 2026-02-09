"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useGoogleLogin } from "@/lib/useGoogleLogin";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin(credential: string) {
    setError("");
    setLoading(true);
    try {
      const result = await authApi.googleLogin(credential);
      setTokens(result.access_token, result.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar com Google");
    } finally {
      setLoading(false);
    }
  }

  const { renderButton } = useGoogleLogin(handleGoogleLogin);

  useEffect(() => {
    // Render Google button after component mounts
    const timer = setTimeout(() => {
      renderButton("google-signin-button");
    }, 100);
    return () => clearTimeout(timer);
  }, [renderButton]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        result = await authApi.register(email, password, name || undefined);
      } else {
        result = await authApi.login(email, password);
      }
      setTokens(result.access_token, result.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold">
            {isRegister ? "Criar conta" : "Entrar"}
          </h1>
          <p className="text-sm text-text-secondary">
            {isRegister
              ? "Crie sua conta para começar"
              : "Faça login para acessar seu dashboard"}
          </p>
        </div>

        {/* Google OAuth */}
        <div id="google-signin-button" className="w-full" />

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-muted">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email form */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    Nome
                  </label>
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  Senha
                </label>
                <Input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-negative bg-negative/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? "Carregando..."
                  : isRegister
                  ? "Criar conta"
                  : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-text-secondary">
          {isRegister ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-accent hover:underline"
          >
            {isRegister ? "Faça login" : "Crie uma"}
          </button>
        </p>
      </div>
    </div>
  );
}
