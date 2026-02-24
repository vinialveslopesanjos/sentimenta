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
import { dashboardApi, connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { DashboardSummary, TrendResponse, HealthReport, Connection, PostSummary } from "@/lib/types";
import { loadSyncSettings, toSyncPayload } from "@/lib/syncSettings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function buildThumbnailSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${API_URL}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function parsePeriod(period: string) {
  if (/^\d{4}-\d{2}$/.test(period)) return new Date(`${period}-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return new Date(`${period}T00:00:00`);
  const dt = new Date(period);
  return Number.isNaN(dt.getTime()) ? new Date("1970-01-01T00:00:00") : dt;
}

function formatMonthYear(period: string) {
  return parsePeriod(period).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

function formatDayLabel(period: string) {
  return parsePeriod(period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function scoreColor(score: number | null) {
  if (score === null) return "text-slate-300";
  if (score >= 8) return "text-emerald-500";
  if (score >= 6) return "text-brand-lilacDark";
  if (score >= 4) return "text-amber-500";
  return "text-rose-500";
}

function scoreLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 9) return { text: "Excelente", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  if (score >= 8) return { text: "Ótimo", cls: "bg-cyan-50 text-cyan-700 border-cyan-100" };
  if (score >= 6.5) return { text: "Bom", cls: "bg-violet-50 text-violet-700 border-violet-100" };
  if (score >= 4) return { text: "Regular", cls: "bg-amber-50 text-amber-700 border-amber-100" };
  return { text: "Crítico", cls: "bg-rose-50 text-rose-700 border-rose-100" };
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

function SentimentBarChart({ data }: { data: TrendResponse | null }) {
  if (!data || data.data_points.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-200">
        <span className="text-sm font-light">Sem dados de tendência ainda.</span>
      </div>
    );
  }

  const pts = data.data_points.slice(-24).map((p) => ({
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
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={22}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(period: string) => formatMonthYear(period)}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(139, 92, 246, 0.06)" }}
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
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(196,181,253,0.35)",
              borderRadius: 14,
              boxShadow: "0 4px 16px -4px rgba(139,92,246,0.2)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="positive" stackId="sent" fill="#34D399" radius={[3, 3, 0, 0]} />
          <Bar dataKey="neutral" stackId="sent" fill="#FCD34D" radius={[3, 3, 0, 0]} />
          <Bar dataKey="negative" stackId="sent" fill="#FB7185" radius={[3, 3, 0, 0]} />
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

  const isInstagram = conn.platform === "instagram";
  const platformGrad = isInstagram
    ? "from-pink-400 via-rose-400 to-orange-400"
    : "from-red-500 to-red-600";

  return (
    <div className="dream-card p-5 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${platformGrad} flex items-center justify-center shrink-0 shadow-md`}>
          {isInstagram ? (
            <svg fill="white" height="20" viewBox="0 0 24 24" width="20"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 3.674c-2.403 0-4.35 1.948-4.35 4.35s1.947 4.35 4.35 4.35 4.35-1.948 4.35-4.35-1.947-4.35-4.35-4.35zm0 7.175c-1.566 0-2.826-1.26-2.826-2.825s1.26-2.826 2.826-2.826 2.826 1.26 2.826 2.826-1.26 2.825-2.826 2.825zm4.406-7.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
          ) : (
            <svg fill="white" height="18" viewBox="0 0 24 24" width="18"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans font-semibold text-slate-800 text-sm truncate">@{conn.username}</p>
          <p className="text-xs text-slate-400 capitalize">{conn.platform}</p>
        </div>
        <div className={`w-2 h-2 rounded-full shrink-0 ${conn.status === "active" ? "bg-emerald-400 shadow-sm shadow-emerald-200" : "bg-rose-400"}`} />
      </div>
      {conn.followers_count > 0 && (
        <p className="text-xs text-slate-400 mb-4">
          {conn.followers_count.toLocaleString("pt-BR")} seguidores
        </p>
      )}
      <div className="flex gap-2">
        <Link
          href={`/dashboard/connection/${conn.id}`}
          className="flex-1 text-center py-2.5 rounded-xl bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-xs font-semibold hover:shadow-lg hover:shadow-violet-200 transition-all hover:-translate-y-px"
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
        </p>
      </div>
      {score !== null && (
        <span className={`text-sm font-sans font-bold shrink-0 ${scoreColor(score)}`}>
          {score.toFixed(1)}
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
  const HEALTH_CACHE_KEY = "sentimenta_latest_health_report";

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [s, t] = await Promise.all([
        dashboardApi.summary(token),
        dashboardApi.trends(token, { granularity: "day", days: 30 }),
      ]);
      setSummary(s);
      setTrends(t);
    } catch (error) {
      console.error("Falha ao carregar dashboard", error);
      setTrends({ data_points: [], granularity: "day" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoadingHealth(true);
    try {
      const h = await dashboardApi.healthReport(token);
      setHealth(h);
      if (typeof window !== "undefined") {
        localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(h));
      }
    } catch (error) {
      console.error("Falha ao carregar relatório de saúde", error);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sentiment_user_name") : null;
    setUserName(stored);
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(HEALTH_CACHE_KEY);
      if (raw) {
        try { setHealth(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }
    loadData();
    loadHealth();
  }, [loadData, loadHealth]);

  const handleSync = async (connectionId: string) => {
    const token = getToken();
    if (!token) return;
    await connectionsApi.sync(token, connectionId, toSyncPayload(loadSyncSettings()));
    setTimeout(loadData, 3000);
  };

  const dist = summary?.sentiment_distribution;
  const total = dist ? (dist.positive + dist.neutral + dist.negative) || 1 : 1;
  const posRate = dist ? Math.round((dist.positive / total) * 100) : 0;
  const neuRate = dist ? Math.round((dist.neutral / total) * 100) : 0;
  const negRate = dist ? Math.round((dist.negative / total) * 100) : 0;

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
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-6 md:px-8 py-5 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-sans font-bold text-slate-800 tracking-tight">
            {greeting()}{firstName ? `, ${firstName}` : ""}. 👋
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
            className="px-4 py-2 rounded-full bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-sm font-semibold shadow-sm hover:shadow-lg hover:shadow-violet-200 transition-all hover:-translate-y-px"
          >
            + Conectar
          </Link>
        </div>
      </header>

      <main className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-lilacLight to-brand-cyanLight flex items-center justify-center mb-6 shadow-dream">
              <span className="material-symbols-outlined text-[40px] text-brand-lilacDark">add_link</span>
            </div>
            <h2 className="text-2xl font-sans font-bold text-slate-700 mb-3">Conecte seu primeiro perfil</h2>
            <p className="text-slate-400 font-light mb-8 max-w-sm">Adicione Instagram ou YouTube para começar a analisar seus comentários com IA.</p>
            <div className="flex gap-4">
              <Link href="/connect" className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white font-medium text-sm shadow-float hover:shadow-glow hover:scale-105 transition-all">
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
            {/* ── HERO: Score + Narrative ── */}
            <div className="dream-card p-6 md:p-8 animate-fade-in-up-1">
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
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold">
                          ↑ +0.4 esta semana
                        </span>
                        {badge && (
                          <span className={`px-3 py-1.5 border rounded-full text-xs font-semibold ${badge.cls}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── KPIs compactos ── */}
            <div className="grid grid-cols-3 gap-4 animate-fade-in-up-2">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="dream-card p-4 animate-pulse flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-16 bg-slate-100 rounded" />
                      <div className="h-3 w-20 bg-slate-50 rounded" />
                    </div>
                  </div>
                ))
              ) : (
                [
                  { icon: "forum", value: (summary?.total_comments ?? 0).toLocaleString("pt-BR"), label: "comentários", bg: "bg-cyan-50 text-brand-cyanDark" },
                  { icon: "article", value: summary?.total_posts ?? 0, label: "posts", bg: "bg-violet-50 text-brand-lilacDark" },
                  { icon: "add_link", value: summary?.total_connections ?? 0, label: "conexões", bg: "bg-emerald-50 text-emerald-600" },
                ].map((kpi) => (
                  <div key={kpi.label} className="dream-card p-4 flex gap-3 items-center hover:-translate-y-0.5 transition-all">
                    <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-xl text-slate-800">{kpi.value}</p>
                      <p className="text-xs text-slate-400">{kpi.label}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Connections ── */}
            {!loading && (summary?.connections ?? []).length > 0 && (
              <div className="space-y-4 animate-fade-in-up-3">
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

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up-4">
              {/* Trend chart */}
              <div className="lg:col-span-2 dream-card p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-sans font-bold text-slate-700">Distribuição Temporal</h2>
                    <p className="text-xs text-slate-400 font-light mt-0.5">Comentários por sentimento — 30 dias</p>
                  </div>
                </div>
                {loading ? (
                  <div className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
                ) : (
                  <SentimentBarChart data={trends} />
                )}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-3">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Positivo</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-300" />Neutro</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-400" />Negativo</span>
                </div>
              </div>

              {/* Sentiment donut */}
              <div className="dream-card p-6">
                <h2 className="text-base font-sans font-bold text-slate-700 mb-5">Distribuição</h2>
                {loading ? (
                  <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" />
                ) : dist ? (
                  <div className="space-y-4">
                    <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                      <div className="h-full rounded-l-full bg-emerald-400 transition-all" style={{ width: `${posRate}%` }} />
                      <div className="h-full bg-amber-300 transition-all" style={{ width: `${neuRate}%` }} />
                      <div className="h-full rounded-r-full bg-rose-400 transition-all" style={{ width: `${negRate}%` }} />
                    </div>
                    <div className="space-y-3 mt-4">
                      {[
                        { label: "Positivo", pct: posRate, color: "bg-emerald-400", textColor: "text-emerald-600" },
                        { label: "Neutro", pct: neuRate, color: "bg-amber-300", textColor: "text-amber-600" },
                        { label: "Negativo", pct: negRate, color: "bg-rose-400", textColor: "text-rose-600" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                            <span className="text-sm text-slate-500 font-light">{item.label}</span>
                          </div>
                          <span className={`text-sm font-sans font-bold ${item.textColor}`}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-200 text-sm">Sem dados ainda</div>
                )}
              </div>
            </div>

            {/* ── Health Report + Recent Posts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Health Report */}
              <div className="dream-card p-6 md:p-8 relative overflow-hidden">
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-cyan-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-brand-lilac to-brand-cyan flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      </div>
                      <h2 className="text-base font-sans font-bold text-slate-700">Saúde da Reputação (IA)</h2>
                    </div>
                    <button
                      onClick={loadHealth}
                      disabled={loadingHealth}
                      className="text-xs text-brand-lilacDark font-semibold hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {loadingHealth && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      Atualizar
                    </button>
                  </div>
                  {health ? (
                    <div className="prose prose-sm prose-slate max-w-none text-brand-text leading-relaxed">
                      <p className="text-xs text-slate-400 font-light mb-3">Último relatório disponível.</p>
                      <ReactMarkdown>{health.report_text}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-300">
                      <span className="material-symbols-outlined text-[40px] block mb-3">auto_awesome</span>
                      <p className="text-sm font-light">Clique em &quot;Atualizar&quot; para gerar um relatório com IA.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Posts */}
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
            </div>
          </>
        )}
      </main>
    </div>
  );
}
