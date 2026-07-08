"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
  LineChart, Line,
} from "recharts";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { Section } from "@/components/ds/Section";
import { SentimentBar } from "@/components/ds/SentimentBar";
import { getScoreStyle } from "@/components/ds/tokens";
import { useTheme } from "@/components/ThemeContext";
import {
  GlassChartIcon,
  GlassHeartIcon,
  GlassLinkIcon,
  GlassZapIcon,
} from "@/components/GlassIcons";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import { AmbassadorsVsDetractors } from "@/components/AdvancedCharts";
import { DemographicsSummary } from "@/components/DemographicsCharts";
import EmotionRadarCard from "@/components/EmotionRadarCard";
import WordCloudChart from "@/components/charts/WordCloudChart";
import { dashboardApi, connectionsApi, commentsApi, postsApi, demographicsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type {
  DashboardSummary,
  HealthReport,
  TrendResponse,
  TrendsDetailedResponse,
} from "@/lib/types";

const CHART_MARGIN = { top: 8, right: 4, bottom: 0, left: 0 };
const COMPACT_X_AXIS = {
  padding: { left: 0, right: 0 },
  interval: "preserveStartEnd" as const,
  minTickGap: 8,
};

/* ───────── Types for API responses ───────── */
interface ConnectionItem {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  followers_count: number;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
  persona: string | null;
  auto_sync: boolean;
  has_oauth_token: boolean;
}

interface TopComments {
  most_positive: Array<any>;
  most_negative: Array<any>;
}

interface PostItem {
  id: string;
  platform: string;
  platform_post_id: string;
  post_type: string | null;
  content_text: string | null;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  post_url: string | null;
  thumbnail_url: string | null;
}

interface EngagementPeaksResponse {
  hours: Array<{ hour: number; volume: number }>;
}

interface EngagementHeatmapResponse {
  data: number[][];
}

interface TrendsByPlatformResponse {
  platforms: Record<string, Array<{ date: string; score: number | null }>>;
}

/* ───────── Skeleton ───────── */
function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ backgroundColor: "var(--bg-subtle)", ...style }}
    />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

/* ───────── Helper: platform path ───────── */
function platformPath(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "x" || p === "twitter") return "/dashboard/twitter";
  return `/dashboard/${p}`;
}

function platformLabel(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "X / Twitter";
  if (p === "instagram") return "Instagram";
  if (p === "youtube") return "YouTube";
  if (p === "tiktok") return "TikTok";
  return platform;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString("pt-BR");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function timeSince(dateStr: string | null, labels: { never: string; now: string; ago: string }): string {
  if (!dateStr) return labels.never;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return labels.now;
  if (mins < 60) return `${mins} min ${labels.ago}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${labels.ago}`;
  return `${Math.floor(hrs / 24)}d ${labels.ago}`;
}

function getReputationBadge(score: number, labels: { good: string; attention: string; critical: string }): { variant: "positive" | "warning" | "negative" | "primary"; label: string } {
  if (score >= 7) return { variant: "positive", label: labels.good };
  if (score >= 4) return { variant: "warning", label: labels.attention };
  return { variant: "negative", label: labels.critical };
}

/* ───────── Main Page ───────── */

function DashboardQuestionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="pt-3 max-w-3xl ui-reveal">
      <p style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {eyebrow}
      </p>
      <h2 className="mt-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.12rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.25 }}>
        {title}
      </h2>
      <p className="mt-1" style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}

function DashboardMetricTile({ icon, label, value, sub, accent = "var(--primary)", strong = false }: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5 interactive-lift"
      style={{
        backgroundColor: strong ? "var(--primary)" : "var(--bg-card)",
        border: strong ? "1px solid transparent" : "1px solid var(--border)",
        boxShadow: strong ? "0 10px 28px -10px var(--primary)" : "0 1px 8px -2px rgba(0,0,0,0.06)",
        color: strong ? "var(--primary-foreground)" : "var(--text-primary)",
      }}
    >
      <div className="mb-3" style={{ color: strong ? "var(--primary-foreground)" : accent }}>{icon}</div>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.65rem", fontWeight: 800, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "0.72rem", color: strong ? "color-mix(in srgb, var(--primary-foreground) 76%, transparent)" : "var(--text-muted)", marginTop: 4 }}>{label}</p>
      <p style={{ fontSize: "0.62rem", color: strong ? "color-mix(in srgb, var(--primary-foreground) 62%, transparent)" : "var(--text-faint)", marginTop: 2 }}>{sub}</p>
    </div>
  );
}

const heatmapHours = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTheme();
  const td = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tch = useTranslations("charts");

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("Volume");
  const [sentimentTemporalMode, setSentimentTemporalMode] = useState<"grouped" | "stacked100">("grouped");

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [scoreTrend, setScoreTrend] = useState<TrendResponse | null>(null);
  const [trendsByPlatform, setTrendsByPlatform] = useState<TrendsByPlatformResponse | null>(null);
  const [trendsDetailed, setTrendsDetailed] = useState<TrendsDetailedResponse | null>(null);
  const [engagementPeaks, setEngagementPeaks] = useState<EngagementPeaksResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<number[][] | null>(null);
  const [topComments, setTopComments] = useState<TopComments | null>(null);
  const [recentPosts, setRecentPosts] = useState<PostItem[]>([]);
  const [ambassadorsData, setAmbassadorsData] = useState<{
    ambassadors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string }>;
    detractors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string }>;
  } | null>(null);
  const [globalDemoOverview, setGlobalDemoOverview] = useState<{
    gender_distribution: Record<string, number>;
    age_distribution: Record<string, number>;
    top_locations: Array<{ country: string; country_code: string; count: number }>;
    enrichment_coverage: { total_commenters: number; enriched: number; coverage_pct: number };
  } | null>(null);

  // Chart filters
  const [chartGranularity, setChartGranularity] = useState<"day" | "week" | "month">("week");
  const [chartDays, setChartDays] = useState<number>(30);

  // Prompt editing
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        dashboardApi.summary(token),                                    // 0
        connectionsApi.list(token),                                     // 1
        dashboardApi.healthReport(token),                               // 2
        dashboardApi.trends(token, { granularity: "week" }),            // 3
        dashboardApi.trendsByPlatform(token, { days: 30 }),              // 4
        dashboardApi.trendsDetailed(token),                             // 5
        dashboardApi.engagementPeaks(token),                            // 6
        dashboardApi.engagementHeatmap(token),                          // 7
        commentsApi.top(token),                                         // 8
        postsApi.list(token, { limit: 5 }),                             // 9
        dashboardApi.getHealthPrompt(token),                            // 10
      ]);

      if (results[0].status === "fulfilled") setSummary(results[0].value);
      if (results[1].status === "fulfilled") setConnections(results[1].value);
      if (results[2].status === "fulfilled") setHealthReport(results[2].value);
      if (results[3].status === "fulfilled") setScoreTrend(results[3].value);
      if (results[4].status === "fulfilled") setTrendsByPlatform(results[4].value);
      if (results[5].status === "fulfilled") setTrendsDetailed(results[5].value);
      if (results[6].status === "fulfilled") setEngagementPeaks(results[6].value);
      if (results[7].status === "fulfilled") setHeatmapData(results[7].value.data);
      if (results[8].status === "fulfilled") setTopComments(results[8].value);
      if (results[9].status === "fulfilled") setRecentPosts(results[9].value);
      if (results[10].status === "fulfilled") setPromptText((results[10].value as { prompt: string }).prompt);

      // Fetch ambassadors/detractors for first connection
      if (results[1].status === "fulfilled") {
        const conns = results[1].value as ConnectionItem[];
        if (conns.length > 0) {
          dashboardApi.ambassadorsDetractors(token, conns[0].id).then(setAmbassadorsData).catch(() => {});
        }
      }

      // Fetch global demographics overview
      demographicsApi.globalOverview(token).then(setGlobalDemoOverview).catch(() => {});

      // If summary failed, that's critical
      if (results[0].status === "rejected") {
        setError(td("couldNotLoadDashboard"));
      }
    } catch {
      setError(td("dashboardLoadError"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Refetch trends when chart filters change ──
  useEffect(() => {
    const token = getToken();
    if (!token || loading) return;
    Promise.allSettled([
      dashboardApi.trends(token, { granularity: chartGranularity, days: chartDays }),
      dashboardApi.trendsDetailed(token, { granularity: chartGranularity, days: chartDays }),
      dashboardApi.trendsByPlatform(token, { days: chartDays }),
    ]).then(results => {
      if (results[0].status === "fulfilled") setScoreTrend(results[0].value);
      if (results[1].status === "fulfilled") setTrendsDetailed(results[1].value);
      if (results[2].status === "fulfilled") setTrendsByPlatform(results[2].value);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartGranularity, chartDays]);

  // ── Derived data ──
  const score = summary?.avg_score ?? 0;
  const totalComments = summary?.total_analyzed ?? 0;
  const hasAnalyzedData = totalComments > 0;
  const scorePercent = hasAnalyzedData ? (score / 10) * 100 : 0;
  const totalPosts = summary?.total_posts ?? 0;
  const connectedProfiles = connections.length;
  const sentDist = summary?.sentiment_distribution;
  const positive = sentDist?.positive ?? 0;
  const neutral = sentDist?.neutral ?? 0;
  const negative = sentDist?.negative ?? 0;
  const totalSentiment = positive + neutral + negative || 1;
  const positivePct = Math.round((positive / totalSentiment) * 100);
  const neutralPct = Math.round((neutral / totalSentiment) * 100);
  const negativePct = 100 - positivePct - neutralPct;
  const repBadge = hasAnalyzedData
    ? getReputationBadge(score, { good: td("goodReputation"), attention: td("attentionNeeded"), critical: td("criticalReputation") })
    : { variant: "primary" as const, label: td("noDataYet") };
  const timeSinceLabels = { never: tc("never"), now: tc("now"), ago: tc("ago") };
  const heatmapDays: string[] = tch.raw("heatmap.days") as unknown as string[];

  // Last sync time from connections
  const lastSyncTimes = connections.map(c => c.last_sync_at).filter(Boolean) as string[];
  const latestSync = lastSyncTimes.length > 0
    ? lastSyncTimes.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;

  // Emotion pie data from summary
  const emotionPie = summary?.emotions_distribution
    ? Object.entries(summary.emotions_distribution)
        .map(([name, value], i) => ({ name, value, color: t.chart[i % t.chart.length] }))
        .sort((a, b) => b.value - a.value)
    : [];

  // Radar data from emotions
  const radarData = emotionPie.map(e => ({ emotion: e.name, value: e.value }));

  // Word cloud — handled by WordCloudChart component

  // Score trend chart data
  const parseDateOnly = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const formatTrendLabel = (period: string, idx: number) => {
    if (chartGranularity === "week") return `${td("weekLabel")} ${idx + 1}`;
    if (chartGranularity === "month") {
      const d = parseDateOnly(period);
      return d.toLocaleDateString("pt-BR", { month: "short" });
    }
    const d = parseDateOnly(period);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const isNumericScore = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const trendPeriodKey = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split("-").map(Number);
    const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    if (chartGranularity === "month") {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    }
    if (chartGranularity === "week") {
      const diffFromMonday = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - diffFromMonday);
    }
    return d.toISOString().slice(0, 10);
  };

  const scoreTrendData = scoreTrend?.data_points?.reduce<Array<{ date: string; score: number }>>((points, dp, i) => {
    if (isNumericScore(dp.avg_score)) {
      points.push({
        date: formatTrendLabel(dp.period, i),
        score: dp.avg_score,
      });
    }
    return points;
  }, []) ?? [];

  // Score by platform chart data
  const networkTrend = (() => {
    if (!trendsByPlatform?.platforms) return { data: [], keys: [] as string[] };
    const platforms = trendsByPlatform.platforms;
    const seriesByPlatform: Record<string, Array<{ period: string; score: number }>> = {};

    for (const [platform, points] of Object.entries(platforms)) {
      const buckets = new Map<string, { sum: number; count: number }>();
      for (const point of points) {
        if (!isNumericScore(point.score)) continue;
        const period = trendPeriodKey(point.date);
        const current = buckets.get(period) ?? { sum: 0, count: 0 };
        current.sum += point.score;
        current.count += 1;
        buckets.set(period, current);
      }

      const series = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({ period, score: Number((value.sum / value.count).toFixed(2)) }));

      if (series.length > 0) {
        seriesByPlatform[platform.toLowerCase()] = series;
      }
    }

    const periods = Array.from(
      new Set(Object.values(seriesByPlatform).flatMap(points => points.map(point => point.period)))
    ).sort();
    const data: Record<string, unknown>[] = periods.map((period, i) => {
      const row: Record<string, unknown> = { date: formatTrendLabel(period, i) };
      for (const [platform, points] of Object.entries(seriesByPlatform)) {
        row[platform] = points.find(point => point.period === period)?.score ?? null;
      }
      return row;
    });
    return { data, keys: Object.keys(seriesByPlatform) };
  })();
  const scoreTrendByNetwork = networkTrend.data;
  const platformKeys = networkTrend.keys;

  // Temporal distribution data
  const temporalData = trendsDetailed?.data_points?.map(dp => ({
    date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    positivo: dp.positive,
    neutro: dp.neutral,
    negativo: dp.negative,
  })) ?? [];

  const temporalPctData = temporalData.map(point => {
    const total = point.positivo + point.neutro + point.negativo || 1;
    return {
      date: point.date,
      positivo: Math.round((point.positivo / total) * 100),
      neutro: Math.round((point.neutro / total) * 100),
      negativo: Math.round((point.negativo / total) * 100),
      total,
    };
  });
  const hasSentimentTemporalVolume = temporalData.some(point => (point.positivo + point.neutro + point.negativo) > 0);

  // Volume temporal data
  const volumeTemporalData = trendsDetailed?.data_points?.map(dp => ({
    date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    volume: (dp.positive ?? 0) + (dp.neutral ?? 0) + (dp.negative ?? 0),
  })) ?? [];

  // Score temporal data (from scoreTrend which has avg_score)
  const scoreTemporalData = scoreTrend?.data_points
    ?.filter(dp => dp.avg_score != null)
    .map((dp, i) => ({
      date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
      score: dp.avg_score ?? 0,
    })) ?? [];

  // Engagement peaks data
  const engagementData = engagementPeaks?.hours?.map(h => ({
    hour: `${String(h.hour).padStart(2, "0")}h`,
    volume: h.volume,
  })) ?? [];

  // Platform stats from summary connections + compare
  const platformStats = connections.map(c => {
    const conn = summary?.connections?.find(sc => sc.id === c.id);
    return {
      id: c.id,
      name: platformLabel(c.platform),
      platform: c.platform.toLowerCase(),
      icon: <GlassSocialIcon platform={c.platform.toLowerCase()} size={32} />,
      score: conn?.total_analyzed ? (summary?.avg_score ?? 0) : 0,
      comments: conn?.total_analyzed ?? 0,
      trend: 0,
      dominant: "",
      isNeg: false,
    };
  });

  const firstTrendScore = scoreTrendData.find(point => point.score > 0)?.score ?? null;
  const lastTrendScore = scoreTrendData.length > 0 ? scoreTrendData[scoreTrendData.length - 1].score : null;
  const trendDelta = firstTrendScore != null && lastTrendScore != null ? Number((lastTrendScore - firstTrendScore).toFixed(1)) : null;
  const dominantEmotion = emotionPie[0]?.name ?? td("diagnosticHero.noEmotion");
  const dominantPlatform = platformStats.length > 0
    ? [...platformStats].sort((a, b) => b.comments - a.comments)[0]
    : null;
  const sentimentDriver = !hasAnalyzedData
    ? td("diagnosticHero.emptyDriver")
    : negativePct >= 35
      ? td("diagnosticHero.driverNegative", { pct: negativePct })
      : positivePct >= 50
        ? td("diagnosticHero.driverPositive", { pct: positivePct })
        : td("diagnosticHero.driverMixed", { positive: positivePct, negative: negativePct });
  const trendNarrative = trendDelta == null
    ? td("diagnosticHero.trendUnknown")
    : trendDelta > 0.2
      ? td("diagnosticHero.trendUp", { delta: trendDelta.toFixed(1) })
      : trendDelta < -0.2
        ? td("diagnosticHero.trendDown", { delta: Math.abs(trendDelta).toFixed(1) })
        : td("diagnosticHero.trendStable");
  const diagnosticTitle = !hasAnalyzedData
    ? td("diagnosticHero.titleEmpty")
    : score >= 7
      ? td("diagnosticHero.titleGood")
      : score >= 4
        ? td("diagnosticHero.titleAttention")
        : td("diagnosticHero.titleCritical");

  // Top comments — merge positive and negative
  const allTopComments = [
    ...(topComments?.most_positive ?? []).map(c => ({ ...c, _type: "positive" })),
    ...(topComments?.most_negative ?? []).map(c => ({ ...c, _type: "negative" })),
  ].slice(0, 4);

  // Heatmap color helper
  function getHeatColor(value: number) {
    if (value >= 40) return t.primary;
    if (value >= 30) return t.primaryMuted;
    if (value >= 20) return t.primaryFaint;
    if (value >= 10) return t.textXfaint;
    return t.primaryBg;
  }

  // Health report prompt update
  async function handleSavePrompt() {
    const token = getToken();
    if (!token) return;
    setLoadingPrompt(true);
    try {
      const result = await dashboardApi.healthReportWithPrompt(token, promptText);
      setHealthReport(result);
      setEditingPrompt(false);
    } catch {
      // silently fail
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleRefreshReport() {
    const token = getToken();
    if (!token) return;
    setLoadingPrompt(true);
    try {
      const result = await dashboardApi.healthReportWithPrompt(token);
      setHealthReport(result);
    } catch {
      // silently fail
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }

  // ── Error state ──
  if (error && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{error}</p>
        <Button onClick={fetchData} icon={<RefreshCw className="w-4 h-4" />}>{tc("retry")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══ GREETING ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-1">
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {td("title")}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: 4 }}>
            {td("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted" dot>{td("lastSync", { time: timeSince(latestSync, timeSinceLabels) })}</Badge>
          <Button variant="ghost" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />} onClick={handleRefresh} disabled={refreshing}>{refreshing ? "..." : td("refresh")}</Button>
        </div>
      </div>

      {/* ═══ REPUTATION HERO + QUICK STATS ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7"><CardSkeleton /></div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 ui-reveal">
          <div
            className="lg:col-span-7 rounded-2xl p-5 md:p-6"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--primary-bg) 62%, var(--bg-card)) 0%, color-mix(in srgb, var(--accent-bg) 76%, var(--bg-card)) 100%)",
              border: "1px solid color-mix(in srgb, var(--primary) 24%, var(--border))",
              boxShadow: "0 16px 42px -28px var(--primary)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge variant={repBadge.variant} dot>{repBadge.label}</Badge>
                <h2 className="mt-4" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.45rem", fontWeight: 850, color: "var(--text-primary)", lineHeight: 1.18 }}>
                  {diagnosticTitle}
                </h2>
                <p className="mt-2" style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  {sentimentDriver} {trendNarrative}
                </p>
              </div>
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="color-mix(in srgb, var(--primary) 16%, var(--bg-card))" strokeWidth="7" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={hasAnalyzedData ? (score >= 7 ? t.sentimentPositive : score >= 4 ? t.primary : t.sentimentNegative) : t.primary} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${scorePercent * 2.64} ${264 - scorePercent * 2.64}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 850, color: "var(--text-primary)" }}>{!hasAnalyzedData ? "\u2014" : score.toFixed(1)}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--text-faint)" }}>{td("outOf10")}</span>
                </div>
              </div>
            </div>

            {(positive + neutral + negative) > 0 && (
              <div className="mt-5">
                <SentimentBar positive={positive} neutral={neutral} negative={negative} height={10} showLabels />
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 pt-5" style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 18%, var(--border))" }}>
              {[
                { label: td("diagnosticHero.trendLabel"), value: trendDelta == null ? td("diagnosticHero.noTrendShort") : `${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)}` },
                { label: td("diagnosticHero.mainEmotion"), value: dominantEmotion },
                { label: td("diagnosticHero.mainAudience"), value: dominantPlatform?.name ?? td("diagnosticHero.noPlatform") },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                  <p className="truncate" style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <DashboardMetricTile strong icon={<GlassChartIcon size={34} />} value={totalComments.toLocaleString("pt-BR")} label={td("analyzedComments")} sub={td("diagnosticHero.volumeSub")} />
            <DashboardMetricTile icon={<GlassHeartIcon size={34} />} value={totalPosts.toLocaleString("pt-BR")} label={td("monitoredPosts")} sub={td("diagnosticHero.postsSub")} accent="var(--secondary)" />
            <DashboardMetricTile icon={<GlassLinkIcon size={34} />} value={connectedProfiles} label={td("connectedProfiles")} sub={td("diagnosticHero.profilesSub")} accent="var(--accent)" />
            <DashboardMetricTile icon={<GlassZapIcon size={34} />} value="8" label={td("trackedEmotions")} sub={td("diagnosticHero.emotionsSub")} accent="var(--primary)" />
            <div className="col-span-2 rounded-2xl p-4 md:p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 8px -2px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 12 }}>{td("connectedPlatforms")}</p>
              {connections.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[...connections].sort((a, b) => {
                    const order: Record<string, number> = { instagram: 0, youtube: 1, tiktok: 2, twitter: 3 };
                    return (order[a.platform] ?? 9) - (order[b.platform] ?? 9);
                  }).map(c => (
                    <button key={c.id} onClick={() => router.push(platformPath(c.platform))} className="flex items-center gap-2 p-2 rounded-xl transition-colors group" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <GlassSocialIcon platform={c.platform.toLowerCase()} size={28} />
                      <div className="min-w-0 text-left">
                        <p className="truncate" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{platformLabel(c.platform)}</p>
                        <p className="truncate" style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{c.username.startsWith("@") ? c.username : `@${c.username}`}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.78rem", color: "var(--text-faint)", textAlign: "center", padding: "12px 0" }}>{td("noPlatformConnected")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DIAGNOSIS ═══ */}
      <div className="grid grid-cols-1 gap-4">
        <Section title={td("aiDiagnosis")} subtitle={healthReport?.generated_at ? td("generatedAt", { date: new Date(healthReport.generated_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) }) : td("automaticDiagnosis")} action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setEditingPrompt(!editingPrompt)}>{td("editPrompt")}</Button>
            <Button variant="ghost" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingPrompt ? "animate-spin" : ""}`} strokeWidth={1.5} />} onClick={handleRefreshReport}>{td("refreshReport")}</Button>
          </div>
        }>
          {editingPrompt && (
            <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{td("agentPrompt")}</p>
                <button onClick={() => setEditingPrompt(false)}>
                  <X className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
                </button>
              </div>
              <textarea
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                className="w-full rounded-lg p-3 resize-none focus:outline-none"
                rows={4}
                style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-primary)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handleSavePrompt}>{loadingPrompt ? td("savingPrompt") : td("savePrompt")}</Button>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {loading || loadingPrompt ? (
              <div className="space-y-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                  <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--primary)" }}>
                    {loadingPrompt ? td("generatingDiagnosis") : td("loading")}
                  </p>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : healthReport?.report_text ? (
              <div
                style={{ fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-muted)" }}
                dangerouslySetInnerHTML={{
                  __html: healthReport.report_text
                    .replace(/\n/g, "<br/>")
                    .replace(/\*\*(.*?)\*\*/g, '<span style="color: var(--text-primary); font-weight: 600;">$1</span>'),
                }}
              />
            ) : (
              <p style={{ fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-faint)" }}>
                {td("noDiagnosisAvailable")}
              </p>
            )}
          </div>
        </Section>

      </div>

      {/* ═══ DEMOGRAPHICS SUMMARY ═══ */}
      {globalDemoOverview && globalDemoOverview.enrichment_coverage.enriched > 0 && (
        <DemographicsSummary
          genderDist={globalDemoOverview.gender_distribution}
          ageDist={globalDemoOverview.age_distribution}
          topLocations={globalDemoOverview.top_locations}
          coverage={globalDemoOverview.enrichment_coverage}
        />
      )}

      {/* ═══ CHART FILTERS ═══ */}
      <DashboardQuestionHeader
        eyebrow={td("sections.reputation.eyebrow")}
        title={td("sections.reputation.title")}
        description={td("sections.reputation.description")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
          {(["day", "week", "month"] as const).map(g => (
            <button key={g} onClick={() => setChartGranularity(g)}
              className="px-3 py-1.5 transition-colors"
              style={{ fontSize: "0.68rem", fontWeight: 600, backgroundColor: chartGranularity === g ? "var(--primary)" : "transparent", color: chartGranularity === g ? "var(--primary-foreground)" : "var(--text-muted)" }}>
              {g === "day" ? td("day") : g === "week" ? td("week") : td("month")}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
          {[{ label: "7d", v: 7 }, { label: "30d", v: 30 }, { label: "90d", v: 90 }, { label: td("total"), v: 0 }].map(p => (
            <button key={p.v} onClick={() => setChartDays(p.v)}
              className="px-3 py-1.5 transition-colors"
              style={{ fontSize: "0.68rem", fontWeight: 600, backgroundColor: chartDays === p.v ? "var(--primary)" : "transparent", color: chartDays === p.v ? "var(--primary-foreground)" : "var(--text-muted)" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CHARTS ROW 1: Score Trend + Score by Platform ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title={td("scoreTrend")} subtitle={`${td("avgGeneral")} — ${chartGranularity === "day" ? td("daily") : chartGranularity === "week" ? td("weekly") : td("monthly")}`}>
          {loading ? <ChartSkeleton /> : scoreTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart id="dash-score-area" data={scoreTrendData} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="dash-scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={t.primary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={t.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                <Area type="monotone" dataKey="score" stroke={t.primary} strokeWidth={2.5} fill="url(#dash-scoreGradient)" dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noTrendData")}</p>
          )}
        </Section>
        <Section title={td("scoreByNetwork")} subtitle={td("platformComparison")}>
          {loading ? <ChartSkeleton /> : scoreTrendByNetwork.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart id="dash-network-line" data={scoreTrendByNetwork} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                {platformKeys.map((pk, i) => (
                  <Line key={pk} type="monotone" dataKey={pk.toLowerCase()} name={platformLabel(pk)} stroke={t.chart[i % t.chart.length]} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: t.chart[i % t.chart.length] }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noComparativeData")}</p>
          )}
        </Section>
      </div>

      {/* ═══ RADAR + WORD CLOUD ═══ */}
      <DashboardQuestionHeader
        eyebrow={td("sections.drivers.eyebrow")}
        title={td("sections.drivers.title")}
        description={td("sections.drivers.description")}
      />

      <div className="space-y-4">
        {loading ? (
          <Section title={td("emotionRadar")}>
            <ChartSkeleton height={300} />
          </Section>
        ) : radarData.length > 0 ? (
          <EmotionRadarCard title={td("emotionRadar")} data={radarData} />
        ) : (
          <Section title={td("emotionRadar")}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noEmotionData")}</p>
          </Section>
        )}
        <Section title={td("wordCloud")} subtitle={td("wordCloudSubtitle")}>
          {loading ? <ChartSkeleton height={180} /> : (
            <WordCloudChart topics={summary?.word_frequency || null} maxWords={25} height={240} />
          )}
        </Section>
      </div>

      {/* ═══ HEATMAP ═══ */}
      <Section title={td("heatmapTitle")} subtitle={td("heatmapSubtitle")}>
        {loading ? <ChartSkeleton height={220} /> : heatmapData && heatmapData.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="flex gap-1 mb-1 pl-10">
                {heatmapHours.map(h => (
                  <div key={h} className="flex-1 text-center" style={{ fontSize: "0.62rem", color: "var(--text-faint)", fontWeight: 500 }}>{h}h</div>
                ))}
              </div>
              {heatmapDays.map((day, di) => (
                <div key={day} className="flex gap-1 mb-1 items-center">
                  <span className="w-8 shrink-0 text-right pr-2" style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>{day}</span>
                  {(heatmapData[di] ?? []).map((val, hi) => (
                    <div key={hi} className="flex-1 rounded-md transition-all hover:scale-110 cursor-default" style={{ height: 28, backgroundColor: getHeatColor(val) }} title={`${day} ${heatmapHours[hi]}h — ${val} com.`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "40px 0" }}>{td("noHeatmapData")}</p>
        )}
      </Section>

      {/* ═══ TEMPORAL CHART ═══ */}
      <Section title={td("temporalDistribution")} subtitle={td("temporalSubtitle")}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", border: "0.5px solid var(--border)", backdropFilter: "blur(12px)", boxShadow: "0 2px 10px -2px rgba(0,0,0,0.05)" }}>
            {[{ key: "Volume", label: td("volume") }, { key: "Score", label: tc("score") }, { key: "Sentimento", label: td("sentiment") }].map(range => (
            <button key={range.key} onClick={() => setTimeRange(range.key)} className="px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap" style={{ fontSize: "0.75rem", fontWeight: 500, backgroundColor: timeRange === range.key ? "var(--primary)" : "transparent", color: timeRange === range.key ? "var(--primary-foreground)" : "var(--text-muted)", boxShadow: timeRange === range.key ? "0 4px 16px -4px var(--primary)" : "none" }}>
                {range.label}
              </button>
            ))}
          </div>
          {timeRange === "Sentimento" && (
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "color-mix(in srgb, var(--accent-bg) 58%, var(--bg-card))", border: "0.5px solid color-mix(in srgb, var(--accent) 28%, var(--border))", boxShadow: "0 2px 10px -2px rgba(0,0,0,0.05)" }}>
              {([
                { key: "grouped", label: td("temporalModes.grouped") },
                { key: "stacked100", label: td("temporalModes.stacked100") },
              ] as const).map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setSentimentTemporalMode(mode.key)}
                  className="px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    backgroundColor: sentimentTemporalMode === mode.key ? "var(--accent)" : "transparent",
                    color: sentimentTemporalMode === mode.key ? "var(--primary-foreground)" : "var(--text-muted)",
                    boxShadow: sentimentTemporalMode === mode.key ? "0 6px 18px -8px var(--accent)" : "none",
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading ? <ChartSkeleton height={260} /> : timeRange === "Volume" && volumeTemporalData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart id="dash-temporal-volume" data={volumeTemporalData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
              <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Bar dataKey="volume" name={td("volume")} fill={t.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : timeRange === "Score" && scoreTemporalData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart id="dash-temporal-score" data={scoreTemporalData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="dash-scoreTemporalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={t.primary} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={t.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
              <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Area type="monotone" dataKey="score" name={tc("score")} stroke={t.primary} strokeWidth={2.5} fill="url(#dash-scoreTemporalGrad)" dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : timeRange === "Sentimento" && temporalData.length > 0 && hasSentimentTemporalVolume ? (
          sentimentTemporalMode === "stacked100" ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart id="dash-temporal-bar-stacked" data={temporalPctData} barGap={2} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--accent) 28%, transparent)" vertical={false} />
                <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} formatter={(value, name) => [`${Number(value ?? 0)}%`, String(name)]} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                <Bar dataKey="positivo" name={tc("positive")} fill={t.sentimentPositive} stackId="sentiment" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutro" name={tc("neutral")} fill={t.sentimentNeutral} stackId="sentiment" radius={[0, 0, 0, 0]} />
                <Bar dataKey="negativo" name={tc("negative")} fill={t.sentimentNegative} stackId="sentiment" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart id="dash-temporal-bar-grouped" data={temporalData} barGap={4} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--accent) 28%, transparent)" vertical={false} />
                <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                <Bar dataKey="negativo" name={tc("negative")} fill={t.sentimentNegative} radius={[4, 4, 0, 0]} />
                <Bar dataKey="neutro" name={tc("neutral")} fill={t.sentimentNeutral} radius={[4, 4, 0, 0]} />
                <Bar dataKey="positivo" name={tc("positive")} fill={t.sentimentPositive} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noTemporalData")}</p>
        )}
      </Section>

      {/* ═══ ENGAGEMENT CURVE ═══ */}
      <Section title={td("engagementPeak")} subtitle={td("engagementSubtitle")}>
        {loading ? <ChartSkeleton height={180} /> : engagementData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart id="dash-engagement-area" data={engagementData} margin={CHART_MARGIN}>
              <XAxis dataKey="hour" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Bar dataKey="volume" fill={t.primaryMuted} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "40px 0" }}>{td("noEngagementData")}</p>
        )}
      </Section>

      {/* ═══ TOP COMMENTS ═══ */}
      <Section title={td("featuredComments")} subtitle={td("featuredCommentsSub")}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : allTopComments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allTopComments.map((c, i) => {
              const commentScore = (c.score_0_10 as number) ?? (c.score as number) ?? 0;
              const ss = getScoreStyle(commentScore);
              const username = (c.author_username as string) || (c.user as string) || tc("anonymous");
              const text = (c.text_original as string) || (c.text as string) || "";
              const emotion = ((c.emotions as string[]) ?? [])[0] || (c.emotion as string) || "";
              return (
                <div key={i} className="rounded-xl p-4 transition-colors cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)" }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.68rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>{commentScore.toFixed(1)}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>@{username}</span>
                    {emotion && (
                      <span className="ml-auto px-2 py-0.5 rounded-md" style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{emotion}</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--text-muted)" }}>&quot;{text.length > 120 ? text.slice(0, 120) + "..." : text}&quot;</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "24px 0" }}>{td("noFeaturedComments")}</p>
        )}
      </Section>

      {/* ═══ FANS E HATERS ═══ */}
      {ambassadorsData && (ambassadorsData.ambassadors?.length > 0 || ambassadorsData.detractors?.length > 0) && (
        <AmbassadorsVsDetractors
          ambassadors={ambassadorsData.ambassadors.map(a => ({
            username: a.username,
            comments: a.count,
            avgScore: a.avg_score,
            dominantEmotion: a.dominant_emotion,
            lastSeen: "",
          }))}
          detractors={ambassadorsData.detractors.map(d => ({
            username: d.username,
            comments: d.count,
            avgScore: d.avg_score,
            dominantEmotion: d.dominant_emotion,
            lastSeen: "",
          }))}
          platformLabel="Geral"
        />
      )}

      {/* ═══ PROFILES ═══ */}
      <Section title={td("yourProfiles")} action={<Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/connect")}>{td("addProfile")}</Button>}>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : connections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...connections].sort((a, b) => {
              const order: Record<string, number> = { instagram: 0, youtube: 1, tiktok: 2, twitter: 3 };
              return (order[a.platform] ?? 9) - (order[b.platform] ?? 9);
            }).map(profile => (
              <div key={profile.id} className="rounded-xl p-5 transition-colors cursor-pointer group" style={{ backgroundColor: "var(--bg-subtle)" }} onClick={() => router.push(platformPath(profile.platform))}>
                <div className="flex items-center gap-3 mb-5">
                  <GlassSocialIcon platform={profile.platform.toLowerCase()} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{profile.username.startsWith("@") ? profile.username : `@${profile.username}`}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{platformLabel(profile.platform)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { l: tc("followers"), v: profile.followers_count ? formatNumber(profile.followers_count) : "—" },
                    { l: tc("status"), v: profile.status === "active" ? tc("active") : profile.status },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.v}</p>
                      <p style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: profile.status === "active" ? "var(--primary)" : "var(--text-faint)" }} />
                    <span style={{ fontSize: "0.72rem", color: profile.status === "active" ? "var(--primary)" : "var(--text-faint)", fontWeight: 500 }}>
                      {profile.status === "active" ? td("synchronized") : tc("inactive")}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 transition-colors" style={{ color: "var(--text-faint)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <p style={{ fontSize: "0.85rem", color: "var(--text-faint)" }}>{td("noProfileYet")}</p>
            <Button size="sm" onClick={() => router.push("/dashboard/connect")}>{td("connectFirstProfile")}</Button>
          </div>
        )}
      </Section>

      {/* ═══ RECENT POSTS ═══ */}
      <Section title={td("recentPosts")} subtitle={td("recentPostsSub")}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : recentPosts.filter(p => p.content_text && p.content_text !== "null").length > 0 ? (
          <div className="space-y-1">
            {(() => {
              // Prioriza posts com comentários — post 0/0 não tem análise para abrir
              const visible = recentPosts.filter(p => p.content_text && p.content_text !== "null");
              const withComments = visible.filter(p => (p.comment_count ?? 0) > 0);
              return withComments.length > 0 ? withComments : visible;
            })().map((post, i) => {
              const postTitle = post.content_text!.length > 60 ? post.content_text!.slice(0, 60) + "..." : post.content_text!;
              const thumbSrc = post.thumbnail_url ? `/api/v1/posts/thumbnail?url=${encodeURIComponent(post.thumbnail_url)}` : null;
              return (
                <div key={post.id || i} onClick={() => router.push(`/dashboard/post/${post.id}`)} className="flex items-center gap-3 md:gap-4 p-3 md:p-3.5 rounded-xl cursor-pointer transition-colors group" style={{ backgroundColor: "transparent" }}>
                  {thumbSrc ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <img src={thumbSrc} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span style="font-size:0.7rem;color:var(--text-faint)">📷</span></div>'; }} />
                    </div>
                  ) : (
                    <GlassSocialIcon platform={post.platform?.toLowerCase() ?? "instagram"} size={28} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>{postTitle}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{post.comment_count} {tc("comments")} · {formatDate(post.published_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden sm:block" style={{ color: "var(--text-faint)" }} />
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "24px 0" }}>{td("noPostFound")}</p>
        )}
      </Section>
    </div>
  );
}
