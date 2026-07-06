"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Logo } from "@/components/ds/Logo";
import { currentAttributionPath, getAttribution, trackDiagnosticLead } from "@/lib/tracking";

type DiagnosticForm = {
  name: string;
  email: string;
  role: string;
  profileOrPost: string;
  context: string;
};

const initialForm: DiagnosticForm = {
  name: "",
  email: "",
  role: "agencia",
  profileOrPost: "",
  context: "",
};

export default function DiagnosticoPage() {
  const [form, setForm] = useState<DiagnosticForm>(initialForm);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const attribution = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getAttribution();
  }, []);

  const update = (key: keyof DiagnosticForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/v1/leads/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          profile_or_post: form.profileOrPost,
          context: form.context || null,
          source_path: currentAttributionPath(),
          attribution,
          website: "",
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || "Não foi possível enviar agora.");
      }

      await trackDiagnosticLead({
        role: form.role,
        attribution,
      });
      setSent(true);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 84%, transparent)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-4 md:px-8">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <Link href="/blog" className="text-sm" style={{ color: "var(--text-muted)" }}>
            Blog
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-[1040px] grid-cols-1 gap-8 px-4 py-10 md:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-14">
        <div>
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
            Diagnóstico gratuito
          </span>
          <h1 className="mt-5" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "clamp(2rem, 5vw, 3.4rem)", fontWeight: 800, letterSpacing: "0", lineHeight: 1.04 }}>
            Envie um perfil ou post público. Receba 3 achados práticos.
          </h1>
          <p className="mt-5 text-lg leading-8" style={{ color: "var(--text-muted)" }}>
            O Sentimenta analisa comentários reais e mostra o sentimento geral, os temas que aparecem e os
            pontos que merecem resposta ou atenção.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Não precisa conectar conta para pedir a amostra.",
              "Use um @ público ou link de post de Instagram/YouTube.",
              "Análise feita pelo motor do Sentimenta, com revisão humana.",
              "Resposta em até 24h úteis, com uma leitura curta e acionável.",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" style={{ color: "var(--sentiment-positive)" }} />
                <p className="leading-7" style={{ color: "var(--text-secondary)" }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5 md:p-7" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          {sent ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: "var(--primary-bg)" }}>
                <ShieldCheck className="h-7 w-7" style={{ color: "var(--primary)" }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Pedido recebido
              </h2>
              <p className="mx-auto mt-3 max-w-[420px] leading-7" style={{ color: "var(--text-muted)" }}>
                Nossa equipe vai analisar o perfil/post e responder com os achados. Se faltar contexto,
                pedimos o link certo por e-mail.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 rounded-xl px-5 py-3 text-sm font-medium"
                style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}
              >
                Enviar outro pedido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Pedir diagnóstico
                </h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  Preencha o mínimo necessário para sabermos o que analisar.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nome</span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                    placeholder="Seu nome"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>E-mail</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                    placeholder="voce@email.com"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Você é...</span>
                <select
                  value={form.role}
                  onChange={(event) => update("role", event.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                >
                  <option value="agencia">Agência</option>
                  <option value="social-media">Social media</option>
                  <option value="criador">Criador de conteúdo</option>
                  <option value="marca">Marca/empresa</option>
                  <option value="outro">Outro</option>
                </select>
              </label>

              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Perfil ou post público</span>
                <input
                  required
                  value={form.profileOrPost}
                  onChange={(event) => update("profileOrPost", event.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                  placeholder="@perfil ou link do post"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Contexto opcional</span>
                <textarea
                  rows={4}
                  value={form.context}
                  onChange={(event) => update("context", event.target.value)}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                  placeholder="Ex: quero entender se a campanha gerou crítica, dúvida ou oportunidade de resposta."
                />
              </label>

              {error && (
                <p className="rounded-xl px-4 py-3 text-sm" style={{ color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={sending}
                icon={sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              >
                {sending ? "Enviando..." : "Pedir diagnóstico gratuito"}
              </Button>
            </form>
          )}
        </div>
      </section>

      <section className="px-4 pb-14 md:px-8" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <div className="mx-auto max-w-[1040px] py-12">
          <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
            O que é o Sentimenta
          </span>
          <h2 className="mt-4 max-w-[720px] text-3xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
            A plataforma que transforma comentários em sinais de sentimento, emoção e risco
          </h2>
          <p className="mt-4 max-w-[680px] text-lg leading-8" style={{ color: "var(--text-muted)" }}>
            O diagnóstico gratuito usa o mesmo motor do painel: coleta de comentários públicos de
            Instagram e YouTube, classificação por IA e leitura clara do que está ajudando ou
            prejudicando a sua imagem.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Score de sentimento", "Positivo, neutro e negativo em um número acompanhável no tempo."],
              ["Mapa de emoções", "Alegria, raiva, tristeza e surpresa para entender o porquê da reação."],
              ["Sinais de risco", "Críticas recorrentes e alertas antes de virarem crise pública."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" style={{ color: "var(--primary)" }} />
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
                </div>
                <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-start gap-4 rounded-lg border p-6 md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="flex items-start gap-3">
              <MessageSquareText className="mt-1 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
              <p className="max-w-[560px] leading-7" style={{ color: "var(--text-secondary)" }}>
                Prefere explorar por conta própria? Inicie um trial de 14 dias com cartão e use
                1.000 créditos de teste para analisar comentários reais no painel.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold"
              style={{ color: "white", backgroundColor: "var(--primary)" }}
            >
              Iniciar trial de 14 dias
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
