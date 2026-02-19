"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 font-sans font-semibold text-3xl">—</span>;
  const color = score >= 7 ? "text-emerald-600" : score >= 4 ? "text-amber-500" : "text-rose-500";
  return <span className={`font-sans font-semibold text-3xl ${color}`}>{score.toFixed(1)}</span>;
}

function SkeletonCard() {
  return (
    <div className="dream-card p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-12 h-5 rounded-full bg-slate-100" />
      </div>
      <div className="h-8 w-20 bg-slate-100 rounded-lg mb-2" />
      <div className="h-4 w-28 bg-slate-100 rounded" />
    </div>
  );
}

function SentimentBarChart({ data }: { data: TrendResponse | null }) {
  if (!data || data.data_points.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-200">
        <span className="text-sm font-light">Sem dados de tendência</span>
      </div>
    );
  }

  const pts = data.data_points.slice(-14);
  const maxTotal = Math.max(...pts.map(p => p.positive + p.neutral + p.negative), 1);
  const CHART_H = 144;

  return (
    <div className="h-48 w-full">
      <div className="flex items-end gap-px w-full" style={{ height: CHART_H }}>
        {pts.map((p, i) => {
          const total = p.positive + p.neutral + p.negative;
          if (total === 0) {
            return <div key={i} className="flex-1 bg-slate-50 rounded-sm" style={{ height: 4 }} />;
          }
          const posH = Math.round((p.positive / maxTotal) * CHART_H);
          const neuH = Math.round((p.neutral / maxTotal) * CHART_H);
          const negH = Math.round((p.negative / maxTotal) * CHART_H);
          return (
            <div key={i} className="flex-1 flex flex-col justify-end overflow-hidden rounded-sm">
              <div style={{ height: posH, backgroundColor: "#34D399" }} title={`Positivo: ${p.positive}`} />
              <div style={{ height: neuH, backgroundColor: "#FCD34D" }} title={`Neutro: ${p.neutral}`} />
              <div style={{ height: negH, backgroundColor: "#FB7185" }} title={`Negativo: ${p.negative}`} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {[
          { label: "Positivo", color: "#34D399" },
          { label: "Neutro", color: "#FCD34D" },
          { label: "Negativo", color: "#FB7185" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-slate-300 font-light">{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex justify-end text-[10px] text-slate-300 font-light uppercase tracking-wider gap-2">
          {pts.filter((_, i) => i % Math.ceil(pts.length / 5) === 0).map((p, i) => (
            <span key={i}>{p.period.slice(5)}</span>
          ))}
        </div>
      </div>
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

  const platformColor = conn.platform === "instagram"
    ? "from-orange-100 to-pink-100 text-pink-500"
    : "from-red-50 to-red-100 text-red-500";

  const platformIcon = conn.platform === "instagram"
    ? <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><rect height="20" rx="5" ry="5" width="20" x="2" y="2"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
    : <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>;

  return (
    <div className="dream-card p-5 hover:shadow-float transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${platformColor} flex items-center justify-center shrink-0`}>
          {platformIcon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-700 text-sm truncate">@{conn.username}</p>
          <p className="text-xs text-slate-400 capitalize">{conn.platform}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${conn.status === "active" ? "bg-emerald-400" : "bg-rose-400"} shrink-0`} title={conn.status} />
      </div>
      {conn.followers_count > 0 && (
        <p className="text-xs text-slate-400 mb-4">
          {conn.followers_count.toLocaleString("pt-BR")} seguidores
        </p>
      )}
      <div className="flex gap-2">
        <Link
          href={`/dashboard/connection/${conn.id}`}
          className="flex-1 text-center py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-medium hover:bg-brand-lilacLight hover:text-brand-lilacDark transition-colors"
        >
          Ver análise
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

function RecentPostItem({ post }: { post: PostSummary }) {
  const score = post.summary?.avg_score;
  const sentLabel = score == null ? "Pendente" : score >= 7 ? "Positivo" : score >= 4 ? "Neutro" : "Negativo";
  const sentColor = score == null
    ? "bg-slate-50 text-slate-400 border-slate-100"
    : score >= 7
      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
      : score >= 4
        ? "bg-amber-50 text-amber-600 border-amber-100"
        : "bg-rose-50 text-rose-500 border-rose-100";
  const [imgError, setImgError] = useState(false);
  const thumbnailSrc = buildThumbnailSrc(post.thumbnail_url);
  const showThumb = thumbnailSrc && !imgError;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group"
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
      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border shrink-0 ${sentColor}`}>
        {sentLabel}
      </span>
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

  useEffect(() => {
    // Get user name from localStorage
    const stored = typeof window !== "undefined" ? localStorage.getItem("sentiment_user_name") : null;
    setUserName(stored);
    loadData();
  }, [loadData]);

  const loadHealth = async () => {
    const token = getToken();
    if (!token) return;
    setLoadingHealth(true);
    try {
      const h = await dashboardApi.healthReport(token);
      setHealth(h);
    } catch (error) {
      console.error("Falha ao carregar relatório de saúde", error);
    } finally {
      setLoadingHealth(false);
    }
  };

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

  const isEmpty = !loading && summary && summary.total_connections === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-medium text-slate-800">
            {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}. 👋
          </h1>
          <p className="text-sm text-slate-400 font-light">Aqui está o resumo dos seus sentimentos hoje.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="relative w-10 h-10 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-brand-cyanDark hover:border-brand-cyan transition-all flex items-center justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </Link>
          <Link
            href="/connect"
            className="px-4 py-2 rounded-full bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-sm font-medium shadow-sm hover:shadow-float transition-all"
          >
            + Conectar
          </Link>
        </div>
      </header>

      <main className="p-6 md:p-8 space-y-8 max-w-screen-xl mx-auto animate-fade-in">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-lilacLight to-brand-cyanLight flex items-center justify-center mb-6 shadow-dream">
              <span className="material-symbols-outlined text-[40px] text-brand-lilacDark">add_link</span>
            </div>
            <h2 className="text-2xl font-sans font-medium text-slate-700 mb-3">Conecte seu primeiro perfil</h2>
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
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {loading ? (
                Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
              ) : (
                <>
                  {[
                    { icon: "add_link", label: "Conexões", value: summary?.total_connections ?? 0, sub: "perfis conectados", bg: "bg-violet-50 text-brand-lilacDark", badge: null },
                    { icon: "article", label: "Posts", value: summary?.total_posts ?? 0, sub: "analisados", bg: "bg-cyan-50 text-brand-cyanDark", badge: null },
                    { icon: "forum", label: "Comentários", value: (summary?.total_comments ?? 0).toLocaleString("pt-BR"), sub: "coletados", bg: "bg-rose-50 text-rose-400", badge: null },
                  ].map((kpi) => (
                    <div key={kpi.label} className="dream-card p-5 hover:shadow-float transition-all duration-300 group">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                        </div>
                      </div>
                      <h3 className="text-3xl font-sans font-semibold text-slate-700">{kpi.value}</h3>
                      <p className="text-sm text-slate-400 font-light mt-1">{kpi.sub}</p>
                    </div>
                  ))}
                  {/* Score card — highlighted */}
                  <div className="bg-gradient-to-br from-brand-lilac to-brand-lilacDark p-5 rounded-3xl shadow-lg shadow-violet-200 text-white relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">favorite</span>
                      </div>
                    </div>
                    <div className="relative z-10">
                      {summary?.avg_score != null ? (
                        <h3 className="text-3xl font-sans font-semibold">{summary.avg_score.toFixed(1)}<span className="text-lg text-violet-200 ml-1">/10</span></h3>
                      ) : (
                        <h3 className="text-3xl font-sans font-semibold text-violet-200">—</h3>
                      )}
                      <p className="text-sm text-violet-100 font-light mt-1">Score médio</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend chart */}
              <div className="lg:col-span-2 dream-card p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-sans font-medium text-slate-700">Distribuição Temporal</h2>
                    <p className="text-sm text-slate-400 font-light mt-0.5">Comentários por sentimento — 30 dias</p>
                  </div>
                </div>
                {loading ? (
                  <div className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
                ) : (
                  <SentimentBarChart data={trends} />
                )}
              </div>

              {/* Sentiment donut */}
              <div className="dream-card p-6">
                <h2 className="text-lg font-sans font-medium text-slate-700 mb-6">Distribuição</h2>
                {loading ? (
                  <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" />
                ) : dist ? (
                  <div className="space-y-4">
                    {/* Bar */}
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
                          <span className={`text-sm font-sans font-semibold ${item.textColor}`}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-200 text-sm">Sem dados</div>
                )}
              </div>
            </div>

            {/* Health Report + Recent Posts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Health Report */}
              <div className="dream-card p-6 md:p-8 relative overflow-hidden">
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-cyan-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-brand-lilac to-brand-cyan flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      </div>
                      <h2 className="text-lg font-sans font-medium text-slate-700">Saúde da Reputação (IA)</h2>
                    </div>
                    <button
                      onClick={loadHealth}
                      disabled={loadingHealth}
                      className="text-xs text-brand-lilacDark font-medium hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {loadingHealth && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      Atualizar
                    </button>
                  </div>
                  {health ? (
                    <div className="prose prose-sm prose-slate max-w-none text-brand-text leading-relaxed">
                      <ReactMarkdown>{health.report_text}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-300">
                      <span className="material-symbols-outlined text-[40px] block mb-3">auto_awesome</span>
                      <p className="text-sm font-light">Clique em "Atualizar" para gerar um relatório de saúde com IA.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Posts */}
              <div className="dream-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-sans font-medium text-slate-700">Posts Recentes</h2>
                  <Link href="/connect" className="text-xs text-brand-lilacDark font-medium hover:underline">Ver tudo</Link>
                </div>
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
                    {(summary?.recent_posts ?? []).slice(0, 5).map((post) => (
                      <RecentPostItem key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Connections */}
            {!loading && (summary?.connections ?? []).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-sans font-medium text-slate-700">Seus Perfis</h2>
                  <Link href="/connect" className="text-xs text-brand-lilacDark font-medium hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Adicionar perfil
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
          </>
        )}
      </main>
    </div>
  );
}
