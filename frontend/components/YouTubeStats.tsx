"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { Eye, ThumbsUp, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Section } from "@/components/ds/Section";
import { StatCard } from "@/components/ds/StatCard";
import { useTheme } from "@/components/ThemeContext";
import { ChartTextAlternative } from "@/components/charts/ChartTextAlternative";
import { formatChartNumber, getPeriodRange, getTrendFact } from "@/lib/chartAccessibility";

// Hardcoded pt-BR strings (sem arquivo de tradução)
const labels = {
  sectionTitle: "Estatísticas do YouTube",
  subscribers: "Inscritos",
  totalViews: "Views totais",
  totalVideos: "Vídeos",
  avgEngagement: "Engajamento médio",
  subscriberGrowth: "Crescimento de inscritos",
  topVideos: "Top vídeos por engajamento",
  views: "views",
  likes: "likes",
  comments: "comentários",
};

interface YouTubeStatsData {
  channel_stats: {
    subscribers: number;
    total_views: number;
    total_videos: number;
    avg_views_per_video: number;
    avg_engagement_rate: number;
  };
  growth: Array<{ date: string; subscribers: number; views: number }>;
  top_videos: Array<{
    title: string;
    views: number;
    likes: number;
    comments: number;
    engagement_rate: number;
    published_at: string | null;
  }>;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("pt-BR");
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function YouTubeStats({ data }: { data: YouTubeStatsData }) {
  const { t } = useTheme();
  const locale = useLocale();
  const ta = useTranslations("charts.accessibility");
  const stats = data.channel_stats;

  const growthData = useMemo(
    () => data.growth.map((g) => ({ date: shortDate(g.date), subscribers: g.subscribers })),
    [data.growth],
  );

  const topVideosData = useMemo(
    () =>
      data.top_videos.map((v) => ({
        ...v,
        shortTitle: v.title.length > 45 ? v.title.slice(0, 42) + "..." : v.title,
      })),
    [data.top_videos],
  );
  const growthFact = getTrendFact(growthData, point => point.date, point => point.subscribers);
  const growthSummary = growthFact
    ? growthFact.start === growthFact.end
      ? ta("singlePoint", {
          series: labels.subscribers,
          value: formatChartNumber(growthFact.to, locale, 0),
          unit: ta("units.subscribers"),
          period: growthFact.end,
        })
      : growthFact.direction === "up"
        ? ta("trendUp", {
            series: labels.subscribers,
            delta: formatChartNumber(Math.abs(growthFact.delta), locale, 0),
            unit: ta("units.subscribers"),
            from: formatChartNumber(growthFact.from, locale, 0),
            to: formatChartNumber(growthFact.to, locale, 0),
            start: growthFact.start,
            end: growthFact.end,
          })
        : growthFact.direction === "down"
          ? ta("trendDown", {
              series: labels.subscribers,
              delta: formatChartNumber(Math.abs(growthFact.delta), locale, 0),
              unit: ta("units.subscribers"),
              from: formatChartNumber(growthFact.from, locale, 0),
              to: formatChartNumber(growthFact.to, locale, 0),
              start: growthFact.start,
              end: growthFact.end,
            })
          : ta("trendStable", {
              series: labels.subscribers,
              unit: ta("units.subscribers"),
              from: formatChartNumber(growthFact.from, locale, 0),
              to: formatChartNumber(growthFact.to, locale, 0),
              delta: 0,
              start: growthFact.start,
              end: growthFact.end,
            })
    : "";

  const tooltipStyle = {
    borderRadius: 12,
    border: "none",
    fontSize: "0.78rem",
    backgroundColor: t.bgCard,
  };

  return (
    <div className="space-y-4">
      {/* Channel overview cards */}
      <Section title={labels.sectionTitle}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={labels.subscribers} value={fmtNum(stats.subscribers)} />
          <StatCard label={labels.totalViews} value={fmtNum(stats.total_views)} />
          <StatCard label={labels.totalVideos} value={String(stats.total_videos)} />
          <StatCard
            label={labels.avgEngagement}
            value={`${(stats.avg_engagement_rate * 100).toFixed(2)}%`}
          />
        </div>
      </Section>

      {/* Subscriber Growth chart */}
      {growthData.length > 1 && (
        <Section title={labels.subscriberGrowth}>
          <div data-chart-visual="youtube-subscriber-growth" style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={growthData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
                <defs>
                  <linearGradient id="yt-subscribers-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={t.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: "0.72rem", fill: t.textMuted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: "0.72rem", fill: t.textMuted }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => fmtNum(v)}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="subscribers"
                  stroke={t.primary}
                  strokeWidth={2}
                  fill="url(#yt-subscribers-fill)"
                  name={labels.subscribers}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartTextAlternative
            chartId="youtube-subscriber-growth"
            title={labels.subscriberGrowth}
            summary={growthSummary}
            period={getPeriodRange(growthData, point => point.date, ta("currentSlice"))}
            unit={ta("units.subscribers")}
            columns={[
              { key: "date", label: ta("columns.date") },
              { key: "subscribers", label: ta("columns.subscribers"), numeric: true },
            ]}
            rows={growthData.map(point => ({
              date: point.date,
              subscribers: formatChartNumber(point.subscribers, locale, 0),
            }))}
          />
        </Section>
      )}

      {/* Top Videos */}
      {topVideosData.length > 0 && (
        <Section title={labels.topVideos}>
          <div className="space-y-3">
            {topVideosData.map((video, idx) => (
              <div
                key={idx}
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{
                  backgroundColor: t.bgSubtle,
                  border: `1px solid ${t.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: t.textPrimary,
                    fontFamily: "'Outfit', sans-serif",
                    lineHeight: 1.3,
                  }}
                >
                  {video.shortTitle}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: t.textMuted }}>
                    <Eye className="w-3 h-3" /> {fmtNum(video.views)} {labels.views}
                  </span>
                  <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: t.textMuted }}>
                    <ThumbsUp className="w-3 h-3" /> {fmtNum(video.likes)} {labels.likes}
                  </span>
                  <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: t.textMuted }}>
                    <MessageCircle className="w-3 h-3" /> {fmtNum(video.comments)} {labels.comments}
                  </span>
                  <span
                    className="ml-auto rounded-full px-2 py-0.5"
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      backgroundColor: t.primaryBg,
                      color: t.primary,
                    }}
                  >
                    {(video.engagement_rate * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
