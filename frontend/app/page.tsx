"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform, AnimatePresence, useSpring } from "framer-motion";
import {
  ArrowRight, ChevronDown, CheckCircle2, Zap, Eye, Shield, MessageCircle,
  TrendingUp, Sparkles, Play, Star, Send, Info, Smile, Frown, Meh,
  Heart, ThumbsDown, Flame, AlertTriangle,
} from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";
import {
  GlassChartIcon,
  GlassHeartIcon,
  GlassShieldIcon,
  GlassBellIcon,
  GlassZapIcon,
  GlassEyeIcon,
  GlassTargetIcon,
} from "@/components/GlassIcons";

/* ── Helpers ── */

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55, delay, ease: [0.22, 0.61, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

function GlassCard({ children, className = "", active = false }: { children: React.ReactNode; className?: string; active?: boolean }) {
  const bgOpacity = active ? 0.5 : 0.25;
  const borderOpacity = active ? 0.4 : 0.2;
  return (
    <div
      className={`relative rounded-[20px] overflow-hidden transition-all duration-300 ${active ? "shadow-[0_8px_40px_-8px_rgba(57,184,198,0.18)]" : "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]"} ${className}`}
      style={{
        backgroundColor: `rgba(255, 255, 255, ${bgOpacity})`,
        border: `0.5px solid rgba(14, 35, 37, ${borderOpacity})`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <div className="relative h-full flex flex-col">{children}</div>
    </div>
  );
}

function PillSelector({ items, selected, onSelect, icon, grid }: { items: string[]; selected: string[]; onSelect: (v: string) => void; icon?: boolean; grid?: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    Alegria: <Smile className="w-3.5 h-3.5" />, Raiva: <Flame className="w-3.5 h-3.5" />,
    Tristeza: <Frown className="w-3.5 h-3.5" />, Neutro: <Meh className="w-3.5 h-3.5" />,
    Amor: <Heart className="w-3.5 h-3.5" />, Nojo: <ThumbsDown className="w-3.5 h-3.5" />,
    Surpresa: <Sparkles className="w-3.5 h-3.5" />, Medo: <AlertTriangle className="w-3.5 h-3.5" />,
  };
  return (
    <div className={grid ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {items.map(item => {
        const isSelected = selected.includes(item);
        return (
          <button key={item} onClick={() => onSelect(item)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200"
            style={{
              fontSize: "0.82rem", fontWeight: 500,
              backgroundColor: isSelected ? "var(--primary)" : "var(--bg-card)",
              color: isSelected ? "white" : "var(--primary)",
              border: isSelected ? "none" : "1px solid var(--border)",
              boxShadow: isSelected ? "0 4px 16px -4px rgba(57,184,198,0.4)" : "none",
            }}
          >
            {icon && icons[item]}
            {item}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const inc = target / 40;
    const timer = setInterval(() => {
      start += inc;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 25);
    return () => clearInterval(timer);
  }, [isInView, target]);
  return <span ref={ref}>{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ── Data ── */

const tickerItemsBase = [
  { user: "@ana_marketing", textKey: "tickerItems.congratsContent" as const, emotionKey: "joy", type: "pos" },
  { user: "@carlos.dev", textKey: "tickerItems.totalAbsurd" as const, emotionKey: "anger", type: "neg" },
  { user: "@mari_design", textKey: "tickerItems.whenNext" as const, emotionKey: "neutral", type: "neu" },
  { user: "@joao_ba", textKey: "tickerItems.favoriteDeputy" as const, emotionKey: "love", type: "pos" },
  { user: "@lucia.sp", textKey: "tickerItems.disagreeCompletely" as const, emotionKey: "anger", type: "neg" },
  { user: "@beto_salva", textKey: "tickerItems.finallySomeone" as const, emotionKey: "surprise", type: "pos" },
  { user: "@cris.art", textKey: "tickerItems.tooEmotional" as const, emotionKey: "sadness", type: "neg" },
  { user: "@dani_fit", textKey: "tickerItems.givesHope" as const, emotionKey: "joy", type: "pos" },
];

/* demoResults and demoSuggestions are constructed inside the component using translations */

/* plans and faqs are now constructed inside the component using translations */

const theme = {
  primary: "#39b8c6",
  secondary: "#b6496b",
  accent: "#b88147",
  primaryBg: "#ebf8f9",
  sentimentNegative: "#b6496b",
  sentimentNeutral: "#94a3b8",
  textXfaint: "#6cbec6",
  chart: ["#39b8c6", "#b6496b", "#b88147", "#61c6d1", "#c56d89", "#c69a6c", "#88d4dd", "#d392a6"],
};

/* ── Component ── */

export default function LandingPage() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");

  const demoKeys = ["s1", "s2", "s3", "s4", "s5"] as const;
  const demoMeta = t.raw("demoResultsMeta") as Record<string, { emotion: string; score: number; sentiment: string; emoji: string }>;
  const demoResults: Record<string, { emotion: string; score: number; sentiment: string; type: "pos" | "neg" | "neu"; emoji: string }> = {};
  const demoSuggestions: string[] = [];
  for (const k of demoKeys) {
    const text = t(`demoResults.${k}`);
    const meta = demoMeta[k];
    demoSuggestions.push(text);
    demoResults[text] = { ...meta, type: meta.score >= 7 ? "pos" : meta.score <= 4 ? "neg" : "neu" };
  }

  const emotionNames = t.raw("emotions") as Record<string, string>;
  const emotionList = ["joy", "anger", "sadness", "neutral", "love", "disgust", "surprise", "fear"];

  const plans = [
    { name: t("pricing.freePlan"), price: t("pricing.freePlanPrice"), desc: t("pricing.freePlanDesc"), features: [t("pricing.freePlanFeature1"), t("pricing.freePlanFeature2"), t("pricing.freePlanFeature3"), t("pricing.freePlanFeature4")], popular: false },
    { name: t("pricing.starterPlan"), price: t("pricing.starterPlanPrice"), desc: t("pricing.starterPlanDesc"), features: [t("pricing.starterPlanFeature1"), t("pricing.starterPlanFeature2"), t("pricing.starterPlanFeature3"), t("pricing.starterPlanFeature4"), t("pricing.starterPlanFeature5")], popular: false },
    { name: t("pricing.proPlan"), price: t("pricing.proPlanPrice"), desc: t("pricing.proPlanDesc"), features: [t("pricing.proPlanFeature1"), t("pricing.proPlanFeature2"), t("pricing.proPlanFeature3"), t("pricing.proPlanFeature4"), t("pricing.proPlanFeature5")], popular: true },
    { name: t("pricing.businessPlan"), price: t("pricing.businessPlanPrice"), desc: t("pricing.businessPlanDesc"), features: [t("pricing.businessPlanFeature1"), t("pricing.businessPlanFeature2"), t("pricing.businessPlanFeature3"), t("pricing.businessPlanFeature4"), t("pricing.businessPlanFeature5")], popular: false },
  ];

  const creditExplanation = t("pricing.creditExplanation");

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];

  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => { const ti = setInterval(() => setTickerIdx(i => (i + 1) % tickerItemsBase.length), 2200); return () => clearInterval(ti); }, []);

  const [demoInput, setDemoInput] = useState("");
  const [demoResult, setDemoResult] = useState<typeof demoResults[string] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { scrollYProgress: rawScroll } = useScroll();
  const pageScroll = useSpring(rawScroll, { stiffness: 60, damping: 20, restDelta: 0.001 });
  const y1 = useTransform(pageScroll, [0, 1], [0, 600]);
  const y2 = useTransform(pageScroll, [0, 1], [0, -500]);
  const y3 = useTransform(pageScroll, [0, 1], [0, 400]);
  const y4 = useTransform(pageScroll, [0, 1], [0, -350]);
  const x1 = useTransform(pageScroll, [0, 1], [0, 250]);
  const x2 = useTransform(pageScroll, [0, 1], [0, -250]);
  const rotate1 = useTransform(pageScroll, [0, 1], [0, 180]);
  const rotate2 = useTransform(pageScroll, [0, 1], [0, -180]);

  const analyzeSentiment = useCallback((text: string) => {
    setDemoInput(text); setAnalyzing(true); setDemoResult(null);
    setTimeout(() => {
      const result = demoResults[text] || {
        emotion: text.includes("!") ? "Surpresa" : text.includes("?") ? "Neutro" : "Alegria",
        score: 5 + Math.random() * 4,
        sentiment: text.includes("não") || text.includes("absurdo") || text.includes("horror") ? "Negativo" : "Positivo",
        type: (text.includes("não") || text.includes("absurdo") ? "neg" : "pos") as "pos" | "neg",
        emoji: text.includes("não") ? "😟" : "😊",
      };
      setDemoResult(result); setAnalyzing(false);
    }, 1200);
  }, []);

  const [selectedEmotions, setSelectedEmotions] = useState([emotionNames.joy, emotionNames.anger]);
  const toggleEmotion = (e: string) => setSelectedEmotions(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 10); window.addEventListener("scroll", onScroll); return () => window.removeEventListener("scroll", onScroll); }, []);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 800], [0, 120]);

  const getColor = (type?: string) => type === "neg" ? theme.secondary : type === "neu" ? theme.accent : theme.primary;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--bg-page)", fontFamily: "'Inter', sans-serif" }}>
      {/* GLOBAL BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <motion.svg style={{ y: y1, x: x1 }} className="absolute -top-[10%] -left-[20%] w-[1000px] h-[1000px] opacity-60 overflow-visible" viewBox="0 0 900 900" fill="none">
          <defs><filter id="g-blur-teal" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="160" /></filter><radialGradient id="g-grad-teal" cx="50%" cy="50%" r="50%"><stop stopColor="#39b8c6" stopOpacity="0.8" /><stop offset="1" stopColor="#39b8c6" stopOpacity="0" /></radialGradient></defs>
          <ellipse cx="450" cy="450" rx="450" ry="350" fill="url(#g-grad-teal)" filter="url(#g-blur-teal)" />
        </motion.svg>
        <motion.svg style={{ y: y2, x: x2 }} className="absolute -top-[5%] -right-[10%] w-[1100px] h-[900px] opacity-50 overflow-visible" viewBox="0 0 800 800" fill="none">
          <defs><filter id="g-blur-rose" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="150" /></filter><radialGradient id="g-grad-rose" cx="50%" cy="50%" r="50%"><stop stopColor="#b6496b" stopOpacity="0.7" /><stop offset="1" stopColor="#b6496b" stopOpacity="0" /></radialGradient></defs>
          <ellipse cx="400" cy="400" rx="300" ry="420" fill="url(#g-grad-rose)" filter="url(#g-blur-rose)" />
        </motion.svg>
        <motion.svg style={{ y: y3, x: x2 }} className="absolute top-[30%] -right-[15%] w-[900px] h-[800px] opacity-40 overflow-visible" viewBox="0 0 700 700" fill="none">
          <defs><filter id="g-blur-gold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="130" /></filter><radialGradient id="g-grad-gold" cx="50%" cy="50%" r="50%"><stop stopColor="#b88147" stopOpacity="0.6" /><stop offset="1" stopColor="#b88147" stopOpacity="0" /></radialGradient></defs>
          <circle cx="350" cy="350" r="380" fill="url(#g-grad-gold)" filter="url(#g-blur-gold)" />
        </motion.svg>
        <motion.svg style={{ y: y4, x: x1 }} className="absolute top-[50%] -left-[15%] w-[800px] h-[800px] opacity-45 overflow-visible" viewBox="0 0 600 600" fill="none">
          <defs><filter id="g-blur-teal2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="140" /></filter><radialGradient id="g-grad-teal2" cx="50%" cy="50%" r="50%"><stop stopColor="#39b8c6" stopOpacity="0.7" /><stop offset="1" stopColor="#39b8c6" stopOpacity="0" /></radialGradient></defs>
          <ellipse cx="300" cy="300" rx="280" ry="340" fill="url(#g-grad-teal2)" filter="url(#g-blur-teal2)" />
        </motion.svg>

        {/* Decorative gradient stroke rings */}
        <motion.svg style={{ y: y3, rotate: rotate1, filter: 'invert(1) opacity(0.3)' }} className="absolute top-[8%] right-[5%] w-[500px] h-[500px] opacity-[0.15]" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="248" stroke="url(#ring-g1)" strokeWidth="1" /><defs><linearGradient id="ring-g1" x1="0" y1="100" x2="400" y2="450" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient></defs>
        </motion.svg>
        <motion.svg style={{ y: y4, rotate: rotate2, filter: 'invert(1) opacity(0.3)' }} className="absolute top-[25%] right-[8%] w-[360px] h-[360px] opacity-[0.12]" viewBox="0 0 360 360" fill="none">
          <circle cx="180" cy="180" r="178" stroke="url(#ring-g2)" strokeWidth="1" /><defs><linearGradient id="ring-g2" x1="-20" y1="60" x2="300" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient></defs>
        </motion.svg>
        <motion.svg style={{ y: y1, rotate: rotate1 }} className="absolute top-[45%] left-[2%] w-[300px] h-[300px] opacity-[0.1]" viewBox="0 0 300 300" fill="none">
          <circle cx="150" cy="150" r="148" stroke="url(#ring-g3)" strokeWidth="1.5" /><defs><linearGradient id="ring-g3" x1="0" y1="50" x2="250" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#39b8c6" /><stop offset="1" stopColor="#39b8c6" stopOpacity="0" /></linearGradient></defs>
        </motion.svg>
      </div>

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-xl shadow-sm" : "bg-transparent"}`} style={scrolled ? { backgroundColor: "rgba(255,255,255,0.8)" } : {}}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#demo" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t("nav.liveTest")}</a>
            <a href="#como" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t("nav.howItWorks")}</a>
            <a href="#preco" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t("nav.pricing")}</a>
            <LanguageSwitcher />
            <Link href="/login" style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--primary)" }}>{t("nav.login")}</Link>
            <Link href="/login"><Button size="sm">{t("nav.startFree")}</Button></Link>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher compact />
            <Link href="/login"><Button size="sm">{t("nav.enter")}</Button></Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-28 pb-0 px-4 md:px-8 overflow-hidden min-h-[100vh]">
        <div className="max-w-[1200px] mx-auto relative">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center justify-center mb-4 md:mb-12">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full transition-all max-w-[95vw]" style={{ backgroundColor: "#ffffff", border: "1px solid #bce8ec", boxShadow: "0 4px 16px -6px rgba(57,184,198,0.1)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: "#39b8c6" }} />
              <span className="shrink-0" style={{ fontSize: "0.72rem", color: "#1a6f78", fontWeight: 600, letterSpacing: "0.02em" }}>{t("hero.live")}</span>
              <AnimatePresence mode="wait">
                <motion.span key={tickerIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                  style={{ fontSize: "0.75rem", fontWeight: 500, color: getColor(tickerItemsBase[tickerIdx].type) }}
                  className="whitespace-nowrap overflow-hidden text-ellipsis min-w-0"
                >
                  {emotionNames[tickerItemsBase[tickerIdx].emotionKey]}: &ldquo;{t(tickerItemsBase[tickerIdx].textKey)}&rdquo;
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[70vh]">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 800, lineHeight: 1.02, color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
                {t("hero.title")}<br />
                <span style={{ color: "var(--primary)" }}>{t("hero.titleBreak")}</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="mt-7 max-w-[420px]" style={{ fontSize: "1.1rem", lineHeight: 1.75, color: "var(--text-muted)" }}
                dangerouslySetInnerHTML={{ __html: t.raw("hero.subtitle") }}
              />
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="flex items-center gap-3 mt-10 flex-wrap">
                <Link href="/login"><Button variant="pill" size="lg" iconRight={<ArrowRight className="w-4 h-4" />}>{t("hero.ctaPrimary")}</Button></Link>
                <a href="#demo"><Button variant="pill-glass" size="lg" icon={<Play className="w-3.5 h-3.5" />}>{t("hero.ctaSecondary")}</Button></a>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-6 mt-8 flex-wrap">
                {[{ v: "12K+", l: t("hero.statsComments") }, { v: "8", l: t("hero.statsEmotions") }, { v: "<2min", l: t("hero.statsFirstRead") }].map(s => (
                  <div key={s.l} className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.v}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{s.l}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div style={{ y: heroY }} className="relative hidden lg:block">
              <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }} className="space-y-4">
                <GlassCard active>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("heroCards.emotionMapTitle")}</h3>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{t("heroCards.emotionMapSubtitle")}</p>
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}><Info className="w-3.5 h-3.5 text-white" /></div>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { name: emotionNames.joy, pct: 34, color: theme.chart[0] },
                        { name: emotionNames.anger, pct: 28, color: theme.sentimentNegative },
                        { name: emotionNames.neutral, pct: 19, color: theme.sentimentNeutral },
                        { name: emotionNames.disgust, pct: 8, color: theme.chart[4] },
                        { name: emotionNames.surprise, pct: 6, color: theme.chart[6] },
                        { name: t("heroCards.others"), pct: 5, color: theme.chart[7] },
                      ].map(e => (
                        <div key={e.name} className="flex items-center gap-3">
                          <span className="w-16 shrink-0" style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>{e.name}</span>
                          <div className="flex-1 rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: "var(--bg-subtle)" }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${e.pct}%` }} transition={{ duration: 0.8, delay: 0.6 + e.pct * 0.01 }} className="h-full rounded-full" style={{ backgroundColor: e.color }} />
                          </div>
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)", width: 28, textAlign: "right" }}>{e.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard>
                    <div className="p-5 flex flex-col items-center">
                      <div className="relative w-20 h-20 mb-3">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="38" fill="none" stroke={theme.primaryBg} strokeWidth="8" />
                          <motion.circle cx="50" cy="50" r="38" fill="none" stroke={theme.primary} strokeWidth="8" strokeLinecap="round" initial={{ strokeDasharray: "0 240" }} animate={{ strokeDasharray: "110 130" }} transition={{ duration: 1, delay: 0.8 }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)" }}>4.6</span>
                        </div>
                      </div>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("heroCards.scoreLabel")}</p>
                      <p style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>{t("heroCards.reputationLabel")}</p>
                    </div>
                  </GlassCard>
                  <GlassCard>
                    <div className="p-5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--sentiment-negative-bg)" }}>
                        <Shield className="w-4 h-4" style={{ color: "var(--sentiment-negative)" }} />
                      </div>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{t("heroCards.crisisAlertTitle")}</p>
                      <p style={{ fontSize: "0.68rem", lineHeight: 1.5, color: "var(--text-muted)" }}>{t("heroCards.crisisAlertDesc")}</p>
                      <div className="mt-3 flex items-center gap-1">
                        <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: "var(--sentiment-negative-bg)" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: "72%" }} transition={{ duration: 1, delay: 1 }} className="h-full rounded-full" style={{ backgroundColor: "var(--sentiment-negative)" }} />
                        </div>
                        <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--sentiment-negative)" }}>72%</span>
                      </div>
                    </div>
                  </GlassCard>
                </div>
                <GlassCard>
                  <div className="p-5 flex items-center gap-5">
                    <div className="flex-1">
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{t("heroCards.weeklyTrendTitle")}</p>
                      <div className="flex items-end gap-[3px] h-10">
                        {[30, 45, 35, 55, 40, 65, 50, 70, 45, 60, 55, 75, 48, 80].map((v, i) => (
                          <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(v / 80) * 100}%` }} transition={{ duration: 0.4, delay: 0.8 + i * 0.05 }} className="flex-1 rounded-sm" style={{ backgroundColor: i >= 10 ? theme.primary : theme.textXfaint }} />
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>+12%</p>
                      <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{t("heroCards.vsPreviousWeek")}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="flex flex-col items-center mt-16 pb-8">
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <ChevronDown className="w-5 h-5" style={{ color: "var(--text-faint)" }} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="py-12 md:py-18 px-4 md:px-8 relative">
        <div className="max-w-[900px] mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--primary)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <Zap className="w-3 h-3" /> {t("demo.badge")}
              </span>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                {t("demo.title")}<br />{t("demo.titleLine2")}
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <GlassCard active className="overflow-visible">
              <div className="p-5 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 relative">
                    <input type="text" value={demoInput} onChange={e => setDemoInput(e.target.value)} onKeyDown={e => e.key === "Enter" && demoInput.trim() && analyzeSentiment(demoInput)}
                      placeholder={t("demo.inputPlaceholder")}
                      className="w-full px-5 py-4 rounded-2xl transition-all"
                      style={{ fontSize: "0.95rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    />
                  </div>
                  <button onClick={() => demoInput.trim() && analyzeSentiment(demoInput)} className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-colors" style={{ backgroundColor: "var(--primary)", boxShadow: `0 4px 16px -4px ${theme.primary}60` }}>
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="w-full" style={{ fontSize: "0.72rem", color: "var(--text-faint)", fontWeight: 500, marginBottom: 2 }}>{t("demo.trySuggestions")}</span>
                  {demoSuggestions.map(s => (
                    <button key={s} onClick={() => analyzeSentiment(s)} className="px-3 py-1.5 rounded-xl transition-colors" style={{ fontSize: "0.68rem", fontWeight: 500, backgroundColor: "var(--bg-subtle)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                      {s.length > 40 ? s.slice(0, 40) + "..." : s}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {analyzing && (
                    <motion.div key="analyzing" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-center py-8 gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 rounded-full" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                      <span style={{ fontSize: "0.88rem", color: "var(--primary)", fontWeight: 500 }}>{t("demo.analyzingWithAI")}</span>
                    </motion.div>
                  )}
                  {demoResult && !analyzing && (
                    <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "var(--bg-subtle)" }}>
                        <span style={{ fontSize: "2rem" }}>{demoResult.emoji}</span>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginTop: 6 }}>{demoResult.emotion}</p>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("demo.emotionDetected")}</p>
                      </div>
                      <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "var(--bg-subtle)" }}>
                        <div className="relative w-14 h-14 mx-auto mb-2">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="38" fill="none" stroke={theme.primaryBg} strokeWidth="8" />
                            <circle cx="50" cy="50" r="38" fill="none" stroke={getColor(demoResult.type)} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(demoResult.score / 10) * 240} ${240 - (demoResult.score / 10) * 240}`} />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 700, color: getColor(demoResult.type) }}>{demoResult.score.toFixed(1)}</span>
                        </div>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("demo.scoreOf10")}</p>
                      </div>
                      <div className="rounded-2xl p-5 text-center text-white" style={{ backgroundColor: getColor(demoResult.type) }}>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.3rem", fontWeight: 700, marginBottom: 4 }}>{demoResult.sentiment}</p>
                        <p style={{ fontSize: "0.68rem", opacity: 0.7 }}>{t("demo.classification")}</p>
                      </div>
                      <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "var(--bg-subtle)" }}>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>94%</p>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("demo.aiConfidence")}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          </FadeIn>
        </div>
      </section>

      {/* CONFIGURE */}
      <section id="como" className="py-12 md:py-18 px-4 md:px-8 relative">
        <div className="max-w-[1000px] mx-auto">
          <FadeIn>
            <div className="flex flex-col md:flex-row md:items-start justify-between mb-14 gap-6">
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.05 }}
                dangerouslySetInnerHTML={{ __html: t.raw("configure.title").replace(/\n/g, "<br/>") }}
              />
              <p className="max-w-[380px] md:text-right" style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text-muted)" }}
                dangerouslySetInnerHTML={{ __html: t.raw("configure.subtitle") }}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <GlassCard className="mb-4">
              <div className="p-5 md:p-7">
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("configure.monitoredEmotions")}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{t("configure.monitoredEmotionsSub")}</p>
                <div className="mt-5"><PillSelector items={emotionList.map(e => emotionNames[e])} selected={selectedEmotions} onSelect={toggleEmotion} icon /></div>
              </div>
            </GlassCard>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FadeIn delay={0.15}>
              <GlassCard>
                <div className="p-5 md:p-7">
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("configure.platforms")}</h3>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{t("configure.platformsSub")}</p>
                  <div className="mt-5"><PillSelector items={["Instagram", "TikTok", "YouTube", "X/Twitter"]} selected={["Instagram"]} onSelect={() => {}} grid /></div>
                </div>
              </GlassCard>
            </FadeIn>
            <FadeIn delay={0.2}>
              <GlassCard>
                <div className="p-5 md:p-7">
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("configure.frequency")}</h3>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{t("configure.frequencySub")}</p>
                  <div className="mt-5"><PillSelector items={[t("configure.frequencyHourly"), t("configure.frequencyDaily"), t("configure.frequencyWeekly")]} selected={[t("configure.frequencyDaily")]} onSelect={() => {}} /></div>
                </div>
              </GlassCard>
            </FadeIn>
          </div>
          <FadeIn delay={0.25}>
            <GlassCard>
              <div className="p-5 md:p-7">
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("configure.alertThreshold")}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{t("configure.alertThresholdSub")}</p>
                <div className="mt-5 flex items-center gap-5">
                  <div className="flex-1 relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: "65%", background: `linear-gradient(90deg, ${theme.primary}, ${theme.sentimentNegative})` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full shadow-md" style={{ left: "calc(65% - 10px)", backgroundColor: "var(--bg-card)", border: `2px solid ${theme.primary}` }} />
                  </div>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", width: 60, textAlign: "right" }}>65%</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("configure.relaxed")}</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("configure.sensitive")}</span>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
          <FadeIn delay={0.35}>
            <GlassCard className="mt-4">
              <div className="p-5 flex items-center gap-4">
                <span style={{ color: "var(--text-faint)" }}>+</span>
                <input type="text" placeholder={t("configure.profilePlaceholder")} className="flex-1 bg-transparent focus:outline-none" style={{ fontSize: "0.92rem", color: "var(--text-primary)" }} readOnly />
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
                  <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
              </div>
            </GlassCard>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div className="flex justify-end mt-6">
              <Link href="/login"><Button size="lg" icon={<Sparkles className="w-4 h-4" />} iconRight={<ArrowRight className="w-4 h-4" />}>{t("configure.startMonitoring")}</Button></Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-12 md:py-18 px-4 md:px-8 overflow-hidden">
        <div className="max-w-[1100px] mx-auto relative">
          <FadeIn>
            <div className="text-center mb-10">
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                {t("features.title")}<br />{t("features.titleLine2")}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[180px] gap-4">
            {[
              { glassIcon: <GlassZapIcon size={44} />, title: t("features.aiDiagnosis"), desc: t("features.aiDiagnosisDesc"), tall: true },
              { glassIcon: <GlassShieldIcon size={40} />, title: t("features.crisisAlerts"), desc: t("features.crisisAlertsDesc") },
              { glassIcon: <GlassChartIcon size={40} />, title: t("features.score010"), desc: t("features.score010Desc") },
              { glassIcon: <GlassHeartIcon size={40} />, title: t("features.emotionsMapped"), desc: t("features.emotionsMappedDesc"), wide: true },
              { glassIcon: <GlassTargetIcon size={40} />, title: t("features.comparatives"), desc: t("features.comparativesDesc") },
              { glassIcon: <GlassEyeIcon size={40} />, title: t("features.wordCloud"), desc: t("features.wordCloudDesc") },
              { glassIcon: <GlassBellIcon size={40} />, title: t("features.temporalHeatmap"), desc: t("features.temporalHeatmapDesc") },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05} className={`${(f as any).tall ? "md:row-span-2" : ""} ${(f as any).wide ? "md:col-span-2" : ""}`}>
                <GlassCard active={(f as any).tall} className="h-full">
                  <div className="p-6 h-full flex flex-col">
                    <div className="mb-3">{f.glassIcon}</div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{f.title}</h3>
                    <p className="flex-1" style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--text-muted)" }}>{f.desc}</p>
                  </div>
                </GlassCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <FadeIn>
        <section className="py-12 px-4 md:px-8">
          <div className="max-w-[680px] mx-auto">
            <GlassCard active>
              <div className="p-8 md:p-10 text-center">
                <div className="flex items-center justify-center gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5" style={{ fill: theme.primary, color: theme.primary }} />)}
                </div>
                <blockquote style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.3rem", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  &ldquo;{t("socialProof.quote")}&rdquo;
                </blockquote>
                <div className="mt-7 flex items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.secondary}, ${theme.primary})` }}>
                    <span className="text-white" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 600 }}>A</span>
                  </div>
                  <div className="text-left">
                    <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("socialProof.authorName")}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t("socialProof.authorRole")}</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>
      </FadeIn>

      {/* PRICING */}
      <section id="preco" className="py-12 md:py-18 px-4 md:px-8 relative">
        <div className="max-w-[1200px] mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--primary)", backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>{t("pricing.badge")}</span>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{t("pricing.title")}</h2>
              <p className="mt-3" style={{ fontSize: "0.92rem", color: "var(--text-muted)" }}>{t("pricing.subtitle")}</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.08} className="h-full">
                <div className="relative h-full">
                  {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white z-20" style={{ fontSize: "0.68rem", fontWeight: 600, backgroundColor: "var(--primary)" }}>{t("pricing.mostPopular")}</span>}
                  <GlassCard active={plan.popular} className={`h-full flex flex-col ${plan.popular ? "text-white" : ""}`}>
                    <div className="absolute inset-0 z-0 pointer-events-none rounded-[20px]" style={plan.popular ? { background: `linear-gradient(135deg, rgba(14,35,37,0.92) 0%, rgba(29,70,73,0.92) 50%, rgba(57,184,198,0.92) 100%)` } : {}} />
                    <div className="relative z-10 flex flex-col h-full p-8">
                      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: plan.popular ? "white" : "var(--text-primary)" }}>{plan.name}</h3>
                      <p className="mt-1.5" style={{ fontSize: "0.78rem", color: plan.popular ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>{plan.desc}</p>
                      <div className="flex items-baseline gap-0.5 mt-6 mb-8">
                        <span style={{ fontSize: "0.82rem", color: plan.popular ? "rgba(255,255,255,0.6)" : "var(--text-faint)" }}>R$</span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "3rem", fontWeight: 800, lineHeight: 1, color: plan.popular ? "white" : "var(--text-primary)" }}>{plan.price}</span>
                        <span style={{ fontSize: "0.82rem", color: plan.popular ? "rgba(255,255,255,0.6)" : "var(--text-faint)" }}>{tc("perMonth")}</span>
                      </div>
                      <div className="space-y-3.5 mb-8 flex-1">
                        {plan.features.map(f => (
                          <div key={f} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.popular ? "#88D4DD" : "var(--primary)" }} />
                            <span style={{ fontSize: "0.82rem", color: plan.popular ? "rgba(255,255,255,0.9)" : "var(--text-primary)" }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Link href="/login" className="w-full py-3.5 rounded-xl transition-all text-center block" style={plan.popular ? { backgroundColor: "white", color: "#0e2325", fontSize: "0.88rem", fontWeight: 600, boxShadow: `0 4px 16px -4px rgba(255,255,255,0.3)` } : { backgroundColor: "var(--primary)", color: "white", fontSize: "0.88rem", fontWeight: 600, boxShadow: "0 4px 16px -4px rgba(57,184,198,0.4)" }}>
                        {t("pricing.startFree")}
                      </Link>
                    </div>
                  </GlassCard>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn>
            <p className="text-center mt-8" style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 600, margin: "2rem auto 0" }}>
              {creditExplanation}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-18 px-4 md:px-8 relative">
        <div className="max-w-[640px] mx-auto">
          <FadeIn><h2 className="text-center mb-12" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("faq.title")}</h2></FadeIn>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.04}>
                <GlassCard>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                    <span style={{ fontSize: "0.92rem", fontWeight: 500, color: "var(--text-primary)" }}>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 ml-4 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="px-6 pb-6 -mt-1"><p style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{faq.a}</p></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <FadeIn>
        <section className="pb-12 md:pb-18 px-4 md:px-8">
          <div className="max-w-[900px] mx-auto rounded-[32px] overflow-hidden relative" style={{ background: `linear-gradient(135deg, #0e2325 0%, #1d4649 50%, ${theme.primary} 100%)` }}>
            <div className="absolute top-[-80px] right-[-40px] w-[260px] h-[260px] rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${theme.secondary} 0%, transparent 70%)` }} />
            <div className="relative px-8 md:px-12 py-16 md:py-20 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #88d4dd, #61c6d1, #39b8c6)" }}>
                <svg fill="none" height="24" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="24"><path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" /></svg>
              </div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 800, color: "white", lineHeight: 1.1, letterSpacing: "-0.03em" }}>{t("cta.title")}<br />{t("cta.titleLine2")}</h2>
              <p className="mt-4 mb-10 mx-auto max-w-[420px]" style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{t("cta.subtitle")}</p>
              <Link href="/login" className="inline-block px-10 py-4 bg-white rounded-full hover:bg-white/90 transition-all shadow-[0_8px_32px_-8px_rgba(0,0,0,0.2)]" style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0e2325" }}>
                {t("cta.button")}
              </Link>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* FOOTER */}
      <footer className="py-10 px-4 md:px-8" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-8">
            {[{ name: t("footer.privacy"), path: "/privacidade" }, { name: t("footer.terms"), path: "/termos" }, { name: t("footer.support"), path: "/suporte" }, { name: t("footer.blog"), path: "/blog" }].map(link => (
              <Link key={link.name} href={link.path} style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{link.name}</Link>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>&copy; {t("footer.copyright")}</p>
        </div>
      </footer>
    </div>
  );
}
