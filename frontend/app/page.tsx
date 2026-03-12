"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { landingLatestTotals, landingMonthlySentiment } from "@/lib/landingMockData";
import { track } from "@/lib/tracking";

declare global {
  interface Window {
    VANTA?: {
      NET: (config: Record<string, unknown>) => { destroy?: () => void };
      FOG: (config: Record<string, unknown>) => { destroy?: () => void };
    };
  }
}

function formatMonthYear(period: string) {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

function formatMonthTooltip(period: string) {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

function LandingSentimentTrendChart() {
  const pts = landingMonthlySentiment.map((row) => ({
    period: row.month,
    positive: row.positive,
    neutral: row.neutral,
    negative: row.negative,
    total_comments: row.total,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pts} margin={{ top: 8, right: 8, left: -14, bottom: 8 }}>
          <defs>
            <linearGradient id="gradPositiveLanding" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#34D399" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="gradNeutralLanding" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="gradNegativeLanding" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FB7185" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={40}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={formatMonthYear}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(139, 92, 246, 0.05)" }}
            labelFormatter={formatMonthTooltip}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                positive: "Positivo",
                neutral: "Neutro",
                negative: "Negativo",
              };
              return [Math.round(value).toLocaleString("pt-BR"), labels[name] || name];
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #f1f5f9",
              fontSize: 11,
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              padding: "10px 14px",
            }}
          />
          <Bar dataKey="positive" stackId="sent" fill="url(#gradPositiveLanding)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="neutral" stackId="sent" fill="url(#gradNeutralLanding)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="negative" stackId="sent" fill="url(#gradNegativeLanding)" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100">
        <svg fill="none" height="22" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="22">
          <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
        </svg>
      </div>
      <span className="text-2xl font-sans font-medium tracking-tight text-slate-700">sentimenta</span>
    </div>
  );
}

const features = [
  {
    icon: "hub",
    color: "bg-violet-50 text-brand-lilacDark",
    title: "Conecte",
    desc: "Sem senhas, sem burocracia. Basta colar o @ da conta. Nada de permissões chatas ou logins complicados. Em segundos, estamos prontos para ouvir.",
  },
  {
    icon: "psychology",
    color: "bg-cyan-50 text-brand-cyanDark",
    title: "Analise",
    desc: "A gente faz o trabalho sujo. Nossa IA lê comentário por comentário. Ela identifica elogios reais, críticas construtivas e até sinais sutis de contexto que passam despercebidos.",
  },
  {
    icon: "insights",
    color: "bg-rose-50 text-rose-500",
    title: "Entenda",
    desc: "A verdade mastigada para você. Nada de planilhas infinitas. Você recebe um relatório que parece uma conversa, te dizendo exatamente onde você acertou a mão e onde o clima pesou.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R$79",
    period: "/mês",
    desc: "Para criadores e profissionais.",
    features: ["1 perfil conectado", "1.000 comentários/mês", "Análise de sentimento", "Dashboard completo", "Relatório semanal por e-mail"],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$199",
    period: "/mês",
    desc: "Para agências e marcas em crescimento.",
    features: ["5 perfis conectados", "10.000 comentários/mês", "Tudo do Starter", "Alertas de crise em tempo real", "Comparativo entre perfis", "API de acesso"],
    cta: "Começar grátis",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "R$599",
    period: "/mês",
    desc: "Para grandes operações e políticos.",
    features: ["Perfis ilimitados", "Comentários ilimitados", "Tudo do Pro", "Onboarding dedicado", "SLA garantido", "Relatórios customizados"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Preciso de login no Instagram para conectar?",
    a: "Não! Basta informar o @ da conta pública. Nossa IA coleta os comentários automaticamente via API.",
  },
  {
    q: "Quanto tempo leva para analisar uma conta?",
    a: "Dependendo do volume, entre 2 a 15 minutos. Você acompanha o progresso em tempo real no dashboard.",
  },
  {
    q: "Os dados ficam armazenados com segurança?",
    a: "Sim. Todos os dados são criptografados em repouso e em trânsito, com backups diários.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, sem multa ou fidelidade. Cancele quando quiser pelo painel de configurações.",
  },
  {
    q: "O que acontece ao fim dos 14 dias grátis?",
    a: "Você escolhe um plano ou a conta é pausada. Seus dados ficam por 30 dias para você decidir.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const vantaRef = useRef<{ destroy?: () => void } | null>(null);
  const fogScriptLoadedRef = useRef(false);
  const threeScriptLoadedRef = useRef(false);

  const initFog = () => {
    if (!threeScriptLoadedRef.current || !fogScriptLoadedRef.current) return;
    if (!window.VANTA?.FOG || vantaRef.current) return;
    vantaRef.current = window.VANTA.FOG({
      el: "#landing-vanta-bg",
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      highlightColor: 0x00e5ff,
      midtoneColor: 0x6721bb,
      blurFactor: 0.36,
      speed: 0.7,
      zoom: 1.5,
      scale: 1,
      scaleMobile: 1,
    });
  };

  useEffect(() => {
    return () => {
      if (vantaRef.current?.destroy) vantaRef.current.destroy();
      vantaRef.current = null;
    };
  }, []);

  return (
    <div className="font-body antialiased overflow-x-hidden relative">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          threeScriptLoadedRef.current = true;
          initFog();
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          fogScriptLoadedRef.current = true;
          initFog();
        }}
      />
      <div
        id="landing-vanta-bg"
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.18)_38%,rgba(255,255,255,0.08)_100%)]" />
      <div className="relative z-10">

      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-brand-lilacDark transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-brand-lilacDark transition-colors">Preços</a>
<Link href="/login" className="text-slate-800 hover:text-brand-lilacDark transition-colors">Login</Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 text-sm"
            >
              Comece grátis
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Menu"
          >
            <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
              {mobileMenuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="absolute top-20 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 hover:text-brand-lilacDark transition-colors py-2">Recursos</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 hover:text-brand-lilacDark transition-colors py-2">Precos</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-800 hover:text-brand-lilacDark transition-colors py-2">Login</Link>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block text-center px-5 py-3 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all">Comece gratis</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <header className="pt-36 pb-24 px-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-to-b from-violet-100/50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">

          <h1 className="text-5xl md:text-7xl font-sans font-semibold text-brand-heading leading-[1.1] tracking-tight animate-slide-up">
            Entenda o que eles sentem, não apenas o que escrevem.
          </h1>

          <p className="text-lg md:text-xl text-slate-700 font-light max-w-3xl mx-auto leading-relaxed">
            Nossos Agentes de IA analisam cada post e comentário das suas redes para gerar um direcionamento claro. Saiba o que seu público ama, o que detesta e o que ele está pedindo para você postar amanhã.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/login"
              onClick={() => track("landing_cta_clicked", { cta: "hero_primary" })}
              className="px-8 py-4 rounded-full liquid-btn bg-slate-900 text-white font-medium text-lg hover:bg-slate-800 hover:scale-105 transition-all duration-300"
            >
              Comece grátis 14 dias
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-full liquid-btn bg-white/82 text-slate-700 font-medium text-lg border border-white/70 hover:border-brand-lilac hover:text-brand-lilacDark transition-all duration-300 flex items-center gap-2"
            >
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Saiba mais
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 pt-4 text-sm text-slate-700">
            <span className="font-sans font-semibold text-slate-900 text-lg">14 dias</span>
            <span>grátis, sem cartão de crédito</span>
          </div>
        </div>

        {/* Dashboard + IA report mockup */}
        <div className="max-w-7xl mx-auto mt-20 relative">
          <div className="absolute -right-16 top-16 w-64 h-64 bg-violet-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
          <div className="absolute -left-16 bottom-16 w-64 h-64 bg-cyan-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-5 relative">
            <div className="relative bg-white/68 backdrop-blur-xl rounded-[32px] shadow-dream-lg p-2 md:p-4">
              <div className="bg-brand-bg/70 rounded-[24px] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-white/70">
                  <div>
                    <h2 className="text-lg font-sans font-medium text-slate-800">Bom dia, Julia.</h2>
                    <p className="text-xs text-slate-600 font-light">Resumo da percepção do público em tempo real.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-200 to-rose-200 border-2 border-white shadow-sm" />
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ["group", "3 Conexões", "+1 nova", "bg-violet-50 text-brand-lilacDark"],
                    ["article", "47 Posts", "+5 esta semana", "bg-cyan-50 text-brand-cyanDark"],
                    ["forum", "5.230", "comentários/mês", "bg-rose-50 text-rose-400"],
                    ["favorite", `${landingLatestTotals.score.toFixed(1)} / 10`, "▲ +0.4", "bg-gradient-to-br from-brand-lilac to-brand-lilacDark text-white"],
                  ].map(([icon, val, sub, cls]) => (
                    <div key={String(val)} className={`rounded-2xl p-4 ${String(cls).includes("from-") ? cls : "bg-white/80"}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${String(cls).includes("from-") ? "bg-white/20" : cls}`}>
                        <span className="material-symbols-outlined text-[18px]">{icon}</span>
                      </div>
                      <div className={`font-sans font-semibold text-base xl:text-lg leading-tight ${String(cls).includes("from-") ? "text-white" : "text-slate-800"}`}>{val}</div>
                      <div className={`text-xs mt-0.5 ${String(cls).includes("from-") ? "text-violet-100" : "text-slate-600"}`}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-800">Distribuição mensal (stacked 100%)</h3>
                    <span className="text-[11px] text-slate-600">01/2023 a 01/2026</span>
                  </div>
                  <LandingSentimentTrendChart />
                  <div className="flex items-center gap-4 text-[11px] text-slate-700 mt-3">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Positivo</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-300" />Neutro</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-400" />Negativo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative bg-white/68 backdrop-blur-xl rounded-[32px] shadow-dream-lg p-2 md:p-4">
              <div className="bg-brand-bg/70 rounded-[24px] p-6 md:p-7 h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-brand-lilac to-brand-cyan text-white flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-sans font-semibold text-slate-900">Diagnóstico de Reputação</h3>
                      <p className="text-xs text-slate-600 font-light">Perfil: @julia_brand | Período: Últimas 24h</p>
                    </div>
                  </div>
                  <span className="text-xs text-brand-lilacDark font-medium">Atualizado agora</span>
                </div>

                <div className="space-y-5 text-slate-800">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-1">✨ O resumo da vez</p>
                    <p className="text-sm leading-relaxed">
                      Sua audiência está em clima de celebração. O lançamento de ontem gerou pico de alegria (72%) e admiração.
                      O tom é de proximidade, com leve confusão sobre o prazo de entrega nos comentários.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 mb-1">✅ O que funcionou</p>
                    <p className="text-sm leading-relaxed">
                      Humanização forte: o vídeo de bastidores teve 0% de sarcasmo percebido.
                      A nova paleta de cores foi o tópico mais elogiado, com 142 menções positivas.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 mb-1">⚠️ Pontos de atenção</p>
                    <p className="text-sm leading-relaxed">
                      Dúvida recorrente: 15 comentários pedem o link do frete.
                      Há 3 comentários ironizando preço, ainda sem força de crise.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-violet-50/70 p-4">
                    <p className="text-sm font-semibold text-brand-lilacDark mb-1">🚀 Próximo passo sugerido</p>
                    <p className="text-sm leading-relaxed">
                      Julia, grave um Story rápido de 15 segundos reforçando onde está o link do frete e agradecendo os elogios
                      sobre a nova identidade. Momento ideal para converter essa energia em vendas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-900 mb-4">Simples de usar. Profundo na análise.</h2>
            <p className="text-slate-700 font-light max-w-xl mx-auto text-lg">Três passos simples para transformar comentário em direção prática.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={f.title} className="liquid-panel rounded-3xl p-8 hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-6`}>
                  <span className="material-symbols-outlined text-[24px]">{f.icon}</span>
                </div>
                <h3 className="text-xl font-sans font-semibold text-slate-700 mb-3">{f.title}</h3>
                <p className="text-slate-400 font-light leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Feature details */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 liquid-copy p-6">
              <h3 className="text-3xl font-sans font-semibold text-slate-900">IA que entende seu público em profundidade.</h3>
              <p className="text-slate-700 font-light leading-relaxed">
                Nosso modelo vai além de positivo e negativo. Ele captura variações de sentimento, identifica emoções dominantes e mostra os temas que movem sua audiência para você entender o lado mais subjetivo da conversa.
              </p>
              <div className="space-y-3">
                {["Variação de sentimento ao longo do tempo", "Emoções mais presentes em cada conteúdo", "Tópicos que mais mobilizam seu público", "Score de sentimento 0-10 por post"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <svg fill="none" height="12" stroke="#10B981" strokeWidth="2.5" viewBox="0 0 24 24" width="12"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-sm text-slate-500">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Mock comment card */}
            <div className="space-y-3">
              {[
                { score: 8.4, user: "@fa_clube", text: "Amei o conteúdo! A edição ficou incrível, muito melhor que o último.", emotions: ["alegria", "aprovação"], sarcasm: false, color: "text-emerald-600 bg-emerald-50" },
                { score: 4.8, user: "@analitico_user", text: "Bom post, mas senti a mensagem um pouco corrida no final.", emotions: ["curiosidade", "atenção"], sarcasm: false, color: "text-amber-600 bg-amber-50" },
                { score: 6.2, user: "@curioso_br", text: "Interessante, mas faltou explicar melhor a parte técnica.", emotions: ["curiosidade", "neutro"], sarcasm: false, color: "text-amber-600 bg-amber-50" },
              ].map((c) => (
                <div key={c.user} className="liquid-panel rounded-3xl p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-sm font-sans font-bold px-2 py-0.5 rounded-lg shrink-0 ${c.color}`}>{c.score}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{c.user}</span>
                        
                      </div>
                      <p className="text-sm text-slate-500 font-light">{c.text}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {c.emotions.map((e) => (
                          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">{e}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-900 mb-4">Planos simples e transparentes</h2>
            <p className="text-slate-700 font-light">14 dias grátis em qualquer plano. Sem cartão de crédito.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[28px] p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight
                    ? "bg-gradient-to-br from-brand-lilacDark to-violet-800 text-white shadow-glow"
                    : "liquid-panel border border-white/45"
                }`}
              >
                {plan.highlight && (
                  <>
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wide text-white">
                      Mais popular
                    </div>
                  </>
                )}
                <h3 className={`font-sans font-semibold text-lg mb-1 ${plan.highlight ? "text-white" : "text-slate-700"}`}>{plan.name}</h3>
                <p className={`text-xs mb-6 ${plan.highlight ? "text-violet-200" : "text-slate-400"}`}>{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className={`text-4xl font-sans font-bold ${plan.highlight ? "text-white" : "text-slate-800"}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-violet-200" : "text-slate-400"}`}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? "bg-white/20" : "bg-emerald-50"}`}>
                        <svg fill="none" height="10" stroke={plan.highlight ? "white" : "#10B981"} strokeWidth="2.5" viewBox="0 0 24 24" width="10"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <span className={`text-sm ${plan.highlight ? "text-violet-100" : "text-slate-500"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  onClick={() => track("landing_cta_clicked", { cta: "pricing", plan: plan.name })}
                  className={`block text-center py-3.5 rounded-2xl font-medium text-sm transition-all ${
                    plan.highlight
                      ? "bg-white text-brand-lilacDark hover:bg-violet-50 shadow-lg"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-900 mb-4">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="liquid-panel rounded-3xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-medium text-slate-700 text-sm">{faq.q}</span>
                  <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`}>
                    keyboard_arrow_down
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <div className="px-6 pb-5">
                    <p className="text-sm text-slate-400 font-light leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="cta" className="py-24 px-6 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-sans font-semibold text-white mb-6 leading-tight">
            Comece a entender sua audiência hoje.
          </h2>
          <p className="text-slate-400 font-light text-lg mb-10 max-w-xl mx-auto">
            14 dias grátis, sem cartão de crédito. Configure em menos de 2 minutos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              onClick={() => track("landing_cta_clicked", { cta: "bottom_primary" })}
              className="px-8 py-4 rounded-full bg-white text-brand-lilacDark font-medium text-lg hover:bg-violet-50 transition-all shadow-lg hover:shadow-xl"
            >
              Comece grátis 14 dias
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-full border border-white/30 text-white font-medium text-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Saiba mais
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-md">
              <svg fill="none" height="18" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span className="text-lg font-sans font-medium text-slate-700">sentimenta</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-brand-lilacDark transition-colors">Privacidade</a>
            <a href="#" className="hover:text-brand-lilacDark transition-colors">Termos</a>
            <a href="#" className="hover:text-brand-lilacDark transition-colors">Suporte</a>
            <Link href="/login" className="hover:text-brand-lilacDark transition-colors">Login</Link>
          </div>
          <p className="text-xs text-slate-300">© 2026 Sentimenta Inc. Todos os direitos reservados.</p>
        </div>
      </footer>
      </div>
    </div>
  );
}





