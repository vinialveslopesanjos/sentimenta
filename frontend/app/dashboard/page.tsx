"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Pencil,
  ShieldAlert,
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
import {
  PlatformCapabilityBadge,
  PlatformCapabilityMatrix,
} from "@/components/PlatformCapabilityMatrix";
import { AmbassadorsVsDetractors } from "@/components/AdvancedCharts";
import { DemographicsSummary } from "@/components/DemographicsCharts";
import EmotionRadarCard from "@/components/EmotionRadarCard";
import WordCloudChart from "@/components/charts/WordCloudChart";
import { ChartTextAlternative } from "@/components/charts/ChartTextAlternative";
import { CountFunnel } from "@/components/data/CountFunnel";
import { ProvenanceDrawer } from "@/components/data/ProvenanceDrawer";
import { dashboardApi, connectionsApi, commentsApi, postsApi, demographicsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatChartNumber, getPeakFact, getPeriodRange, getTrendFact } from "@/lib/chartAccessibility";
import type { SnapshotHealthState } from "@sentimenta/types";
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

function withTimeout<T>(promise: Promise<T>, ms = 4500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("request_timeout")), ms);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function formatEvidenceDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function SafeReportText({ text }: { text: string }) {
  return (
    <div data-testid="diagnosis-report-text" className="space-y-3" style={{ fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-muted)" }}>
      {text.split(/\n+/).filter(Boolean).map((line, lineIndex) => (
        <p key={`${lineIndex}-${line.slice(0, 20)}`}>
          {line.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, partIndex) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={partIndex} style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={partIndex}>{part}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

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
  connection_id: string;
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

function profileSnapshotHealth(
  profiles: Array<Record<string, unknown>> | undefined,
  connectionId: string,
): SnapshotHealthState | null {
  const profile = profiles?.find((item) => item.connection_id === connectionId);
  const health = profile?.health;
  return health === "healthy"
    || health === "degraded"
    || health === "stale"
    || health === "failed"
    || health === "never_synced"
    ? health
    : null;
}

function healthTone(health: SnapshotHealthState): string {
  if (health === "healthy") return "var(--sentiment-positive)";
  if (health === "degraded" || health === "stale") return "var(--accent)";
  if (health === "failed") return "var(--sentiment-negative)";
  return "var(--primary)";
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
  const locale = useLocale();
  const td = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tch = useTranslations("charts");
  const tca = useTranslations("charts.accessibility");
  const snapshotActions = useTranslations("snapshot.actions");
  const snapshotProvenance = useTranslations("snapshot.provenance");
  const connectionHealth = useTranslations("connect.health.states");
  const connectionRegistration = useTranslations("connect.registration");

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const provenanceTriggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("Volume");
  const [sentimentTemporalMode, setSentimentTemporalMode] = useState<"grouped" | "stacked100">("grouped");

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [healthReportLoading, setHealthReportLoading] = useState(true);
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

  const closeProvenance = useCallback(() => {
    setProvenanceOpen(false);
    requestAnimationFrame(() => provenanceTriggerRef.current?.focus());
  }, []);

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
      const [summaryResult, connectionsResult] = await Promise.allSettled([
        dashboardApi.summary(token),
        connectionsApi.list(token),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setError(td("couldNotLoadDashboard"));
        return;
      }

      const loadedConnections = connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
      if (connectionsResult.status === "fulfilled") setConnections(loadedConnections);

      setHealthReportLoading(true);
      void (async () => {
        const results = await Promise.allSettled([
          withTimeout(dashboardApi.healthReport(token)),                    // 0
          withTimeout(dashboardApi.trends(token, { granularity: "week" })), // 1
          withTimeout(dashboardApi.trendsByPlatform(token, { days: 30 })),  // 2
          withTimeout(dashboardApi.trendsDetailed(token)),                  // 3
          withTimeout(dashboardApi.engagementPeaks(token)),                 // 4
          withTimeout(dashboardApi.engagementHeatmap(token)),               // 5
          withTimeout(commentsApi.top(token)),                              // 6
          withTimeout(postsApi.list(token, { limit: 5 })),                  // 7
          withTimeout(dashboardApi.getHealthPrompt(token)),                 // 8
        ]);

        if (results[0].status === "fulfilled") setHealthReport(results[0].value);
        if (results[1].status === "fulfilled") setScoreTrend(results[1].value);
        if (results[2].status === "fulfilled") setTrendsByPlatform(results[2].value);
        if (results[3].status === "fulfilled") setTrendsDetailed(results[3].value);
        if (results[4].status === "fulfilled") setEngagementPeaks(results[4].value);
        if (results[5].status === "fulfilled") setHeatmapData(results[5].value.data);
        if (results[6].status === "fulfilled") setTopComments(results[6].value);
        if (results[7].status === "fulfilled") setRecentPosts(results[7].value);
        if (results[8].status === "fulfilled") setPromptText((results[8].value as { prompt: string }).prompt);

        if (loadedConnections.length > 0) {
          dashboardApi.ambassadorsDetractors(token, loadedConnections[0].id).then(setAmbassadorsData).catch(() => {});
        }

        demographicsApi.globalOverview(token).then(setGlobalDemoOverview).catch(() => {});
        setHealthReportLoading(false);
      })();
    } catch {
      setError(td("dashboardLoadError"));
    } finally {
      setLoading(false);
    }
  }, [router, td]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Refetch trends when chart filters change ──
  useEffect(() => {
    const token = getToken();
    if (!token || loading) return;
    Promise.allSettled([
      withTimeout(dashboardApi.trends(token, { granularity: chartGranularity, days: chartDays })),
      withTimeout(dashboardApi.trendsDetailed(token, { granularity: chartGranularity, days: chartDays })),
      withTimeout(dashboardApi.trendsByPlatform(token, { days: chartDays })),
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
  const snapshotValidCount = summary?.snapshot?.valid_count;
  const hasAnalyzedData = totalComments > 0 && (snapshotValidCount == null || snapshotValidCount > 0);
  const failedWithoutEvidence = summary?.snapshot?.health === "failed" && !hasAnalyzedData;
  const scorePercent = hasAnalyzedData ? (score / 10) * 100 : 0;
  const totalPosts = summary?.total_posts ?? 0;
  const connectedProfiles = connections.length;
  const neverSynced = summary?.snapshot?.health === "never_synced";
  const hasConnectedProfileWithoutAnalysis = connectedProfiles > 0 && !hasAnalyzedData;
  const sentDist = summary?.sentiment_distribution;
  const positive = sentDist?.positive ?? 0;
  const neutral = sentDist?.neutral ?? 0;
  const negative = sentDist?.negative ?? 0;
  const totalSentiment = positive + neutral + negative || 1;
  const positivePct = Math.round((positive / totalSentiment) * 100);
  const neutralPct = Math.round((neutral / totalSentiment) * 100);
  const negativePct = 100 - positivePct - neutralPct;
  const summaryLanguageMode = summary?.snapshot?.language_policy.mode ?? "unavailable";
  const currentEvidenceAllowed = summaryLanguageMode === "current";
  const repBadge = !hasAnalyzedData
    ? {
        variant: failedWithoutEvidence ? "negative" as const : "primary" as const,
        label: failedWithoutEvidence ? td("noValidAnalysis") : td("noDataYet"),
      }
    : !currentEvidenceAllowed
      ? {
          variant: "warning" as const,
          label: summaryLanguageMode === "historical"
            ? td("diagnosticHero.historicalBadge")
            : td("diagnosticHero.qualifiedBadge"),
        }
      : getReputationBadge(score, { good: td("goodReputation"), attention: td("attentionNeeded"), critical: td("criticalReputation") });
  const timeSinceLabels = { never: tc("never"), now: tc("now"), ago: tc("ago") };
  const heatmapDays: string[] = tch.raw("heatmap.days") as unknown as string[];

  // Last sync time from connections
  const lastSyncTimes = connections.map(c => c.last_sync_at).filter(Boolean) as string[];
  const latestSync = lastSyncTimes.length > 0
    ? lastSyncTimes.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;
  const latestSuccessfulSync = summary?.snapshot ? summary.snapshot.last_success_at : latestSync;
  const lastSuccessBadgeVariant = !latestSuccessfulSync
    ? "negative" as const
    : summary?.snapshot && ["degraded", "stale", "failed"].includes(summary.snapshot.health)
      ? "warning" as const
      : "positive" as const;

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
  const temporalData = hasAnalyzedData
    ? trendsDetailed?.data_points?.map(dp => ({
        date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        positivo: dp.positive,
        neutro: dp.neutral,
        negativo: dp.negative,
      })) ?? []
    : [];

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
  const volumeTemporalData = hasAnalyzedData
    ? trendsDetailed?.data_points?.map(dp => ({
        date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        volume: (dp.positive ?? 0) + (dp.neutral ?? 0) + (dp.negative ?? 0),
      })) ?? []
    : [];

  // Score temporal data (from scoreTrend which has avg_score)
  const scoreTemporalData = hasAnalyzedData
    ? scoreTrend?.data_points
      ?.filter(dp => dp.avg_score != null)
      .map((dp) => ({
        date: new Date(dp.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        score: dp.avg_score ?? 0,
      })) ?? []
    : [];

  // Engagement peaks data
  const engagementData = hasAnalyzedData
    ? engagementPeaks?.hours?.map(h => ({
        hour: `${String(h.hour).padStart(2, "0")}h`,
        volume: h.volume,
      })) ?? []
    : [];

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
  const dominantEmotion = hasAnalyzedData && (emotionPie[0]?.value ?? 0) > 0
    ? emotionPie[0].name
    : td("diagnosticHero.noEmotion");
  const dominantPlatform = hasAnalyzedData && platformStats.length > 0
    ? [...platformStats].sort((a, b) => b.comments - a.comments)[0]
    : null;
  const sentimentDriver = !hasAnalyzedData
    ? failedWithoutEvidence
      ? td("diagnosticHero.unavailableDriver", { saved: summary?.snapshot?.saved_count ?? 0 })
      : neverSynced
        ? td("diagnosticHero.neverSyncedDriver")
        : hasConnectedProfileWithoutAnalysis
          ? td("diagnosticHero.connectedEmptyDriver")
          : td("diagnosticHero.emptyDriver")
    : !currentEvidenceAllowed
      ? negativePct >= 35
        ? td("diagnosticHero.historicalDriverNegative", { pct: negativePct })
        : positivePct >= 50
          ? td("diagnosticHero.historicalDriverPositive", { pct: positivePct })
          : td("diagnosticHero.historicalDriverMixed", { positive: positivePct, negative: negativePct })
    : negativePct >= 35
      ? td("diagnosticHero.driverNegative", { pct: negativePct })
      : positivePct >= 50
        ? td("diagnosticHero.driverPositive", { pct: positivePct })
        : td("diagnosticHero.driverMixed", { positive: positivePct, negative: negativePct });
  const trendNarrative = neverSynced
    ? td("diagnosticHero.neverSyncedBoundary")
    : !currentEvidenceAllowed
      ? td("diagnosticHero.nonCurrentBoundary")
    : trendDelta == null
    ? td("diagnosticHero.trendUnknown")
    : trendDelta > 0.2
      ? td("diagnosticHero.trendUp", { delta: trendDelta.toFixed(1) })
      : trendDelta < -0.2
        ? td("diagnosticHero.trendDown", { delta: Math.abs(trendDelta).toFixed(1) })
        : td("diagnosticHero.trendStable");
  const diagnosticTitle = !hasAnalyzedData
    ? failedWithoutEvidence
      ? td("diagnosticHero.titleUnavailable")
      : neverSynced
        ? td("diagnosticHero.titleNeverSynced")
        : hasConnectedProfileWithoutAnalysis
          ? td("diagnosticHero.titleConnectedEmpty")
          : td("diagnosticHero.titleEmpty")
    : !currentEvidenceAllowed
      ? summaryLanguageMode === "historical"
        ? td("diagnosticHero.titleHistorical")
        : td("diagnosticHero.titleQualified")
    : score >= 7
      ? td("diagnosticHero.titleGood")
      : score >= 4
        ? td("diagnosticHero.titleAttention")
        : td("diagnosticHero.titleCritical");
  const reputationSectionCopy = summaryLanguageMode === "current"
    ? { title: td("sections.reputation.title"), description: td("sections.reputation.description") }
    : summaryLanguageMode === "historical"
      ? { title: td("sections.reputation.historicalTitle"), description: td("sections.reputation.historicalDescription") }
      : summaryLanguageMode === "qualified"
        ? { title: td("sections.reputation.qualifiedTitle"), description: td("sections.reputation.qualifiedDescription") }
        : { title: td("sections.reputation.unavailableTitle"), description: td("sections.reputation.unavailableDescription") };
  const driversSectionCopy = summaryLanguageMode === "current"
    ? { title: td("sections.drivers.title"), description: td("sections.drivers.description") }
    : summaryLanguageMode === "historical"
      ? { title: td("sections.drivers.historicalTitle"), description: td("sections.drivers.historicalDescription") }
      : summaryLanguageMode === "qualified"
        ? { title: td("sections.drivers.qualifiedTitle"), description: td("sections.drivers.qualifiedDescription") }
        : { title: td("sections.drivers.unavailableTitle"), description: td("sections.drivers.unavailableDescription") };

  const reportBasis = healthReport?.report_basis;
  const reportMode = reportBasis?.recommendation_mode ?? "blocked";
  const reportSnapshot = healthReport?.snapshot ?? null;
  const reportStart = formatEvidenceDate(reportBasis?.period_start, locale);
  const reportEnd = formatEvidenceDate(reportBasis?.period_end, locale);
  const reportPeriod = reportStart && reportEnd
    ? reportStart === reportEnd
      ? reportStart
      : td("diagnosisEvidence.periodRange", { start: reportStart, end: reportEnd })
    : td("diagnosisEvidence.periodUnknown");
  const coverageKey = ["complete", "partial", "none"].includes(reportBasis?.coverage_status ?? "")
    ? reportBasis!.coverage_status
    : "unknown";
  const coverageBase = td(`diagnosisEvidence.coverage.${coverageKey}`);
  const reportCoverage = typeof reportBasis?.coverage_ratio === "number"
    ? td("diagnosisEvidence.coverageWithRatio", { label: coverageBase, ratio: Math.round(reportBasis.coverage_ratio * 100) })
    : coverageBase;
  const reportGeneratedAt = formatEvidenceDate(healthReport?.generated_at, locale) ?? td("diagnosisEvidence.notGenerated");
  const reportReference = reportBasis?.snapshot_id ? `ref. ${reportBasis.snapshot_id.slice(0, 8)}` : td("diagnosisEvidence.noReference");
  const reportAction = reportSnapshot?.language_policy.next_action;
  const reportActionLabel = reportAction ? snapshotActions(reportAction.code) : td("diagnosisEvidence.restoreData");
  const reportEvidence = reportMode === "current"
    ? {
        title: td("diagnosisEvidence.currentTitle"),
        description: td("diagnosisEvidence.currentDescription"),
        color: "var(--sentiment-positive)",
        background: "var(--sentiment-positive-bg)",
        Icon: CheckCircle,
      }
    : reportMode === "historical_only"
      ? {
          title: td("diagnosisEvidence.historicalTitle"),
          description: td("diagnosisEvidence.historicalDescription"),
          color: "var(--accent)",
          background: "var(--accent-bg)",
          Icon: Clock,
        }
      : {
          title: td("diagnosisEvidence.blockedTitle"),
          description: td("diagnosisEvidence.blockedDescription"),
          color: "var(--sentiment-negative)",
          background: "var(--sentiment-negative-bg)",
          Icon: ShieldAlert,
        };

  // Top comments — merge positive and negative
  const allTopComments = [
    ...(topComments?.most_positive ?? []).map(c => ({ ...c, _type: "positive" })),
    ...(topComments?.most_negative ?? []).map(c => ({ ...c, _type: "negative" })),
  ].slice(0, 4);

  const heatmapMax = hasAnalyzedData && heatmapData ? Math.max(...heatmapData.flat(), 0) : 0;

  const describeTrend = (
    series: string,
    fact: ReturnType<typeof getTrendFact>,
  ) => {
    if (!fact) return "";
    const values = {
      series,
      delta: formatChartNumber(Math.abs(fact.delta), locale),
      unit: tca("units.scoreShort"),
      from: formatChartNumber(fact.from, locale),
      to: formatChartNumber(fact.to, locale),
      start: fact.start,
      end: fact.end,
    };
    if (fact.start === fact.end) {
      return tca("singlePoint", {
        series,
        value: values.to,
        unit: tca("units.scoreShort"),
        period: fact.end,
      });
    }
    if (fact.direction === "up") return tca("trendUp", values);
    if (fact.direction === "down") return tca("trendDown", values);
    return tca("trendStable", values);
  };

  const scoreTrendFact = getTrendFact(scoreTrendData, point => point.date, point => point.score);
  const scoreTrendSummary = describeTrend(td("avgGeneral"), scoreTrendFact);
  const networkTrendFacts = platformKeys
    .map((platform) => ({
      platform,
      fact: getTrendFact(
        scoreTrendByNetwork,
        row => String(row.date),
        row => typeof row[platform] === "number" ? Number(row[platform]) : null,
      ),
    }))
    .filter((item): item is { platform: string; fact: NonNullable<ReturnType<typeof getTrendFact>> } => item.fact != null);
  const primaryNetworkTrend = [...networkTrendFacts]
    .sort((a, b) => Math.abs(b.fact.delta) - Math.abs(a.fact.delta))[0] ?? null;
  const networkTrendSummary = primaryNetworkTrend
    ? describeTrend(platformLabel(primaryNetworkTrend.platform), primaryNetworkTrend.fact)
    : "";
  const volumePeak = getPeakFact(volumeTemporalData, point => point.date, point => point.volume);
  const scoreTemporalFact = getTrendFact(scoreTemporalData, point => point.date, point => point.score);
  const sentimentTotals = temporalData.reduce(
    (totals, point) => ({
      positivo: totals.positivo + point.positivo,
      neutro: totals.neutro + point.neutro,
      negativo: totals.negativo + point.negativo,
    }),
    { positivo: 0, neutro: 0, negativo: 0 },
  );
  const dominantSentiment = (Object.entries(sentimentTotals) as Array<[keyof typeof sentimentTotals, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const totalSentimentCount = sentimentTotals.positivo + sentimentTotals.neutro + sentimentTotals.negativo;
  const dominantSentimentPct = dominantSentiment && totalSentimentCount > 0
    ? Math.round((dominantSentiment[1] / totalSentimentCount) * 100)
    : 0;
  const sentimentLabels = {
    positivo: tc("positive"),
    neutro: tc("neutral"),
    negativo: tc("negative"),
  };
  const engagementPeak = getPeakFact(engagementData, point => point.hour, point => point.volume);
  const heatmapRows = hasAnalyzedData ? heatmapData?.flatMap((row, dayIndex) =>
    row.map((value, hourIndex) => ({
      day: heatmapDays[dayIndex] ?? String(dayIndex + 1),
      hour: `${heatmapHours[hourIndex] ?? String(hourIndex * 2).padStart(2, "0")}h`,
      value,
    })),
  ) ?? [] : [];
  const heatmapPeak = getPeakFact(heatmapRows, row => `${row.day} ${row.hour}`, row => row.value);

  // Heatmap color helper
  function getHeatColor(value: number) {
    if (value <= 0 || heatmapMax <= 0) return t.primaryBg;
    const intensity = Math.log1p(value) / Math.log1p(heatmapMax);
    if (intensity >= 0.82) return t.primary;
    if (intensity >= 0.62) return t.primaryMuted;
    if (intensity >= 0.38) return t.primaryFaint;
    if (intensity >= 0.16) return t.textXfaint;
    return t.primaryBg;
  }

  // Health report prompt update
  async function handleSavePrompt() {
    if (reportMode !== "current") return;
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
    if (reportMode === "blocked") {
      if (reportAction) router.push(reportAction.href);
      return;
    }
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
          <span data-testid="dashboard-last-success-badge" data-last-success-at={latestSuccessfulSync ?? "never"}>
            <Badge variant={lastSuccessBadgeVariant} dot>{td("lastSuccess", { time: timeSince(latestSuccessfulSync, timeSinceLabels) })}</Badge>
          </span>
          <Button variant="ghost" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />} onClick={handleRefresh} disabled={refreshing}>{refreshing ? "..." : td("refresh")}</Button>
        </div>
      </div>

      {!loading && <CountFunnel snapshot={summary?.snapshot ?? null} surface="dashboard" />}
      <ProvenanceDrawer snapshot={summary?.snapshot ?? null} open={provenanceOpen} onClose={closeProvenance} />

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
            data-testid="dashboard-reputation-summary"
            data-evidence-state={summaryLanguageMode}
            data-snapshot-health={summary?.snapshot?.health ?? "unknown"}
            className="lg:col-span-7 rounded-2xl p-5 md:p-6"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--primary-bg) 62%, var(--bg-card)) 0%, color-mix(in srgb, var(--accent-bg) 76%, var(--bg-card)) 100%)",
              border: "1px solid color-mix(in srgb, var(--primary) 24%, var(--border))",
              boxShadow: "0 16px 42px -28px var(--primary)",
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Badge variant={repBadge.variant} dot>{repBadge.label}</Badge>
                <h2 className="mt-4" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.45rem", fontWeight: 850, color: "var(--text-primary)", lineHeight: 1.18 }}>
                  {diagnosticTitle}
                </h2>
                <p className="mt-2" style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  {sentimentDriver} {trendNarrative}
                </p>
              </div>
              <button
                ref={provenanceTriggerRef}
                type="button"
                  data-testid="dashboard-score-provenance-trigger"
                  aria-label={snapshotProvenance(hasAnalyzedData ? "open" : "openUnavailable")}
                disabled={!summary?.snapshot}
                onClick={() => setProvenanceOpen(true)}
                className="group shrink-0 self-center rounded-2xl p-1 text-center disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
              >
                <span className="relative block h-28 w-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transition-transform group-hover:scale-[1.03]">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="color-mix(in srgb, var(--primary) 16%, var(--bg-card))" strokeWidth="7" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={hasAnalyzedData ? (score >= 7 ? t.sentimentPositive : score >= 4 ? t.primary : t.sentimentNegative) : t.primary} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${scorePercent * 2.64} ${264 - scorePercent * 2.64}`} />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 850, color: "var(--text-primary)" }}>{!hasAnalyzedData ? "\u2014" : score.toFixed(1)}</span>
                    <span style={{ fontSize: "0.6rem", color: "var(--text-faint)" }}>{td("outOf10")}</span>
                  </span>
                </span>
                <span className="mt-1 inline-flex rounded-full px-2 py-1" style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)", fontSize: "0.62rem", fontWeight: 800 }}>
                    {snapshotProvenance(hasAnalyzedData ? "openShort" : "openShortUnavailable")}
                </span>
              </button>
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
            <DashboardMetricTile icon={<GlassHeartIcon size={34} />} value={totalPosts.toLocaleString("pt-BR")} label={td("monitoredPosts")} sub={hasAnalyzedData ? td("diagnosticHero.postsSub") : td("diagnosticHero.postsWithoutAnalysisSub")} accent="var(--secondary)" />
            <DashboardMetricTile icon={<GlassLinkIcon size={34} />} value={connectedProfiles} label={td("connectedProfiles")} sub={td("diagnosticHero.profilesSub")} accent="var(--accent)" />
            <DashboardMetricTile icon={<GlassZapIcon size={34} />} value={hasAnalyzedData ? "8" : "—"} label={td("trackedEmotions")} sub={hasAnalyzedData ? td("diagnosticHero.emotionsSub") : td("diagnosticHero.emotionsWithoutAnalysisSub")} accent="var(--primary)" />
            <div className="col-span-2 rounded-2xl p-4 md:p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 8px -2px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 12 }}>{td("connectedPlatforms")}</p>
              {connections.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[...connections].sort((a, b) => {
                    const order: Record<string, number> = { instagram: 0, youtube: 1, tiktok: 2, twitter: 3 };
                    return (order[a.platform] ?? 9) - (order[b.platform] ?? 9);
                  }).map(c => (
                    <Link
                      key={c.id}
                      href={`/dashboard/profile/${c.id}`}
                      data-testid={`dashboard-connected-profile-${c.id}`}
                      className="flex items-center gap-2 p-2 rounded-xl transition-colors group"
                      style={{ backgroundColor: "var(--bg-subtle)" }}
                    >
                      <GlassSocialIcon platform={c.platform.toLowerCase()} size={28} />
                      <div className="min-w-0 text-left">
                        <p className="truncate" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{platformLabel(c.platform)}</p>
                        <p className="truncate" style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{c.username.startsWith("@") ? c.username : `@${c.username}`}</p>
                        <span className="mt-1 block"><PlatformCapabilityBadge platform={c.platform} /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.78rem", color: "var(--text-faint)", textAlign: "center", padding: "12px 0" }}>{td("noPlatformConnected")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <PlatformCapabilityMatrix surface="dashboard" />

      {/* ═══ DIAGNOSIS ═══ */}
      <div data-testid="ai-diagnosis-section" className="grid grid-cols-1 gap-4">
        <Section
          title={td("aiDiagnosis")}
          subtitle={td("diagnosisEvidence.dataPeriod", { period: reportPeriod })}
          action={healthReport && reportMode !== "blocked" ? (
            <div className="flex items-center gap-2">
              {reportMode === "current" && (
                <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setEditingPrompt(!editingPrompt)}>
                  {td("editPrompt")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingPrompt ? "animate-spin" : ""}`} strokeWidth={1.5} />}
                onClick={handleRefreshReport}
              >
                {reportMode === "historical_only"
                  ? healthReport.report_text
                    ? td("diagnosisEvidence.refreshHistorical")
                    : td("diagnosisEvidence.generateHistorical")
                  : td("refreshReport")}
              </Button>
            </div>
          ) : null}
        >
          {editingPrompt && reportMode === "current" && (
            <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{td("agentPrompt")}</p>
                <button type="button" aria-label={tc("close")} onClick={() => setEditingPrompt(false)}>
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
            {!healthReportLoading && healthReport && (
              <section
                data-testid="diagnosis-evidence"
                data-snapshot-id={reportBasis?.snapshot_id ?? "none"}
                data-language-mode={reportBasis?.language_mode ?? "unavailable"}
                data-recommendation-mode={reportMode}
                data-report-source={reportBasis?.source ?? "none"}
                role="status"
                aria-label={reportEvidence.title}
                className="rounded-2xl p-4 md:p-5"
                style={{ backgroundColor: reportEvidence.background, border: `1px solid color-mix(in srgb, ${reportEvidence.color} 32%, var(--border))` }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--bg-card)" }}>
                      <reportEvidence.Icon aria-hidden="true" className="h-5 w-5" style={{ color: reportEvidence.color }} />
                    </div>
                    <div>
                      <h4 style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", fontWeight: 700 }}>
                        {reportEvidence.title}
                      </h4>
                      <p className="mt-1 max-w-3xl" style={{ color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                        {reportEvidence.description}
                      </p>
                    </div>
                  </div>
                  {reportMode !== "current" && reportAction && (
                    <Link
                      href={reportAction.href}
                      className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
                    >
                      {reportActionLabel}
                    </Link>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "color-mix(in srgb, var(--border) 75%, transparent)" }}>
                  {[
                    { label: td("diagnosisEvidence.observedData"), value: reportPeriod },
                    { label: td("diagnosisEvidence.coverageLabel"), value: reportCoverage },
                    { label: td("diagnosisEvidence.generatedLabel"), value: reportGeneratedAt },
                    { label: td("diagnosisEvidence.referenceLabel"), value: reportReference },
                  ].map(item => (
                    <div key={item.label}>
                      <dt className="text-[0.62rem] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-faint)" }}>{item.label}</dt>
                      <dd className="mt-1 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {healthReport.has_new_data && healthReport.report_text && healthReport.generated_at && (
                  <p className="mt-4 rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}>
                    {td("diagnosisEvidence.newerData")}
                  </p>
                )}
              </section>
            )}

            {loading || healthReportLoading || loadingPrompt ? (
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
              <SafeReportText text={healthReport.report_text} />
            ) : (
              <p style={{ fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-faint)" }}>
                {reportMode === "blocked"
                  ? td("diagnosisEvidence.blockedBody")
                  : reportMode === "historical_only"
                    ? td("diagnosisEvidence.historicalNotGenerated")
                    : td("noDiagnosisAvailable")}
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
        title={reputationSectionCopy.title}
        description={reputationSectionCopy.description}
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
            <>
              <div data-chart-visual="dashboard-score-trend">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart id="dash-score-area" data={scoreTrendData} margin={CHART_MARGIN} accessibilityLayer={false}>
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
              </div>
              <ChartTextAlternative
                chartId="dashboard-score-trend"
                title={td("scoreTrend")}
                summary={scoreTrendSummary}
                period={getPeriodRange(scoreTrendData, point => point.date, tc("notAvailable"))}
                unit={tca("units.score")}
                columns={[
                  { key: "period", label: tca("columns.period") },
                  { key: "score", label: tca("columns.score"), numeric: true },
                ]}
                rows={scoreTrendData.map(point => ({
                  period: point.date,
                  score: formatChartNumber(point.score, locale),
                }))}
              />
            </>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noTrendData")}</p>
          )}
        </Section>
        <Section title={td("scoreByNetwork")} subtitle={td("platformComparison")}>
          {loading ? <ChartSkeleton /> : scoreTrendByNetwork.length > 0 ? (
            <>
              <div data-chart-visual="dashboard-score-by-network">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart id="dash-network-line" data={scoreTrendByNetwork} margin={CHART_MARGIN} accessibilityLayer={false}>
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
              </div>
              <ChartTextAlternative
                chartId="dashboard-score-by-network"
                title={td("scoreByNetwork")}
                summary={networkTrendSummary}
                period={getPeriodRange(scoreTrendByNetwork, row => String(row.date), tc("notAvailable"))}
                unit={tca("units.score")}
                columns={[
                  { key: "period", label: tca("columns.period") },
                  ...platformKeys.map(platform => ({
                    key: platform,
                    label: platformLabel(platform),
                    numeric: true,
                  })),
                ]}
                rows={scoreTrendByNetwork.map(row => ({
                  period: String(row.date),
                  ...Object.fromEntries(platformKeys.map(platform => [
                    platform,
                    typeof row[platform] === "number" ? formatChartNumber(Number(row[platform]), locale) : null,
                  ])),
                }))}
              />
            </>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noComparativeData")}</p>
          )}
        </Section>
      </div>

      {/* ═══ RADAR + WORD CLOUD ═══ */}
      <DashboardQuestionHeader
        eyebrow={td("sections.drivers.eyebrow")}
        title={driversSectionCopy.title}
        description={driversSectionCopy.description}
      />

      <div className="space-y-4">
        {loading ? (
          <Section title={td("emotionRadar")}>
            <ChartSkeleton height={300} />
          </Section>
        ) : radarData.length > 0 ? (
          <EmotionRadarCard title={td("emotionRadar")} data={radarData} chartId="dashboard-emotion-radar" />
        ) : (
          <Section title={td("emotionRadar")}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noEmotionData")}</p>
          </Section>
        )}
        <Section title={td("wordCloud")} subtitle={td("wordCloudSubtitle")}>
          {loading ? <ChartSkeleton height={180} /> : (
            <WordCloudChart
              topics={summary?.word_frequency || null}
              maxWords={25}
              height={240}
              title={td("wordCloud")}
              chartId="dashboard-word-cloud"
            />
          )}
        </Section>
      </div>

      {/* ═══ HEATMAP ═══ */}
      <Section title={td("heatmapTitle")} subtitle={td("heatmapSubtitle")}>
        {loading ? <ChartSkeleton height={220} /> : hasAnalyzedData && heatmapData && heatmapData.length > 0 ? (
          <>
            <div data-chart-visual="dashboard-activity-heatmap" className="overflow-x-auto">
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
            <ChartTextAlternative
              chartId="dashboard-activity-heatmap"
              title={td("heatmapTitle")}
              summary={heatmapPeak ? tca("peak", {
                value: formatChartNumber(heatmapPeak.value, locale, 0),
                unit: heatmapPeak.value === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
                period: heatmapPeak.period,
              }) : ""}
              period={`${heatmapDays[0]} — ${heatmapDays[heatmapDays.length - 1]} · ${heatmapHours[0]}h — ${heatmapHours[heatmapHours.length - 1]}h`}
              unit={tca("units.comments")}
              columns={[
                { key: "day", label: tca("columns.day") },
                { key: "hour", label: tca("columns.hour") },
                { key: "value", label: tca("columns.comments"), numeric: true },
              ]}
              rows={heatmapRows.map(row => ({ ...row, value: formatChartNumber(row.value, locale, 0) }))}
            />
          </>
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
          <div data-chart-visual="dashboard-temporal-volume">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart id="dash-temporal-volume" data={volumeTemporalData} margin={CHART_MARGIN} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.primaryBg} vertical={false} />
                <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                <Bar dataKey="volume" name={td("volume")} fill={t.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : timeRange === "Score" && scoreTemporalData.length > 0 ? (
          <div data-chart-visual="dashboard-temporal-score">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart id="dash-temporal-score" data={scoreTemporalData} margin={CHART_MARGIN} accessibilityLayer={false}>
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
          </div>
        ) : timeRange === "Sentimento" && temporalData.length > 0 && hasSentimentTemporalVolume ? (
          sentimentTemporalMode === "stacked100" ? (
            <div data-chart-visual="dashboard-temporal-sentiment">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart id="dash-temporal-bar-stacked" data={temporalPctData} barGap={2} margin={CHART_MARGIN} accessibilityLayer={false}>
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
            </div>
          ) : (
            <div data-chart-visual="dashboard-temporal-sentiment">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart id="dash-temporal-bar-grouped" data={temporalData} barGap={4} margin={CHART_MARGIN} accessibilityLayer={false}>
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
            </div>
          )
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)", textAlign: "center", padding: "60px 0" }}>{td("noTemporalData")}</p>
        )}
        {!loading && timeRange === "Volume" && volumeTemporalData.length > 0 && (
          <ChartTextAlternative
            chartId="dashboard-temporal-volume"
            title={`${td("temporalDistribution")} — ${td("volume")}`}
            summary={volumePeak ? tca("peak", {
              value: formatChartNumber(volumePeak.value, locale, 0),
              unit: volumePeak.value === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
              period: volumePeak.period,
            }) : ""}
            period={getPeriodRange(volumeTemporalData, point => point.date, tc("notAvailable"))}
            unit={tca("units.comments")}
            columns={[
              { key: "date", label: tca("columns.date") },
              { key: "volume", label: tca("columns.comments"), numeric: true },
            ]}
            rows={volumeTemporalData.map(point => ({
              date: point.date,
              volume: formatChartNumber(point.volume, locale, 0),
            }))}
          />
        )}
        {!loading && timeRange === "Score" && scoreTemporalData.length > 0 && (
          <ChartTextAlternative
            chartId="dashboard-temporal-score"
            title={`${td("temporalDistribution")} — ${tc("score")}`}
            summary={describeTrend(tc("score"), scoreTemporalFact)}
            period={getPeriodRange(scoreTemporalData, point => point.date, tc("notAvailable"))}
            unit={tca("units.score")}
            columns={[
              { key: "date", label: tca("columns.date") },
              { key: "score", label: tca("columns.score"), numeric: true },
            ]}
            rows={scoreTemporalData.map(point => ({
              date: point.date,
              score: formatChartNumber(point.score, locale),
            }))}
          />
        )}
        {!loading && timeRange === "Sentimento" && temporalData.length > 0 && hasSentimentTemporalVolume && dominantSentiment && (
          <ChartTextAlternative
            chartId="dashboard-temporal-sentiment"
            title={`${td("temporalDistribution")} — ${td("sentiment")}`}
            summary={sentimentTemporalMode === "stacked100"
              ? tca("dominantPercent", {
                  category: sentimentLabels[dominantSentiment[0]],
                  value: formatChartNumber(dominantSentimentPct, locale, 0),
                })
              : tca("dominant", {
                  category: sentimentLabels[dominantSentiment[0]],
                  value: formatChartNumber(dominantSentiment[1], locale, 0),
                  unit: dominantSentiment[1] === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
                })}
            period={getPeriodRange(temporalData, point => point.date, tc("notAvailable"))}
            unit={sentimentTemporalMode === "stacked100" ? tca("units.percentage") : tca("units.comments")}
            columns={[
              { key: "date", label: tca("columns.date") },
              { key: "negative", label: tc("negative"), numeric: true },
              { key: "neutral", label: tc("neutral"), numeric: true },
              { key: "positive", label: tc("positive"), numeric: true },
            ]}
            rows={(sentimentTemporalMode === "stacked100" ? temporalPctData : temporalData).map(point => ({
              date: point.date,
              negative: sentimentTemporalMode === "stacked100" ? `${point.negativo}%` : formatChartNumber(point.negativo, locale, 0),
              neutral: sentimentTemporalMode === "stacked100" ? `${point.neutro}%` : formatChartNumber(point.neutro, locale, 0),
              positive: sentimentTemporalMode === "stacked100" ? `${point.positivo}%` : formatChartNumber(point.positivo, locale, 0),
            }))}
          />
        )}
      </Section>

      {/* ═══ ENGAGEMENT CURVE ═══ */}
      <Section title={td("engagementPeak")} subtitle={td("engagementSubtitle")}>
        {loading ? <ChartSkeleton height={180} /> : engagementData.length > 0 ? (
          <>
            <div data-chart-visual="dashboard-engagement-peak">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart id="dash-engagement-area" data={engagementData} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <XAxis dataKey="hour" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Bar dataKey="volume" fill={t.primaryMuted} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartTextAlternative
              chartId="dashboard-engagement-peak"
              title={td("engagementPeak")}
              summary={engagementPeak ? tca("peak", {
                value: formatChartNumber(engagementPeak.value, locale, 0),
                unit: engagementPeak.value === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
                period: engagementPeak.period,
              }) : ""}
              period={`${engagementData[0]?.hour} — ${engagementData[engagementData.length - 1]?.hour}`}
              unit={tca("units.comments")}
              columns={[
                { key: "hour", label: tca("columns.hour") },
                { key: "volume", label: tca("columns.comments"), numeric: true },
              ]}
              rows={engagementData.map(point => ({
                hour: point.hour,
                volume: formatChartNumber(point.volume, locale, 0),
              }))}
            />
          </>
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
            }).map(profile => {
              const dataHealth = profileSnapshotHealth(summary?.snapshot?.profiles, profile.id)
                ?? summary?.snapshot?.health
                ?? "never_synced";
              const dataHealthTone = healthTone(dataHealth);
              return (
              <Link
                key={profile.id}
                href={`/dashboard/profile/${profile.id}`}
                data-testid={`dashboard-profile-health-${profile.id}`}
                data-connection-status={profile.status}
                data-health-state={dataHealth}
                className="rounded-xl p-5 transition-colors cursor-pointer group"
                style={{ backgroundColor: "var(--bg-subtle)" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <GlassSocialIcon platform={profile.platform.toLowerCase()} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{profile.username.startsWith("@") ? profile.username : `@${profile.username}`}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{platformLabel(profile.platform)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { l: tc("followers"), v: formatNumber(profile.followers_count) },
                    { l: td("registrationStatus"), v: profile.status === "active" ? connectionRegistration("connected") : connectionRegistration("needsAttention") },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.v}</p>
                      <p style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dataHealthTone }} />
                    <span style={{ fontSize: "0.72rem", color: dataHealthTone, fontWeight: 650 }}>
                      {connectionHealth(`${dataHealth}.label`)}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 transition-colors" style={{ color: "var(--text-faint)" }} />
                </div>
              </Link>
              );
            })}
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
            {recentPosts.filter(p => p.content_text && p.content_text !== "null").map((post, i) => {
              const postTitle = post.content_text!.length > 60 ? post.content_text!.slice(0, 60) + "..." : post.content_text!;
              const thumbSrc = post.thumbnail_url ? `/api/v1/posts/thumbnail?url=${encodeURIComponent(post.thumbnail_url)}` : null;
              return (
                <Link
                  key={post.id || i}
                  href={`/dashboard/post/${post.id}?from=dashboard&connection_id=${post.connection_id}`}
                  data-testid={`dashboard-post-${post.id}`}
                  className="flex items-center gap-3 md:gap-4 p-3 md:p-3.5 rounded-xl cursor-pointer transition-colors group"
                  style={{ backgroundColor: "transparent" }}
                >
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
                </Link>
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
