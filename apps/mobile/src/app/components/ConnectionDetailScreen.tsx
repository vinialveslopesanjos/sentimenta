import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import type {
  ConnectionDashboard,
  TrendResponse,
  TrendsDetailedResponse,
  CommentWithAnalysis,
} from "@sentimenta/types";
import {
  ArrowLeft,
  Heart,
  BarChart3,
  TrendingDown,
  MessageSquare,
  ThumbsUp,
  FileText,
  Zap,
  Search,
  Filter,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

const EMOTION_PALETTE = [
  "#22D3EE", "#8B5CF6", "#67E8F9", "#A78BFA", "#F472B6", "#C4B5FD", "#E2E8F0",
];

const TOPIC_PALETTE = [
  "#22D3EE", "#06B6D4", "#67E8F9", "#22D3EE", "#06B6D4", "#67E8F9", "#22D3EE",
];

function fmtDate(s: string | null) {
  if (!s) return "?";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function buildThumbnailSrc(url?: string | null) {
  if (!url) return null;
  const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${baseUrl}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function ConnectionDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [scorePeriod, setScorePeriod] = useState<"Dia" | "Semana" | "Mes">("Dia");
  const [temporalView, setTemporalView] = useState<"Sentimento" | "Emocoes" | "Topicos">("Sentimento");
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<ConnectionDashboard | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [trendsDetailed, setTrendsDetailed] = useState<TrendsDetailedResponse | null>(null);
  const [comments, setComments] = useState<CommentWithAnalysis[]>([]);

  const granularityMap: Record<string, string> = { Dia: "day", Semana: "week", Mes: "month" };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const granularity = granularityMap[scorePeriod];
    Promise.all([
      api.dashboard.connectionDashboard(id),
      api.dashboard.trends({ connection_id: id, granularity }),
      api.dashboard.trendsDetailed({ connection_id: id, granularity }),
      api.comments.list({ connection_id: id, limit: 20 }),
    ])
      .then(([dashData, trendsData, detailedData, commentsData]) => {
        setDash(dashData);
        setTrends(trendsData);
        setTrendsDetailed(detailedData);
        setComments(commentsData.items);
      })
      .catch((err) => console.error("Failed to load connection data:", err))
      .finally(() => setLoading(false));
  }, [id, scorePeriod]);

  const handleAnalyze = () => {
    if (!id) return;
    setAnalyzing(true);
    api.connections
      .sync(id)
      .then(() => {
        // Reload data after sync
        return api.dashboard.connectionDashboard(id);
      })
      .then((d) => setDash(d))
      .catch((err) => console.error("Sync failed:", err))
      .finally(() => setAnalyzing(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center">
        <StatusBar />
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-violet-400 animate-spin" />
          <p className="text-slate-400" style={{ fontSize: "13px" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center">
        <StatusBar />
        <p className="text-slate-400" style={{ fontSize: "14px" }}>Conexao nao encontrada</p>
      </div>
    );
  }

  const conn = dash.connection;
  const sentDist = dash.sentiment_distribution;
  const totalSent = sentDist ? sentDist.positive + sentDist.neutral + sentDist.negative : 0;
  const positivePercent = totalSent > 0 ? Math.round((sentDist!.positive / totalSent) * 100) : 0;
  const neutralPercent = totalSent > 0 ? Math.round((sentDist!.neutral / totalSent) * 100) : 0;
  const negativePercent = totalSent > 0 ? Math.round((sentDist!.negative / totalSent) * 100) : 0;

  // Build emotions list from emotions_distribution
  const emotionEntries = dash.emotions_distribution
    ? Object.entries(dash.emotions_distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
    : [];
  const emotionTotal = emotionEntries.reduce((s, [, v]) => s + v, 0);
  const emotionsList = emotionEntries.map(([name, count], i) => ({
    name,
    value: emotionTotal > 0 ? Math.round((count / emotionTotal) * 100) : 0,
    color: EMOTION_PALETTE[i % EMOTION_PALETTE.length],
  }));

  // Build topics list from topics_frequency
  const topicEntries = dash.topics_frequency
    ? Object.entries(dash.topics_frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
    : [];
  const topicTotal = topicEntries.reduce((s, [, v]) => s + v, 0);
  const topicsList = topicEntries.map(([name, count], i) => ({
    name,
    value: topicTotal > 0 ? Math.round((count / topicTotal) * 100) : 0,
    color: TOPIC_PALETTE[i % TOPIC_PALETTE.length],
  }));

  // Build comment volume chart data from trends
  const commentVolumeData = trends
    ? trends.data_points.map((dp) => ({
        month: dp.period.length > 7 ? dp.period.slice(0, 7) : dp.period,
        count: dp.total_comments,
      }))
    : [];

  // Build score trend chart data from trends
  const scoreTrendData = trends
    ? trends.data_points
        .filter((dp) => dp.avg_score !== null)
        .map((dp) => ({
          day: dp.period.length > 7 ? dp.period.slice(0, 7) : dp.period,
          score: dp.avg_score,
        }))
    : [];

  // Build temporal analysis from trends detailed
  const temporalData = trendsDetailed
    ? trendsDetailed.data_points.map((dp) => ({
        period: dp.period.length > 7 ? dp.period.slice(0, 7) : dp.period,
        positivo: dp.positive,
        neutro: dp.neutral,
        negativo: dp.negative,
      }))
    : [];

  // Filter comments by search
  const filteredComments = comments.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.text_original || "").toLowerCase().includes(q) ||
      (c.author_username || "").toLowerCase().includes(q) ||
      (c.author_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-2 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-slate-400 mb-3"
          style={{ fontSize: "13px" }}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white border border-slate-50 shadow-sm overflow-hidden flex-shrink-0">
              {conn.profile_image_url ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || "/api/v1"}/posts/thumbnail?url=${encodeURIComponent(conn.profile_image_url)}`}
                  alt={conn.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<img src="/icons/${conn.platform === "twitter" ? "twitter-x" : conn.platform}.svg" alt="${conn.platform}" class="w-7 h-7" />`;
                  }}
                />
              ) : (
                <img
                  src={`/icons/${conn.platform === "twitter" ? "twitter-x" : conn.platform}.svg`}
                  alt={conn.platform}
                  className="w-7 h-7"
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "18px",
                    fontWeight: 500,
                    color: "#334155",
                  }}
                >
                  {conn.username}
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md" style={{ fontSize: "9px", fontWeight: 500 }}>
                  {conn.status === "active" ? "ATIVO" : conn.status.toUpperCase()}
                </span>
              </div>
              <p className="text-slate-400" style={{ fontSize: "11px" }}>
                {conn.platform} · {conn.followers_count.toLocaleString()} seguidores · Sync: {conn.last_sync_at ? fmtDate(conn.last_sync_at) : "nunca"}
              </p>
            </div>
          </div>
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          className={`w-full mt-4 py-3.5 rounded-2xl text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${analyzing
            ? "bg-gradient-to-r from-cyan-400 to-cyan-300"
            : "bg-gradient-to-r from-violet-500 to-cyan-400 shadow-lg shadow-violet-200/50"
            }`}
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500 }}
        >
          <Zap size={18} />
          {analyzing ? "Analisando..." : "Analisar"}
        </button>
      </div>

      <div className="px-5 mt-2 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
              <Heart size={14} className="text-violet-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#06B6D4" }}>
              {dash.avg_score !== null ? dash.avg_score.toFixed(1) : "—"}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Score medio</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <BarChart3 size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {negativePercent}%
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios negativos</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center mb-2">
              <TrendingDown size={14} className="text-cyan-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {dash.avg_polarity !== null ? dash.avg_polarity.toFixed(2) : "—"}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Polaridade media</p>
          </DreamCard>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center mb-2">
              <MessageSquare size={14} className="text-rose-400" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {dash.total_comments}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <ThumbsUp size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {(dash.engagement_totals.total_likes + dash.engagement_totals.total_views).toLocaleString()}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Likes + Views</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <FileText size={14} className="text-emerald-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {dash.total_posts}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Posts analisados</p>
          </DreamCard>
        </div>

        {/* Volume de Comentarios */}
        {commentVolumeData.length > 0 && (
          <DreamCard className="p-5">
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
            >
              Volume de Comentarios
            </p>
            <p className="text-slate-300 mb-4" style={{ fontSize: "11px" }}>
              Quantidade de comentarios por periodo
            </p>
            <div className="h-[140px]">
              <ResponsiveContainer width="99%" height="100%">
                <AreaChart data={commentVolumeData}>
                  <defs>
                    <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8, fill: "#94A3B8" }}
                    interval={2}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8, fill: "#94A3B8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      fontSize: "11px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#22D3EE"
                    fill="url(#gradVol)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DreamCard>
        )}

        {/* Tendencia de Score */}
        {scoreTrendData.length > 0 && (
          <DreamCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
                >
                  Tendencia de Score
                </p>
                <p className="text-slate-300" style={{ fontSize: "11px" }}>
                  Score medio ao longo do tempo
                </p>
              </div>
              <div className="flex bg-slate-50 rounded-xl p-0.5">
                {(["Dia", "Semana", "Mes"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setScorePeriod(p)}
                    className={`px-3 py-1 rounded-lg transition-colors ${scorePeriod === p
                      ? "bg-violet-500 text-white"
                      : "text-slate-400"
                      }`}
                    style={{ fontSize: "10px", fontWeight: 500 }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[130px]">
              <ResponsiveContainer width="99%" height="100%">
                <LineChart data={scoreTrendData}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8, fill: "#94A3B8" }}
                    interval={4}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8, fill: "#94A3B8" }}
                    domain={[4, 10]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      fontSize: "11px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DreamCard>
        )}

        {/* Analise Temporal */}
        {temporalData.length > 0 && (
          <DreamCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
                >
                  Analise Temporal
                </p>
                <p className="text-slate-300" style={{ fontSize: "11px" }}>
                  Distribuicao por periodo
                </p>
              </div>
              <div className="flex bg-slate-50 rounded-xl p-0.5">
                {(["Sentimento", "Emocoes", "Topicos"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTemporalView(v)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${temporalView === v
                      ? "bg-violet-500 text-white"
                      : "text-slate-400"
                      }`}
                    style={{ fontSize: "9px", fontWeight: 500 }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {temporalView === "Sentimento" && (
              <div className="space-y-4">
                <div>
                  <p className="text-slate-400 mb-2" style={{ fontSize: "10px", fontWeight: 500 }}>
                    Intensidade absoluta
                  </p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="99%" height="100%">
                      <BarChart data={temporalData}>
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "#94A3B8" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "#94A3B8" }} />
                        <Tooltip contentStyle={{ background: "white", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "10px" }} />
                        <Bar dataKey="positivo" stackId="a" fill="#34D399" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="neutro" stackId="a" fill="#FBBF24" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="negativo" stackId="a" fill="#F472B6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 mb-2" style={{ fontSize: "10px", fontWeight: 500 }}>
                    Distribuicao 100%
                  </p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="99%" height="100%">
                      <BarChart
                        data={temporalData.map((d) => {
                          const total = d.positivo + d.neutro + d.negativo;
                          return {
                            period: d.period,
                            positivo: total > 0 ? Math.round((d.positivo / total) * 100) : 0,
                            neutro: total > 0 ? Math.round((d.neutro / total) * 100) : 0,
                            negativo: total > 0 ? Math.round((d.negativo / total) * 100) : 0,
                          };
                        })}
                      >
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "#94A3B8" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "#94A3B8" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ background: "white", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "10px" }} />
                        <Bar dataKey="positivo" stackId="a" fill="#34D399" />
                        <Bar dataKey="neutro" stackId="a" fill="#FBBF24" />
                        <Bar dataKey="negativo" stackId="a" fill="#F472B6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-400" style={{ fontSize: "9px" }}>Positivo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-slate-400" style={{ fontSize: "9px" }}>Neutro</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-pink-400" />
                    <span className="text-slate-400" style={{ fontSize: "9px" }}>Negativo</span>
                  </div>
                </div>
              </div>
            )}

            {temporalView === "Emocoes" && (
              <div className="space-y-4">
                {emotionsList.length > 0 ? (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="99%" height="100%">
                      <RadarChart data={emotionsList.map((e) => ({ name: e.name, value: e.value }))}>
                        <PolarGrid stroke="rgba(196,181,253,0.2)" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748B" }} />
                        <Radar name="Emocoes" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.25} strokeWidth={2} />
                        <Tooltip contentStyle={{ background: "white", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "10px" }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-slate-300 text-center py-8" style={{ fontSize: "12px" }}>Sem dados de emocoes</p>
                )}
              </div>
            )}

            {temporalView === "Topicos" && (
              <div className="space-y-3">
                {topicsList.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center py-4">
                    {topicsList.map((t, i) => {
                      const size = Math.max(11, Math.min(24, 11 + t.value * 0.8));
                      const opacity = Math.max(0.5, Math.min(1, 0.5 + t.value / 50));
                      return (
                        <span
                          key={t.name}
                          style={{
                            fontSize: `${size}px`,
                            fontWeight: size > 16 ? 600 : 400,
                            color: TOPIC_PALETTE[i % TOPIC_PALETTE.length],
                            opacity,
                            padding: "4px 8px",
                            lineHeight: 1.4,
                          }}
                        >
                          {t.name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-300 text-center py-8" style={{ fontSize: "12px" }}>Sem dados de topicos</p>
                )}
              </div>
            )}
          </DreamCard>
        )}

        {/* Emotions & Topics */}
        <div className="grid grid-cols-2 gap-3">
          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>😊</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Emocoes
              </span>
              <span className="text-slate-300 ml-auto" style={{ fontSize: "9px" }}>top 7</span>
            </div>
            <div className="space-y-2">
              {emotionsList.length > 0 ? emotionsList.map((e) => (
                <div key={e.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-500" style={{ fontSize: "10px" }}>{e.name}</span>
                    <span className="text-slate-400" style={{ fontSize: "10px", fontWeight: 500 }}>{e.value}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${e.value}%`, backgroundColor: e.color }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-slate-300" style={{ fontSize: "10px" }}>Sem dados</p>
              )}
            </div>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>🏷️</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Topicos
              </span>
              <span className="text-slate-300 ml-auto" style={{ fontSize: "9px" }}>top 7</span>
            </div>
            <div className="space-y-2">
              {topicsList.length > 0 ? topicsList.map((t) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-500" style={{ fontSize: "10px" }}>{t.name}</span>
                    <span className="text-slate-400" style={{ fontSize: "10px", fontWeight: 500 }}>{t.value}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(t.value * 4, 100)}%`, backgroundColor: t.color }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-slate-300" style={{ fontSize: "10px" }}>Sem dados</p>
              )}
            </div>
          </DreamCard>
        </div>

        {/* Sentiment Distribution */}
        {sentDist && totalSent > 0 && (
          <DreamCard className="p-5">
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
              className="mb-3"
            >
              Distribuicao de Sentimento
            </p>
            <div className="flex rounded-xl overflow-hidden h-4 mb-3">
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${positivePercent}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${neutralPercent}%` }}
              />
              <div
                className="bg-rose-400 transition-all"
                style={{ width: `${negativePercent}%` }}
              />
            </div>
            <div className="flex justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-500" style={{ fontSize: "11px" }}>
                  Positivo {sentDist.positive}
                </span>
                <span className="text-emerald-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {positivePercent}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {neutralPercent}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-rose-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {negativePercent}%
                </span>
              </div>
            </div>
          </DreamCard>
        )}

        {/* Engajamento */}
        <DreamCard className="p-5">
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
            className="mb-3"
          >
            Engajamento
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-rose-400" />
              <div>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>Likes</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#334155" }}>
                  {dash.engagement_totals.total_likes.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <div>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>Views</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#334155" }}>
                  {dash.engagement_totals.total_views.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-cyan-400" />
              <div>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>Comentarios</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#334155" }}>
                  {dash.engagement_totals.total_comments.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </DreamCard>

        {/* Posts List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 500, color: "#334155" }}
            >
              Posts
            </p>
            <span className="text-slate-400" style={{ fontSize: "11px" }}>{dash.posts.length} no total</span>
          </div>

          <div className="space-y-3">
            {dash.posts.slice(0, 6).map((post) => {
              const score = post.summary?.avg_score ?? null;
              const tint =
                score !== null && score >= 8 ? "emerald" : score !== null && score >= 6.5 ? "none" : "amber";
              const scoreColor =
                score !== null && score >= 8
                  ? "#059669"
                  : score !== null && score >= 6.5
                    ? "#7C3AED"
                    : "#D97706";
              const thumbUrl = buildThumbnailSrc(post.thumbnail_url);
              return (
                <DreamCard
                  key={post.id}
                  className="p-4 flex items-center gap-3"
                  tint={tint as any}
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ background: "rgba(196,181,253,0.12)" }}
                  >
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText size={16} style={{ color: "#C4B5FD" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }} className="truncate">
                      {post.content_text || "Post sem texto"}
                    </p>
                    <p style={{ fontSize: "11px", color: "#64748B" }}>
                      {post.platform} · {post.comment_count} comentarios · {fmtDate(post.published_at)}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "17px",
                      fontWeight: 700,
                      color: scoreColor,
                    }}
                  >
                    {score !== null ? score.toFixed(1) : "—"}
                  </span>
                </DreamCard>
              );
            })}
          </div>
        </div>

        {/* Comments Table */}
        <div>
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 600, color: "#1E293B" }}
            className="mb-3"
          >
            Comentarios
          </p>

          <div className="flex gap-2 mb-4">
            <div
              className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(248,250,252,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(196,181,253,0.15)",
              }}
            >
              <Search size={14} style={{ color: "#C4B5FD" }} />
              <input
                placeholder="Buscar comentarios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: "12px", color: "#475569" }}
              />
            </div>
            <button
              className="px-3 py-2 rounded-xl flex items-center gap-1"
              style={{
                background: "rgba(248,250,252,0.85)",
                border: "1px solid rgba(196,181,253,0.15)",
                color: "#475569",
                backdropFilter: "blur(12px)",
              }}
            >
              <Filter size={14} />
              <span style={{ fontSize: "11px" }}>Todos</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {filteredComments.map((c) => {
              const score = c.analysis?.score_0_10 ?? 0;
              const tint =
                score >= 8.5 ? "emerald" : score >= 6.5 ? "cyan" : "amber";
              const scoreColor =
                score >= 8.5 ? "#059669" : score >= 6.5 ? "#0891B2" : "#D97706";
              const tagBg =
                score >= 8.5
                  ? "rgba(52,211,153,0.1)"
                  : score >= 6.5
                    ? "rgba(34,211,238,0.1)"
                    : "rgba(251,191,36,0.1)";
              const tagColor =
                score >= 8.5 ? "#059669" : score >= 6.5 ? "#0891B2" : "#D97706";
              const emotion = c.analysis?.emotions?.[0] || "—";

              return (
                <DreamCard key={c.id} className="p-4" tint={tint as any}>
                  <div className="flex items-start gap-3">
                    {/* Score badge */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${tagBg}` }}
                    >
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: scoreColor,
                        }}
                      >
                        {score.toFixed(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }} className="truncate">
                          {c.author_username || c.author_name || "Anonimo"}
                        </span>
                        <span style={{ fontSize: "10px", color: "#94A3B8", flexShrink: 0 }}>
                          {c.published_at ? fmtDate(c.published_at) : ""}
                        </span>
                      </div>
                      <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.45, marginBottom: "6px" }}>
                        {c.text_original}
                      </p>
                      {c.analysis?.summary_pt && (
                        <p style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.4, marginBottom: "8px" }}>
                          ✦ {c.analysis.summary_pt}
                        </p>
                      )}
                      <span
                        className="px-2.5 py-1 rounded-full"
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          background: tagBg,
                          color: tagColor,
                        }}
                      >
                        {emotion}
                      </span>
                    </div>
                  </div>
                </DreamCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
