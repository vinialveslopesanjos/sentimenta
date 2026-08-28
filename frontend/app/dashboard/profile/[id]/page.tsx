"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft, Heart, MessageCircle, Eye, RefreshCw, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, LineChart, Line,
} from "recharts";

import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { StatCard } from "@/components/ds/StatCard";
import { Section } from "@/components/ds/Section";
import { SentimentBar } from "@/components/ds/SentimentBar";
import { chartColors, getScoreStyle } from "@/components/ds/tokens";
import { useTheme } from "@/components/ThemeContext";
import { Heatmap, FeaturedComments, CommentsTable } from "@/components/SocialSharedSections";
import { toast } from "sonner";
import PreflightModal from "@/components/PreflightModal";
import { useActiveRuns } from "@/components/ActiveRunsContext";
import type { PreflightEstimate } from "@/lib/types";
import type { CommentRow } from "@/components/SocialSharedSections";
import {
  GapAnalysis, PostLifecycle, AmbassadorsVsDetractors, TopicTreemap,
  SmartAlerts, TopicEmotionHeatmap,
} from "@/components/AdvancedCharts";
import { DemographicsOverview, SentimentByAge, SentimentByGender, EmotionsByGender } from "@/components/DemographicsCharts";
import EmotionRadarCard from "@/components/EmotionRadarCard";
import { GlassHeartIcon, GlassZapIcon, GlassPeopleIcon, GlassShieldIcon } from "@/components/GlassIcons";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import { SurfaceEvidenceNotice } from "@/components/data/SurfaceEvidenceNotice";
import { CountFunnel } from "@/components/data/CountFunnel";
import { ProvenanceDrawer } from "@/components/data/ProvenanceDrawer";
import WordCloudChart from "@/components/charts/WordCloudChart";
import { ChartTextAlternative } from "@/components/charts/ChartTextAlternative";
import YouTubeStats from "@/components/YouTubeStats";

import { getToken } from "@/lib/auth";
import { formatChartNumber, getPeakFact, getPeriodRange, getTrendFact } from "@/lib/chartAccessibility";
import {
  dashboardApi, connectionsApi, postsApi, commentsApi, demographicsApi, authApi,
} from "@/lib/api";
import type {
  ConnectionDashboard, TrendResponse, TrendsDetailedResponse,
  CommentWithAnalysis, PostSummary,
} from "@/lib/types";

const CHART_MARGIN = { top: 8, right: 4, bottom: 0, left: 0 };
const COMPACT_X_AXIS = {
  padding: { left: 0, right: 0 },
  interval: "preserveStartEnd" as const,
  minTickGap: 8,
};

// ─── helpers ───────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0).replace(/\.0$/, "")}.${String(n % 1000).padStart(3, "0").slice(0, 3)}`.replace(/\.?0+$/, "");
  return String(n);
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan.", "Fev.", "Mar.", "Abr.", "Mai.", "Jun.", "Jul.", "Ago.", "Set.", "Out.", "Nov.", "Dez."];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function getSentimentLabel(score: number): "Positivo" | "Neutro" | "Negativo" {
  if (score >= 7) return "Positivo";
  if (score >= 4) return "Neutro";
  return "Negativo";
}

function getPlatformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    twitter: "X / Twitter",
  };
  return map[platform.toLowerCase()] || platform;
}

function ProfileQuestionGroup({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 md:space-y-5 ui-reveal">
      <div className="max-w-3xl">
        <p
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "var(--primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-1"
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "1.12rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>
        <p className="mt-1" style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ProfileQuestionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="pt-3 max-w-3xl ui-reveal">
      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: "var(--primary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-1"
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "1.12rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      <p className="mt-1" style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}

// ─── time range to days mapping ────────────
const timeRangeDays: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1a": 365,
  "Tudo": 0,
};

// ─── Component ─────────────────────────────

export default function ProfileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { t } = useTheme();
  const locale = useLocale();
  const ti = useTranslations("profile");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const tca = useTranslations("charts.accessibility");
  const snapshotProvenance = useTranslations("snapshot.provenance");

  // ── state ──
  const [activeTab, setActiveTab] = useState("Volume");
  const [timeRange, setTimeRange] = useState("Tudo");
  const [granularity, setGranularity] = useState("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const provenanceTriggerRef = useRef<HTMLButtonElement>(null);
  const [postSort, setPostSort] = useState<"recent" | "score">("recent");
  const [postLimit, setPostLimit] = useState<number>(10);
  const [sentimentTemporalMode, setSentimentTemporalMode] = useState<"grouped" | "stacked100">("grouped");

  const closeProvenance = useCallback(() => {
    setProvenanceOpen(false);
    requestAnimationFrame(() => provenanceTriggerRef.current?.focus());
  }, []);

  // ── data ──
  const [dashboard, setDashboard] = useState<ConnectionDashboard | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [trendsDetailed, setTrendsDetailed] = useState<TrendsDetailedResponse | null>(null);
  const [comments, setComments] = useState<CommentWithAnalysis[]>([]);
  const [gapData, setGapData] = useState<{ posts: Array<{ id: string; title: string; engagement: number; sentiment: number; comments: number }> } | null>(null);
  const [ambassadorsData, setAmbassadorsData] = useState<{
    ambassadors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string }>;
    detractors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string }>;
  } | null>(null);
  const [topicEmotionData, setTopicEmotionData] = useState<{
    topics: string[];
    emotions: string[];
    matrix: number[][];
  } | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [connectionInfo, setConnectionInfo] = useState<{
    platform: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
    followers_count: number;
    status: string;
  } | null>(null);

  // Demographics
  const [demoOverview, setDemoOverview] = useState<{
    gender_distribution: Record<string, number>;
    age_distribution: Record<string, number>;
    top_locations: Array<{ country: string; country_code: string; count: number }>;
    state_distribution: Array<{ state: string; count: number }>;
    enrichment_coverage: { total_commenters: number; enriched: number; coverage_pct: number };
  } | null>(null);
  const [sentimentByAge, setSentimentByAge] = useState<Array<{ band: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }> | null>(null);
  const [sentimentByGender, setSentimentByGender] = useState<Array<{ gender: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }> | null>(null);
  const [emotionsByGender, setEmotionsByGender] = useState<Array<{ gender: string; emotions: Record<string, number> }> | null>(null);

  // YouTube-specific
  const [youtubeStats, setYoutubeStats] = useState<{
    channel_stats: { subscribers: number; total_views: number; total_videos: number; avg_views_per_video: number; avg_engagement_rate: number };
    growth: Array<{ date: string; subscribers: number; views: number }>;
    top_videos: Array<{ title: string; views: number; likes: number; comments: number; engagement_rate: number; published_at: string | null }>;
  } | null>(null);

  // ── fetch all data ──
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        dashRes,
        trendsRes,
        trendsDetailedRes,
        commentsRes,
        gapRes,
        ambRes,
        matrixRes,
        connectionsRes,
        demoOverviewRes,
        sentByAgeRes,
        sentByGenderRes,
        emotByGenderRes,
        meRes,
      ] = await Promise.allSettled([
        dashboardApi.connectionDashboard(token, id),
        dashboardApi.trends(token, { connection_id: id, granularity: "week", days: 0 }),
        dashboardApi.trendsDetailed(token, { connection_id: id, granularity: "week", days: 0 }),
        commentsApi.list(token, { connection_id: id, limit: 200 }),
        dashboardApi.gapAnalysis(token, id),
        dashboardApi.ambassadorsDetractors(token, id),
        dashboardApi.topicEmotionMatrix(token, id),
        connectionsApi.list(token),
        demographicsApi.overview(token, id),
        demographicsApi.sentimentByAge(token, id),
        demographicsApi.sentimentByGender(token, id),
        demographicsApi.emotionsByGender(token, id),
        authApi.me(token),
      ]);

      if (dashRes.status === "fulfilled") setDashboard(dashRes.value);
      else console.error("Dashboard fetch failed:", dashRes.reason);

      if (trendsRes.status === "fulfilled") setTrends(trendsRes.value);
      if (trendsDetailedRes.status === "fulfilled") setTrendsDetailed(trendsDetailedRes.value);
      if (commentsRes.status === "fulfilled") setComments(commentsRes.value.items);
      if (gapRes.status === "fulfilled") setGapData(gapRes.value);
      if (ambRes.status === "fulfilled") setAmbassadorsData(ambRes.value);
      if (matrixRes.status === "fulfilled") setTopicEmotionData(matrixRes.value);

      if (demoOverviewRes.status === "fulfilled") setDemoOverview(demoOverviewRes.value);
      if (sentByAgeRes.status === "fulfilled") setSentimentByAge(sentByAgeRes.value);
      if (sentByGenderRes.status === "fulfilled") setSentimentByGender(sentByGenderRes.value);
      if (emotByGenderRes.status === "fulfilled") setEmotionsByGender(emotByGenderRes.value);
      if (meRes.status === "fulfilled") setUserPlan(meRes.value.plan || "free");

      if (connectionsRes.status === "fulfilled") {
        const conn = connectionsRes.value.find((c) => c.id === id);
        if (conn) {
          setConnectionInfo({
            platform: conn.platform,
            username: conn.username,
            display_name: conn.display_name,
            profile_image_url: conn.profile_image_url,
            followers_count: conn.followers_count,
            status: conn.status,
          });

          // Fetch YouTube-specific stats if platform is youtube
          if (conn.platform === "youtube") {
            dashboardApi.youtubeStats(token, id)
              .then((ytData) => setYoutubeStats(ytData))
              .catch(() => { /* silently fail */ });
          }
        }
      }

      if (dashRes.status === "rejected") {
        setError(ti("errorLoading"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ti("errorUnknown"));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── re-fetch only trends when timeRange changes (after initial load) ──
  const fetchTrends = useCallback(async () => {
    const token = getToken();
    if (!token || loading) return;
    const days = timeRangeDays[timeRange] ?? 0;
    try {
      const [tr, trd] = await Promise.all([
        dashboardApi.trends(token, { connection_id: id, granularity, days }),
        dashboardApi.trendsDetailed(token, { connection_id: id, granularity, days }),
      ]);
      setTrends(tr);
      setTrendsDetailed(trd);
    } catch { /* silently fail, keep old data */ }
  }, [id, timeRange, granularity, loading]);

  useEffect(() => {
    if (!loading) fetchTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, granularity]);

  // ── derived data ──
  const hasDemographics = !["free", "starter"].includes(userPlan);
  const hasEmotionsByGender = hasDemographics && !!emotionsByGender && emotionsByGender.length > 0;
  const platform = connectionInfo?.platform || dashboard?.connection?.platform || "instagram";
  const platformLabel = getPlatformLabel(platform);
  const username = connectionInfo?.username || dashboard?.connection?.username || "";
  const followersCount = connectionInfo?.followers_count || dashboard?.connection?.followers_count || 0;
  const followingCount = dashboard?.connection?.following_count || 0;
  const mediaCount = dashboard?.connection?.media_count || 0;
  const connectionStatus = connectionInfo?.status || dashboard?.connection?.status || "";

  const score = dashboard?.avg_score ?? dashboard?.weighted_avg_score ?? 0;
  const totalComments = dashboard?.total_comments ?? 0;
  const totalAnalyzed = dashboard?.total_analyzed ?? 0;
  const profileSnapshot = dashboard?.snapshot ?? null;
  const snapshotValidCount = profileSnapshot?.valid_count;
  const hasProfileEvidence = totalAnalyzed > 0 && (snapshotValidCount == null || snapshotValidCount > 0);
  const hasLegacyProfileEvidence = !profileSnapshot && hasProfileEvidence;
  const profileLanguageMode = profileSnapshot?.language_policy.mode
    ?? (hasLegacyProfileEvidence ? "historical" : "unavailable");
  const profileNeverSynced = profileSnapshot?.health === "never_synced";
  const profileConnectedWithoutAnalysis = !hasProfileEvidence && profileSnapshot?.health === "healthy";
  const profileEvidenceIsCurrent = profileLanguageMode === "current";
  const profileEvidenceIsHistorical = profileLanguageMode === "historical" || profileLanguageMode === "qualified";

  useEffect(() => {
    if (!hasProfileEvidence && activeTab !== "Volume") {
      setActiveTab("Volume");
    }
  }, [activeTab, hasProfileEvidence]);

  const sentDist = dashboard?.sentiment_distribution;
  const positive = sentDist?.positive ?? 0;
  const neutral = sentDist?.neutral ?? 0;
  const negative = sentDist?.negative ?? 0;
  const totalSent = positive + neutral + negative;
  const posPct = totalSent > 0 ? Math.round((positive / totalSent) * 100) : 0;
  const neuPct = totalSent > 0 ? Math.round((neutral / totalSent) * 100) : 0;
  const negPct = totalSent > 0 ? 100 - posPct - neuPct : 0;

  const engagementTotals = dashboard?.engagement_totals;
  const totalLikes = engagementTotals?.total_likes ?? 0;
  const totalViews = engagementTotals?.total_views ?? 0;
  const totalCommentsEng = engagementTotals?.total_comments ?? totalComments;
  const engagementRate = followersCount > 0 ? ((totalCommentsEng / followersCount) * 100).toFixed(2) : "0.00";

  const polarizationLabel = hasProfileEvidence
    ? negPct >= 40
      ? ti("polarizationLevels.high")
      : negPct >= 25
        ? ti("polarizationLevels.moderate")
        : ti("polarizationLevels.low")
    : ti("notAvailable");
  const polarizationSub = hasProfileEvidence
    ? `${negPct}% neg. vs ${posPct}% pos.`
    : ti("notAvailableWithoutAnalysis");

  // ── emotions for radar ──
  const radarData = useMemo(() => {
    if (!hasProfileEvidence || !dashboard?.emotions_distribution) return [];
    return Object.entries(dashboard.emotions_distribution).map(([emotion, value]) => ({
      emotion,
      value,
    }));
  }, [dashboard?.emotions_distribution, hasProfileEvidence]);

  // ── word cloud — handled by WordCloudChart component ──

  // ── temporal chart data ──
  const volumeData = useMemo(() => {
    if (!trends?.data_points) return [];
    return trends.data_points.map((dp) => ({
      date: shortDate(dp.period),
      volume: dp.total_comments,
    }));
  }, [trends]);

  const scoreTemporalData = useMemo(() => {
    if (!trends?.data_points) return [];
    return trends.data_points.reduce<Array<{ date: string; score: number }>>((points, dp) => {
      if (typeof dp.avg_score === "number" && Number.isFinite(dp.avg_score)) {
        points.push({
        date: shortDate(dp.period),
        score: dp.avg_score,
        });
      }
      return points;
    }, []);
  }, [trends]);

  const sentimentTemporalData = useMemo(() => {
    if (!trends?.data_points) return [];
    return trends.data_points.map((dp) => ({
      date: shortDate(dp.period),
      positivo: dp.positive,
      neutro: dp.neutral,
      negativo: dp.negative,
    }));
  }, [trends]);

  const sentimentTemporalPctData = useMemo(() => {
    return sentimentTemporalData.map((point) => {
      const total = point.positivo + point.neutro + point.negativo || 1;
      return {
        date: point.date,
        positivo: Math.round((point.positivo / total) * 100),
        neutro: Math.round((point.neutro / total) * 100),
        negativo: Math.round((point.negativo / total) * 100),
        total,
      };
    });
  }, [sentimentTemporalData]);

  const profileScorePercent = hasProfileEvidence ? Math.min(100, Math.max(0, score * 10)) : 0;
  const firstTrendScore = scoreTemporalData.find(point => point.score > 0)?.score ?? null;
  const lastTrendScore = scoreTemporalData.length > 0 ? scoreTemporalData[scoreTemporalData.length - 1].score : null;
  const profileTrendDelta = firstTrendScore != null && lastTrendScore != null ? Number((lastTrendScore - firstTrendScore).toFixed(1)) : null;
  const dominantProfileEmotion = hasProfileEvidence && [...radarData].sort((a, b) => b.value - a.value)[0]?.value > 0
    ? [...radarData].sort((a, b) => b.value - a.value)[0].emotion
    : td("diagnosticHero.noEmotion");
  const profileSentimentDriver = !hasProfileEvidence
    ? profileNeverSynced
      ? td("diagnosticHero.neverSyncedDriver")
      : profileConnectedWithoutAnalysis
        ? td("diagnosticHero.connectedEmptyDriver")
        : td("diagnosticHero.unavailableDriver", { saved: profileSnapshot?.saved_count ?? totalComments })
    : !profileEvidenceIsCurrent
      ? negPct >= 35
        ? td("diagnosticHero.historicalDriverNegative", { pct: negPct })
        : posPct >= 50
          ? td("diagnosticHero.historicalDriverPositive", { pct: posPct })
          : td("diagnosticHero.historicalDriverMixed", { positive: posPct, negative: negPct })
      : negPct >= 35
        ? td("diagnosticHero.driverNegative", { pct: negPct })
        : posPct >= 50
          ? td("diagnosticHero.driverPositive", { pct: posPct })
          : td("diagnosticHero.driverMixed", { positive: posPct, negative: negPct });
  const profileTrendNarrative = profileNeverSynced
    ? td("diagnosticHero.neverSyncedBoundary")
    : !profileEvidenceIsCurrent
      ? td("diagnosticHero.nonCurrentBoundary")
    : profileTrendDelta == null
      ? td("diagnosticHero.trendUnknown")
      : profileTrendDelta > 0.2
        ? td("diagnosticHero.trendUp", { delta: profileTrendDelta.toFixed(1) })
        : profileTrendDelta < -0.2
          ? td("diagnosticHero.trendDown", { delta: Math.abs(profileTrendDelta).toFixed(1) })
          : td("diagnosticHero.trendStable");
  const profileDiagnosticTitle = !hasProfileEvidence
    ? profileNeverSynced
      ? td("diagnosticHero.titleNeverSynced")
      : profileConnectedWithoutAnalysis
        ? td("diagnosticHero.titleConnectedEmpty")
        : td("diagnosticHero.titleUnavailable")
    : !profileEvidenceIsCurrent
      ? td("diagnosticHero.titleHistorical")
      : score >= 7
        ? td("diagnosticHero.titleGood")
        : score >= 4
          ? td("diagnosticHero.titleAttention")
          : td("diagnosticHero.titleCritical");
  const profileReputationVariant: "primary" | "positive" | "warning" | "negative" = !hasProfileEvidence
    ? "primary"
    : profileEvidenceIsHistorical
      ? "warning"
      : score >= 7
        ? "positive"
        : score >= 4
          ? "warning"
          : "negative";

  const emotionTemporalData = useMemo(() => {
    if (!trendsDetailed?.data_points) return [];
    return trendsDetailed.data_points.map((dp) => {
      const base: Record<string, string | number> = { date: shortDate(dp.period) };
      if (dp.emotions) {
        Object.entries(dp.emotions).forEach(([k, v]) => {
          base[k.toLowerCase()] = v;
        });
      }
      return base;
    });
  }, [trendsDetailed]);

  const topicTemporalData = useMemo(() => {
    if (!trendsDetailed?.data_points) return [];
    return trendsDetailed.data_points.map((dp) => {
      const base: Record<string, string | number> = { date: shortDate(dp.period) };
      if (dp.topics) {
        Object.entries(dp.topics).forEach(([k, v]) => {
          base[k.toLowerCase()] = v;
        });
      }
      return base;
    });
  }, [trendsDetailed]);

  // ── extract unique emotion & topic keys for chart series ──
  const emotionKeys = useMemo(() => {
    const keys = new Set<string>();
    emotionTemporalData.forEach((dp) => {
      Object.keys(dp).forEach((k) => { if (k !== "date") keys.add(k); });
    });
    return Array.from(keys);
  }, [emotionTemporalData]);

  const topicKeys = useMemo(() => {
    const keys = new Set<string>();
    topicTemporalData.forEach((dp) => {
      Object.keys(dp).forEach((k) => { if (k !== "date") keys.add(k); });
    });
    return Array.from(keys).slice(0, 8);
  }, [topicTemporalData]);

  // ── posts for list ──
  const posts = useMemo(() => {
    const allPosts = (dashboard?.posts ?? [])
      .filter((p: any) => p.content_text && p.content_text !== "null")
      .map((p: any) => {
        const mu = p.media_urls;
        const imageUrl = p.thumbnail_url || (typeof mu === "object" && mu && !Array.isArray(mu) ? (mu.thumbnail_url || mu.url) : Array.isArray(mu) ? mu[0] : null) || p.image_url || null;
        return {
          id: p.id,
          shortcode: p.platform_post_id || "",
          title: p.content_text!.slice(0, 80),
          comments: p.comment_count,
          date: formatDate(p.published_at),
          dateRaw: p.published_at || "",
          score: (p.summary?.total_analyzed ?? 0) > 0 && typeof p.summary?.avg_score === "number" ? p.summary.avg_score : null,
          platform: p.platform,
          imageUrl,
        };
      });
    // Sort
    if (postSort === "score") {
      allPosts.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else {
      allPosts.sort((a, b) => (b.dateRaw > a.dateRaw ? 1 : -1));
    }
    // Limit (0 = all)
    if (postLimit > 0) return allPosts.slice(0, postLimit);
    return allPosts;
  }, [dashboard?.posts, postSort, postLimit]);

  // ── gap analysis posts ──
  const gapPosts = useMemo(() => {
    if (!hasProfileEvidence || !gapData?.posts) return [];
    const rawRates = gapData.posts.map((p) => Math.max(0, p.engagement ?? 0));
    const minRate = Math.min(...rawRates);
    const maxRate = Math.max(...rawRates);
    const minLog = Math.log1p(minRate);
    const maxLog = Math.log1p(maxRate);
    const normalizeEngagement = (rate: number) => {
      if (rawRates.length <= 1 || maxLog === minLog) return 50;
      return Math.round(((Math.log1p(Math.max(0, rate)) - minLog) / (maxLog - minLog)) * 100);
    };

    return gapData.posts.map((p) => ({
      title: p.title?.slice(0, 60) || "Post",
      engagement: normalizeEngagement(p.engagement),
      rawEngagement: p.engagement,
      sentiment: p.sentiment,
      comments: p.comments,
    }));
  }, [gapData, hasProfileEvidence]);

  // ── ambassadors / detractors ──
  const ambassadorsList = useMemo(() => {
    if (!hasProfileEvidence || !ambassadorsData?.ambassadors) return [];
    return ambassadorsData.ambassadors.map((a: any) => ({
      username: a.username,
      comments: a.count,
      avgScore: a.avg_score,
      dominantEmotion: a.dominant_emotion,
      lastSeen: "",
      gender: a.gender,
      age_band: a.age_band,
      location_state: a.location_state,
    }));
  }, [ambassadorsData, hasProfileEvidence]);

  const detractorsList = useMemo(() => {
    if (!hasProfileEvidence || !ambassadorsData?.detractors) return [];
    return ambassadorsData.detractors.map((d: any) => ({
      username: d.username,
      comments: d.count,
      avgScore: d.avg_score,
      dominantEmotion: d.dominant_emotion,
      lastSeen: "",
      gender: d.gender,
      age_band: d.age_band,
      location_state: d.location_state,
    }));
  }, [ambassadorsData, hasProfileEvidence]);

  // ── topic treemap from topics_frequency ──
  const topicNodes = useMemo(() => {
    const MAX_TOPICS = 10;
    if (!hasProfileEvidence) return [];
    // Prefer topics_with_scores from enriched endpoint
    const topicsWithScores = (dashboard as any)?.topics_with_scores;
    if (topicsWithScores && Array.isArray(topicsWithScores) && topicsWithScores.length > 0) {
      const sorted = [...topicsWithScores].sort((a: any, b: any) => b.count - a.count);
      const limit = sorted.length < MAX_TOPICS ? Math.min(sorted.length, 5) : MAX_TOPICS;
      return sorted
        .slice(0, limit)
        .map((t: any) => ({
          topic: t.topic,
          count: t.count,
          avgScore: t.avg_score ?? score,
        }));
    }
    // Fallback to topics_frequency
    if (!dashboard?.topics_frequency) return [];
    const entries = Object.entries(dashboard.topics_frequency).sort((a, b) => b[1] - a[1]);
    const limit = entries.length < MAX_TOPICS ? Math.min(entries.length, 5) : MAX_TOPICS;
    return entries
      .slice(0, limit)
      .map(([topic, count]) => ({
        topic,
        count,
        avgScore: score,
      }));
  }, [dashboard, hasProfileEvidence, score]);

  // ── heatmap (empty placeholder if API didn't return) ──
  const [heatmapData, setHeatmapData] = useState<number[][] | null>(null);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    dashboardApi.engagementHeatmap(token, id).then((res) => {
      if (res?.data) setHeatmapData(res.data);
    }).catch(() => {});
  }, []);

  // ── comments table rows ──
  const commentsTableRows: CommentRow[] = useMemo(() => {
    return comments.map((c) => ({
      user: c.author_username || c.author_name || "unknown",
      text: c.text_original,
      emotion: c.analysis?.emotions?.[0] ?? "",
      score: c.analysis?.score_0_10 ?? null,
      date: c.published_at ? formatDate(c.published_at) : "",
      post: "",
      sentiment: c.analysis?.score_0_10 != null ? getSentimentLabel(c.analysis.score_0_10) : "Pendente",
    }));
  }, [comments]);

  // ── featured comments (top positive + top negative) ──
  const featuredComments = useMemo(() => {
    const sorted = [...comments]
      .filter((c) => c.analysis?.score_0_10 != null)
      .sort((a, b) => (b.analysis!.score_0_10! - a.analysis!.score_0_10!));
    const topPositive = sorted.slice(0, 2).map((c) => ({
      user: c.author_username || c.author_name || "unknown",
      text: c.text_original.slice(0, 120),
      emotion: c.analysis?.emotions?.[0] ?? "Alegria",
      score: c.analysis!.score_0_10!,
    }));
    const topNegative = sorted.slice(-2).map((c) => ({
      user: c.author_username || c.author_name || "unknown",
      text: c.text_original.slice(0, 120),
      emotion: c.analysis?.emotions?.[0] ?? "Raiva",
      score: c.analysis!.score_0_10!,
    }));
    return [...topPositive, ...topNegative];
  }, [comments]);

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
  const volumePeak = getPeakFact(volumeData, point => point.date, point => point.volume);
  const scoreTrendFact = getTrendFact(scoreTemporalData, point => point.date, point => point.score);
  const sentimentTotals = sentimentTemporalData.reduce(
    (totals, point) => ({
      positivo: totals.positivo + point.positivo,
      neutro: totals.neutro + point.neutro,
      negativo: totals.negativo + point.negativo,
    }),
    { positivo: 0, neutro: 0, negativo: 0 },
  );
  const sentimentTotal = sentimentTotals.positivo + sentimentTotals.neutro + sentimentTotals.negativo;
  const dominantSentiment = (Object.entries(sentimentTotals) as Array<[keyof typeof sentimentTotals, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const sentimentLabels = {
    positivo: tc("positive"),
    neutro: tc("neutral"),
    negativo: tc("negative"),
  };
  const emotionCells = emotionTemporalData.flatMap(row => Object.entries(row)
    .filter(([key, value]) => key !== "date" && Number.isFinite(Number(value)))
    .map(([key, value]) => ({ date: String(row.date), key, value: Number(value) })));
  const emotionPeak = [...emotionCells].sort((a, b) => b.value - a.value)[0] ?? null;
  const topicCells = topicTemporalData.flatMap(row => Object.entries(row)
    .filter(([key, value]) => key !== "date" && Number.isFinite(Number(value)))
    .map(([key, value]) => ({ date: String(row.date), key, value: Number(value) })));
  const topicPeak = [...topicCells].sort((a, b) => b.value - a.value)[0] ?? null;

  // ── handle analyze (com preflight de créditos) ──
  const { refresh: refreshRuns } = useActiveRuns();
  const [preflight, setPreflight] = useState<{ open: boolean; estimate: PreflightEstimate | null; loading: boolean; confirming: boolean; error: string }>({ open: false, estimate: null, loading: false, confirming: false, error: "" });

  const handleAnalyze = async () => {
    const token = getToken();
    if (!token) return;
    setPreflight({ open: true, estimate: null, loading: true, confirming: false, error: "" });
    try {
      const est = await connectionsApi.preflight(token, id, "analyze");
      setPreflight(p => ({ ...p, estimate: est, loading: false }));
    } catch (err) {
      setPreflight(p => ({ ...p, open: false }));
      toast.error(err instanceof Error ? err.message : "Erro ao calcular estimativa");
    }
  };

  const confirmAnalyze = async () => {
    const token = getToken();
    if (!token) return;
    setPreflight(p => ({ ...p, confirming: true }));
    try {
      await connectionsApi.analyze(token, id);
      refreshRuns();
      fetchData();
    } catch (err) {
      console.error("Analyze failed:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar análise");
    } finally {
      setPreflight(p => ({ ...p, open: false, confirming: false }));
    }
  };

  // ── temporal chart renderer ──
  const renderTemporalChart = () => {
    switch (activeTab) {
      case "Volume":
        return (
          <>
            <div data-chart-visual="profile-temporal-volume">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={volumeData} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                  <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: `0 4px 16px ${t.primary}15`, fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Bar dataKey="volume" fill={t.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {volumeData.length > 0 && (
              <ChartTextAlternative
                chartId="profile-temporal-volume"
                title={`${ti("temporalAnalysis")} — ${td("tabs.volume")}`}
                summary={volumePeak ? tca("peak", {
                  value: formatChartNumber(volumePeak.value, locale, 0),
                  unit: volumePeak.value === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
                  period: volumePeak.period,
                }) : ""}
                period={getPeriodRange(volumeData, point => point.date, tca("currentSlice"))}
                unit={tca("units.comments")}
                columns={[
                  { key: "date", label: tca("columns.date") },
                  { key: "volume", label: tca("columns.comments"), numeric: true },
                ]}
                rows={volumeData.map(point => ({
                  date: point.date,
                  volume: formatChartNumber(point.volume, locale, 0),
                }))}
              />
            )}
          </>
        );
      case "Score":
        return (
          <>
            <div data-chart-visual="profile-temporal-score">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={scoreTemporalData} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                  <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Area type="monotone" dataKey="score" stroke={t.primary} fill={t.primary} fillOpacity={0.1} strokeWidth={2.5} dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {scoreTemporalData.length > 0 && (
              <ChartTextAlternative
                chartId="profile-temporal-score"
                title={`${ti("temporalAnalysis")} — ${td("tabs.score")}`}
                summary={describeScoreTrend(td("tabs.score"), scoreTrendFact)}
                period={getPeriodRange(scoreTemporalData, point => point.date, tca("currentSlice"))}
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
          </>
        );
      case "Sentimento":
        if (sentimentTemporalMode === "stacked100") {
          return (
            <>
              <div data-chart-visual="profile-temporal-sentiment">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sentimentTemporalPctData} barGap={2} margin={CHART_MARGIN} accessibilityLayer={false}>
                    <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--accent) 28%, transparent)" vertical={false} />
                    <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 10, fill: t.textFaint }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }}
                      formatter={(value, name) => [`${Number(value ?? 0)}%`, String(name)]}
                    />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                    <Bar dataKey="positivo" name={tc("positive")} fill={t.sentimentPositive} stackId="sentiment" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="neutro" name={tc("neutral")} fill={t.sentimentNeutral} stackId="sentiment" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="negativo" name={tc("negative")} fill={t.sentimentNegative} stackId="sentiment" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {sentimentTemporalPctData.length > 0 && dominantSentiment && (
                <ChartTextAlternative
                  chartId="profile-temporal-sentiment"
                  title={`${ti("temporalAnalysis")} — ${td("tabs.sentiment")}`}
                  summary={tca("dominantPercent", {
                    category: sentimentLabels[dominantSentiment[0]],
                    value: sentimentTotal > 0 ? Math.round((dominantSentiment[1] / sentimentTotal) * 100) : 0,
                  })}
                  period={getPeriodRange(sentimentTemporalPctData, point => point.date, tca("currentSlice"))}
                  unit={tca("units.percentage")}
                  columns={[
                    { key: "date", label: tca("columns.date") },
                    { key: "negative", label: tc("negative"), numeric: true },
                    { key: "neutral", label: tc("neutral"), numeric: true },
                    { key: "positive", label: tc("positive"), numeric: true },
                  ]}
                  rows={sentimentTemporalPctData.map(point => ({
                    date: point.date,
                    negative: `${point.negativo}%`,
                    neutral: `${point.neutro}%`,
                    positive: `${point.positivo}%`,
                  }))}
                />
              )}
            </>
          );
        }
        return (
          <>
            <div data-chart-visual="profile-temporal-sentiment">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sentimentTemporalData} barGap={4} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--accent) 28%, transparent)" vertical={false} />
                  <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                  <Bar dataKey="negativo" name={tc("negative")} fill={t.sentimentNegative} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="neutro" name={tc("neutral")} fill={t.sentimentNeutral} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="positivo" name={tc("positive")} fill={t.sentimentPositive} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {sentimentTemporalData.length > 0 && dominantSentiment && (
              <ChartTextAlternative
                chartId="profile-temporal-sentiment"
                title={`${ti("temporalAnalysis")} — ${td("tabs.sentiment")}`}
                  summary={tca("dominant", {
                    category: sentimentLabels[dominantSentiment[0]],
                    value: formatChartNumber(dominantSentiment[1], locale, 0),
                    unit: dominantSentiment[1] === 1 ? tca("units.commentSingular") : tca("units.commentsShort"),
                  })}
                period={getPeriodRange(sentimentTemporalData, point => point.date, tca("currentSlice"))}
                unit={tca("units.comments")}
                columns={[
                  { key: "date", label: tca("columns.date") },
                  { key: "negative", label: tc("negative"), numeric: true },
                  { key: "neutral", label: tc("neutral"), numeric: true },
                  { key: "positive", label: tc("positive"), numeric: true },
                ]}
                rows={sentimentTemporalData.map(point => ({
                  date: point.date,
                  negative: formatChartNumber(point.negativo, locale, 0),
                  neutral: formatChartNumber(point.neutro, locale, 0),
                  positive: formatChartNumber(point.positivo, locale, 0),
                }))}
              />
            )}
          </>
        );
      case "Emocoes":
        return (
          <>
            <div data-chart-visual="profile-temporal-emotions">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={emotionTemporalData} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                  <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                  {emotionKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} fill={t.chart[i % t.chart.length]} stackId="emotions" radius={i === emotionKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {emotionTemporalData.length > 0 && emotionPeak && (
              <ChartTextAlternative
                chartId="profile-temporal-emotions"
                title={`${ti("temporalAnalysis")} — ${td("tabs.emotions")}`}
                summary={tca("dominant", {
                  category: `${emotionPeak.key} · ${emotionPeak.date}`,
                  value: formatChartNumber(emotionPeak.value, locale, 0),
                  unit: tca("units.occurrences"),
                })}
                period={getPeriodRange(emotionTemporalData, point => String(point.date), tca("currentSlice"))}
                unit={tca("units.occurrences")}
                columns={[
                  { key: "date", label: tca("columns.date") },
                  ...emotionKeys.map(key => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), numeric: true })),
                ]}
                rows={emotionTemporalData.map(point => ({
                  date: String(point.date),
                  ...Object.fromEntries(emotionKeys.map(key => [
                    key,
                    typeof point[key] === "number" ? formatChartNumber(Number(point[key]), locale, 0) : null,
                  ])),
                }))}
              />
            )}
          </>
        );
      case "Topicos":
        return (
          <>
            <div data-chart-visual="profile-temporal-topics">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topicTemporalData} margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                  <XAxis dataKey="date" {...COMPACT_X_AXIS} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
                  {topicKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} fill={t.chart[i % t.chart.length]} stackId="topics" radius={i === topicKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {topicTemporalData.length > 0 && topicPeak && (
              <ChartTextAlternative
                chartId="profile-temporal-topics"
                title={`${ti("temporalAnalysis")} — ${td("tabs.topics")}`}
                summary={tca("dominant", {
                  category: `${topicPeak.key} · ${topicPeak.date}`,
                  value: formatChartNumber(topicPeak.value, locale, 0),
                  unit: tca("units.occurrences"),
                })}
                period={getPeriodRange(topicTemporalData, point => String(point.date), tca("currentSlice"))}
                unit={tca("units.occurrences")}
                columns={[
                  { key: "date", label: tca("columns.date") },
                  ...topicKeys.map(key => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), numeric: true })),
                ]}
                rows={topicTemporalData.map(point => ({
                  date: String(point.date),
                  ...Object.fromEntries(topicKeys.map(key => [
                    key,
                    typeof point[key] === "number" ? formatChartNumber(Number(point[key]), locale, 0) : null,
                  ])),
                }))}
              />
            )}
          </>
        );
      default:
        return null;
    }
  };

  // ── loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{ti("loading")}</p>
        </div>
      </div>
    );
  }

  // ── error state ──
  if (error && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--sentiment-negative)" }}>{tc("error")}</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{error}</p>
          <Button variant="primary" onClick={fetchData}>{ti("retry")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" aria-label={ti("backToDashboard")} onClick={() => router.push("/dashboard")} className="p-1.5 rounded-xl transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </button>
        <GlassSocialIcon platform={platform} size={36} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h1 className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {username.startsWith("@") ? username : `@${username}`}
          </h1>
          <Badge variant="muted">
            {connectionStatus === "active" ? ti("registrationConnected") : ti("registrationNeedsAttention")}
          </Badge>
        </div>
        <Button variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={handleAnalyze} className="shrink-0">
          {ti("analyze")}
        </Button>
      </div>

      <SurfaceEvidenceNotice
        snapshot={profileSnapshot}
        surface="profile"
        legacyEvidence={hasLegacyProfileEvidence
          ? { validCount: totalAnalyzed, savedCount: totalComments }
          : undefined}
      />
      <CountFunnel snapshot={profileSnapshot} surface="profile" />
      <ProvenanceDrawer snapshot={profileSnapshot} open={provenanceOpen} onClose={closeProvenance} />

      <ProfileQuestionGroup
        eyebrow={ti("reputationSummary.eyebrow")}
        title={profileEvidenceIsCurrent
          ? ti("reputationSummary.currentTitle")
          : profileEvidenceIsHistorical
            ? ti("reputationSummary.historicalTitle")
            : ti("reputationSummary.unavailableTitle")}
        description={profileEvidenceIsCurrent
          ? ti("reputationSummary.currentDescription")
          : profileEvidenceIsHistorical
            ? ti("reputationSummary.historicalDescription")
            : profileNeverSynced
              ? ti("reputationSummary.neverSyncedDescription")
              : ti("reputationSummary.unavailableDescription")}
      >
        <div className="space-y-4">
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.22fr)_minmax(260px,0.78fr)] gap-4 ui-reveal"
          >
            <div
              data-testid="profile-reputation-summary"
              data-evidence-state={profileLanguageMode}
              data-snapshot-health={profileSnapshot?.health ?? "unknown"}
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--primary-bg) 60%, var(--bg-card)) 0%, color-mix(in srgb, var(--accent-bg) 78%, var(--bg-card)) 100%)",
                border: "1px solid color-mix(in srgb, var(--primary) 24%, var(--border))",
                boxShadow: "0 16px 42px -30px var(--primary)",
              }}
            >
              <Badge variant={profileReputationVariant} dot>
                {!hasProfileEvidence
                  ? td("noValidAnalysis")
                  : profileEvidenceIsHistorical
                    ? td("diagnosticHero.historicalBadge")
                    : score >= 7
                      ? td("goodReputation")
                      : score >= 4
                        ? td("attentionNeeded")
                        : td("criticalReputation")}
              </Badge>
              <h2 className="mt-4" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.35rem", fontWeight: 850, color: "var(--text-primary)", lineHeight: 1.18 }}>
                {profileDiagnosticTitle}
              </h2>
              <p className="mt-2" style={{ fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                {profileSentimentDriver} {profileTrendNarrative}
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5" style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 18%, var(--border))" }}>
                {[
                  { label: td("diagnosticHero.trendLabel"), value: profileTrendDelta == null ? td("diagnosticHero.noTrendShort") : `${profileTrendDelta > 0 ? "+" : ""}${profileTrendDelta.toFixed(1)}` },
                  { label: td("diagnosticHero.mainEmotion"), value: dominantProfileEmotion },
                  { label: ti("stats.totalAnalyzed"), value: fmtNum(totalAnalyzed) },
                ].map(item => (
                  <div key={item.label} className="min-w-0">
                    <p style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                    <p className="truncate" style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl p-5 md:p-6 flex flex-col justify-between"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 8px -2px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{ti("stats.score")}</p>
                  <p className="mt-1" style={{ fontSize: "0.78rem", color: "var(--text-faint)" }}>{td("outOf10")}</p>
                </div>
                <button
                  ref={provenanceTriggerRef}
                  type="button"
                  data-testid="profile-score-provenance-trigger"
                  aria-label={snapshotProvenance(hasProfileEvidence ? "open" : "openUnavailable")}
                  disabled={!profileSnapshot}
                  onClick={() => setProvenanceOpen(true)}
                  className="group shrink-0 rounded-2xl p-1 text-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative block h-24 w-24">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transition-transform group-hover:scale-[1.03]">
                      <circle cx="50" cy="50" r="41" fill="none" stroke="color-mix(in srgb, var(--primary) 14%, var(--bg-subtle))" strokeWidth="8" />
                      <circle cx="50" cy="50" r="41" fill="none" stroke={hasProfileEvidence ? (score >= 7 ? t.sentimentPositive : score >= 4 ? t.primary : t.sentimentNegative) : "var(--text-faint)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${profileScorePercent * 2.58} ${258 - profileScorePercent * 2.58}`} />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.65rem", fontWeight: 850, color: "var(--text-primary)" }}>{hasProfileEvidence ? score.toFixed(1) : "—"}</span>
                    </span>
                  </span>
                  <span className="mt-1 inline-flex rounded-full px-2 py-1" style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)", fontSize: "0.6rem", fontWeight: 800 }}>
                    {snapshotProvenance(hasProfileEvidence ? "openShort" : "openShortUnavailable")}
                  </span>
                </button>
              </div>
              {hasProfileEvidence ? (
                <div className="mt-5">
                  <SentimentBar positive={positive} neutral={neutral} negative={negative} height={10} showLabels />
                </div>
              ) : (
                <p className="mt-5" style={{ color: "var(--text-muted)", fontSize: "0.75rem", lineHeight: 1.55 }}>
                  {ti("notAvailableWithoutAnalysis")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              variant="tinted"
              tintColor="var(--primary)"
              tintBg="var(--primary-bg)"
              icon={<GlassHeartIcon size={32} />}
              label={ti("stats.score")}
              value={hasProfileEvidence ? score.toFixed(1) : "—"}
              sub="/10"
            />
            <StatCard
              variant="tinted"
              tintColor="var(--primary)"
              tintBg="var(--primary-bg)"
              icon={<GlassZapIcon size={32} />}
              label={ti("stats.engagementRate")}
              value={`${engagementRate}%`}
              sub={ti("stats.commentsPerFollower")}
            />
            <StatCard
              variant="tinted"
              tintColor="var(--sentiment-negative)"
              tintBg="var(--sentiment-negative-bg)"
              icon={<GlassPeopleIcon size={32} />}
              label={ti("stats.polarization")}
              value={polarizationLabel}
              sub={polarizationSub}
            />
            <StatCard
              variant="default"
              icon={<GlassShieldIcon size={32} />}
              label={ti("stats.total")}
              value={fmtNum(totalComments)}
              sub={tc("comments")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] gap-4">
            <Section title={ti("sentimentDistribution")}>
              <SentimentBar positive={positive} neutral={neutral} negative={negative} height={12} showLabels />
              <div className="mt-4 space-y-2">
                {[
                  { label: tc("positive"), count: fmtNum(positive), pct: `${posPct}%`, color: chartColors.positive },
                  { label: tc("neutral"), count: fmtNum(neutral), pct: `${neuPct}%`, color: chartColors.neutral },
                  { label: tc("negative"), count: fmtNum(negative), pct: `${negPct}%`, color: chartColors.negative },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>{s.label}</span>
                    <span className="ml-auto" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{s.count}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{s.pct}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title={ti("engagement")}>
              <div className="space-y-3">
                {[
                  { label: tc("likes"), value: fmtNum(totalLikes), icon: Heart },
                  { label: tc("views"), value: fmtNum(totalViews), icon: Eye },
                  { label: tc("comments"), value: fmtNum(totalCommentsEng), icon: MessageCircle },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
                      <s.icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</p>
                      <p style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </ProfileQuestionGroup>

      {/* YouTube-specific stats */}
      {platform === "youtube" && youtubeStats && (
        <YouTubeStats data={youtubeStats} />
      )}

      {/* Featured Comments — near top after stats */}
      {featuredComments.length > 0 && (
        <FeaturedComments comments={featuredComments} />
      )}

      {hasProfileEvidence && hasDemographics && ((demoOverview && demoOverview.enrichment_coverage.enriched > 0) || sentimentByAge || sentimentByGender || emotionsByGender) && (
        <ProfileQuestionHeader
          eyebrow="Públicos"
          title="Quais públicos explicam o sentimento?"
          description="Recortes demográficos ajudam a entender onde a percepção muda de tom."
        />
      )}

      {/* Demographics Overview */}
      {hasProfileEvidence && hasDemographics && demoOverview && demoOverview.enrichment_coverage.enriched > 0 && (
        <DemographicsOverview
          genderDist={demoOverview.gender_distribution}
          ageDist={demoOverview.age_distribution}
          topLocations={demoOverview.top_locations}
          stateDistribution={demoOverview.state_distribution}
          coverage={demoOverview.enrichment_coverage}
        />
      )}

      {/* Sentiment by Age + Gender side by side */}
      {hasProfileEvidence && hasDemographics && (sentimentByAge || sentimentByGender) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sentimentByAge && sentimentByAge.length > 0 && (
            <SentimentByAge data={sentimentByAge} />
          )}
          {sentimentByGender && sentimentByGender.length > 0 && (
            <SentimentByGender data={sentimentByGender} />
          )}
        </div>
      )}

      {(gapPosts.length > 0 || ambassadorsList.length > 0 || detractorsList.length > 0) && (
        <>
          {profileEvidenceIsHistorical && (
            <aside
              data-testid="profile-historical-boundary"
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: "var(--accent-bg)", border: "1px solid color-mix(in srgb, var(--accent) 32%, var(--border))", color: "var(--text-primary)", fontSize: "0.78rem", lineHeight: 1.6 }}
            >
              {ti("historicalBoundary")}
            </aside>
          )}
          <ProfileQuestionHeader
            eyebrow="Prioridades"
            title={ti(`evidenceSections.priorities.${profileEvidenceIsHistorical ? "historicalTitle" : "currentTitle"}`)}
            description={ti(`evidenceSections.priorities.${profileEvidenceIsHistorical ? "historicalDescription" : "currentDescription"}`)}
          />
        </>
      )}

      {/* Gap Analysis */}
      {gapPosts.length > 0 && (
        <GapAnalysis posts={gapPosts} platformLabel={platformLabel} historical={profileEvidenceIsHistorical} />
      )}

      {/* Ambassadors vs Detractors */}
      {(ambassadorsList.length > 0 || detractorsList.length > 0) && (
        <AmbassadorsVsDetractors ambassadors={ambassadorsList} detractors={detractorsList} platformLabel={platformLabel} />
      )}

      {hasProfileEvidence && (topicNodes.length > 0 || (topicEmotionData && topicEmotionData.topics.length > 0)) && (
        <ProfileQuestionHeader
          eyebrow="Tópicos"
          title={ti(`evidenceSections.topics.${profileEvidenceIsHistorical ? "historicalTitle" : "currentTitle"}`)}
          description={ti(`evidenceSections.topics.${profileEvidenceIsHistorical ? "historicalDescription" : "currentDescription"}`)}
        />
      )}

      {/* Topic Treemap */}
      {topicNodes.length > 0 && (
        <TopicTreemap topics={topicNodes} platformLabel={platformLabel} />
      )}

      {/* Topic x Emotion Matrix */}
      {hasProfileEvidence && topicEmotionData && topicEmotionData.topics.length > 0 && (
        <TopicEmotionHeatmap matrix={{ topics: topicEmotionData.topics, emotions: topicEmotionData.emotions, data: topicEmotionData.matrix }} platformLabel={platformLabel} />
      )}

      {hasProfileEvidence && (hasEmotionsByGender || radarData.length > 0 || (dashboard?.word_frequency && Object.keys(dashboard.word_frequency).length > 0) || (heatmapData && heatmapData.length > 0)) && (
        <ProfileQuestionHeader
          eyebrow="Contexto"
          title="Que sinais dão textura para a leitura?"
          description="Sinais complementares mostram vocabulário, emoção geral e momentos de maior atividade."
        />
      )}

      {/* Radar + Words */}
      <div className="space-y-4">
        {(hasEmotionsByGender || radarData.length > 0) && (
          <div className={`grid gap-4 items-stretch ${hasEmotionsByGender && radarData.length > 0 ? "grid-cols-1 xl:grid-cols-[minmax(340px,0.84fr)_minmax(420px,1.16fr)]" : "grid-cols-1"}`}>
            {hasEmotionsByGender && emotionsByGender && (
              <EmotionsByGender data={emotionsByGender} />
            )}
            {radarData.length > 0 && (
              <EmotionRadarCard title={ti("emotionRadar")} data={radarData} compact chartId="profile-emotion-radar" />
            )}
          </div>
        )}
        {hasProfileEvidence && dashboard?.word_frequency && Object.keys(dashboard.word_frequency).length > 0 && (
          <Section title={ti("wordCloud")} subtitle={ti("wordCloudSub")}>
            <WordCloudChart
              topics={dashboard.word_frequency}
              maxWords={30}
              height={220}
              title={ti("wordCloud")}
              chartId="profile-word-cloud"
            />
          </Section>
        )}
      </div>

      {/* Heatmap — above temporal and posts */}
      {hasProfileEvidence && heatmapData && heatmapData.length > 0 && (
        <Heatmap data={heatmapData} chartId="profile-activity-heatmap" />
      )}

      <ProfileQuestionHeader
        eyebrow="Evidência"
        title={profileEvidenceIsCurrent
          ? td("sections.reputation.title")
          : profileEvidenceIsHistorical
            ? td("sections.reputation.historicalTitle")
            : td("sections.reputation.unavailableTitle")}
        description={profileEvidenceIsCurrent
          ? td("sections.reputation.description")
          : profileEvidenceIsHistorical
            ? td("sections.reputation.historicalDescription")
            : td("sections.reputation.unavailableDescription")}
      />

      {/* Temporal */}
      <Section
        title={hasProfileEvidence ? ti("temporalAnalysis") : ti("collectionTimeline")}
        subtitle={hasProfileEvidence ? ti("temporalSub") : ti("collectionTimelineSub")}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="min-w-0 w-full overflow-x-auto rounded-xl sm:w-auto" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", border: "0.5px solid var(--border)", backdropFilter: "blur(12px)", boxShadow: "0 2px 10px -2px rgba(0,0,0,0.05)" }}>
            <div className="flex w-max items-center gap-1 p-1">
              {(hasProfileEvidence
                ? (["Volume", "Score", "Sentimento", "Emocoes", "Topicos"] as const)
                : (["Volume"] as const)
              ).map((tab) => {
                const tabLabels: Record<string, string> = { Volume: td("tabs.volume"), Score: td("tabs.score"), Sentimento: td("tabs.sentiment"), Emocoes: td("tabs.emotions"), Topicos: td("tabs.topics") };
                return (
                <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)} className="px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap" style={{ fontSize: "0.72rem", fontWeight: 500, backgroundColor: activeTab === tab ? "var(--primary)" : "transparent", color: activeTab === tab ? "var(--primary-foreground)" : "var(--text-muted)", boxShadow: activeTab === tab ? "0 4px 16px -4px var(--primary)" : "none" }}>
                  {tabLabels[tab]}
                </button>);
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "Sentimento" && (
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
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="day">{td("granularity.day")}</option>
              <option value="week">{td("granularity.week")}</option>
              <option value="month">{td("granularity.month")}</option>
            </select>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="7d">{td("timeRange.7d")}</option>
              <option value="30d">{td("timeRange.30d")}</option>
              <option value="90d">{td("timeRange.90d")}</option>
              <option value="1a">{td("timeRange.1y")}</option>
              <option value="Tudo">{td("timeRange.all")}</option>
            </select>
          </div>
        </div>
        {renderTemporalChart()}
      </Section>

      {/* Posts */}
      {posts.length > 0 && (
        <Section title={tc("posts")} action={
          <div className="flex items-center gap-2">
            <select value={postSort} onChange={(e) => setPostSort(e.target.value as "recent" | "score")} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="recent">{td("sortRecent")}</option>
              <option value="score">{td("sortScore")}</option>
            </select>
            <select value={postLimit} onChange={(e) => setPostLimit(Number(e.target.value))} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={0}>{td("viewAll")}</option>
            </select>
          </div>
        }>
          <div className="space-y-0.5">
            {posts.map((post, i) => {
              const ss = post.score != null ? getScoreStyle(post.score) : null;
              return (
                <Link
                  key={post.id || i}
                  href={`/dashboard/post/${post.id}?from=profile&connection_id=${id}`}
                  data-testid={`profile-post-${post.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    {post.imageUrl ? (
                      <img src={`/api/v1/posts/thumbnail?url=${encodeURIComponent(post.imageUrl)}&post_id=${encodeURIComponent(post.shortcode)}`} alt="" className="w-full h-full object-cover" onError={e => { const el = e.target as HTMLImageElement; el.style.display = "none"; el.parentElement!.querySelector("span")?.removeAttribute("style"); }} />
                    ) : null}
                    <span style={post.imageUrl ? { display: "none" } : {}}>
                      <GlassSocialIcon platform={platform} size={24} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{post.title}</p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{platformLabel} &middot; {post.comments} com. &middot; {post.date}</p>
                  </div>
                  {post.score != null && ss ? (
                    <span className="px-2 py-0.5 rounded-lg" style={{ fontSize: "0.72rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>
                      {post.score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg" style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
                      Aguardando análise
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Comments Table */}
      {commentsTableRows.length > 0 && (
        <CommentsTable comments={commentsTableRows} platformName={platformLabel} />
      )}
      <PreflightModal
        open={preflight.open}
        mode="analyze"
        targetLabel={username ? `@${username}` : ""}
        estimate={preflight.estimate}
        loading={preflight.loading}
        confirming={preflight.confirming}
        onConfirm={confirmAnalyze}
        onClose={() => setPreflight(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
