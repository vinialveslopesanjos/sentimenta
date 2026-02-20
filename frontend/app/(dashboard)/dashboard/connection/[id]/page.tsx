"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { dashboardApi, connectionsApi, commentsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  DEFAULT_SYNC_SETTINGS,
  loadSyncSettings,
  saveSyncSettings,
  toSyncPayload,
  type SyncSettings,
} from "@/lib/syncSettings";
import type {
  ConnectionDashboard,
  TrendResponse,
  TrendsDetailedResponse,
  TrendsDetailedPeriod,
  CommentWithAnalysis,
  CommentListResponse,
  PostSummary,
} from "@/lib/types";

// Temporal chart constants

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function buildThumbnailSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${API_URL}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const EMOTION_PALETTE = [
  "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B",
  "#EF4444", "#3B82F6", "#EC4899", "#64748B",
];

const SENTIMENT_CHART_COLORS: Record<string, string> = {
  positive: "#34D399",
  neutral: "#FCD34D",
  negative: "#FB7185",
};

function buildSeriesFromDetailed(
  dataPoints: TrendsDetailedPeriod[],
  field: "emotions" | "topics"
): { key: string; label: string; color: string; values: number[] }[] {
  const totals: Record<string, number> = {};
  for (const dp of dataPoints) {
    for (const [key, val] of Object.entries(dp[field])) {
      totals[key] = (totals[key] || 0) + val;
    }
  }
  const topKeys = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);

  return topKeys.map((key, idx) => ({
    key,
    label: key,
    color: EMOTION_PALETTE[idx % EMOTION_PALETTE.length],
    values: dataPoints.map((dp) => dp[field][key] || 0),
  }));
}

// Helpers

function scoreColor(s: number | null) {
  if (s === null) return "text-slate-300";
  if (s >= 7) return "text-emerald-600";
  if (s >= 4) return "text-amber-500";
  return "text-rose-500";
}

function scoreBg(s: number | null) {
  if (s === null) return "bg-slate-50 text-slate-400 border-slate-100";
  if (s >= 7) return "bg-emerald-50 text-emerald-600 border-emerald-100";
  if (s >= 4) return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-rose-50 text-rose-500 border-rose-100";
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtDate(s: string | null) {
  if (!s) return "?";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function parsePeriod(period: string) {
  if (/^\d{4}-\d{2}$/.test(period)) return new Date(`${period}-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return new Date(`${period}T00:00:00`);
  const dt = new Date(period);
  return Number.isNaN(dt.getTime()) ? new Date("1970-01-01T00:00:00") : dt;
}

function formatMonthYear(period: string) {
  return parsePeriod(period).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

function formatDayLabel(period: string) {
  return parsePeriod(period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function platformIcon(platform: string, size = 18) {
  if (platform === "instagram") {
    return (
      <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
        <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

// Sub-components

function SkeletonKpi() {
  return (
    <div className="dream-card p-5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-100 mb-4" />
      <div className="h-7 w-20 bg-slate-100 rounded-lg mb-2" />
      <div className="h-3.5 w-24 bg-slate-100 rounded" />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconBg,
  valueClass,
  tooltip,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  valueClass?: string;
  tooltip?: string;
}) {
  return (
    <div className="dream-card p-5 hover:shadow-float transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <h3 className={`text-2xl font-sans font-semibold ${valueClass ?? "text-slate-700"}`}>{value}</h3>
      <div className="flex items-center mt-1">
        <p className="text-xs text-slate-400 font-light">{sub ?? label}</p>
        {tooltip && <MetricTooltip text={tooltip} />}
      </div>
    </div>
  );
}

function MetricTooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex ml-1">
      <span className="material-symbols-outlined text-[14px] text-slate-300 hover:text-brand-lilacDark cursor-help">info</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-slate-800 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function TrendChart({ data, granularity }: { data: TrendResponse | null; granularity: string }) {
  if (!data || data.data_points.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-slate-200 gap-2">
        <span className="material-symbols-outlined text-[36px]">show_chart</span>
        <p className="text-sm font-light">Aguardando comentários</p>
      </div>
    );
  }

  const pts = data.data_points;
  const hasScore = pts.some((p) => p.avg_score !== null);
  const granularityLabel =
    granularity === "day" ? "dia" : granularity === "week" ? "semana" : "mês";

  if (!hasScore) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-slate-200 gap-2">
        <span className="material-symbols-outlined text-[36px]">hourglass_top</span>
        <p className="text-sm font-light">Análise em andamento...</p>
        <p className="text-xs text-slate-300">Os scores aparecerão quando a análise concluir</p>
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, left: -14, bottom: 8 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={26}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(period: string) => formatMonthYear(period)}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "#C4B5FD", strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as {
                period: string;
                avg_score: number | null;
                total_comments: number;
                positive: number;
                neutral: number;
                negative: number;
              };

              return (
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg min-w-[180px]">
                  <p className="text-xs text-slate-400 mb-1">{formatDayLabel(point.period)} · {granularityLabel}</p>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Score médio: {point.avg_score != null ? point.avg_score.toFixed(2) : "—"}
                  </p>
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>Total comentários: {point.total_comments}</p>
                    <p>Positivo: {point.positive}</p>
                    <p>Neutro: {point.neutral}</p>
                    <p>Negativo: {point.negative}</p>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="avg_score"
            stroke="none"
            fill="url(#scoreFill)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avg_score"
            stroke="#8B5CF6"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: "#8B5CF6" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HBarChart({
  data,
  palette,
  limit = 10,
}: {
  data: Record<string, number> | null;
  palette: "emotion" | "topic";
  limit?: number;
}) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="py-8 text-center text-slate-200 text-sm font-light">Sem dados</div>;
  }

  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries[0][1];
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const gradients =
    palette === "emotion"
      ? [
          ["#A78BFA", "#8B5CF6"],
          ["#BFA9F9", "#A78BFA"],
          ["#D4C4FB", "#C4B5FD"],
          ["#E9DDFD", "#DDD6FE"],
        ]
      : [
          ["#22D3EE", "#06B6D4"],
          ["#67E8F9", "#22D3EE"],
          ["#A5F3FC", "#67E8F9"],
          ["#CFFAFE", "#A5F3FC"],
        ];

  return (
    <div className="space-y-2.5">
      {entries.map(([key, val], idx) => {
        const [from, to] = gradients[Math.min(idx, gradients.length - 1)];
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-light capitalize truncate max-w-[55%]">{key}</span>
              <span className="text-xs text-slate-400 font-light">{Math.round((val / total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(val / max) * 100}%`,
                  backgroundImage: `linear-gradient(90deg, ${from}, ${to})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StackedBarChart({
  periods,
  series,
  mode,
}: {
  periods: string[];
  series: { key: string; label: string; color: string; values: number[] }[];
  mode: "absolute" | "pct";
}) {
  if (periods.length === 0 || series.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-200">
        <p className="text-sm font-light">Sem dados para o período</p>
      </div>
    );
  }

  const rows = periods.map((period, i) => {
    const row: Record<string, number | string> = { period };
    const total = series.reduce((s, ser) => s + (ser.values[i] || 0), 0);
    for (const ser of series) {
      const raw = ser.values[i] || 0;
      row[ser.key] = mode === "pct" ? (total > 0 ? (raw / total) * 100 : 0) : raw;
    }
    return row;
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -14, bottom: 8 }}>
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={24}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(period: string) => formatMonthYear(period)}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            domain={mode === "pct" ? [0, 100] : [0, "auto"]}
            tickFormatter={(v: number) => (mode === "pct" ? `${Math.round(v)}%` : String(Math.round(v)))}
          />
          <Tooltip
            cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
            formatter={(value: number, name: string) => {
              const label = series.find((s) => s.key === name)?.label || name;
              if (mode === "pct") return [`${value.toFixed(1)}%`, label];
              return [Math.round(value), label];
            }}
            labelFormatter={(period: string) => formatDayLabel(period)}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="stack" fill={s.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyCommentsChart({ data }: { data: TrendResponse | null }) {
  if (!data || data.data_points.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-200">
        <p className="text-sm font-light">Sem dados mensais</p>
      </div>
    );
  }

  const pts = data.data_points.map((p) => ({
    period: p.period,
    total_comments: p.total_comments ?? 0,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, left: -14, bottom: 8 }}>
          <defs>
            <linearGradient id="monthlyCommentsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            minTickGap={24}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(period: string) => formatMonthYear(period)}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#67E8F9", strokeDasharray: "4 4" }}
            labelFormatter={(period: string) => formatMonthYear(period)}
            formatter={(value: number) => [Math.round(value), "Comentários"]}
          />
          <Area type="monotone" dataKey="total_comments" stroke="none" fill="url(#monthlyCommentsFill)" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="total_comments"
            stroke="#06B6D4"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: "#06B6D4" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function PostCard({ post }: { post: PostSummary }) {
  const score = post.summary?.avg_score ?? null;
  const [imgError, setImgError] = useState(false);
  const thumbnailSrc = buildThumbnailSrc(post.thumbnail_url);
  const gradients = [
    "from-violet-200 to-cyan-200",
    "from-pink-200 to-violet-200",
    "from-cyan-200 to-emerald-200",
    "from-amber-200 to-orange-200",
    "from-rose-200 to-pink-200",
    "from-indigo-200 to-blue-200",
  ];
  const grad = gradients[Math.abs(post.id.charCodeAt(0) % gradients.length)];
  const showThumb = thumbnailSrc && !imgError;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group"
    >
      <div className="w-12 h-12 rounded-xl shrink-0 shadow-sm overflow-hidden">
        {showThumb ? (
          <img
            src={thumbnailSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-[18px] text-white/80">
              {post.platform === "youtube" ? "play_circle" : "image"}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-brand-lilacDark transition-colors">
          {post.content_text?.slice(0, 70) || "Post sem texto"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">
          {post.platform} · {fmt(post.comment_count)} comentários
          {post.published_at && ` · ${fmtDate(post.published_at)}`}
        </p>
      </div>
      {score !== null && (
        <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border shrink-0 ${scoreBg(score)}`}>
          {score.toFixed(1)}
        </span>
      )}
    </Link>
  );
}

function CommentRow({ comment }: { comment: CommentWithAnalysis }) {
  const score = comment.analysis?.score_0_10 ?? null;
  const emotions = comment.analysis?.emotions ?? [];
  const sarcasm = comment.analysis?.sarcasm ?? false;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="py-3 pl-4 pr-2 w-16">
        {score !== null ? (
          <span className={`inline-block text-xs font-bold px-2 py-1 rounded-lg border ${scoreBg(score)}`}>
            {score.toFixed(1)}
          </span>
        ) : (
          <span className="inline-block text-xs px-2 py-1 rounded-lg bg-slate-50 text-slate-300 border border-slate-100">
            —
          </span>
        )}
      </td>
      <td className="py-3 px-2 w-32">
        <p className="text-xs font-medium text-slate-700 truncate">
          {comment.author_name || comment.author_username || "Anônimo"}
        </p>
        {comment.like_count > 0 && (
          <p className="text-[10px] text-slate-300 mt-0.5">❤ {comment.like_count}</p>
        )}
      </td>
      <td className="py-3 px-2">
        <p className="text-xs text-slate-500 font-light line-clamp-2">{comment.text_original}</p>
        {comment.analysis?.summary_pt && (
          <p className="text-[10px] text-slate-400 italic mt-0.5">
            IA: {comment.analysis.summary_pt}
          </p>
        )}
      </td>
      <td className="py-3 pl-2 pr-4 w-40">
        <div className="flex flex-wrap gap-1">
          {sarcasm && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-md font-medium">
              🎭 sarcasmo
            </span>
          )}
          {emotions.slice(0, 3).map((e) => (
            <span key={e} className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-md font-light capitalize">
              {e}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

// Page

export default function ConnectionPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ConnectionDashboard | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<TrendResponse | null>(null);
  const [detailedTrends, setDetailedTrends] = useState<TrendsDetailedResponse | null>(null);
  const [comments, setComments] = useState<CommentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [granularity, setGranularity] = useState("day");
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncParams, setSyncParams] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);

  // temporal chart tabs
  const [temporalTab, setTemporalTab] = useState<"sentiment" | "emotions" | "topics">("sentiment");

  // comment filters
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // post sort/limit
  const [postSort, setPostSort] = useState<"score_desc" | "score_asc" | "date_desc">("score_desc");
  const [postLimit, setPostLimit] = useState<number | null>(10);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSyncParams = useCallback((next: SyncSettings) => {
    const saved = saveSyncSettings(next);
    setSyncParams(saved);
  }, []);

  const loadMain = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const d = await dashboardApi.connectionDashboard(token, id);
      setData(d);
    } catch (error) {
      console.error("Falha ao carregar dashboard da conexão", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTrends = useCallback(
    async (gran: string) => {
      const token = getToken();
      if (!token) return;
      setTrendsLoading(true);
      try {
        const t = await dashboardApi.trends(token, {
          connection_id: id,
          granularity: gran,
          days: 30,
        });
        setTrends(t);
      } catch (error) {
        console.error("Falha ao carregar tendências", error);
        setTrends({ data_points: [], granularity: gran });
      } finally {
        setTrendsLoading(false);
      }
    },
    [id]
  );

  const loadDetailedTrends = useCallback(
    async (gran: string) => {
      const token = getToken();
      if (!token) return;
      setDetailedLoading(true);
      try {
        const d = await dashboardApi.trendsDetailed(token, {
          connection_id: id,
          granularity: gran,
          days: 30,
        });
        setDetailedTrends(d);
      } catch (error) {
        console.error("Falha ao carregar tendências detalhadas", error);
        setDetailedTrends({ data_points: [], granularity: gran });
      } finally {
        setDetailedLoading(false);
      }
    },
    [id]
  );

  const loadMonthlyTrends = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setMonthlyLoading(true);
    try {
      const t = await dashboardApi.trends(token, {
        connection_id: id,
        granularity: "month",
        days: 3650,
      });
      setMonthlyTrends(t);
    } catch (error) {
      console.error("Falha ao carregar volume mensal", error);
      setMonthlyTrends({ data_points: [], granularity: "month" });
    } finally {
      setMonthlyLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(
    async (q: { search: string; sentiment: string; offset: number }) => {
      const token = getToken();
      if (!token) return;
      setCommentsLoading(true);
      try {
        const c = await commentsApi.list(token, {
          connection_id: id,
          sentiment: q.sentiment || undefined,
          search: q.search || undefined,
          limit: LIMIT,
          offset: q.offset,
          sort: "score",
          order: "desc",
        });
        setComments(c);
      } catch (error) {
        console.error("Falha ao carregar comentários", error);
        setComments({ items: [], total: 0, limit: LIMIT, offset: q.offset });
      } finally {
        setCommentsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    setSyncParams(loadSyncSettings());
    loadMain();
    loadTrends(granularity);
    loadMonthlyTrends();
    loadDetailedTrends(granularity);
    loadComments({ search, sentiment, offset });
  }, [loadMain]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGranularity = (g: string) => {
    setGranularity(g);
    loadTrends(g);
    loadDetailedTrends(g);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      loadComments({ search: v, sentiment, offset: 0 });
    }, 400);
  };

  const handleSentiment = (v: string) => {
    setSentiment(v);
    setOffset(0);
    loadComments({ search, sentiment: v, offset: 0 });
  };

  const handlePage = (dir: "prev" | "next") => {
    const newOffset = dir === "next" ? offset + LIMIT : Math.max(0, offset - LIMIT);
    setOffset(newOffset);
    loadComments({ search, sentiment, offset: newOffset });
  };

  const handleSync = async () => {
    const token = getToken();
    if (!token) return;
    setSyncing(true);
    try {
      await connectionsApi.sync(token, id, toSyncPayload(syncParams));
      setTimeout(() => {
        loadMain();
        loadTrends(granularity);
        loadMonthlyTrends();
        loadDetailedTrends(granularity);
        loadComments({ search, sentiment, offset });
        setSyncing(false);
      }, 4000);
    } catch {
      setSyncing(false);
    }
  };

  const conn = data?.connection;
  const dist = data?.sentiment_distribution;
  const distTotal = dist ? (dist.positive + dist.neutral + dist.negative) || 1 : 1;
  const posRate = dist ? Math.round((dist.positive / distTotal) * 100) : 0;
  const neuRate = dist ? Math.round((dist.neutral / distTotal) * 100) : 0;
  const negRate = dist ? Math.round((dist.negative / distTotal) * 100) : 0;
  const negativeRate = dist ? Math.round((dist.negative / distTotal) * 100) : 0;

  const platformColors: Record<string, string> = {
    instagram: "from-orange-100 to-pink-100 text-pink-500",
    youtube: "from-red-50 to-red-100 text-red-500",
  };
  const ptColor = platformColors[conn?.platform ?? ""] ?? "from-violet-50 to-violet-100 text-violet-500";

  // Temporal chart data
  const temporalPeriods = temporalTab === "sentiment"
    ? (trends?.data_points ?? []).map((p) => p.period)
    : (detailedTrends?.data_points ?? []).map((p) => p.period);

  const temporalSeries = temporalTab === "sentiment"
    ? [
        { key: "positive", label: "Positivo", color: SENTIMENT_CHART_COLORS.positive, values: (trends?.data_points ?? []).map((p) => p.positive) },
        { key: "neutral", label: "Neutro", color: SENTIMENT_CHART_COLORS.neutral, values: (trends?.data_points ?? []).map((p) => p.neutral) },
        { key: "negative", label: "Negativo", color: SENTIMENT_CHART_COLORS.negative, values: (trends?.data_points ?? []).map((p) => p.negative) },
      ]
    : buildSeriesFromDetailed(
        detailedTrends?.data_points ?? [],
        temporalTab === "emotions" ? "emotions" : "topics"
      );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* -- Header -- */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-8 py-4 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-lilacDark transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Voltar
        </Link>

        {loading ? (
          <div className="flex-1 flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-2xl bg-slate-100" />
            <div>
              <div className="h-4 w-32 bg-slate-100 rounded mb-1" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ) : conn ? (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${ptColor} flex items-center justify-center shrink-0`}>
              {platformIcon(conn.platform)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-sans font-semibold text-slate-800 truncate">
                  @{conn.username}
                </h1>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${conn.status === "active"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-rose-50 text-rose-500 border-rose-100"
                    }`}
                >
                  {conn.status === "active" ? "Ativo" : conn.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 capitalize">
                {conn.platform}
                {conn.followers_count > 0 && ` · ${fmt(conn.followers_count)} seguidores`}
                {conn.last_sync_at && ` · Sync ${fmtDate(conn.last_sync_at)}`}
              </p>
            </div>
          </div>
        ) : null}

        <div className="ml-auto shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowSyncSettings((v) => !v)}
            className="h-10 w-10 rounded-full border border-slate-100 text-slate-400 hover:text-brand-lilacDark hover:border-brand-lilac transition-colors flex items-center justify-center"
            title="Ajustar coleta"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-sm font-medium shadow-sm hover:shadow-float transition-all disabled:opacity-60"
          >
            {syncing ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span className="material-symbols-outlined text-[18px]">sync</span>
            )}
            {syncing ? "Analisando..." : "Analisar"}
          </button>
        </div>
      </header>

      <main className="p-6 md:p-8 space-y-8 max-w-screen-xl mx-auto animate-fade-in">
        {showSyncSettings && (
          <div className="dream-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Posts por sync</p>
              <div className="flex gap-1.5 flex-wrap">
                {[10, 50, 200].map((value) => (
                  <button
                    key={value}
                    onClick={() => updateSyncParams({ ...syncParams, max_posts: value })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                      syncParams.max_posts === value
                        ? "bg-brand-lilacDark text-white border-brand-lilacDark"
                        : "bg-white text-slate-500 border-slate-200 hover:border-brand-lilac"
                    }`}
                  >
                    {value === 200 ? "Todos (200)" : value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Comentários por post</p>
              <div className="flex gap-1.5 flex-wrap">
                {[10, 100, 1000].map((value) => (
                  <button
                    key={value}
                    onClick={() => updateSyncParams({ ...syncParams, max_comments_per_post: value })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                      syncParams.max_comments_per_post === value
                        ? "bg-brand-cyanDark text-white border-brand-cyanDark"
                        : "bg-white text-slate-500 border-slate-200 hover:border-brand-cyan"
                    }`}
                  >
                    {value === 1000 ? "Todos (1000)" : value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">A partir de</p>
              <input
                type="date"
                value={syncParams.since_date}
                onChange={(e) => updateSyncParams({ ...syncParams, since_date: e.target.value })}
                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-brand-lilac transition-colors"
              />
              {syncParams.since_date && (
                <button
                  onClick={() => updateSyncParams({ ...syncParams, since_date: "" })}
                  className="text-[10px] text-slate-400 hover:text-rose-500 mt-1"
                >
                  Limpar filtro de data
                </button>
              )}
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-sm font-medium shadow-sm hover:shadow-float transition-all disabled:opacity-60"
              >
                {syncing ? "Adicionando..." : "Adicionar novos dados"}
              </button>
            </div>
          </div>
        )}

        {/* -- KPI cards -- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => <SkeletonKpi key={i} />)
          ) : (
            <>
              <KpiCard
                icon="favorite"
                label="Score médio"
                value={data?.avg_score != null ? `${data.avg_score.toFixed(1)}/10` : "—"}
                sub="Score médio"
                iconBg="bg-violet-50 text-brand-lilacDark"
                valueClass={scoreColor(data?.avg_score ?? null)}
                tooltip="Média aritmética dos scores (0-10) de todos os comentários analisados. Acima de 7 = positivo, abaixo de 4 = negativo."
              />
              <KpiCard
                icon="bar_chart_4_bars"
                label="Taxa negativa"
                value={`${negativeRate}%`}
                sub="Comentários negativos"
                iconBg="bg-cyan-50 text-brand-cyanDark"
                valueClass={negativeRate >= 35 ? "text-rose-500" : negativeRate >= 20 ? "text-amber-500" : "text-emerald-600"}
                tooltip="Percentual de comentários classificados como negativos no período. Ajuda a monitorar risco reputacional com mais clareza."
              />
              <KpiCard
                icon="ssid_chart"
                label="Polaridade"
                value={data?.avg_polarity != null ? data.avg_polarity.toFixed(2) : "—"}
                sub="Polaridade média"
                iconBg="bg-indigo-50 text-indigo-500"
                valueClass="text-slate-700"
                tooltip="Escala de -1 (muito negativo) a +1 (muito positivo) baseada na análise semântica. Complementa o score numérico."
              />
              <KpiCard
                icon="forum"
                label="Comentários"
                value={fmt(data?.total_comments ?? 0)}
                sub="Comentários coletados"
                iconBg="bg-rose-50 text-rose-400"
              />
              <KpiCard
                icon="thumb_up"
                label="Engagement"
                value={fmt((data?.engagement_totals.total_likes ?? 0) + (data?.engagement_totals.total_views ?? 0))}
                sub="Likes + Views"
                iconBg="bg-amber-50 text-amber-500"
              />
              <KpiCard
                icon="article"
                label="Posts"
                value={fmt(data?.total_posts ?? 0)}
                sub={`${fmt(data?.total_analyzed ?? 0)} analisados`}
                iconBg="bg-emerald-50 text-emerald-500"
              />
            </>
          )}
        </div>

        {/* -- Monthly comments chart -- */}
        <div className="dream-card p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-sans font-medium text-slate-700">Volume de Comentários</h2>
              <p className="text-sm text-slate-400 font-light mt-0.5">Quantidade de comentários por mês</p>
            </div>
          </div>
          {monthlyLoading ? (
            <div className="h-56 bg-slate-50 rounded-2xl animate-pulse" />
          ) : (
            <MonthlyCommentsChart data={monthlyTrends} />
          )}
        </div>

        {/* -- Trend chart -- */}
        <div className="dream-card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-sans font-medium text-slate-700">Tendência de Score</h2>
              <p className="text-sm text-slate-400 font-light mt-0.5">Score médio ao longo do tempo</p>
            </div>
            <div className="flex rounded-xl border border-slate-100 overflow-hidden text-sm shrink-0">
              {[
                { label: "Dia", value: "day" },
                { label: "Semana", value: "week" },
                { label: "Mês", value: "month" },
              ].map((g) => (
                <button
                  key={g.value}
                  onClick={() => handleGranularity(g.value)}
                  className={`px-4 py-1.5 font-medium transition-colors ${granularity === g.value
                    ? "bg-brand-lilacDark text-white"
                    : "bg-white text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          {trendsLoading ? (
            <div className="h-60 bg-slate-50 rounded-2xl animate-pulse" />
          ) : (
            <TrendChart data={trends} granularity={granularity} />
          )}
        </div>

        {/* -- Análise Temporal -- */}
        <div className="dream-card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-sans font-medium text-slate-700">Análise Temporal</h2>
              <p className="text-sm text-slate-400 font-light mt-0.5">Distribuição por período</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl border border-slate-100 overflow-hidden text-xs">
                {([
                  { label: "Sentimento", value: "sentiment" as const },
                  { label: "Emoções", value: "emotions" as const },
                  { label: "Tópicos", value: "topics" as const },
                ] as const).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemporalTab(t.value)}
                    className={`px-3 py-1.5 font-medium transition-colors ${temporalTab === t.value ? "bg-brand-lilacDark text-white" : "bg-white text-slate-400 hover:text-slate-600"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {trendsLoading || detailedLoading ? (
            <div className="h-56 bg-slate-50 rounded-2xl animate-pulse" />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Intensidade absoluta</p>
                  <StackedBarChart
                    periods={temporalPeriods}
                    series={temporalSeries}
                    mode="absolute"
                  />
                </div>
                <div className="rounded-2xl border border-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Distribuição 100%</p>
                  <StackedBarChart
                    periods={temporalPeriods}
                    series={temporalSeries}
                    mode="pct"
                  />
                </div>
              </div>
              {temporalSeries.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {temporalSeries.map((s) => (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-slate-400 font-light capitalize">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* -- Emotions + Topics -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="dream-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 text-brand-lilacDark flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">sentiment_satisfied</span>
              </div>
              <h2 className="text-base font-sans font-medium text-slate-700">Emoções</h2>
              <span className="text-xs text-slate-300 font-light ml-1">top 7</span>
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-6 bg-slate-50 rounded-lg" />
                ))}
              </div>
            ) : (
              <HBarChart data={data?.emotions_distribution ?? null} palette="emotion" limit={7} />
            )}
          </div>
          <div className="dream-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 text-brand-cyanDark flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">label</span>
              </div>
              <h2 className="text-base font-sans font-medium text-slate-700">Tópicos</h2>
              <span className="text-xs text-slate-300 font-light ml-1">top 10</span>
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-6 bg-slate-50 rounded-lg" />
                ))}
              </div>
            ) : (
              <HBarChart data={data?.topics_frequency ?? null} palette="topic" limit={10} />
            )}
          </div>
        </div>

        {/* -- Sentiment distribution + Engagement -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="dream-card p-6">
            <h2 className="text-base font-sans font-medium text-slate-700 mb-5">Distribuição de Sentimento</h2>
            {loading ? (
              <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
            ) : dist ? (
              <>
                <div className="h-3 rounded-full overflow-hidden flex gap-0.5 mb-4">
                  <div className="h-full rounded-l-full bg-emerald-400" style={{ width: `${posRate}%` }} />
                  <div className="h-full bg-amber-300" style={{ width: `${neuRate}%` }} />
                  <div className="h-full rounded-r-full bg-rose-400" style={{ width: `${negRate}%` }} />
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Positivo", pct: posRate, dot: "bg-emerald-400", text: "text-emerald-600", count: dist.positive },
                    { label: "Neutro", pct: neuRate, dot: "bg-amber-300", text: "text-amber-600", count: dist.neutral },
                    { label: "Negativo", pct: negRate, dot: "bg-rose-400", text: "text-rose-600", count: dist.negative },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                        <span className="text-sm text-slate-500 font-light">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-300 font-light">{fmt(item.count)}</span>
                        <span className={`text-sm font-sans font-semibold ${item.text}`}>{item.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-slate-200 text-sm">Sem dados</div>
            )}
          </div>

          <div className="dream-card p-6">
            <h2 className="text-base font-sans font-medium text-slate-700 mb-5">Engajamento</h2>
            {loading ? (
              <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-4">
                {[
                  { icon: "favorite", label: "Likes", value: data?.engagement_totals.total_likes ?? 0, color: "text-rose-400 bg-rose-50" },
                  { icon: "visibility", label: "Views", value: data?.engagement_totals.total_views ?? 0, color: "text-blue-400 bg-blue-50" },
                  { icon: "forum", label: "Comentários", value: data?.engagement_totals.total_comments ?? 0, color: "text-violet-400 bg-violet-50" },
                ].map((e) => (
                  <div key={e.label} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${e.color} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[18px]">{e.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 font-light">{e.label}</p>
                      <p className="text-sm font-sans font-semibold text-slate-700">{fmt(e.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* -- Posts list -- */}
        <div className="dream-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-sans font-medium text-slate-700">Posts</h2>
              <span className="text-xs text-slate-300 font-light">{data?.total_posts ?? 0} no total</span>
            </div>
            {!loading && (data?.posts ?? []).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Sort */}
                <div className="flex rounded-xl border border-slate-100 overflow-hidden text-xs shrink-0">
                  {[
                    { label: "↓ Score", value: "score_desc" as const },
                    { label: "↑ Score", value: "score_asc" as const },
                    { label: "Recentes", value: "date_desc" as const },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setPostSort(s.value)}
                      className={`px-3 py-1.5 font-medium transition-colors ${postSort === s.value ? "bg-brand-lilacDark text-white" : "bg-white text-slate-400 hover:text-slate-600"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* Limit */}
                <div className="flex rounded-xl border border-slate-100 overflow-hidden text-xs shrink-0">
                  {[
                    { label: "10", value: 10 as number | null },
                    { label: "25", value: 25 as number | null },
                    { label: "50", value: 50 as number | null },
                    { label: "Todos", value: null as number | null },
                  ].map((l) => (
                    <button
                      key={String(l.value)}
                      onClick={() => setPostLimit(l.value)}
                      className={`px-3 py-1.5 font-medium transition-colors ${postLimit === l.value ? "bg-brand-cyanDark text-white" : "bg-white text-slate-400 hover:text-slate-600"}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-14 bg-slate-50 rounded-2xl" />
              ))}
            </div>
          ) : (data?.posts ?? []).length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-slate-200">article</span>
              </div>
              <p className="text-sm text-slate-300 font-light">Nenhum post encontrado. Clique em Analisar para importar.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {[...(data?.posts ?? [])]
                .sort((a, b) => {
                  if (postSort === "score_desc") return (b.summary?.avg_score ?? -1) - (a.summary?.avg_score ?? -1);
                  if (postSort === "score_asc") return (a.summary?.avg_score ?? -1) - (b.summary?.avg_score ?? -1);
                  return 0;
                })
                .slice(0, postLimit ?? undefined)
                .map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
            </div>
          )}
        </div>

        {/* -- Comments table -- */}
        <div className="dream-card overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-base font-sans font-medium text-slate-700 shrink-0">Comentários</h2>
            <div className="flex flex-1 gap-3 min-w-0">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar comentários..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-100 bg-slate-50 text-slate-600 placeholder-slate-300 focus:outline-none focus:border-brand-lilac focus:bg-white transition-colors"
                />
              </div>
              {/* Sentiment filter */}
              <select
                value={sentiment}
                onChange={(e) => handleSentiment(e.target.value)}
                className="text-sm rounded-xl border border-slate-100 bg-slate-50 text-slate-500 px-3 py-2 focus:outline-none focus:border-brand-lilac shrink-0"
              >
                <option value="">Todos</option>
                <option value="positive">Positivo</option>
                <option value="neutral">Neutro</option>
                <option value="negative">Negativo</option>
              </select>
            </div>
          </div>

          {commentsLoading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 rounded-xl" />
              ))}
            </div>
          ) : (comments?.items ?? []).length === 0 ? (
            <div className="py-16 text-center text-slate-200 text-sm font-light">
              <span className="material-symbols-outlined text-[36px] block mb-2">forum</span>
              Nenhum comentário encontrado
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="py-3 pl-4 pr-2 text-[10px] text-slate-300 uppercase tracking-wider font-medium w-16">Score</th>
                      <th className="py-3 px-2 text-[10px] text-slate-300 uppercase tracking-wider font-medium w-32">Autor</th>
                      <th className="py-3 px-2 text-[10px] text-slate-300 uppercase tracking-wider font-medium">Comentário</th>
                      <th className="py-3 pl-2 pr-4 text-[10px] text-slate-300 uppercase tracking-wider font-medium w-40">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comments?.items ?? []).map((c) => (
                      <CommentRow key={c.id} comment={c} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(comments?.total ?? 0) > LIMIT && (
                <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-xs text-slate-300 font-light">
                    {offset + 1}–{Math.min(offset + LIMIT, comments?.total ?? 0)} de {comments?.total ?? 0}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={offset === 0}
                      onClick={() => handlePage("prev")}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-100 text-slate-400 hover:border-brand-lilac hover:text-brand-lilacDark transition-colors disabled:opacity-30"
                    >
                      ← Anterior
                    </button>
                    <button
                      disabled={offset + LIMIT >= (comments?.total ?? 0)}
                      onClick={() => handlePage("next")}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-100 text-slate-400 hover:border-brand-lilac hover:text-brand-lilacDark transition-colors disabled:opacity-30"
                    >
                      Próximo →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}



