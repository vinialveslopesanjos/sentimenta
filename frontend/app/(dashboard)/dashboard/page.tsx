"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { dashboardApi, connectionsApi, authApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { DashboardSummary, TrendResponse, HealthReport, Connection, PostSummary } from "@/lib/types";
import { loadSyncSettings, toSyncPayload } from "@/lib/syncSettings";
import { scoreColor, scoreLabel, parsePeriod, formatDayLabel, formatTickLabel } from "@/lib/helpers";
import SentimentRadar from "@/components/charts/SentimentRadar";
import WordCloudChart from "@/components/charts/WordCloudChart";

const API_URL = "/api/v1";

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString("pt-BR");
}

function buildThumbnailSrc(url?: string | null) {
  if (!url || url === "null") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${API_URL}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function scoreNarrative(score: number | null) {
  if (score === null) return "Aguardando dados da sua audiência.";
  if (score >= 8) return (
    <span>Seu público está em <span className="text-emerald-500 font-semibold">sintonia</span> com você.</span>
  );
  if (score >= 6.5) return (
    <span>Sua reputação está em <span className="text-brand-lilacDark font-semibold">terreno seguro</span>.</span>
  );
  if (score >= 4) return (
    <span>Alguns sinais de <span className="text-amber-500 font-semibold">atenção</span> detectados.</span>
  );
  return (
    <span>Há <span className="text-rose-500 font-semibold">risco de crise</span> de reputação.</span>
  );
}

// Animated SVG donut
function ScoreDonut({ score }: { score: number | null }) {
  const svgRef = useRef<SVGCircleElement>(null);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? Math.min(Math.max(score / 10, 0), 1) : 0;
  const dashOffset = circumference * (1 - pct);

  const arcColor = score !== null && score >= 8
    ? "url(#donutGrad)"
    : score !== null && score >= 6
      ? "#a78bfa"
      : score !== null && score >= 4
        ? "#FCD34D"
        : "#FB7185";

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.style.strokeDashoffset = String(circumference);
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.8s cubic-bezier(0.16,1,0.3,1)";
        el.style.strokeDashoffset = String(dashOffset);
      });
    });
  }, [score, dashOffset, circumference]);

  return (
    <div className="animate-breathe relative shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx="66" cy="66" r={radius}
          fill="none"
          stroke="#EEF2FF"
          strokeWidth="10"
        />
        {/* Arc */}
        <circle
          ref={svgRef}
          cx="66" cy="66" r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference}
          transform="rotate(-90 66 66)"
        />
        {/* Score text */}
        <text
          x="66" y="62"
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-sans"
          style={{ fontSize: 28, fontWeight: 700, fill: "#1E293B", fontFamily: "Outfit, sans-serif" }}
        >
          {score !== null ? score.toFixed(1) : "—"}
        </text>
        <text
          x="66" y="84"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 12, fill: "#94A3B8", fontFamily: "Outfit, sans-serif" }}
        >
          / 10
        </text>
      </svg>
    </div>
  );
}

function SentimentBarChart({ data, granularity }: { data: TrendResponse | null; granularity: string }) {
  if (!data || data.data_points.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-200">
        <span className="text-sm font-light">Sem dados de tendência ainda.</span>
      </div>
    );
  }

  const pts = data.data_points.map((p) => ({
    period: p.period,
    positive: p.positive,
    neutral: p.neutral,
    negative: p.negative,
    total_comments: p.total_comments,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pts} margin={{ top: 8, right: 8, left: -14, bottom: 8 }}>
          <defs>
            <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#34D399" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FB7185" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={40}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(period: string) => formatTickLabel(period, granularity)}
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
            labelFormatter={(period: string) => formatDayLabel(period)}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                positive: "Positivo",
                neutral: "Neutro",
                negative: "Negativo",
              };
              return [Math.round(value), labels[name] || name];
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #f1f5f9",
              fontSize: 11,
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              padding: "10px 14px",
            }}
          />
          <Bar dataKey="positive" stackId="sent" fill="url(#gradPositive)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="neutral" stackId="sent" fill="url(#gradNeutral)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="negative" stackId="sent" fill="url(#gradNegative)" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConnectionCard({ conn, onSync }: { conn: Connection; onSync: (id: string) => void }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync(conn.id);
    } finally {
      setTimeout(() => setSyncing(false), 2000);
    }
  };

  const iconSrc = conn.platform === "instagram" ? "/icons/instagram.svg" : conn.platform === "twitter" ? "/icons/twitter-x.svg" : "/icons/youtube.svg";

  return (
    <div className="dream-card p-5 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md border border-slate-50 overflow-hidden">
          {conn.profile_image_url ? (
            <img
              src={`${API_URL}/posts/thumbnail?url=${encodeURIComponent(conn.profile_image_url)}`}
              alt={conn.username}
              className="w-11 h-11 rounded-2xl object-cover"
            />
          ) : (
            <img src={iconSrc} alt={conn.platform} className="w-7 h-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans font-semibold text-slate-800 text-sm truncate">{conn.username.startsWith('@') ? conn.username : `@${conn.username}`}</p>
          <p className="text-xs text-slate-400 capitalize">{conn.platform}</p>
        </div>
        <div className={`w-2 h-2 rounded-full shrink-0 ${conn.status === "active" ? "bg-emerald-400 shadow-sm shadow-emerald-200" : "bg-rose-400"}`} />
      </div>
      <div className="flex justify-between items-center mb-4 gap-2">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Seguidores</p>
          <p className="text-sm font-semibold text-slate-700">
            {conn.followers_count > 0
              ? (conn.followers_count >= 1_000_000 ? (conn.followers_count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M' : conn.followers_count >= 10_000 ? (conn.followers_count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K' : conn.followers_count.toLocaleString("pt-BR"))
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Posts</p>
          <p className="text-sm font-semibold text-slate-700">{conn.total_posts ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Comentários</p>
          <p className="text-sm font-semibold text-slate-700">{conn.total_analyzed ?? "—"}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/dashboard/connection/${conn.id}`}
          className="flex-1 text-center py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-all hover:-translate-y-px"
        >
          Ver análise →
        </Link>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-cyanLight hover:text-brand-cyanDark transition-colors flex items-center justify-center disabled:opacity-50"
          title="Sincronizar"
        >
          <span className={`material-symbols-outlined text-[18px] ${syncing ? "animate-spin" : ""}`}>sync</span>
        </button>
      </div>
    </div>
  );
}

function RecentPostItem({ post, index }: { post: PostSummary; index: number }) {
  const [imgError, setImgError] = useState(false);
  const thumbnailSrc = buildThumbnailSrc(post.thumbnail_url);
  const showThumb = thumbnailSrc && !imgError;
  const score = post.summary?.avg_score ?? null;

  const tint = score !== null
    ? score >= 8 ? "dream-card-emerald" : score < 6.5 ? "dream-card-amber" : ""
    : "";

  return (
    <Link
      href={`/posts/${post.id}`}
      className={`flex items-center gap-3 p-3 rounded-2xl hover:-translate-y-px transition-all duration-200 group ${tint || "hover:bg-slate-50/60"}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-brand-lilacLight to-brand-cyanLight flex items-center justify-center shrink-0">
        {showThumb ? (
          <img
            src={thumbnailSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="material-symbols-outlined text-[16px] text-brand-lilacDark">
            {post.platform === "youtube" ? "play_circle" : "image"}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {post.content_text?.slice(0, 50) || "Post sem texto"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">
          {post.platform} · {post.comment_count} comentários
          {" · "}{post.published_at && post.published_at !== "null" ? new Date(post.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}
        </p>
      </div>
      {score !== null && (
        <span className={`text-sm font-sans font-bold shrink-0 ${scoreColor(score)}`}>
          {score.toFixed(1)}/10
        </span>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [pipelineBanner, setPipelineBanner] = useState(false);
  const [trendGranularity, setTrendGranularity] = useState("day");
  const [trendDays, setTrendDays] = useState(30);
  const [userId, setUserId] = useState<string | null>(null);
  const healthCacheKey = userId ? `sentimenta_health_report_${userId}` : null;

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [s, t] = await Promise.all([
        dashboardApi.summary(token),
        dashboardApi.trends(token, { granularity: trendGranularity, days: trendDays }),
      ]);
      setSummary(s);
      setTrends(t);
    } catch (error) {
      console.error("Falha ao carregar dashboard", error);
      setTrends({ data_points: [], granularity: trendGranularity });
    } finally {
      setLoading(false);
    }
  }, [trendGranularity, trendDays]);

  // Check server cache (GET) — never generates a new report
  const checkHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const h = await dashboardApi.healthReport(token);
      if (h.report_text) {
        setHealth(h);
        if (typeof window !== "undefined" && healthCacheKey) {
          localStorage.setItem(healthCacheKey, JSON.stringify(h));
        }
      } else {
        // No cached report on server — clear stale local state
        setHealth(h);
        if (typeof window !== "undefined" && healthCacheKey) {
          localStorage.removeItem(healthCacheKey);
        }
      }
    } catch (error) {
      console.error("Falha ao verificar relatório de saúde", error);
    }
  }, [healthCacheKey]);

  // Generate fresh report (POST) — only called on user click
  const loadHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoadingHealth(true);
    try {
      const h = await dashboardApi.healthReportWithPrompt(token, customPrompt || undefined);
      setHealth(h);
      if (typeof window !== "undefined" && healthCacheKey) {
        localStorage.setItem(healthCacheKey, JSON.stringify(h));
      }
    } catch (error) {
      console.error("Falha ao gerar relatório de saúde", error);
    } finally {
      setLoadingHealth(false);
    }
  }, [customPrompt, healthCacheKey]);

  const openPromptEditor = async () => {
    if (!defaultPrompt) {
      const token = getToken();
      if (token) {
        try {
          const data = await dashboardApi.getHealthPrompt(token);
          setDefaultPrompt(data.prompt);
          if (!customPrompt) setCustomPrompt(data.prompt);
        } catch {}
      }
    }
    setShowPromptEditor(true);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      authApi.me(token).then((u) => {
        setUserName(u.name);
        setUserId(u.id);
      }).catch(() => {});
    }
    if (typeof window !== "undefined") {
      // Check if pipeline was just triggered after social login
      const pipelineFlag = localStorage.getItem("sentimenta_pipeline_started");
      if (pipelineFlag) {
        localStorage.removeItem("sentimenta_pipeline_started");
        setPipelineBanner(true);
        setTimeout(() => setPipelineBanner(false), 30000);
      }
    }
    loadData();
    checkHealth();
  }, [loadData, checkHealth]);

  // Load health cache only after userId is known (scoped per user)
  useEffect(() => {
    if (typeof window !== "undefined" && healthCacheKey) {
      const raw = localStorage.getItem(healthCacheKey);
      if (raw) {
        try { setHealth(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }
  }, [healthCacheKey]);

  const handleSync = async (connectionId: string) => {
    const token = getToken();
    if (!token) return;
    await connectionsApi.sync(token, connectionId, toSyncPayload(loadSyncSettings()));
    setTimeout(loadData, 3000);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = (() => {
    const raw = (userName ?? "").trim();
    if (!raw) return "";
    const name = raw.split(" ")[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  })();

  const isEmpty = !loading && summary && summary.total_connections === 0;
  const avgScore = summary?.avg_score ?? null;
  const badge = scoreLabel(avgScore);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-4 sm:px-6 md:px-8 py-3 sm:py-5 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-sans font-bold text-slate-800 tracking-tight">
            {greeting()}{firstName ? `, ${firstName}` : ""} <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
          </h1>
          <p className="text-sm text-slate-400 font-light">Escute o que o mundo sente.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="relative w-10 h-10 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-brand-cyanDark hover:border-brand-cyan transition-all flex items-center justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </Link>
          <Link
            href="/connect"
            className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 transition-all hover:-translate-y-px"
          >
            <span className="sm:hidden">+</span><span className="hidden sm:inline">+ Conectar</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-screen-xl mx-auto">

        {/* Pipeline started notification */}
        <AnimatePresence>
          {pipelineBanner && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="relative flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-100 shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-brand-lilac to-brand-cyan flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-white text-[18px]">hourglass_top</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Seus dados estao sendo processados</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estamos coletando e analisando seus posts e comentarios. Dependendo do volume, isso pode levar de <strong>5 a 15 minutos</strong>.
                  Voce pode navegar normalmente — o dashboard sera atualizado automaticamente.
                </p>
              </div>
              <button
                onClick={() => setPipelineBanner(false)}
                className="shrink-0 w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-lilacLight to-brand-cyanLight flex items-center justify-center mb-6 shadow-dream">
              <span className="material-symbols-outlined text-[40px] text-brand-lilacDark">add_link</span>
            </div>
            <h2 className="text-2xl font-sans font-bold text-slate-700 mb-3">Conecte seu primeiro perfil</h2>
            <p className="text-slate-400 font-light mb-8 max-w-sm">Adicione Instagram ou YouTube para começar a analisar seus comentários com IA.</p>
            <div className="flex gap-4">
              <Link href="/connect" className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-medium text-sm shadow-float hover:bg-slate-800 hover:scale-105 transition-all">
                Conectar Instagram
              </Link>
              <Link href="/connect" className="px-6 py-3 rounded-2xl bg-white text-slate-600 font-medium text-sm border border-slate-200 hover:border-brand-lilac transition-all">
                Conectar YouTube
              </Link>
            </div>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* ── 1. HERO: Score + Narrative ── */}
            <div className="dream-card p-8 md:p-10 animate-fade-in-up-1">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4">Reputação Geral</p>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {loading ? (
                  <div className="w-32 h-32 rounded-full bg-slate-100 animate-pulse shrink-0" />
                ) : (
                  <ScoreDonut score={avgScore} />
                )}
                <div className="flex-1 text-center sm:text-left">
                  {loading ? (
                    <div className="space-y-3">
                      <div className="h-8 w-64 bg-slate-100 rounded-xl animate-pulse mx-auto sm:mx-0" />
                      <div className="h-5 w-40 bg-slate-50 rounded-lg animate-pulse mx-auto sm:mx-0" />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl md:text-3xl font-sans font-bold text-slate-800 leading-tight mb-3">
                        {scoreNarrative(avgScore)}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        {badge && (
                          <span className={`px-3 py-1.5 border rounded-full text-xs font-semibold ${badge.cls}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
{summary?.sentiment_distribution && (() => {
  const dist = summary.sentiment_distribution;
  const total = dist.positive + dist.neutral + dist.negative;
  if (total === 0) return null;
  const pPos = ((dist.positive / total) * 100).toFixed(0);
  const pNeu = ((dist.neutral / total) * 100).toFixed(0);
  const pNeg = ((dist.negative / total) * 100).toFixed(0);
  return (
    <div className="mt-5 w-full max-w-sm">
      <div className="flex text-[10px] text-slate-400 mb-1.5 justify-between">
        <span>😊 {pPos}% positivo</span>
        <span>😐 {pNeu}% neutro</span>
        <span>😡 {pNeg}% negativo</span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pPos}%` }} />
        <div className="h-full bg-slate-300 transition-all" style={{ width: `${pNeu}%` }} />
        <div className="h-full bg-rose-400 transition-all" style={{ width: `${pNeg}%` }} />
      </div>
    </div>
  );
})()}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── 2. KPIs compactos ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-5 animate-fade-in-up-2">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="dream-card p-5 shadow-sm animate-pulse flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-16 bg-slate-100 rounded" />
                      <div className="h-3 w-20 bg-slate-50 rounded" />
                    </div>
                  </div>
                ))
              ) : (
                [
                  { icon: "forum", value: compactNumber(summary?.total_analyzed ?? 0), label: "analisados", sub: `de ${compactNumber(summary?.total_comments ?? 0)} coletados`, bg: "bg-cyan-50 text-brand-cyanDark" },
                  { icon: "article", value: compactNumber(summary?.total_posts ?? 0), label: "posts", bg: "bg-violet-50 text-brand-lilacDark" },
                  { icon: "add_link", value: compactNumber(summary?.total_connections ?? 0), label: "conexões", bg: "bg-emerald-50 text-emerald-600" },
                ].map((kpi) => (
                  <div key={kpi.label} className="dream-card p-3 sm:p-5 flex shadow-sm gap-2 sm:gap-3 items-center hover:-translate-y-0.5 transition-all">
                    <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-2xl sm:text-3xl text-slate-800">{kpi.value}</p>
                      <p className="text-xs text-slate-400">{kpi.label}</p>
                      {(kpi as any).sub && <p className="text-[10px] text-slate-300">{(kpi as any).sub}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── 3. Radar + WordCloud ── */}
            {!loading && (summary?.total_analyzed ?? 0) > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-up-3">
                <div className="dream-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 text-brand-lilacDark flex items-center justify-center">
                      <span className="material-symbols-outlined text-[16px]">radar</span>
                    </div>
                    <h2 className="text-base font-sans font-bold text-slate-700">Radar de Emocoes</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-light mb-2">Emocoes predominantes em todas as redes</p>
                  <SentimentRadar distribution={summary?.emotions_distribution ?? null} height={260} />
                </div>
                <div className="dream-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-cyan-50 text-brand-cyanDark flex items-center justify-center">
                      <span className="material-symbols-outlined text-[16px]">cloud</span>
                    </div>
                    <h2 className="text-base font-sans font-bold text-slate-700">Nuvem de Palavras</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-light mb-2">Palavras mais faladas nos comentarios</p>
                  <WordCloudChart topics={summary?.word_frequency ?? null} maxWords={20} height={260} />
                </div>
              </div>
            )}

            {/* ── 4. Health Report (IA) — collapsed when unavailable ── */}
            <div className={`dream-card relative overflow-hidden animate-fade-in-up-4 ${health?.report_text ? "p-6 md:p-8" : "p-4"}`}>
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-cyan-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
              <div className="relative z-10">
                <div className={`flex items-center justify-between ${health?.report_text ? "mb-5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-brand-lilac to-brand-cyan flex items-center justify-center text-white shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    </div>
                    <h2 className="text-base font-sans font-bold text-slate-700">Diagnóstico de Reputação</h2>
                    {health?.has_new_data && health?.report_text && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-bold animate-pulse">
                        Novos dados
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {health?.report_text && (
                      <button
                        onClick={openPromptEditor}
                        className="text-xs text-slate-400 hover:text-brand-lilacDark transition-colors flex items-center gap-1"
                        title="Personalizar prompt"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      </button>
                    )}
                    {health?.report_text ? (
                      <button
                        onClick={loadHealth}
                        disabled={loadingHealth}
                        className="text-xs text-brand-lilacDark font-semibold hover:underline disabled:opacity-50 flex items-center gap-1"
                      >
                        {loadingHealth && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                        Atualizar
                      </button>
                    ) : (
                      <button
                        onClick={loadHealth}
                        disabled={loadingHealth}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {loadingHealth && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                        Gerar relatório
                      </button>
                    )}
                  </div>
                </div>
                {health?.report_text && (
                  <div className="prose prose-sm prose-slate max-w-none text-brand-text leading-relaxed mt-5">
                    <p className="text-xs text-slate-400 font-light mb-3">
                      {health.generated_at
                        ? `Gerado em ${new Date(health.generated_at).toLocaleString("pt-BR")}`
                        : "Último relatório disponível."}
                    </p>
                    <ReactMarkdown>{health.report_text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. Temporal distribution chart ── */}
            <div className="dream-card p-6 md:p-8 animate-fade-in-up-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-base font-sans font-bold text-slate-700">Distribuição Temporal</h2>
                  <p className="text-xs text-slate-400 font-light mt-0.5">Comentários por sentimento</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-xl border border-slate-100 overflow-hidden text-sm shrink-0">
                    {[
                      { label: "30d", value: 30 },
                      { label: "90d", value: 90 },
                      { label: "1a", value: 365 },
                      { label: "Tudo", value: 0 },
                    ].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setTrendDays(p.value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          trendDays === p.value
                            ? "bg-brand-lilac text-white"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-xl border border-slate-100 overflow-hidden text-sm shrink-0">
                    {[
                      { label: "Dia", value: "day" },
                      { label: "Semana", value: "week" },
                      { label: "Mês", value: "month" },
                    ].map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setTrendGranularity(g.value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          trendGranularity === g.value
                            ? "bg-brand-lilacDark text-white"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
              ) : (
                <SentimentBarChart data={trends} granularity={trendGranularity} />
              )}
              <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-3">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Positivo</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-400" />Neutro</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-400" />Negativo</span>
              </div>
            </div>

            {/* ── 6. Connections ── */}
            {!loading && (summary?.connections ?? []).length > 0 && (
              <div className="space-y-4 animate-fade-in-up-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-sans font-bold text-slate-700">Seus Perfis</h2>
                  <Link href="/connect" className="text-xs text-brand-lilacDark font-semibold hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Adicionar
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(summary?.connections ?? []).map((conn) => (
                    <ConnectionCard key={conn.id} conn={conn} onSync={handleSync} />
                  ))}
                  <Link
                    href="/connect"
                    className="dream-card p-5 flex flex-col items-center justify-center gap-3 border-dashed border-2 border-slate-100 hover:border-brand-lilac hover:bg-violet-50/30 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 group-hover:bg-brand-lilacLight flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[20px] text-slate-300 group-hover:text-brand-lilacDark transition-colors">add</span>
                    </div>
                    <span className="text-xs text-slate-400 group-hover:text-brand-lilacDark font-medium transition-colors">Adicionar perfil</span>
                  </Link>
                </div>
              </div>
            )}

            {/* ── 7. Recent Posts ── */}
            <div className="dream-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-sans font-bold text-slate-700">Posts Recentes</h2>
                <Link href="/connect" className="text-xs text-brand-lilacDark font-semibold hover:underline">Ver tudo</Link>
              </div>
              <p className="text-xs text-slate-400 mb-3">Clique para ver a análise individual.</p>
              {loading ? (
                <div className="space-y-3">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="h-14 bg-slate-50 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (summary?.recent_posts ?? []).length === 0 ? (
                <div className="py-10 text-center text-slate-300 text-sm font-light">
                  <span className="material-symbols-outlined text-[36px] block mb-2 text-slate-200">article</span>
                  Nenhum post analisado ainda
                </div>
              ) : (
                <div className="space-y-1">
                  {(summary?.recent_posts ?? []).slice(0, 5).map((post, i) => (
                    <RecentPostItem key={post.id} post={post} index={i} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Prompt Editor Modal */}
      <AnimatePresence>
        {showPromptEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowPromptEditor(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-modal w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-brand-lilac to-brand-cyan flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-white">edit_note</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-slate-700">Personalizar Prompt</h3>
                    <p className="text-xs text-slate-400 font-light">Edite o prompt usado para gerar o diagn&oacute;stico</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPromptEditor(false)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full h-64 p-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:outline-none focus:border-brand-lilac focus:ring-2 focus:ring-brand-lilac/20 transition-all font-mono leading-relaxed"
                  placeholder="Escreva seu prompt customizado aqui..."
                />
                <p className="text-[10px] text-slate-300 mt-2 font-light">
                  Os dados de sentimento ser&atilde;o automaticamente anexados ao final do prompt.
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => { setCustomPrompt(defaultPrompt); }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
                >
                  Restaurar padr&atilde;o
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPromptEditor(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowPromptEditor(false);
                      loadHealth();
                    }}
                    className="px-5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-sm transition-all"
                  >
                    Gerar com este prompt
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
