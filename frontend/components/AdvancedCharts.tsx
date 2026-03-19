import { useState } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend, Cell, ZAxis,
} from "recharts";
import { useTranslations } from "next-intl";
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
  const tc = useTranslations("charts");
  const [hovered, setHovered] = useState<number | null>(null);

  const getQuadrantColor = (eng: number, sent: number) => {
    if (eng >= 50 && sent >= 5) return t.sentimentPositive; // viral + positive
    if (eng >= 50 && sent < 5) return t.sentimentNegative;  // viral + negative (danger)
    if (eng < 50 && sent >= 5) return t.secondary;          // low reach + positive (hidden gem)
    return t.sentimentNeutral;                               // low reach + negative
  };

  return (
    <Section title={tc("gapAnalysis.title")} subtitle={tc("gapAnalysis.subtitle")}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{tc("gapAnalysis.eachDot")}</span>
      </div>
      {/* Quadrant labels */}
      <div className="relative">
        <div className="absolute top-2 left-12 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.secondary, backgroundColor: `${t.secondaryBg}` }}>
          💎 {tc("gapAnalysis.hiddenGem")}
        </div>
        <div className="absolute top-2 right-4 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentPositive, backgroundColor: `${t.sentimentPositive}15` }}>
          🚀 {tc("gapAnalysis.viralPositive")}
        </div>
        <div className="absolute bottom-8 left-12 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentNeutral, backgroundColor: `${t.sentimentNeutral}15` }}>
          😐 {tc("gapAnalysis.lowImpact")}
        </div>
        <div className="absolute bottom-8 right-4 z-10 px-2 py-0.5 rounded" style={{ fontSize: "0.58rem", fontWeight: 600, color: t.sentimentNegative, backgroundColor: `${t.sentimentNegative}15` }}>
          🔥 {tc("gapAnalysis.viralCrisis")}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart id={`gap-scatter-${platformLabel}`} margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
            <XAxis
              type="number" dataKey="engagement" name={tc("gapAnalysis.engagementLabel")} unit="%"
              domain={[0, 100]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false}
              label={{ value: `${tc("gapAnalysis.engagementAxis")} →`, position: "insideBottom", offset: -5, style: { fontSize: 10, fill: t.textMuted } }}
            />
            <YAxis
              type="number" dataKey="sentiment" name={tc("gapAnalysis.sentiment")}
              domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false}
              label={{ value: `${tc("gapAnalysis.sentimentAxis")} →`, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: t.textMuted } }}
            />
            <ZAxis type="number" dataKey="comments" range={[40, 200]} name={tc("gapAnalysis.commentsLabel")} />
            {/* Reference lines for quadrants */}
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload as GapPost;
                return (
                  <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textPrimary }}>{d.title}</p>
                    <p style={{ fontSize: "0.68rem", color: t.textMuted }}>{tc("gapAnalysis.engagementLabel")}: {d.engagement}% · Score: {d.sentiment.toFixed(1)} · {d.comments} com.</p>
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
  const tc = useTranslations("charts");
  const [selectedPost, setSelectedPost] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const post = posts[selectedPost];
  const lineColors = [t.primary, t.secondary, t.accent, t.primaryMuted, t.secondaryLight];

  return (
    <Section title={tc("postLifecycle.title")} subtitle={tc("postLifecycle.subtitle")}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
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
          <Line type="monotone" dataKey="score" name={tc("postLifecycle.scoreSentiment")} stroke={t.primary} strokeWidth={2.5} dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="volume" name={tc("postLifecycle.volumeComments")} stroke={t.secondary} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
        <span>⬆ {tc("postLifecycle.scoreRising")}</span>
        <span>⬇ {tc("postLifecycle.scoreDropping")}</span>
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
  gender?: string;
  age_band?: string;
  location_state?: string;
}

export function AmbassadorsVsDetractors({ ambassadors, detractors, platformLabel }: {
  ambassadors: Ambassador[];
  detractors: Ambassador[];
  platformLabel: string;
}) {
  const { t } = useTheme();
  const tc = useTranslations("charts");

  const UserCard = ({ user, type }: { user: Ambassador; type: "fan" | "hater" }) => {
    const isFan = type === "fan";
    const scoreColor = isFan ? t.sentimentPositive : t.sentimentNegative;
    const scoreBgColor = isFan ? `${t.sentimentPositive}15` : `${t.sentimentNegative}15`;
    return (
      <div className="p-3 rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="truncate" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>@{user.username}</p>
          <span className="px-1.5 py-0.5 rounded-md shrink-0" style={{ fontSize: "0.65rem", fontWeight: 700, color: scoreColor, backgroundColor: scoreBgColor }}>
            {user.avgScore.toFixed(1)}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full mb-1.5" style={{ backgroundColor: `${scoreColor}15` }}>
          <div className="h-full rounded-full" style={{ width: `${(user.avgScore / 10) * 100}%`, backgroundColor: scoreColor }} />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{user.comments} com.</span>
          <span className="px-1.5 py-0.5 rounded capitalize ml-auto" style={{ fontSize: "0.58rem", fontWeight: 500, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{user.dominantEmotion}</span>
        </div>
        {(user.gender || user.age_band || user.location_state) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {user.gender && (
              <span className="px-1 py-0.5 rounded" style={{ fontSize: "0.55rem", fontWeight: 500, color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "0.5px solid var(--border)" }}>{user.gender === "male" ? "M" : user.gender === "female" ? "F" : "B"}</span>
            )}
            {user.age_band && (
              <span className="px-1 py-0.5 rounded" style={{ fontSize: "0.55rem", fontWeight: 500, color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "0.5px solid var(--border)" }}>{user.age_band}</span>
            )}
            {user.location_state && (
              <span className="px-1 py-0.5 rounded" style={{ fontSize: "0.55rem", fontWeight: 500, color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "0.5px solid var(--border)" }}>{user.location_state}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Section title={tc("ambassadors.title")} subtitle={tc("ambassadors.subtitle")}>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5" style={{ color: t.sentimentPositive }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{tc("ambassadors.fans")}</span>
          </div>
          <div className="space-y-1.5">
            {ambassadors.map(u => <UserCard key={u.username} user={u} type="fan" />)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5" style={{ color: t.sentimentNegative }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{tc("ambassadors.haters")}</span>
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
  const tc = useTranslations("charts");
  const [hovered, setHovered] = useState<number | null>(null);

  // Sort descending by count
  const sorted = [...topics].sort((a, b) => b.count - a.count);

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

  // Normalize sizes using sqrt scale for visually meaningful differences
  const counts = sorted.map(tp => tp.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const range = maxCount - minCount || 1;

  const getNormalizedSize = (count: number) => {
    // sqrt scale to compress huge ranges, expand small ones
    const normalized = Math.sqrt((count - minCount) / range);
    // Map to height range 56-100px
    return 56 + normalized * 44;
  };

  // Grid layout: 5 columns for clean staircase look
  const cols = sorted.length <= 5 ? sorted.length : 5;

  return (
    <Section title={tc("topicTreemap.title")} subtitle={tc("topicTreemap.subtitle")}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
        <div className="flex items-center gap-3 ml-auto" style={{ fontSize: "0.62rem" }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.sentimentPositive }} /> {tc("topicTreemap.positiveLabel")}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.secondary }} /> {tc("topicTreemap.neutralLabel")}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.primaryMuted }} /> {tc("topicTreemap.alertLabel")}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.sentimentNegative }} /> {tc("topicTreemap.negativeLabel")}</span>
        </div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {sorted.map((topic, i) => {
          const h = getNormalizedSize(topic.count);
          return (
            <div
              key={topic.topic}
              className="rounded-xl flex flex-col items-center justify-center transition-all cursor-default"
              style={{
                height: `${h}px`,
                backgroundColor: getBgForScore(topic.avgScore),
                border: hovered === i ? `2px solid ${getColorForScore(topic.avgScore)}` : "2px solid transparent",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ fontSize: h > 70 ? "0.82rem" : "0.68rem", fontWeight: 700, color: getColorForScore(topic.avgScore) }}>
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
  const tc = useTranslations("charts");

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
      case "high": return { color: t.sentimentNegative, bg: `${t.sentimentNegative}15`, label: tc("smartAlertsSection.severityHigh") };
      case "medium": return { color: t.secondary, bg: `${t.secondary}20`, label: tc("smartAlertsSection.severityMedium") };
      case "low": return { color: t.sentimentPositive, bg: `${t.sentimentPositive}15`, label: tc("smartAlertsSection.severityLow") };
    }
  };

  return (
    <Section title={tc("smartAlertsSection.title")} subtitle={tc("smartAlertsSection.subtitle")}>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{tc("smartAlertsSection.activeAlerts", { count: alerts.length })}</span>
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

// Fixed set of 7 canonical emotions (matching the radar chart)
const CANONICAL_EMOTIONS = ["Alegria", "Tristeza", "Raiva", "Surpresa", "Nojo", "Medo", "Amor"];

// Abbreviated emotion labels for compact pills
const EMOTION_ABBREV: Record<string, string> = {
  "Alegria": "Ale",
  "Tristeza": "Tri",
  "Raiva": "Rai",
  "Surpresa": "Sur",
  "Nojo": "Noj",
  "Medo": "Med",
  "Amor": "Amo",
};

export function TopicEmotionHeatmap({ matrix, platformLabel }: { matrix: TopicEmotionMatrix; platformLabel: string }) {
  const { t } = useTheme();
  const tc = useTranslations("charts");

  // Always use exactly 7 canonical emotions
  // Map from API emotions to canonical ones
  const emotionIndices = CANONICAL_EMOTIONS.map(ce => {
    const idx = matrix.emotions.findIndex(e => e.toLowerCase() === ce.toLowerCase());
    return idx;
  });

  // Limit to top 10 topics (or 5 for small accounts) by total count
  const topicTotals = matrix.topics.map((topic, ti) => ({ topic, ti, total: matrix.data[ti].reduce((s, v) => s + v, 0) }));
  topicTotals.sort((a, b) => b.total - a.total);
  const topN = topicTotals.length < 10 ? Math.min(topicTotals.length, 5) : 10;
  const selectedTopics = topicTotals.slice(0, topN);
  const filteredTopics = selectedTopics.map(tp => tp.topic);
  // Build data rows mapped to canonical emotions
  const filteredData = selectedTopics.map(tp =>
    emotionIndices.map(ei => (ei >= 0 ? matrix.data[tp.ti][ei] : 0))
  );

  const maxVal = Math.max(...filteredData.flat(), 1);

  const getCellBg = (value: number) => {
    if (value === 0) return `${t.primary}08`;
    const ratio = value / maxVal;
    // opacity steps: 15%, 30%, 50%, 70%, 90%
    if (ratio >= 0.8) return `${t.primary}E6`;
    if (ratio >= 0.6) return `${t.primary}B3`;
    if (ratio >= 0.4) return `${t.primary}80`;
    if (ratio >= 0.2) return `${t.primary}4D`;
    return `${t.primary}26`;
  };

  const getCellTextColor = (value: number) => {
    if (value === 0) return "transparent";
    const ratio = value / maxVal;
    return ratio >= 0.5 ? "#fff" : "var(--text-primary)";
  };

  return (
    <Section title={tc("topicEmotionMatrix.title")} subtitle={tc("topicEmotionMatrix.subtitle")}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge variant="primary">{tc("insightPremium")}</Badge>
        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{tc("topicEmotionMatrix.intensity")}</span>
      </div>
      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Emotion column headers */}
          <thead>
            <tr>
              <th style={{ width: "15%" }} />
              {CANONICAL_EMOTIONS.map((emotion) => (
                <th
                  key={emotion}
                  className="text-center"
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    padding: "0 2px 6px",
                  }}
                  title={tc(`emotions.${emotion.toLowerCase()}`)}
                >
                  <span className="hidden sm:inline">{tc(`emotions.${emotion.toLowerCase()}`)}</span>
                  <span className="sm:hidden">{tc(`emotionAbbrev.${emotion.toLowerCase()}`)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTopics.map((topic, ti) => (
              <tr key={topic}>
                {/* Topic name on the left */}
                <td
                  className="truncate pr-2"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    maxWidth: "90px",
                  }}
                  title={topic}
                >
                  {topic}
                </td>
                {/* Heatmap cells */}
                {CANONICAL_EMOTIONS.map((emotion, ei) => {
                  const value = filteredData[ti][ei];
                  return (
                    <td key={emotion} className="text-center" style={{ padding: "1.5px" }}>
                      <div
                        className="rounded flex items-center justify-center mx-auto w-full aspect-square"
                        style={{
                          maxHeight: "40px",
                          backgroundColor: getCellBg(value),
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          color: getCellTextColor(value),
                          transition: "background-color 0.2s",
                        }}
                        title={`${topic} × ${emotion}: ${value}`}
                      >
                        {value > 0 ? value : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end" style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>
        <span>{tc("topicEmotionMatrix.lessMentions")}</span>
        <div className="flex gap-0.5">
          {[0.15, 0.3, 0.5, 0.7, 0.9].map((op, i) => (
            <div key={i} className="w-4 h-3 rounded" style={{ backgroundColor: t.primary, opacity: op }} />
          ))}
        </div>
        <span>{tc("topicEmotionMatrix.moreMentions")}</span>
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