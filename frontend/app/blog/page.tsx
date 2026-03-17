"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Calendar, Clock, ChevronRight, Tag, Lightbulb, BookOpen, Zap } from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";

const categories = [
  { name: "Análise de Sentimento", icon: Lightbulb, color: "var(--primary)" },
  { name: "Gestão de Reputação", icon: BookOpen, color: "var(--secondary)" },
  { name: "IA & Tecnologia", icon: Zap, color: "var(--accent)" },
];

const featuredPost = {
  title: "Como a análise de sentimento com IA está revolucionando o marketing digital em 2026",
  excerpt: "Descubra como marcas estão usando inteligência artificial para mapear emoções em comentários e transformar dados em estratégias de crescimento.",
  date: "10/03/2026",
  readTime: "8 min",
  category: "IA & Tecnologia",
  image: "https://images.unsplash.com/photo-1660165458059-57cfb6cc87e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwdGVjaG5vbG9neSUyMGFic3RyYWN0fGVufDF8fHx8MTc3MzQyNTk2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
};

const posts = [
  {
    title: "8 emoções que sua audiência sente — e como mapeá-las",
    excerpt: "Alegria, raiva, nojo, medo, tristeza, surpresa, neutro e esperança: entenda cada uma e como impactam seu conteúdo.",
    date: "05/03/2026",
    readTime: "6 min",
    category: "Análise de Sentimento",
  },
  {
    title: "Alertas de crise: como detectar negatividade antes que vire problema",
    excerpt: "Aprenda a configurar alertas inteligentes e reagir rapidamente a picos de comentários negativos.",
    date: "28/02/2026",
    readTime: "5 min",
    category: "Gestão de Reputação",
  },
  {
    title: "Score de reputação: o que é e como interpretar",
    excerpt: "Entenda a métrica que simplifica toda a complexidade emocional da sua audiência em um número de 0 a 10.",
    date: "20/02/2026",
    readTime: "4 min",
    category: "Análise de Sentimento",
  },
  {
    title: "Instagram vs TikTok vs YouTube: onde a audiência é mais emocional?",
    excerpt: "Comparativo de sentimento entre plataformas baseado em dados reais de milhares de perfis monitorados.",
    date: "15/02/2026",
    readTime: "7 min",
    category: "Gestão de Reputação",
  },
  {
    title: "Como identificar embaixadores e detratores da sua marca",
    excerpt: "Use dados de sentimento para descobrir quem são seus maiores fãs e críticos — e como reagir a cada grupo.",
    date: "08/02/2026",
    readTime: "5 min",
    category: "Gestão de Reputação",
  },
  {
    title: "NLP em português: os desafios da análise de sentimento no Brasil",
    excerpt: "Gírias, sarcasmo e regionalismos: como a IA do Sentimenta lida com as nuances do português brasileiro.",
    date: "01/02/2026",
    readTime: "9 min",
    category: "IA & Tecnologia",
  },
];

const categoryPosts: Record<string, typeof posts> = {
  "Análise de Sentimento": posts.filter(p => p.category === "Análise de Sentimento"),
  "Gestão de Reputação": posts.filter(p => p.category === "Gestão de Reputação"),
  "IA & Tecnologia": posts.filter(p => p.category === "IA & Tecnologia"),
};

export default function BlogPage() {
  const [search, setSearch] = useState("");

  const filteredPosts = search
    ? posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase()))
    : posts;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", fontFamily: "'Inter', sans-serif" }}>
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl shadow-sm" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 80%, transparent)" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/"><Logo size="md" /></Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/#demo" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Teste ao vivo</Link>
              <Link href="/#como" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Como funciona</Link>
              <Link href="/#preco" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Precos</Link>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>Blog</span>
            </div>
          </div>
          <Link href="/login"><Button size="sm">Comece gratis</Button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-12 pb-8 px-4 md:px-8" style={{ backgroundColor: "var(--bg-card)" }}>
        <div className="max-w-[1200px] mx-auto">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            <span style={{ color: "var(--primary)" }}>Insights</span> sobre sentimento,<br />IA e reputacao digital
          </h1>
          <p className="mt-3 max-w-[500px]" style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text-muted)" }}>
            Artigos, guias e tendencias para quem quer entender e gerenciar a percepcao da sua audiencia.
          </p>
          <div className="flex items-center gap-3 mt-6 max-w-[500px]">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar artigos..." className="bg-transparent focus:outline-none flex-1" style={{ fontSize: "0.88rem", color: "var(--text-primary)" }} />
            </div>
            <Button size="sm">Buscar</Button>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="py-10 px-4 md:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--primary)", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
              Artigos em destaque
            </span>
            <Lightbulb className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="aspect-[16/9] overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredPost.image} alt={featuredPost.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center gap-1" style={{ fontSize: "0.68rem", color: "var(--primary)" }}>
                    <Calendar className="w-3 h-3" /> {featuredPost.date}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{featuredPost.readTime} de leitura</span>
                </div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{featuredPost.title}</h2>
                <p className="mt-2" style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "var(--text-muted)" }}>{featuredPost.excerpt}</p>
                <button className="mt-4 flex items-center gap-1" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--primary)" }}>
                  Ler mais <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {posts.slice(0, 4).map((post, i) => (
                <div key={i} className="rounded-2xl p-5 flex flex-col cursor-pointer transition-colors" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3 h-3" style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>{post.date}</span>
                  </div>
                  <h3 className="flex-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{post.title}</h3>
                  <span className="mt-3 px-2 py-0.5 rounded-md self-start" style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{post.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BY CATEGORY */}
      <section className="py-10 px-4 md:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
              Aprenda por categoria
            </span>
            <Tag className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map(cat => (
              <span key={cat.name} className="px-4 py-2 rounded-full" style={{ fontSize: "0.78rem", fontWeight: 500, color: "white", backgroundColor: cat.color }}>
                {cat.name}
              </span>
            ))}
          </div>

          {categories.map(cat => (
            <div key={cat.name} className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}15` }}>
                  <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>{cat.name}</h3>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {cat.name === "Análise de Sentimento" ? "Entenda como mapear e interpretar emocoes." : cat.name === "Gestão de Reputação" ? "Estrategias para proteger e melhorar sua imagem." : "Novidades em IA e processamento de linguagem natural."}
                  </p>
                </div>
                <button className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--primary)", border: "1px solid var(--border)" }}>
                  + ver mais
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(categoryPosts[cat.name] || []).map((post, i) => (
                  <div key={i} className="rounded-2xl p-5 cursor-pointer transition-colors" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-3 h-3" style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>{post.date}</span>
                      <span className="ml-auto flex items-center gap-1" style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>
                        <Clock className="w-3 h-3" /> {post.readTime}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{post.title}</h3>
                    <p className="mt-2" style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-muted)" }}>{post.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-4 md:px-8" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-8">
            {[{ name: "Privacidade", path: "/privacidade" }, { name: "Termos", path: "/termos" }, { name: "Suporte", path: "/suporte" }, { name: "Blog", path: "/blog" }].map(link => (
              <Link key={link.name} href={link.path} style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{link.name}</Link>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>&copy; 2026 Sentimenta</p>
        </div>
      </footer>
    </div>
  );
}
