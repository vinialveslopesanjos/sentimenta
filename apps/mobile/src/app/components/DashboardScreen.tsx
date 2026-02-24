import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import {
  dashboardKPIs,
  connections,
  monthlyDistribution,
  recentPosts,
  aiReport,
} from "./mockData";
import {
  Instagram,
  Youtube,
  MessageSquare,
  FileText,
  Link2,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Inline SVG donut score — breathing hero
function ScoreHero({ score }: { score: number }) {
  const radius = 46;
  const stroke = 9;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 10) * circumference;

  const label =
    score >= 8.5
      ? "excelente"
      : score >= 7
      ? "otimo"
      : score >= 5.5
      ? "regular"
      : "em alerta";

  const color =
    score >= 8.5
      ? "#34D399"
      : score >= 7
      ? "#8B5CF6"
      : score >= 5.5
      ? "#FBBF24"
      : "#F472B6";

  return (
    <div className="flex items-center gap-5">
      {/* Donut breathing */}
      <motion.div
        className="flex-shrink-0"
        animate={{ scale: [1, 1.018, 1] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="110" height="110" viewBox="0 0 110 110">
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="55" cy="55" r={radius}
            fill="none"
            stroke="rgba(196,181,253,0.18)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <motion.circle
            cx="55" cy="55" r={radius}
            fill="none"
            stroke={score >= 8.5 ? "url(#scoreGrad)" : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${filled} ${circumference}` }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          {/* Score number */}
          <text
            x="55" y="48"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#1E293B"
            fontSize="26"
            fontFamily="Outfit, sans-serif"
            fontWeight="700"
          >
            {score}
          </text>
          <text
            x="55" y="67"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#94A3B8"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            / 10
          </text>
        </svg>
      </motion.div>

      {/* Narrative */}
      <div className="flex-1">
        <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
          Reputacao geral
        </p>
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "17px",
            fontWeight: 600,
            color: "#1E293B",
            lineHeight: 1.3,
          }}
        >
          Seu publico esta em{" "}
          <span style={{ color }}>sintonia</span> com voce.
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <span
            className="px-2.5 py-1 rounded-full"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              background: "rgba(52,211,153,0.12)",
              color: "#059669",
            }}
          >
            + {dashboardKPIs.scoreDelta} esta semana
          </span>
          <span
            className="px-2.5 py-1 rounded-full capitalize"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              background: score >= 8.5 ? "rgba(52,211,153,0.1)" : "rgba(139,92,246,0.1)",
              color: score >= 8.5 ? "#059669" : "#7C3AED",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const [aiExpanded, setAiExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAI = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div>
          <motion.h1
            {...stagger(0)}
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "26px",
              fontWeight: 700,
              color: "#1E293B",
              lineHeight: 1.2,
              letterSpacing: "-0.4px",
            }}
          >
            {getGreeting()}, Julia.
          </motion.h1>
          <motion.p
            {...stagger(1)}
            style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}
          >
            Escute o que o mundo sente.
          </motion.p>
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #F9A8D4 0%, #FCA5A5 100%)",
            boxShadow: "0 4px 12px rgba(249,168,212,0.35)",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#9F1239" }}>JB</span>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">

        {/* HERO: Score + Narrative */}
        <motion.div {...stagger(2)}>
          <DreamCard className="p-5 relative overflow-hidden" glow>
            <div
              className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(103,232,249,0.2) 0%, rgba(196,181,253,0.15) 60%, transparent 100%)" }}
            />
            <ScoreHero score={dashboardKPIs.score} />
          </DreamCard>
        </motion.div>

        {/* Quick KPIs */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              icon: <MessageSquare size={15} className="text-cyan-500" />,
              bg: "rgba(103,232,249,0.12)",
              value: dashboardKPIs.comments.toLocaleString(),
              label: "comentarios",
              color: "#0891B2",
            },
            {
              icon: <FileText size={15} className="text-violet-500" />,
              bg: "rgba(139,92,246,0.1)",
              value: dashboardKPIs.posts,
              label: "posts",
              color: "#7C3AED",
            },
            {
              icon: <Link2 size={15} className="text-emerald-500" />,
              bg: "rgba(52,211,153,0.1)",
              value: dashboardKPIs.connections,
              label: "conexoes",
              color: "#059669",
            },
          ].map((k, i) => (
            <motion.div key={k.label} {...stagger(3 + i)}>
              <DreamCard className="p-3.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5"
                  style={{ background: k.bg }}
                >
                  {k.icon}
                </div>
                <p
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "22px",
                    fontWeight: 700,
                    color: k.color,
                    lineHeight: 1,
                  }}
                >
                  {k.value}
                </p>
                <p style={{ fontSize: "10px", color: "#64748B", marginTop: "3px" }}>
                  {k.label}
                </p>
              </DreamCard>
            </motion.div>
          ))}
        </div>

        {/* Seus Perfis */}
        <motion.div {...stagger(6)}>
          <div className="flex items-center justify-between mb-3">
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "17px",
                fontWeight: 600,
                color: "#1E293B",
              }}
            >
              Seus Perfis
            </h2>
            <button
              onClick={() => navigate("/connect")}
              className="flex items-center gap-1"
              style={{ fontSize: "12px", fontWeight: 500, color: "#8B5CF6" }}
            >
              <Link2 size={13} /> Adicionar
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {connections.map((conn) => (
              <DreamCard
                key={conn.id}
                className="min-w-[200px] p-4 flex-shrink-0"
                onClick={() => navigate(`/dashboard/connection/${conn.id}`)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        conn.platform === "instagram"
                          ? "linear-gradient(135deg, #F472B6 0%, #8B5CF6 100%)"
                          : "#EF4444",
                    }}
                  >
                    {conn.platform === "instagram" ? (
                      <Instagram size={18} className="text-white" />
                    ) : (
                      <Youtube size={18} className="text-white" />
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                      {conn.username}
                    </p>
                    <p style={{ fontSize: "11px", color: "#64748B" }}>
                      {conn.followers.toLocaleString()} seguidores
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1" style={{ fontSize: "12px", fontWeight: 500, color: "#8B5CF6" }}>
                  Ver analise detalhada
                  <ChevronRight size={13} />
                </div>
              </DreamCard>
            ))}

            <DreamCard
              className="min-w-[120px] p-4 flex-shrink-0 flex flex-col items-center justify-center"
              style={{ background: "rgba(248,250,252,0.7)", border: "1.5px dashed rgba(196,181,253,0.3)" } as React.CSSProperties}
              onClick={() => navigate("/connect")}
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-2">
                <span style={{ fontSize: "22px", color: "#C4B5FD", fontWeight: 300 }}>+</span>
              </div>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Adicionar</span>
            </DreamCard>
          </div>
        </motion.div>

        {/* Distribuicao Temporal */}
        <motion.div {...stagger(7)}>
          <DreamCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Distribuicao Temporal
                </p>
                <p style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  Sentimento mensal ao longo do tempo
                </p>
              </div>
              <div
                className="px-2.5 py-1 rounded-lg"
                style={{ background: "rgba(196,181,253,0.12)" }}
              >
                <span style={{ fontSize: "10px", fontWeight: 500, color: "#7C3AED" }}>30 dias</span>
              </div>
            </div>

            <div className="h-[160px]">
              <ResponsiveContainer width="99%" height="100%">
                <AreaChart data={monthlyDistribution}>
                  <defs>
                    <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34D399" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNeu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FBBF24" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F472B6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F472B6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94A3B8" }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94A3B8" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.92)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(196,181,253,0.2)",
                      borderRadius: "16px",
                      boxShadow: "0 4px 20px rgba(196,181,253,0.15)",
                      fontSize: "11px",
                    }}
                  />
                  <Area type="monotone" dataKey="negativo" stackId="1" stroke="#F472B6" fill="#F472B6" fillOpacity={0.55} strokeWidth={0} />
                  <Area type="monotone" dataKey="neutro" stackId="1" stroke="#FBBF24" fill="#FBBF24" fillOpacity={0.55} strokeWidth={0} />
                  <Area type="monotone" dataKey="positivo" stackId="1" stroke="#34D399" fill="#34D399" fillOpacity={0.55} strokeWidth={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-5 mt-3 justify-center">
              {[
                { color: "#34D399", label: "Positivo" },
                { color: "#FBBF24", label: "Neutro" },
                { color: "#F472B6", label: "Negativo" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span style={{ fontSize: "10px", color: "#64748B" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </DreamCard>
        </motion.div>

        {/* IA Report */}
        <motion.div {...stagger(8)}>
          <DreamCard className="p-5 relative overflow-hidden" glow>
            <div
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(103,232,249,0.22) 0%, rgba(196,181,253,0.18) 60%, transparent 100%)" }}
            />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={17} style={{ color: "#8B5CF6" }} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, color: "#1E293B" }}>
                  Saude da Reputacao (IA)
                </span>
              </div>
              <button
                onClick={handleRefreshAI}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  background: "rgba(139,92,246,0.1)",
                  color: "#7C3AED",
                }}
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "" : "Atualizar"}
              </button>
            </div>

            <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }} className="relative z-10">
              Perfil: {aiReport.profile} · {aiReport.period}
            </p>

            <div className="space-y-3 relative z-10">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>O resumo da vez</span>
                </div>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  {aiReport.summary}
                </p>
              </div>

              {aiExpanded && (
                <>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#059669" }}>O que funcionou</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>{aiReport.strengths}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#D97706" }}>Pontos de atencao</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>{aiReport.attention}</p>
                  </div>

                  <DreamCard className="p-3.5" tint="violet">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#7C3AED" }}>Proximo passo sugerido</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>{aiReport.nextStep}</p>
                  </DreamCard>
                </>
              )}

              <button
                onClick={() => setAiExpanded(!aiExpanded)}
                className="flex items-center gap-1"
                style={{ fontSize: "13px", fontWeight: 500, color: "#8B5CF6" }}
              >
                {aiExpanded ? "Ver menos" : "Ver relatorio completo"}
                <ChevronRight
                  size={14}
                  className={`transition-transform ${aiExpanded ? "rotate-90" : ""}`}
                />
              </button>
            </div>
          </DreamCard>
        </motion.div>

        {/* Posts Recentes */}
        <motion.div {...stagger(9)}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 600, color: "#1E293B" }}>
              Posts Recentes
            </h2>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#8B5CF6" }}>Ver tudo</span>
          </div>

          <div className="space-y-2.5">
            {recentPosts.slice(0, 5).map((post, i) => {
              const tint =
                post.score >= 8 ? "emerald" : post.score >= 6.5 ? "none" : "amber";
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <DreamCard
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
                        {post.platform} · {post.comments} comentarios
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: "17px",
                          fontWeight: 700,
                          color:
                            post.score >= 8
                              ? "#059669"
                              : post.score >= 6.5
                              ? "#7C3AED"
                              : "#D97706",
                        }}
                      >
                        {post.score}
                      </span>
                      <ChevronRight size={13} style={{ color: "#CBD5E1" }} />
                    </div>
                  </DreamCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
