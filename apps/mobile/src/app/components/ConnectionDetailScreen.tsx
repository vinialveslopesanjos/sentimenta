import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import {
  connectionKPIs,
  commentVolume,
  scoreTrend,
  temporalAnalysis,
  emotions,
  topics,
  sentimentDistribution,
  recentPosts,
  postComments,
  connections,
} from "./mockData";
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
  Instagram,
  Youtube,
  ChevronDown,
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
} from "recharts";

export function ConnectionDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [scorePeriod, setScorePeriod] = useState<"Dia" | "Semana" | "Mes">("Dia");
  const [temporalView, setTemporalView] = useState<"Sentimento" | "Emocoes" | "Topicos">("Sentimento");
  const [commentFilter, setCommentFilter] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const conn = connections.find((c) => c.id === id) || connections[0];

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 3000);
  };

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
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                conn.platform === "instagram"
                  ? "bg-gradient-to-br from-pink-400 to-purple-500"
                  : "bg-red-500"
              }`}
            >
              {conn.platform === "instagram" ? (
                <Instagram size={20} className="text-white" />
              ) : (
                <Youtube size={20} className="text-white" />
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
                  ATIVO
                </span>
              </div>
              <p className="text-slate-400" style={{ fontSize: "11px" }}>
                {conn.platform} · {conn.followers.toLocaleString()} seguidores · Sync: {conn.lastSync}
              </p>
            </div>
          </div>
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          className={`w-full mt-4 py-3.5 rounded-2xl text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
            analyzing
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
              {connectionKPIs.scoreMedio}/10
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Score medio</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <BarChart3 size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {connectionKPIs.taxaNegativa}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios negativos</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center mb-2">
              <TrendingDown size={14} className="text-cyan-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {connectionKPIs.polaridade}
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
              {connectionKPIs.comentarios}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <ThumbsUp size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {connectionKPIs.engajamento.toLocaleString()}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Likes + Views</p>
          </DreamCard>

          <DreamCard className="p-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <FileText size={14} className="text-emerald-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 500, color: "#334155" }}>
              {connectionKPIs.posts}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Posts analisados</p>
          </DreamCard>
        </div>

        {/* Volume de Comentarios */}
        <DreamCard className="p-5">
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
          >
            Volume de Comentarios
          </p>
          <p className="text-slate-300 mb-4" style={{ fontSize: "11px" }}>
            Quantidade de comentarios por mes
          </p>
          <div className="h-[140px]">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={commentVolume}>
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

        {/* Tendencia de Score */}
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
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    scorePeriod === p
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
              <LineChart data={scoreTrend}>
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

        {/* Analise Temporal */}
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
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    temporalView === v
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

          {/* Side by side charts */}
          <div className="space-y-4">
            <div>
              <p className="text-slate-400 mb-2" style={{ fontSize: "10px", fontWeight: 500 }}>
                Intensidade absoluta
              </p>
              <div className="h-[120px]">
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart data={temporalAnalysis.sentimento}>
                    <XAxis
                      dataKey="period"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 7, fill: "#94A3B8" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 7, fill: "#94A3B8" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        fontSize: "10px",
                      }}
                    />
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
                    data={temporalAnalysis.sentimento.map((d) => {
                      const total = d.positivo + d.neutro + d.negativo;
                      return {
                        period: d.period,
                        positivo: Math.round((d.positivo / total) * 100),
                        neutro: Math.round((d.neutro / total) * 100),
                        negativo: Math.round((d.negativo / total) * 100),
                      };
                    })}
                  >
                    <XAxis
                      dataKey="period"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 7, fill: "#94A3B8" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 7, fill: "#94A3B8" }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        fontSize: "10px",
                      }}
                    />
                    <Bar dataKey="positivo" stackId="a" fill="#34D399" />
                    <Bar dataKey="neutro" stackId="a" fill="#FBBF24" />
                    <Bar dataKey="negativo" stackId="a" fill="#F472B6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
        </DreamCard>

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
              {emotions.map((e) => (
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
              ))}
            </div>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>🏷️</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Topicos
              </span>
              <span className="text-slate-300 ml-auto" style={{ fontSize: "9px" }}>top 10</span>
            </div>
            <div className="space-y-2">
              {topics.slice(0, 7).map((t) => (
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
              ))}
            </div>
          </DreamCard>
        </div>

        {/* Sentiment Distribution */}
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
              style={{ width: `${sentimentDistribution.positivo.percent}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${sentimentDistribution.neutro.percent}%` }}
            />
            <div
              className="bg-rose-400 transition-all"
              style={{ width: `${sentimentDistribution.negativo.percent}%` }}
            />
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-500" style={{ fontSize: "11px" }}>
                Positivo {sentimentDistribution.positivo.count}
              </span>
              <span className="text-emerald-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                {sentimentDistribution.positivo.percent}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                {sentimentDistribution.neutro.percent}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-rose-500" style={{ fontSize: "12px", fontWeight: 600 }}>
                {sentimentDistribution.negativo.percent}%
              </span>
            </div>
          </div>
        </DreamCard>

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
                  3.625
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
                  1.898
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-cyan-400" />
              <div>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>Comentarios</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#334155" }}>
                  502
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
            <span className="text-slate-400" style={{ fontSize: "11px" }}>58 no total</span>
          </div>

          {/* Sort/Filter */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
            {["↓ Score", "↑ Score", "Recentes", "10", "25", "50", "Todos"].map((f, i) => (
              <button
                key={f}
                className={`px-3 py-1.5 rounded-xl flex-shrink-0 transition-colors ${
                  i === 0
                    ? "bg-violet-500 text-white"
                    : i === 3
                    ? "bg-cyan-500 text-white"
                    : "bg-slate-50 text-slate-500"
                }`}
                style={{ fontSize: "11px", fontWeight: 500 }}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {recentPosts.slice(0, 6).map((post) => {
              const tint =
                post.score >= 8 ? "emerald" : post.score >= 6.5 ? "none" : "amber";
              const scoreColor =
                post.score >= 8
                  ? "#059669"
                  : post.score >= 6.5
                  ? "#7C3AED"
                  : "#D97706";
              return (
                <DreamCard
                  key={post.id}
                  className="p-4 flex items-center gap-3"
                  tint={tint as any}
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(196,181,253,0.12)" }}
                  >
                    <FileText size={16} style={{ color: "#C4B5FD" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }} className="truncate">
                      {post.title}
                    </p>
                    <p style={{ fontSize: "11px", color: "#64748B" }}>
                      {post.platform} · {post.comments} comentários · {post.date}
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
                    {post.score}
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
            Comentários
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
                placeholder="Buscar comentários..."
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
            {postComments.map((c) => {
              const tint =
                c.score >= 8.5 ? "emerald" : c.score >= 6.5 ? "cyan" : "amber";
              const scoreColor =
                c.score >= 8.5 ? "#059669" : c.score >= 6.5 ? "#0891B2" : "#D97706";
              const tagBg =
                c.score >= 8.5
                  ? "rgba(52,211,153,0.1)"
                  : c.score >= 6.5
                  ? "rgba(34,211,238,0.1)"
                  : "rgba(251,191,36,0.1)";
              const tagColor =
                c.score >= 8.5 ? "#059669" : c.score >= 6.5 ? "#0891B2" : "#D97706";

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
                        {c.score.toFixed(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }} className="truncate">
                          {c.author}
                        </span>
                        <span style={{ fontSize: "10px", color: "#94A3B8", flexShrink: 0 }}>{c.date}</span>
                      </div>
                      <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.45, marginBottom: "6px" }}>
                        {c.text}
                      </p>
                      <p style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.4, marginBottom: "8px" }}>
                        ✦ {c.aiNote}
                      </p>
                      <span
                        className="px-2.5 py-1 rounded-full"
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          background: tagBg,
                          color: tagColor,
                        }}
                      >
                        {c.tag}
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