"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area } from "recharts";
import { dashboardApi, connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useTheme } from "@/components/ThemeContext";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ds/Badge";
import { Section } from "@/components/ds/Section";
import { SentimentBar } from "@/components/ds/SentimentBar";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import { SurfaceEvidenceNotice } from "@/components/data/SurfaceEvidenceNotice";
import { CountFunnel } from "@/components/data/CountFunnel";
import { ComparisonSeriesLegend, type ComparisonLegendItem } from "@/components/data/ComparisonSeriesLegend";
import { ChartTextAlternative } from "@/components/charts/ChartTextAlternative";
import type { ConnectionComparison, SnapshotReference, TrendResponse } from "@sentimenta/types";
import { buildComparisonTimeline, formatUtcPeriod } from "@/lib/trendTimeline";
import { formatChartNumber, getPeriodRange, getTrendFact } from "@/lib/chartAccessibility";

type ConnectionOption = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  status: string;
};

export default function AnalysisPage() {
  const { t } = useTheme();
  const ta = useTranslations("analysis");
  const tca = useTranslations("charts.accessibility");
  const tp = useTranslations("platformCapabilities");
  const locale = useLocale();
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");
  const [days, setDays] = useState(3650);
  const [activeTime, setActiveTime] = useState("all");
  const [data, setData] = useState<ConnectionComparison[]>([]);
  const [comparisonSnapshot, setComparisonSnapshot] = useState<SnapshotReference | null>(null);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [insights, setInsights] = useState<{ advantage: any; opportunity: any; risk: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendsA, setTrendsA] = useState<TrendResponse>({ data_points: [], granularity: "week", timezone: "UTC" });
  const [trendsB, setTrendsB] = useState<TrendResponse>({ data_points: [], granularity: "week", timezone: "UTC" });
  const [trendLoadState, setTrendLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");

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
    if (ids.length === 0) {
      setData([]);
      setComparisonSnapshot(null);
      return;
    }
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setRadarData([]);
    setInsights(null);
    Promise.all([
      dashboardApi.compareConnections(token, ids, days),
      ids.length >= 2 ? dashboardApi.compareRadar(token, ids, days).catch(() => null) : null,
      ids.length >= 2 ? dashboardApi.insights(token, ids).catch(() => null) : null,
    ]).then(([compareRes, radarRes, insightsRes]) => {
      setData(compareRes.connections.map(series => {
        const legacy = series as ConnectionComparison & {
          saved_count?: number;
          valid_count?: number;
          observed_period_start?: string | null;
          observed_period_end?: string | null;
          health?: ConnectionComparison["health"];
        };
        return {
          ...series,
          saved_count: Number.isFinite(legacy.saved_count) ? Number(legacy.saved_count) : series.total_comments,
          valid_count: Number.isFinite(legacy.valid_count) ? Number(legacy.valid_count) : series.total_analyzed,
          observed_period_start: legacy.observed_period_start ?? null,
          observed_period_end: legacy.observed_period_end ?? null,
          health: legacy.health ?? null,
        };
      }));
      setComparisonSnapshot(compareRes.snapshot);
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
    const empty: TrendResponse = { data_points: [], granularity: "week", timezone: "UTC" };
    if (!selectedA) {
      setTrendsA(empty);
      setTrendsB(empty);
      setTrendLoadState("idle");
      return;
    }

    let cancelled = false;
    setTrendLoadState("loading");
    Promise.all([
      dashboardApi.trends(token, { connection_id: selectedA, granularity: "week", days }),
      selectedB
        ? dashboardApi.trends(token, { connection_id: selectedB, granularity: "week", days })
        : Promise.resolve(empty),
    ]).then(([nextA, nextB]) => {
      if (cancelled) return;
      if (nextA.timezone !== "UTC" || (selectedB && nextB.timezone !== "UTC")) {
        setTrendsA(empty);
        setTrendsB(empty);
        setTrendLoadState("error");
        return;
      }
      setTrendsA(nextA);
      setTrendsB(nextB);
      setTrendLoadState("ready");
    }).catch(() => {
      if (cancelled) return;
      setTrendsA(empty);
      setTrendsB(empty);
      setTrendLoadState("error");
    });

    return () => {
      cancelled = true;
    };
  }, [selectedA, selectedB, days]);

  const connA = data.find(d => d.connection_id === selectedA);
  const connB = data.find(d => d.connection_id === selectedB);
  const activeConns = [connA, connB].filter(Boolean) as ConnectionComparison[];
  const comparisonEvidenceMode = comparisonSnapshot?.language_policy.mode ?? "unavailable";
  const comparisonHasEvidence = comparisonEvidenceMode !== "unavailable"
    && (comparisonSnapshot?.valid_count ?? 0) > 0;
  const trendChartData = useMemo(
    () => buildComparisonTimeline(trendsA.data_points, trendsB.data_points),
    [trendsA.data_points, trendsB.data_points],
  );
  const platformNames: Record<string, string> = {
    instagram: tp("platforms.instagram.name"),
    youtube: tp("platforms.youtube.name"),
    tiktok: tp("platforms.tiktok.name"),
    twitter: tp("platforms.twitter.name"),
  };
  const seriesLabel = (series: ConnectionComparison) => {
    const handle = series.username.startsWith("@") ? series.username : `@${series.username}`;
    return `${platformNames[series.platform] ?? series.platform} · ${handle}`;
  };
  const legendItems: ComparisonLegendItem[] = [];
  if (connA) legendItems.push({ role: "A", label: seriesLabel(connA), color: t.primary, dashed: false, series: connA });
  if (connB) legendItems.push({ role: "B", label: seriesLabel(connB), color: t.secondary, dashed: true, series: connB });

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

  const describeScoreTrend = (series: string, fact: ReturnType<typeof getTrendFact>) => {
    if (!fact) return "";
    if (fact.start === fact.end) {
      return tca("singlePoint", {
        series,
        value: formatChartNumber(fact.to, locale),
        unit: tca("units.scoreShort"),
        period: fact.end,
      });
    }
    const values = {
      series,
      delta: formatChartNumber(Math.abs(fact.delta), locale),
      unit: tca("units.scoreShort"),
      from: formatChartNumber(fact.from, locale),
      to: formatChartNumber(fact.to, locale),
      start: fact.start,
      end: fact.end,
    };
    if (fact.direction === "up") return tca("trendUp", values);
    if (fact.direction === "down") return tca("trendDown", values);
    return tca("trendStable", values);
  };
  const comparisonTrendSeries = [
    connA && trendsA.data_points.length > 0 ? {
      key: "profileA" as const,
      label: seriesLabel(connA),
      fact: getTrendFact(
        trendChartData,
        point => formatUtcPeriod(point.period, locale),
        point => point.profileA,
      ),
    } : null,
    connB && trendsB.data_points.length > 0 ? {
      key: "profileB" as const,
      label: seriesLabel(connB),
      fact: getTrendFact(
        trendChartData,
        point => formatUtcPeriod(point.period, locale),
        point => point.profileB,
      ),
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);
  const comparisonTrendSummary = comparisonTrendSeries
    .map(item => describeScoreTrend(item.label, item.fact))
    .filter(Boolean)
    .join(" ");
  const comparisonPeriod = comparisonSnapshot?.period_start && comparisonSnapshot?.period_end
    ? `${formatUtcPeriod(comparisonSnapshot.period_start, locale, "medium")} — ${formatUtcPeriod(comparisonSnapshot.period_end, locale, "medium")} · UTC`
    : tca("currentSlice");
  const radarCells = radarData.flatMap((point) => [
    connA && Number.isFinite(Number(point.A)) ? { metric: String(point.metric), series: seriesLabel(connA), value: Number(point.A) } : null,
    connB && Number.isFinite(Number(point.B)) ? { metric: String(point.metric), series: seriesLabel(connB), value: Number(point.B) } : null,
  ]).filter((cell): cell is { metric: string; series: string; value: number } => cell != null);
  const radarPeak = [...radarCells].sort((a, b) => b.value - a.value)[0] ?? null;
  const emotionCells = emotionsData.flatMap((point) => [
    connA && Number.isFinite(Number(point.A)) ? { emotion: String(point.emotion), series: seriesLabel(connA), value: Number(point.A) } : null,
    connB && Number.isFinite(Number(point.B)) ? { emotion: String(point.emotion), series: seriesLabel(connB), value: Number(point.B) } : null,
  ]).filter((cell): cell is { emotion: string; series: string; value: number } => cell != null);
  const emotionPeak = [...emotionCells].sort((a, b) => b.value - a.value)[0] ?? null;

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
    else if (key === "all") setDays(3650);
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

      {!loading && selectedA && comparisonEvidenceMode !== "current" && (
        <SurfaceEvidenceNotice snapshot={comparisonSnapshot} surface="comparison" />
      )}

      {!loading && selectedA && (
        <CountFunnel snapshot={comparisonSnapshot} surface="comparison" />
      )}

      {!loading && activeConns.length > 0 && comparisonHasEvidence && (
        <>
          {/* Score cards comparison */}
          <div data-testid="comparison-profile-cards" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeConns.map((p, idx) => (
              <div key={p.connection_id} className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: idx === 0 ? t.primary : t.secondary, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>{idx === 0 ? "A" : "B"}</span>
                  <GlassSocialIcon platform={p.platform} size={32} />
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>@{p.username}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{platformNames[p.platform] ?? p.platform} &middot; {p.saved_count.toLocaleString()} com.</p>
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
          {trendLoadState === "error" && (
            <div data-testid="comparison-score-trend-error" className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{ta("scoreTrendError")}</p>
            </div>
          )}

          {trendLoadState === "ready" && trendChartData.length > 0 && (
            <Section
              title={ta("scoreTrend")}
              subtitle={ta("scoreTrendSub")}
              action={<Badge variant="muted">UTC</Badge>}
            >
              <div
                data-testid="comparison-score-trend"
                data-timezone="UTC"
                data-period-count={trendChartData.length}
                data-periods={trendChartData.map(point => point.period).join(",")}
              >
                <p className="mb-3" style={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>
                  {ta("scoreTrendTimeBasis")}
                </p>
                <ComparisonSeriesLegend items={legendItems} />
                <div data-chart-visual="comparison-score-trend">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendChartData} accessibilityLayer={false}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                    <XAxis dataKey="period" type="category" allowDuplicatedCategory={false} interval={0} padding={{ left: 14, right: 14 }} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} tickFormatter={(value: string) => formatUtcPeriod(value, locale)} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(value) => `${formatUtcPeriod(String(value), locale, "medium")} · UTC`} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                    {trendsA.data_points.length > 0 && (
                      <Line type="monotone" dataKey="profileA" name={connA ? seriesLabel(connA) : ta("profileA")} stroke={t.primary} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                    )}
                    {trendsB.data_points.length > 0 && (
                      <Line type="monotone" dataKey="profileB" name={connB ? seriesLabel(connB) : ta("profileB")} stroke={t.secondary} strokeWidth={2.5} dot={false} connectNulls strokeDasharray="8 4" isAnimationActive={false} />
                    )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ChartTextAlternative
                  chartId="comparison-score-trend"
                  title={ta("scoreTrend")}
                  summary={comparisonTrendSummary}
                  period={getPeriodRange(
                    trendChartData,
                    point => `${formatUtcPeriod(point.period, locale)} · UTC`,
                    comparisonPeriod,
                  )}
                  unit={tca("units.score")}
                  columns={[
                    { key: "period", label: tca("columns.period") },
                    ...comparisonTrendSeries.map(series => ({
                      key: series.key,
                      label: series.label,
                      numeric: true,
                    })),
                  ]}
                  rows={trendChartData.map(point => ({
                    period: `${formatUtcPeriod(point.period, locale, "medium")} · UTC`,
                    profileA: point.profileA == null ? null : formatChartNumber(point.profileA, locale),
                    profileB: point.profileB == null ? null : formatChartNumber(point.profileB, locale),
                  }))}
                />
              </div>
            </Section>
          )}

          {/* Radar + Emotions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {radarData.length > 0 && (
              <Section title={ta("comparativeRadar")} subtitle={ta("comparativeRadarSub")}>
                <div data-chart-visual="comparison-radar">
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData} accessibilityLayer={false}>
                      <PolarGrid stroke={t.textXfaint} />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: t.textMuted }} />
                      <Radar dataKey="A" name={connA ? `@${connA.username}` : "A"} stroke={t.primary} fill={t.primary} fillOpacity={0.1} strokeWidth={2} />
                      {connB && <Radar dataKey="B" name={`@${connB.username}`} stroke={t.secondary} fill={t.secondary} fillOpacity={0.08} strokeWidth={2} strokeDasharray="6 3" />}
                      <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {radarPeak && (
                  <ChartTextAlternative
                    chartId="comparison-radar"
                    title={ta("comparativeRadar")}
                    summary={tca("dominant", {
                      category: `${radarPeak.metric} · ${radarPeak.series}`,
                      value: formatChartNumber(radarPeak.value, locale),
                      unit: tca("units.relativeIndex"),
                    })}
                    period={comparisonPeriod}
                    unit={tca("units.relativeIndex")}
                    columns={[
                      { key: "metric", label: tca("columns.metric") },
                      ...(connA ? [{ key: "A", label: seriesLabel(connA), numeric: true }] : []),
                      ...(connB ? [{ key: "B", label: seriesLabel(connB), numeric: true }] : []),
                    ]}
                    rows={radarData.map(point => ({
                      metric: String(point.metric),
                      A: point.A == null ? null : formatChartNumber(Number(point.A), locale),
                      B: point.B == null ? null : formatChartNumber(Number(point.B), locale),
                    }))}
                  />
                )}
              </Section>
            )}

            {emotionsData.length > 0 && (
              <Section title={ta("emotionsComparative")} subtitle={ta("emotionsComparativeSub")}>
                <div data-chart-visual="comparison-emotions">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={emotionsData} barGap={4} accessibilityLayer={false}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                      <XAxis dataKey="emotion" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                      <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                      <Bar dataKey="A" name={connA ? `@${connA.username}` : "A"} fill={t.primary} radius={[4, 4, 0, 0]} />
                      {connB && <Bar dataKey="B" name={`@${connB.username}`} fill={t.secondary} radius={[4, 4, 0, 0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {emotionPeak && (
                  <ChartTextAlternative
                    chartId="comparison-emotions"
                    title={ta("emotionsComparative")}
                    summary={tca("dominant", {
                      category: `${emotionPeak.emotion} · ${emotionPeak.series}`,
                      value: formatChartNumber(emotionPeak.value, locale, 0),
                      unit: tca("units.occurrences"),
                    })}
                    period={comparisonPeriod}
                    unit={tca("units.occurrences")}
                    columns={[
                      { key: "emotion", label: tca("columns.emotion") },
                      ...(connA ? [{ key: "A", label: seriesLabel(connA), numeric: true }] : []),
                      ...(connB ? [{ key: "B", label: seriesLabel(connB), numeric: true }] : []),
                    ]}
                    rows={emotionsData.map(point => ({
                      emotion: String(point.emotion),
                      A: point.A == null ? null : formatChartNumber(Number(point.A), locale, 0),
                      B: point.B == null ? null : formatChartNumber(Number(point.B), locale, 0),
                    }))}
                  />
                )}
              </Section>
            )}
          </div>

          {/* Insight cards */}
          {insights && comparisonEvidenceMode === "current" && (
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
