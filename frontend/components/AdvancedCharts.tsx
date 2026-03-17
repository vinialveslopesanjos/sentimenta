import { useState } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend, Cell, ZAxis,
} from "recharts";
import { Section } from "./ds/Section";
import { Badge } from "./ds/Badge";
import { getScoreStyle } from "./ds/tokens";
import { useTheme } from "./ThemeContext";
import { AlertTriangle, TrendingDown, TrendingUp, User, Shield, Flame, Zap, MessageCircle, ChevronDown } from "lucide-react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #1 — GAP ANALYSIS (Scatter Quadrant 2x2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GapPost {
  title: string;
  engagement: number; // 0-100
  sentiment: number;  // 0-10
  comments: number;
}

export function GapAnalysis({ posts, platformLabel }: { posts: GapPost[]; platformLabel: string }) {
  const { t } = useTheme();
  const [hovered, setHovered] = useState<number | null>(null);

  const getQuadrantColor = (eng: number, sent: number) => {
    if (eng >= 50 && sent >= 5) return t.sentimentPositive; // viral + positive
    if (eng >= 50 && sent < 5) return t.sentimentNegative;  // viral + negative (danger)
    if (eng < 50 && sent >= 5) return t.secondary;          // low reach + positive (hidden gem)
    return t.sentimentNeutral;                               // low reach + negative
  };

  return (
    <Section title="Gap Analysis: Engajamento vs. Sentimento" subtitle="Posts plotados por taxa de engajamento e score médio de sentimento">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="primary">Insight Premium</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>Cada ponto = 1 post</span>
      </div>
      {/* Quadrant labels */}
      <div className="relative">
        <div className="absolute top-2 left-12 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.secondary, backgroundColor: `${t.secondaryBg}` }}>
          💎 Joia Escondida
        </div>
        <div className="absolute top-2 right-4 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentPositive, backgroundColor: `${t.sentimentPositive}15` }}>
          🚀 Viral Positivo
        </div>
        <div className="absolute bottom-8 left-12 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentNeutral, backgroundColor: `${t.sentimentNeutral}15` }}>
          😐 Baixo Impacto
        </div>
        <div className="absolute bottom-8 right-4 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentNegative, backgroundColor: `${t.sentimentNegative}15` }}>
          🔥 Crise Viral
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart id={`gap-scatter-${platformLabel}`} margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
            <XAxis
              type="number" dataKey="engagement" name="Engajamento" unit="%"
              domain={[0, 100]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false}
              label={{ value: "Taxa de Engajamento →", position: "insideBottom", offset: -5, style: { fontSize: 10, fill: t.textMuted } }}
            />
            <YAxis
              type="number" dataKey="sentiment" name="Sentimento"
              domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false}
              label={{ value: "Score Sentimento →", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: t.textMuted } }}
            />
            <ZAxis type="number" dataKey="comments" range={[40, 200]} name="Comentários" />
            {/* Reference lines for quadrants */}
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload as GapPost;
                return (
                  <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textPrimary }}>{d.title}</p>
                    <p style={{ fontSize: "0.68rem", color: t.textMuted }}>Engajamento: {d.engagement}% · Score: {d.sentiment.toFixed(1)} · {d.comments} com.</p>
                  </div>
                );
              }}
            />
            <Scatter data={posts} isAnimationActive>
              {posts.map((p, i) => (
                <Cell key={`gap-${i}-${p.title}`} fill={getQuadrantColor(p.engagement, p.sentiment)} fillOpacity={0.75} stroke={getQuadrantColor(p.engagement, p.sentiment)} strokeWidth={1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #2 — POST LIFECYCLE (sentiment over time within a post)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LifecyclePoint {
  time: string;
  score: number;
  volume: number;
}

interface LifecyclePost {
  title: string;
  data: LifecyclePoint[];
}

export function PostLifecycle({ posts, platformLabel }: { posts: LifecyclePost[]; platformLabel: string }) {
  const { t } = useTheme();
  const [selectedPost, setSelectedPost] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const post = posts[selectedPost];
  const lineColors = [t.primary, t.secondary, t.accent, t.primaryMuted, t.secondaryLight];

  return (
    <Section title="Lifecycle Emocional do Post" subtitle="Como o sentimento evolui ao longo do tempo dentro de cada post">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge variant="primary">Insight Premium</Badge>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl transition-all"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-card) 70%, transparent)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border)",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              maxWidth: 320,
            }}
          >
            <span className="truncate">{post.title}</span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-faint)" }} />
          </button>
          {dropdownOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-[320px] max-h-[280px] overflow-y-auto rounded-2xl shadow-lg z-50"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-card) 90%, transparent)",
                backdropFilter: "blur(16px)",
                border: "1px solid var(--border)",
              }}
            >
              {posts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedPost(i); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3"
                  style={{
                    backgroundColor: selectedPost === i ? "var(--primary-bg)" : "transparent",
                    borderBottom: i < posts.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ fontSize: "0.62rem", fontWeight: 700, backgroundColor: selectedPost === i ? "var(--primary)" : "var(--bg-subtle)", color: selectedPost === i ? "white" : "var(--text-muted)" }}>
                    {i + 1}
                  </span>
                  <span className="truncate" style={{ fontSize: "0.75rem", fontWeight: 500, color: selectedPost === i ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {p.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mb-3 truncate" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>
        "{post.title}"
      </p>
      <ResponsiveContainer key={`lifecycle-${selectedPost}`} width="100%" height={260}>
        <LineChart id={`lifecycle-line-${platformLabel}-${selectedPost}`} data={post.data}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: t.textFaint }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: t.textFaint }} axisLine={false} tickLine={false}
            label={{ value: "Score", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 9, fill: t.textMuted } }}
          />
          <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: `0 4px 16px ${t.primary}15`, fontSize: "0.78rem", backgroundColor: t.bgCard }} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
          <Line type="monotone" dataKey="score" name="Score Sentimento" stroke={t.primary} strokeWidth={2.5} dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="volume" name="Volume com." stroke={t.secondary} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
        <span>⬆ Score subindo = sentimento melhorando</span>
        <span>⬇ Score caindo = crise se formando</span>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #3 — TOP COMENTARISTAS: EMBAIXADORES vs DETRATORES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Ambassador {
  username: string;
  comments: number;
  avgScore: number;
  dominantEmotion: string;
  lastSeen: string;
}

export function AmbassadorsVsDetractors({ ambassadors, detractors, platformLabel }: {
  ambassadors: Ambassador[];
  detractors: Ambassador[];
  platformLabel: string;
}) {
  const { t } = useTheme();

  const UserCard = ({ user, type }: { user: Ambassador; type: "fan" | "hater" }) => {
    const isFan = type === "fan";
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isFan ? `${t.sentimentPositive}18` : `${t.sentimentNegative}18`,
          }}
        >
          {isFan ? <Shield className="w-4 h-4" style={{ color: t.sentimentPositive }} /> : <Flame className="w-4 h-4" style={{ color: t.sentimentNegative }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>@{user.username}</p>
          <p style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
            {user.comments} com. · {user.dominantEmotion} · Visto: {user.lastSeen}
          </p>
        </div>
        <span
          className="px-2 py-0.5 rounded-lg shrink-0"
          style={{
            fontSize: "0.72rem", fontWeight: 700,
            color: isFan ? t.sentimentPositive : t.sentimentNegative,
            backgroundColor: isFan ? `${t.sentimentPositive}15` : `${t.sentimentNegative}15`,
          }}
        >
          {user.avgScore.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <Section title="Fans e Haters" subtitle="CRM de audiência: seus fãs mais leais vs. críticos frequentes">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">Insight Premium</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" style={{ color: t.sentimentPositive }} />
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>Fans</span>
            <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>Score médio ≥ 7.0</span>
          </div>
          <div className="space-y-1.5">
            {ambassadors.map(u => <UserCard key={u.username} user={u} type="fan" />)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4" style={{ color: t.sentimentNegative }} />
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>Haters</span>
            <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>Score médio ≤ 4.0</span>
          </div>
          <div className="space-y-1.5">
            {detractors.map(u => <UserCard key={u.username} user={u} type="hater" />)}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #4 — TOPIC TREEMAP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TopicNode {
  topic: string;
  count: number;
  avgScore: number;
}

export function TopicTreemap({ topics, platformLabel }: { topics: TopicNode[]; platformLabel: string }) {
  const { t } = useTheme();
  const [hovered, setHovered] = useState<number | null>(null);

  const maxCount = Math.max(...topics.map(t => t.count));
  const totalCount = topics.reduce((s, t) => s + t.count, 0);

  const getColorForScore = (score: number) => {
    if (score >= 7) return t.sentimentPositive;
    if (score >= 5) return t.secondary;
    if (score >= 3) return t.primaryMuted;
    return t.sentimentNegative;
  };

  const getBgForScore = (score: number) => {
    if (score >= 7) return `${t.sentimentPositive}20`;
    if (score >= 5) return `${t.secondary}20`;
    if (score >= 3) return `${t.primaryMuted}20`;
    return `${t.sentimentNegative}20`;
  };

  // Simple treemap layout: arrange in a flex-wrap grid proportional to count
  return (
    <Section title="Topic Treemap" subtitle="Tamanho = frequência, Cor = sentimento médio do tópico">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="primary">Insight Premium</Badge>
        <div className="flex items-center gap-3 ml-auto" style={{ fontSize: "0.62rem" }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.sentimentPositive }} /> Positivo (≥7)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.secondary }} /> Neutro (5-7)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.primaryMuted }} /> Alerta (3-5)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.sentimentNegative }} /> Negativo (&lt;3)</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic, i) => {
          const pct = (topic.count / totalCount) * 100;
          const minW = Math.max(pct * 2.5, 80);
          const h = Math.max(40, Math.min(100, (topic.count / maxCount) * 100));
          return (
            <div
              key={topic.topic}
              className="rounded-xl flex flex-col items-center justify-center transition-all cursor-default"
              style={{
                width: `${minW}px`,
                height: `${h}px`,
                flexGrow: pct / 10,
                backgroundColor: getBgForScore(topic.avgScore),
                border: hovered === i ? `2px solid ${getColorForScore(topic.avgScore)}` : "2px solid transparent",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ fontSize: pct > 10 ? "0.82rem" : "0.68rem", fontWeight: 700, color: getColorForScore(topic.avgScore) }}>
                {topic.topic}
              </span>
              <span style={{ fontSize: "0.58rem", color: "var(--text-muted)" }}>
                {topic.count} · {topic.avgScore.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #5 — ALERTAS INTELIGENTES (anomaly cards)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SmartAlert {
  type: "score_drop" | "negative_spike" | "topic_emerging" | "author_shift" | "engagement_surge";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  timestamp: string;
  metric?: string;
}

export function SmartAlerts({ alerts, platformLabel }: { alerts: SmartAlert[]; platformLabel: string }) {
  const { t } = useTheme();

  const getAlertIcon = (type: SmartAlert["type"]) => {
    switch (type) {
      case "score_drop": return <TrendingDown className="w-5 h-5" />;
      case "negative_spike": return <AlertTriangle className="w-5 h-5" />;
      case "topic_emerging": return <Zap className="w-5 h-5" />;
      case "author_shift": return <User className="w-5 h-5" />;
      case "engagement_surge": return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getSeverityStyle = (severity: SmartAlert["severity"]) => {
    switch (severity) {
      case "high": return { color: t.sentimentNegative, bg: `${t.sentimentNegative}15`, label: "Alta" };
      case "medium": return { color: t.secondary, bg: `${t.secondary}20`, label: "Média" };
      case "low": return { color: t.sentimentPositive, bg: `${t.sentimentPositive}15`, label: "Baixa" };
    }
  };

  return (
    <Section title="Alertas Inteligentes" subtitle="Anomalias detectadas automaticamente nos seus dados">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">Insight Premium</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{alerts.length} alertas ativos</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert, i) => {
          const sev = getSeverityStyle(alert.severity);
          return (
            <div key={i} className="rounded-xl p-4 transition-colors cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)", border: `1px solid ${sev.bg}` }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sev.bg, color: sev.color }}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{alert.title}</p>
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: sev.color, backgroundColor: sev.bg }}>
                      {sev.label}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-muted)" }}>{alert.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>{alert.timestamp}</span>
                    {alert.metric && <span style={{ fontSize: "0.68rem", fontWeight: 600, color: sev.color }}>{alert.metric}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #6 — MATRIZ TÓPICO × EMOÇÃO (heatmap)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MatrixCell {
  value: number; // count or intensity 0-100
}

interface TopicEmotionMatrix {
  topics: string[];
  emotions: string[];
  data: number[][]; // [topicIdx][emotionIdx]
}

export function TopicEmotionHeatmap({ matrix, platformLabel }: { matrix: TopicEmotionMatrix; platformLabel: string }) {
  const { t } = useTheme();
  const [hoveredCell, setHoveredCell] = useState<{ t: number; e: number } | null>(null);

  // Limit to top 10 topics by total count
  const topN = 10;
  const topicTotals = matrix.topics.map((topic, ti) => ({ topic, ti, total: matrix.data[ti].reduce((s, v) => s + v, 0) }));
  topicTotals.sort((a, b) => b.total - a.total);
  const selectedTopics = topicTotals.slice(0, topN);
  const filteredTopics = selectedTopics.map(t => t.topic);
  const filteredData = selectedTopics.map(t => matrix.data[t.ti]);

  const maxVal = Math.max(...filteredData.flat());

  const getIntensityColor = (value: number) => {
    const ratio = value / maxVal;
    if (ratio >= 0.8) return t.primary;
    if (ratio >= 0.6) return t.primaryMuted;
    if (ratio >= 0.4) return t.secondary;
    if (ratio >= 0.2) return t.primaryFaint;
    return t.primaryBg;
  };

  const getIntensityOpacity = (value: number) => {
    const ratio = value / maxVal;
    return Math.max(0.15, ratio);
  };

  return (
    <Section title="Matriz Tópico × Emoção" subtitle="Qual emoção é associada a cada tópico mencionado">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge variant="primary">Insight Premium</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>Intensidade = volume de menções</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Header row */}
          <div className="flex gap-1 mb-1 pl-24">
            {matrix.emotions.map(e => (
              <div key={e} className="flex-1 text-center" style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--text-muted)", writingMode: "horizontal-tb" }}>
                {e}
              </div>
            ))}
          </div>
          {/* Data rows */}
          {filteredTopics.map((topic, ti) => (
            <div key={topic} className="flex gap-1 mb-1 items-center">
              <span className="w-22 shrink-0 text-right pr-2 truncate" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>
                {topic}
              </span>
              {filteredData[ti].map((val, ei) => {
                const isHovered = hoveredCell?.t === ti && hoveredCell?.e === ei;
                return (
                  <div
                    key={ei}
                    className="flex-1 rounded-md transition-all cursor-default flex items-center justify-center"
                    style={{
                      height: 36,
                      backgroundColor: getIntensityColor(val),
                      opacity: getIntensityOpacity(val),
                      transform: isHovered ? "scale(1.08)" : "scale(1)",
                      border: isHovered ? `2px solid ${t.primary}` : "2px solid transparent",
                    }}
                    onMouseEnter={() => setHoveredCell({ t: ti, e: ei })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${topic} × ${matrix.emotions[ei]}: ${val}`}
                  >
                    <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--text-primary)", mixBlendMode: "multiply" }}>
                      {val > 0 ? val : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end" style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>
        <span>Menos menções</span>
        <div className="flex gap-0.5">
          {[0.15, 0.3, 0.5, 0.7, 0.9].map((op, i) => (
            <div key={i} className="w-4 h-3 rounded" style={{ backgroundColor: t.primary, opacity: op }} />
          ))}
        </div>
        <span>Mais menções</span>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPORAL TAB DATA RENDERERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TemporalScorePoint { date: string; score: number; }
export interface TemporalSentimentPoint { date: string; positivo: number; neutro: number; negativo: number; }
export interface TemporalEmotionPoint { date: string; alegria: number; raiva: number; tristeza: number; surpresa: number; medo: number; }
export interface TemporalTopicPoint { date: string; [topic: string]: number | string; }