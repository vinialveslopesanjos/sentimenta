"use client";

import Link from "next/link";
import { useState } from "react";

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

const testimonials = [
  {
    text: "Antes do Sentimenta, me sentia sobrecarregada com os comentários negativos. A interface zen mudou minha forma de trabalhar.",
    name: "Ana Clara",
    role: "Social Media Manager",
    initials: "AC",
    color: "from-pink-200 to-rose-200",
  },
  {
    text: "A clareza dos dados é impressionante. Consigo ver a 'cor' do sentimento da minha audiência em segundos.",
    name: "Ricardo Mendes",
    role: "Head de Marketing",
    initials: "RM",
    color: "from-cyan-200 to-blue-200",
  },
  {
    text: "Detectou uma crise de reputação 6 horas antes de viralizar. Salvou nossa campanha inteira.",
    name: "Fernanda Costa",
    role: "Gerente de Produto",
    initials: "FC",
    color: "from-violet-200 to-purple-200",
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

  return (
    <div className="font-body antialiased overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-brand-lilacDark transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-brand-lilacDark transition-colors">Preços</a>
            <a href="#testimonials" className="hover:text-brand-lilacDark transition-colors">Depoimentos</a>
            <Link href="/login" className="text-slate-700 hover:text-brand-lilacDark transition-colors">Login</Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 text-sm"
            >
              Comece grátis
            </Link>
          </div>
          {/* Mobile CTA */}
          <Link href="/login" className="md:hidden px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium">
            Entrar
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="pt-36 pb-24 px-6 relative overflow-hidden bg-gradient-hero">
        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-to-b from-violet-100/50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">

          <h1 className="text-5xl md:text-7xl font-sans font-semibold text-brand-heading leading-[1.1] tracking-tight animate-slide-up">
            Chega de passar o olho em mil comentários para saber se gostaram do post.
          </h1>

          <p className="text-lg md:text-xl text-slate-400 font-light max-w-3xl mx-auto leading-relaxed">
            Nossos Agentes de IA analisam cada post e comentário das suas redes para gerar um direcionamento claro. Saiba o que seu público ama, o que detesta e o que ele está pedindo para você postar amanhã.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="px-8 py-4 rounded-full bg-gradient-to-r from-brand-lilacDark to-violet-600 text-white font-medium text-lg hover:shadow-glow hover:scale-105 transition-all duration-300 subtle-glow"
            >
              Comece grátis 14 dias
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-full bg-white text-slate-600 font-medium text-lg border border-slate-200 hover:border-brand-lilac hover:text-brand-lilacDark transition-all duration-300 flex items-center gap-2"
            >
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Ver demonstração
            </a>
          </div>

          {/* Social proof numbers */}
          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-sans font-semibold text-slate-700 text-lg">2.000+</span>
              <span>perfis analisados</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="font-sans font-semibold text-slate-700 text-lg">8,4M</span>
              <span>comentários este mês</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-sans font-semibold text-slate-700 text-lg">14 dias</span>
              <span>grátis</span>
            </div>
          </div>

          {/* Platform logos */}
          <div className="pt-8 flex items-center justify-center gap-8 opacity-40">
            <svg className="h-7 w-auto" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <svg className="h-7 w-auto" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="max-w-5xl mx-auto mt-20 relative">
          <div className="absolute -right-16 top-16 w-64 h-64 bg-violet-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
          <div className="absolute -left-16 bottom-16 w-64 h-64 bg-cyan-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
          <div className="relative bg-white/80 backdrop-blur-xl rounded-[32px] shadow-dream-lg border border-white p-2 md:p-4">
            <div className="bg-brand-bg rounded-[24px] border border-slate-100 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-50">
                <div>
                  <h2 className="text-lg font-sans font-medium text-slate-700">Bom dia, Julia.</h2>
                  <p className="text-xs text-slate-400 font-light">Aqui está o resumo dos seus sentimentos hoje.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-200 to-rose-200 border-2 border-white shadow-sm" />
                </div>
              </div>
              {/* KPI cards */}
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["group", "3 Conexões", "+1 nova", "bg-violet-50 text-brand-lilacDark"],
                  ["article", "47 Posts", "+5 esta semana", "bg-cyan-50 text-brand-cyanDark"],
                  ["forum", "8.420 Coment.", "Este período", "bg-rose-50 text-rose-400"],
                  ["favorite", "7.4 / 10", "▲ +0.3", "bg-gradient-to-br from-brand-lilac to-brand-lilacDark text-white"],
                ].map(([icon, val, sub, cls]) => (
                  <div key={val} className={`rounded-2xl p-4 ${cls.includes("from-") ? cls : "bg-white border border-slate-50"}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${cls.includes("from-") ? "bg-white/20" : cls}`}>
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    </div>
                    <div className={`font-sans font-semibold text-lg ${cls.includes("from-") ? "text-white" : "text-slate-700"}`}>{val}</div>
                    <div className={`text-xs mt-0.5 ${cls.includes("from-") ? "text-violet-100" : "text-slate-400"}`}>{sub}</div>
                  </div>
                ))}
              </div>
              {/* Sentiment bar */}
              <div className="px-6 pb-6">
                <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                  <div className="h-full rounded-l-full bg-emerald-400" style={{ width: "62%" }} />
                  <div className="h-full bg-amber-300" style={{ width: "28%" }} />
                  <div className="h-full rounded-r-full bg-rose-400" style={{ width: "10%" }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>62% positivo</span>
                  <span>28% neutro</span>
                  <span>10% negativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-white border-y border-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-700 mb-4">Simples de usar. Profundo na análise.</h2>
            <p className="text-slate-400 font-light max-w-xl mx-auto text-lg">Três passos simples para transformar comentário em direção prática.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={f.title} className="dream-card p-8 hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-6`}>
                  <span className="material-symbols-outlined text-[24px]">{f.icon}</span>
                </div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">0{i + 1}</div>
                <h3 className="text-xl font-sans font-semibold text-slate-700 mb-3">{f.title}</h3>
                <p className="text-slate-400 font-light leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Feature details */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-sans font-semibold text-slate-700">IA que entende seu público em profundidade.</h3>
              <p className="text-slate-400 font-light leading-relaxed">
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
                <div key={c.user} className="dream-card p-4">
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

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-700 mb-4">Confiança que transmite calma</h2>
            <p className="text-slate-400 font-light max-w-xl mx-auto">Junte-se a mais de 2.000 marcas que monitoram suas comunidades sem perder a tranquilidade.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={t.name} className={`dream-card p-8 hover:-translate-y-1 transition-all duration-300 ${i === 1 ? "bg-gradient-to-br from-white to-cyan-50 border-cyan-100" : ""}`}>
                <div className="text-4xl text-brand-lilac font-serif opacity-30 mb-4">"</div>
                <p className="text-slate-500 font-light leading-relaxed mb-6">{t.text}</p>
                <div className="flex items-center gap-3 border-t border-slate-50 pt-6">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${t.color} flex items-center justify-center shadow-sm`}>
                    <span className="text-sm font-sans font-semibold text-white">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-sans font-semibold text-slate-700 mb-4">Planos simples e transparentes</h2>
            <p className="text-slate-400 font-light">14 dias grátis em qualquer plano. Sem cartão de crédito.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[28px] p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight
                    ? "bg-gradient-to-br from-brand-lilacDark to-violet-800 text-white shadow-glow"
                    : "bg-white border border-slate-100 shadow-card"
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
            <h2 className="text-4xl font-sans font-semibold text-slate-700 mb-4">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="dream-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-medium text-slate-700 text-sm">{faq.q}</span>
                  <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`}>
                    keyboard_arrow_down
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-slate-400 font-light leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="cta" className="py-24 px-6 bg-gradient-to-br from-brand-lilacDark to-violet-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-sans font-semibold text-white mb-6 leading-tight">
            Comece a entender sua audiência hoje.
          </h2>
          <p className="text-violet-200 font-light text-lg mb-10 max-w-xl mx-auto">
            14 dias grátis, sem cartão de crédito. Configure em menos de 2 minutos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 rounded-full bg-white text-brand-lilacDark font-medium text-lg hover:bg-violet-50 transition-all shadow-lg hover:shadow-xl"
            >
              Comece grátis 14 dias
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-full border border-white/30 text-white font-medium text-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Ver demonstração
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 bg-white border-t border-slate-50">
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
  );
}
