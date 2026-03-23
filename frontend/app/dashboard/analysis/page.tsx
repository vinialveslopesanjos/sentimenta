"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area } from "recharts";
import { dashboardApi, connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useTheme } from "@/components/ThemeContext";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ds/Badge";
import { Section } from "@/components/ds/Section";
import { SentimentBar } from "@/components/ds/SentimentBar";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";

type ConnectionOption = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  status: string;
};

type CompareConnection = {
  connection_id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  total_comments: number;
  total_analyzed: number;
  avg_score: number | null;
  avg_polarity: number | null;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  positive_rate: number;
  negative_rate: number;
  emotions_distribution: Record<string, number>;
};

export default function AnalysisPage() {
  const { t } = useTheme();
  const ta = useTranslations("analysis");
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");
  const [days, setDays] = useState(0);
  const [activeTime, setActiveTime] = useState("all");
  const [data, setData] = useState<CompareConnection[]>([]);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [insights, setInsights] = useState<{ advantage: any; opportunity: any; risk: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendsA, setTrendsA] = useState<{ data_points: any[] }>({ data_points: [] });
  const [trendsB, setTrendsB] = useState<{ data_points: any[] }>({ data_points: [] });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    connectionsApi.list(token).then(list => {
      const active = list.filter(c => c.status === "active");
      setConnections(active);
      if (active.length > 0) setSelectedA(active[0].id);
    });
  }, []);

  useEffect(() => {
    const ids = [selectedA, selectedB].filter(Boolean);
    if (ids.length === 0) { setData([]); return; }
    const token = getToken();
    if (!token) return;
    setLoading(true);
    Promise.all([
      dashboardApi.compareConnections(token, ids, days),
      dashboardApi.compareRadar(token, ids, days).catch(() => null),
      ids.length >= 1 ? dashboardApi.insights(token, ids).catch(() => null) : null,
    ]).then(([compareRes, radarRes, insightsRes]) => {
      setData(compareRes.connections);
      if (radarRes) {
        const metrics = ["score", "engagement", "positivity", "volume", "consistency", "growth"];
        const metricLabels: Record<string, string> = { score: ta("radarMetrics.score"), engagement: ta("radarMetrics.engagement"), positivity: ta("radarMetrics.positivity"), volume: ta("radarMetrics.volume"), consistency: ta("radarMetrics.consistency"), growth: ta("radarMetrics.growth") };
        const radarFormatted = metrics.map(m => {
          const item: Record<string, any> = { metric: metricLabels[m] || m };
          radarRes.connections.forEach((c, idx) => {
            const axes = c.axes as Record<string, number>;
            item[idx === 0 ? "A" : "B"] = axes[m] ?? 0;
          });
          return item;
        });
        setRadarData(radarFormatted);
      }
      if (insightsRes) setInsights(insightsRes);
    }).finally(() => setLoading(false));
  }, [selectedA, selectedB, days]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (selectedA) {
      dashboardApi.trends(token, { connection_id: selectedA, granularity: "week", days }).then(setTrendsA).catch(() => {});
    } else { setTrendsA({ data_points: [] }); }
    if (selectedB) {
      dashboardApi.trends(token, { connection_id: selectedB, granularity: "week", days }).then(setTrendsB).catch(() => {});
    } else { setTrendsB({ data_points: [] }); }
  }, [selectedA, selectedB, days]);

  const connA = data.find(d => d.connection_id === selectedA);
  const connB = data.find(d => d.connection_id === selectedB);
  const activeConns = [connA, connB].filter(Boolean) as CompareConnection[];

  const emotionsData = (() => {
    if (activeConns.length === 0) return [];
    const allEmotions = new Set<string>();
    activeConns.forEach(c => Object.keys(c.emotions_distribution).forEach(e => allEmotions.add(e)));
    return Array.from(allEmotions).sort((a, b) => {
      const maxA = Math.max(...activeConns.map(c => c.emotions_distribution[a] || 0));
      const maxB = Math.max(...activeConns.map(c => c.emotions_distribution[b] || 0));
      return maxB - maxA;
    }).slice(0, 8).map(emotion => {
      const item: Record<string, any> = { emotion };
      if (connA) item.A = connA.emotions_distribution[emotion] || 0;
      if (connB) item.B = connB.emotions_distribution[emotion] || 0;
      return item;
    });
  })();

  const timeFilters = [
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "1y", label: ta("1y") },
    { key: "all", label: ta("all") },
  ];

  const handleTimeChange = (key: string) => {
    setActiveTime(key);
    if (key === "30d") setDays(30);
    else if (key === "90d") setDays(90);
    else if (key === "all") setDays(0);
    else setDays(365);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{ta("title")}</h1>
        <p className="mt-1" style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>{ta("subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>{ta("profileA")}</label>
            <select value={selectedA} onChange={e => setSelectedA(e.target.value)} className="w-full px-3 py-2.5 rounded-xl transition-all" style={{ fontSize: "0.82rem", border: "1px solid var(--primary)", backgroundColor: "var(--primary-bg)", color: "var(--primary)" }}>
              <option value="">{ta("selectProfile")}</option>
              {connections.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === selectedB}>@{c.username} ({c.platform})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>{ta("profileB")}</label>
            <select value={selectedB} onChange={e => setSelectedB(e.target.value)} className="w-full px-3 py-2.5 rounded-xl transition-all" style={{ fontSize: "0.82rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
              <option value="">{ta("showOnlyA")}</option>
              {connections.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === selectedA}>@{c.username} ({c.platform})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ backgroundColor: "var(--bg-subtle)" }}>
            {timeFilters.map(tf => (
              <button key={tf.key} onClick={() => handleTimeChange(tf.key)} className="px-3 py-1.5 rounded-lg transition-all" style={{ fontSize: "0.72rem", fontWeight: 500, backgroundColor: activeTime === tf.key ? "var(--bg-card)" : "transparent", color: activeTime === tf.key ? "var(--text-primary)" : "var(--text-muted)" }}>{tf.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        </div>
      )}

      {!loading && activeConns.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)" }}>{ta("selectAtLeastOne")}</h3>
          <p className="mt-1" style={{ fontSize: "0.82rem", color: "var(--text-faint)" }}>{ta("selectAbove")}</p>
        </div>
      )}

      {!loading && activeConns.length > 0 && (
        <>
          {/* Score cards comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeConns.map((p, idx) => (
              <div key={p.connection_id} className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: idx === 0 ? t.primary : t.secondary, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>{idx === 0 ? "A" : "B"}</span>
                  <GlassSocialIcon platform={p.platform} size={32} />
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>@{p.username}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.platform} &middot; {p.total_comments.toLocaleString()} com.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Score</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>{p.avg_score != null ? p.avg_score.toFixed(1) : "\u2014"}<span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-muted)" }}>/10</span></p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{ta("positivity")}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 700, color: (p.avg_polarity ?? 0) >= 0 ? t.sentimentPositive : t.sentimentNegative }}>{p.avg_polarity != null ? ((p.avg_polarity >= 0 ? "+" : "") + p.avg_polarity.toFixed(2)) : "\u2014"}</p>
                  </div>
                </div>
                <SentimentBar positive={p.sentiment_distribution.positive} neutral={p.sentiment_distribution.neutral} negative={p.sentiment_distribution.negative} height={10} showLabels />
              </div>
            ))}
          </div>

          {/* Score trend */}
          {(trendsA.data_points.length > 0 || trendsB.data_points.length > 0) && (
            <Section title={ta("scoreTrend")} subtitle={ta("scoreTrendSub")}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                  <XAxis dataKey="period" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} tickFormatter={(v: string) => { const d = new Date(v); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  {trendsA.data_points.length > 0 && (
                    <Line data={trendsA.data_points} type="monotone" dataKey="avg_score" name={connA ? `@${connA.username}` : ta("profileA")} stroke={t.primary} strokeWidth={2.5} dot={false} connectNulls />
                  )}
                  {trendsB.data_points.length > 0 && (
                    <Line data={trendsB.data_points} type="monotone" dataKey="avg_score" name={connB ? `@${connB.username}` : ta("profileB")} stroke={t.secondary} strokeWidth={2.5} dot={false} connectNulls strokeDasharray="8 4" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Radar + Emotions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {radarData.length > 0 && (
              <Section title={ta("comparativeRadar")} subtitle={ta("comparativeRadarSub")}>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={t.textXfaint} />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: t.textMuted }} />
                    <Radar dataKey="A" name={connA ? `@${connA.username}` : "A"} stroke={t.primary} fill={t.primary} fillOpacity={0.1} strokeWidth={2} />
                    {connB && <Radar dataKey="B" name={`@${connB.username}`} stroke={t.secondary} fill={t.secondary} fillOpacity={0.08} strokeWidth={2} strokeDasharray="6 3" />}
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </Section>
            )}

            {emotionsData.length > 0 && (
              <Section title={ta("emotionsComparative")} subtitle={ta("emotionsComparativeSub")}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={emotionsData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                    <XAxis dataKey="emotion" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                    <Bar dataKey="A" name={connA ? `@${connA.username}` : "A"} fill={t.primary} radius={[4, 4, 0, 0]} />
                    {connB && <Bar dataKey="B" name={`@${connB.username}`} fill={t.secondary} radius={[4, 4, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            )}
          </div>

          {/* Insight cards */}
          {insights && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { data: insights.advantage, color: t.sentimentPositive, bg: "var(--sentiment-positive-bg)" },
                { data: insights.opportunity, color: t.primary, bg: "var(--primary-bg)" },
                { data: insights.risk, color: t.sentimentNegative, bg: "var(--sentiment-negative-bg)" },
              ].map(card => (
                <div key={card.data.title} className="rounded-2xl p-5" style={{ backgroundColor: card.bg, border: `1px solid ${card.color}30` }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 600, color: card.color, marginBottom: 8 }}>{card.data.title}</p>
                  <p style={{ fontSize: "0.78rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{card.data.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
