"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, Eye, RefreshCw, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
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
import type { CommentRow } from "@/components/SocialSharedSections";
import {
  GapAnalysis, PostLifecycle, AmbassadorsVsDetractors, TopicTreemap,
  SmartAlerts, TopicEmotionHeatmap,
} from "@/components/AdvancedCharts";
import { GlassHeartIcon, GlassZapIcon, GlassPeopleIcon, GlassShieldIcon } from "@/components/GlassIcons";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import WordCloudChart from "@/components/charts/WordCloudChart";

import { getToken } from "@/lib/auth";
import {
  dashboardApi, connectionsApi, postsApi, commentsApi,
} from "@/lib/api";
import type {
  ConnectionDashboard, TrendResponse, TrendsDetailedResponse,
  CommentWithAnalysis, PostSummary,
} from "@/lib/types";

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
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  // ── state ──
  const [activeTab, setActiveTab] = useState("Volume");
  const [timeRange, setTimeRange] = useState("90d");
  const [granularity, setGranularity] = useState("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postSort, setPostSort] = useState<"recent" | "score">("recent");
  const [postLimit, setPostLimit] = useState<number>(10);

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
  const [connectionInfo, setConnectionInfo] = useState<{
    platform: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
    followers_count: number;
    status: string;
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
      ] = await Promise.allSettled([
        dashboardApi.connectionDashboard(token, id),
        dashboardApi.trends(token, { connection_id: id, granularity: "week", days: 90 }),
        dashboardApi.trendsDetailed(token, { connection_id: id, granularity: "week", days: 90 }),
        commentsApi.list(token, { connection_id: id, limit: 200 }),
        dashboardApi.gapAnalysis(token, id),
        dashboardApi.ambassadorsDetractors(token, id),
        dashboardApi.topicEmotionMatrix(token, id),
        connectionsApi.list(token),
      ]);

      if (dashRes.status === "fulfilled") setDashboard(dashRes.value);
      else console.error("Dashboard fetch failed:", dashRes.reason);

      if (trendsRes.status === "fulfilled") setTrends(trendsRes.value);
      if (trendsDetailedRes.status === "fulfilled") setTrendsDetailed(trendsDetailedRes.value);
      if (commentsRes.status === "fulfilled") setComments(commentsRes.value.items);
      if (gapRes.status === "fulfilled") setGapData(gapRes.value);
      if (ambRes.status === "fulfilled") setAmbassadorsData(ambRes.value);
      if (matrixRes.status === "fulfilled") setTopicEmotionData(matrixRes.value);

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
        }
      }

      if (dashRes.status === "rejected") {
        setError("Falha ao carregar dados do perfil.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
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
    const days = timeRangeDays[timeRange] ?? 90;
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
  const sentDist = dashboard?.sentiment_distribution;
  const positive = sentDist?.positive ?? 0;
  const neutral = sentDist?.neutral ?? 0;
  const negative = sentDist?.negative ?? 0;
  const totalSent = positive + neutral + negative || 1;
  const posPct = Math.round((positive / totalSent) * 100);
  const neuPct = Math.round((neutral / totalSent) * 100);
  const negPct = 100 - posPct - neuPct;

  const engagementTotals = dashboard?.engagement_totals;
  const totalLikes = engagementTotals?.total_likes ?? 0;
  const totalViews = engagementTotals?.total_views ?? 0;
  const totalCommentsEng = engagementTotals?.total_comments ?? totalComments;
  const engagementRate = followersCount > 0 ? ((totalCommentsEng / followersCount) * 100).toFixed(2) : "0.00";

  const polarizationLabel = negPct >= 40 ? "Alta" : negPct >= 25 ? "Moderada" : "Baixa";
  const polarizationSub = `${negPct}% neg. vs ${posPct}% pos.`;

  // ── emotions for radar ──
  const radarData = useMemo(() => {
    if (!dashboard?.emotions_distribution) return [];
    return Object.entries(dashboard.emotions_distribution).map(([emotion, value]) => ({
      emotion,
      value,
    }));
  }, [dashboard?.emotions_distribution]);

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
    return trends.data_points
      .filter((dp) => dp.avg_score !== null)
      .map((dp) => ({
        date: shortDate(dp.period),
        score: dp.avg_score ?? 0,
      }));
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
          score: p.summary?.avg_score ?? 0,
          platform: p.platform,
          imageUrl,
        };
      });
    // Sort
    if (postSort === "score") {
      allPosts.sort((a, b) => b.score - a.score);
    } else {
      allPosts.sort((a, b) => (b.dateRaw > a.dateRaw ? 1 : -1));
    }
    // Limit (0 = all)
    if (postLimit > 0) return allPosts.slice(0, postLimit);
    return allPosts;
  }, [dashboard?.posts, postSort, postLimit]);

  // ── gap analysis posts ──
  const gapPosts = useMemo(() => {
    if (!gapData?.posts) return [];
    return gapData.posts.map((p) => ({
      title: p.title?.slice(0, 60) || "Post",
      engagement: p.engagement,
      sentiment: p.sentiment,
      comments: p.comments,
    }));
  }, [gapData]);

  // ── ambassadors / detractors ──
  const ambassadorsList = useMemo(() => {
    if (!ambassadorsData?.ambassadors) return [];
    return ambassadorsData.ambassadors.map((a) => ({
      username: a.username,
      comments: a.count,
      avgScore: a.avg_score,
      dominantEmotion: a.dominant_emotion,
      lastSeen: "",
    }));
  }, [ambassadorsData]);

  const detractorsList = useMemo(() => {
    if (!ambassadorsData?.detractors) return [];
    return ambassadorsData.detractors.map((d) => ({
      username: d.username,
      comments: d.count,
      avgScore: d.avg_score,
      dominantEmotion: d.dominant_emotion,
      lastSeen: "",
    }));
  }, [ambassadorsData]);

  // ── topic treemap from topics_frequency ──
  const topicNodes = useMemo(() => {
    const MAX_TOPICS = 10;
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
  }, [dashboard, score]);

  // ── heatmap (empty placeholder if API didn't return) ──
  const [heatmapData, setHeatmapData] = useState<number[][] | null>(null);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    dashboardApi.engagementHeatmap(token).then((res) => {
      if (res?.data) setHeatmapData(res.data);
    }).catch(() => {});
  }, []);

  // ── comments table rows ──
  const commentsTableRows: CommentRow[] = useMemo(() => {
    return comments.map((c) => ({
      user: c.author_username || c.author_name || "unknown",
      text: c.text_original,
      emotion: c.analysis?.emotions?.[0] ?? "N/A",
      score: c.analysis?.score_0_10 ?? 5,
      date: c.published_at ? formatDate(c.published_at) : "",
      post: "",
      sentiment: getSentimentLabel(c.analysis?.score_0_10 ?? 5),
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

  // ── handle analyze ──
  const handleAnalyze = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await connectionsApi.analyze(token, id);
      fetchData();
    } catch (err) {
      console.error("Analyze failed:", err);
    }
  };

  // ── temporal chart renderer ──
  const renderTemporalChart = () => {
    switch (activeTab) {
      case "Volume":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: `0 4px 16px ${t.primary}15`, fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Area type="monotone" dataKey="volume" stroke={t.primary} fill={t.primary} fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "Score":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={scoreTemporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Area type="monotone" dataKey="score" stroke={t.secondary} fill={t.secondary} fillOpacity={0.08} strokeWidth={2.5} dot={{ r: 3, fill: t.secondary, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "Sentimento":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sentimentTemporalData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
              <Bar dataKey="positivo" name="Positivo" fill={t.sentimentPositive} stackId="sentiment" radius={[0, 0, 0, 0]} />
              <Bar dataKey="neutro" name="Neutro" fill={t.sentimentNeutral} stackId="sentiment" radius={[0, 0, 0, 0]} />
              <Bar dataKey="negativo" name="Negativo" fill={t.sentimentNegative} stackId="sentiment" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "Emocoes":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={emotionTemporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
              {emotionKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} stroke={t.chart[i % t.chart.length]} fill={t.chart[i % t.chart.length]} fillOpacity={0.06} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      case "Topicos":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={topicTemporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
              {topicKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} stroke={t.chart[i % t.chart.length]} fill={t.chart[i % t.chart.length]} fillOpacity={0.06} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
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
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Carregando perfil...</p>
        </div>
      </div>
    );
  }

  // ── error state ──
  if (error && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--sentiment-negative)" }}>Erro ao carregar</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{error}</p>
          <Button variant="primary" onClick={fetchData}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded-xl transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </button>
        <GlassSocialIcon platform={platform} size={36} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h1 className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            @{username}
          </h1>
          <Badge variant={connectionStatus === "active" ? "positive" : "muted"} dot>
            {connectionStatus === "active" ? "ATIVO" : connectionStatus.toUpperCase()}
          </Badge>
        </div>
        <Button variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={handleAnalyze} className="shrink-0">
          Analisar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          variant="tinted"
          tintColor="var(--primary)"
          tintBg="var(--primary-bg)"
          icon={<GlassHeartIcon size={32} />}
          label="Score"
          value={score.toFixed(1)}
          sub="/10"
        />
        <StatCard
          variant="tinted"
          tintColor="var(--primary)"
          tintBg="var(--primary-bg)"
          icon={<GlassZapIcon size={32} />}
          label="Taxa de Engajamento"
          value={`${engagementRate}%`}
          sub="comentarios/seguidor"
        />
        <StatCard
          variant="tinted"
          tintColor="var(--sentiment-negative)"
          tintBg="var(--sentiment-negative-bg)"
          icon={<GlassPeopleIcon size={32} />}
          label="Polarizacao"
          value={polarizationLabel}
          sub={polarizationSub}
        />
        <StatCard
          variant="highlighted"
          icon={<GlassShieldIcon size={32} />}
          label="Total"
          value={fmtNum(totalComments)}
          sub="comentarios"
        />
      </div>

      {/* Sentiment + Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Distribuicao de Sentimento">
          <SentimentBar positive={positive} neutral={neutral} negative={negative} height={12} showLabels />
          <div className="mt-4 space-y-2">
            {[
              { label: "Positivo", count: fmtNum(positive), pct: `${posPct}%`, color: chartColors.positive },
              { label: "Neutro", count: fmtNum(neutral), pct: `${neuPct}%`, color: chartColors.neutral },
              { label: "Negativo", count: fmtNum(negative), pct: `${negPct}%`, color: chartColors.negative },
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
        <Section title="Engajamento">
          <div className="space-y-3">
            {[
              { label: "Likes", value: fmtNum(totalLikes), icon: Heart },
              { label: "Views", value: fmtNum(totalViews), icon: Eye },
              { label: "Comentários", value: fmtNum(totalCommentsEng), icon: MessageCircle },
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

      {/* Featured Comments — near top after stats */}
      {featuredComments.length > 0 && (
        <FeaturedComments comments={featuredComments} />
      )}

      {/* Gap Analysis */}
      {gapPosts.length > 0 && (
        <GapAnalysis posts={gapPosts} platformLabel={platformLabel} />
      )}

      {/* Ambassadors vs Detractors */}
      {(ambassadorsList.length > 0 || detractorsList.length > 0) && (
        <AmbassadorsVsDetractors ambassadors={ambassadorsList} detractors={detractorsList} platformLabel={platformLabel} />
      )}

      {/* Topic Treemap */}
      {topicNodes.length > 0 && (
        <TopicTreemap topics={topicNodes} platformLabel={platformLabel} />
      )}

      {/* Topic x Emotion Matrix */}
      {topicEmotionData && topicEmotionData.topics.length > 0 && (
        <TopicEmotionHeatmap matrix={{ topics: topicEmotionData.topics, emotions: topicEmotionData.emotions, data: topicEmotionData.matrix }} platformLabel={platformLabel} />
      )}

      {/* Radar + Words */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {radarData.length > 0 && (
          <Section title="Radar de Emocoes">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                <Radar dataKey="value" stroke={t.primary} fill={t.primary} fillOpacity={0.12} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Section>
        )}
        {dashboard?.word_frequency && Object.keys(dashboard.word_frequency).length > 0 && (
          <Section title="Nuvem de Palavras" subtitle="Termos mais citados nos comentários">
            <WordCloudChart topics={dashboard.word_frequency} maxWords={30} height={220} />
          </Section>
        )}
      </div>

      {/* Heatmap — above temporal and posts */}
      {heatmapData && heatmapData.length > 0 && (
        <Heatmap data={heatmapData} />
      )}

      {/* Temporal */}
      <Section title="Analise Temporal" subtitle="Distribuicao por periodo">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", border: "0.5px solid var(--border)", backdropFilter: "blur(12px)", boxShadow: "0 2px 10px -2px rgba(0,0,0,0.05)" }}>
            {["Volume", "Score", "Sentimento", "Emocoes", "Topicos"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap" style={{ fontSize: "0.72rem", fontWeight: 500, backgroundColor: activeTab === tab ? "var(--primary)" : "transparent", color: activeTab === tab ? "white" : "var(--text-muted)", boxShadow: activeTab === tab ? "0 4px 16px -4px var(--primary)" : "none" }}>
                {tab === "Emocoes" ? "Emocoes" : tab === "Topicos" ? "Topicos" : tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="7d">Ultimos 7 dias</option>
              <option value="30d">Ultimos 30 dias</option>
              <option value="90d">Ultimos 90 dias</option>
              <option value="1a">Ultimo ano</option>
              <option value="Tudo">Todo o periodo</option>
            </select>
          </div>
        </div>
        {renderTemporalChart()}
      </Section>

      {/* Posts */}
      {posts.length > 0 && (
        <Section title="Posts" action={
          <div className="flex items-center gap-2">
            <select value={postSort} onChange={(e) => setPostSort(e.target.value as "recent" | "score")} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value="recent">Recentes</option>
              <option value="score">Score</option>
            </select>
            <select value={postLimit} onChange={(e) => setPostLimit(Number(e.target.value))} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.75rem", fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={0}>Todos</option>
            </select>
          </div>
        }>
          <div className="space-y-0.5">
            {posts.map((post, i) => {
              const ss = getScoreStyle(post.score);
              return (
                <div key={post.id || i} onClick={() => router.push(`/dashboard/post/${post.id}`)} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors group">
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
                  <span className="px-2 py-0.5 rounded-lg" style={{ fontSize: "0.72rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>
                    {post.score.toFixed(1)}
                  </span>
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Comments Table */}
      {commentsTableRows.length > 0 && (
        <CommentsTable comments={commentsTableRows} platformName={platformLabel} />
      )}
    </div>
  );
}
