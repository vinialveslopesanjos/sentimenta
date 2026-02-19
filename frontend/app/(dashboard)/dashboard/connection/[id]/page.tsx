"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { dashboardApi, connectionsApi, commentsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type {
  ConnectionDashboard,
  TrendResponse,
  CommentWithAnalysis,
  CommentListResponse,
  PostSummary,
} from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

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
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
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

// ─── sub-components ──────────────────────────────────────────────────────────

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
  const allNull = pts.every((p) => p.avg_score === null);

  if (allNull) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-slate-200 gap-2">
        <span className="material-symbols-outlined text-[36px]">hourglass_top</span>
        <p className="text-sm font-light">Análise em andamento…</p>
        <p className="text-xs text-slate-300">Os scores aparecerão quando a análise concluir</p>
      </div>
    );
  }

  const scores = pts.map((p) => p.avg_score ?? 0);
  const maxScore = Math.max(...scores, 10);
  const W = pts.length * 60;
  const H = 200;
  const pad = 30;

  const toY = (s: number) => H - pad - ((s / maxScore) * (H - pad * 2));
  const toX = (i: number) => i * 60 + 30;

  const linePts = pts.map((p, i) => `${toX(i)},${toY(p.avg_score ?? 0)}`).join(" ");
  const areaPath = `M ${linePts.split(" ").join(" L ")} L ${toX(pts.length - 1)},${H - pad} L ${toX(0)},${H - pad} Z`;

  return (
    <div className="h-52 w-full relative">
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendGrad" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#C4B5FD", stopOpacity: 0.5 }} />
            <stop offset="100%" style={{ stopColor: "#C4B5FD", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendGrad)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.avg_score ?? 0)} r="4" fill="white" stroke="#8B5CF6" strokeWidth="2" />
          </g>
        ))}
        {/* Y axis labels */}
        {[0, 5, 10].map((v) => (
          <text key={v} x={4} y={toY(v) + 4} fontSize="9" fill="#CBD5E1" fontFamily="Inter">
            {v}
          </text>
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-slate-300 mt-1 font-light uppercase tracking-wider px-1">
        {pts
          .filter((_, i) => i % Math.ceil(pts.length / 6) === 0)
          .map((p, i) => (
            <span key={i}>{p.period.slice(5)}</span>
          ))}
      </div>
    </div>
  );
}

function HBarChart({
  data,
  colorFrom,
  colorTo,
  limit = 10,
}: {
  data: Record<string, number> | null;
  colorFrom: string;
  colorTo: string;
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

  return (
    <div className="space-y-2.5">
      {entries.map(([key, val]) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-light capitalize truncate max-w-[55%]">{key}</span>
            <span className="text-xs text-slate-400 font-light">{Math.round((val / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${colorFrom} ${colorTo} transition-all duration-700`}
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PostCard({ post }: { post: PostSummary }) {
  const score = post.summary?.avg_score ?? null;
  const gradients = [
    "from-violet-200 to-cyan-200",
    "from-pink-200 to-violet-200",
    "from-cyan-200 to-emerald-200",
    "from-amber-200 to-orange-200",
    "from-rose-200 to-pink-200",
    "from-indigo-200 to-blue-200",
  ];
  const grad = gradients[Math.abs(post.id.charCodeAt(0) % gradients.length)];

  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-sm`}>
        <span className="material-symbols-outlined text-[18px] text-white/80">
          {post.platform === "youtube" ? "play_circle" : "image"}
        </span>
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

// ─── page ────────────────────────────────────────────────────────────────────

export default function ConnectionPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ConnectionDashboard | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [comments, setComments] = useState<CommentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [granularity, setGranularity] = useState("day");

  // comment filters
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // post sort/limit
  const [postSort, setPostSort] = useState<"score_desc" | "score_asc" | "date_desc">("score_desc");
  const [postLimit, setPostLimit] = useState<number | null>(10);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMain = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const d = await dashboardApi.connectionDashboard(token, id);
      setData(d);
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
      } finally {
        setTrendsLoading(false);
      }
    },
    [id]
  );

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
      } finally {
        setCommentsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadMain();
    loadTrends(granularity);
    loadComments({ search, sentiment, offset });
  }, [loadMain]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGranularity = (g: string) => {
    setGranularity(g);
    loadTrends(g);
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
      await connectionsApi.sync(token, id);
      setTimeout(() => {
        loadMain();
        setSyncing(false);
      }, 2000);
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

  const platformColors: Record<string, string> = {
    instagram: "from-orange-100 to-pink-100 text-pink-500",
    youtube: "from-red-50 to-red-100 text-red-500",
  };
  const ptColor = platformColors[conn?.platform ?? ""] ?? "from-violet-50 to-violet-100 text-violet-500";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Header ── */}
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

        <button
          onClick={handleSync}
          disabled={syncing}
          className="ml-auto shrink-0 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-sm font-medium shadow-sm hover:shadow-float transition-all disabled:opacity-60"
        >
          {syncing ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span className="material-symbols-outlined text-[18px]">sync</span>
          )}
          {syncing ? "Analisando…" : "Analisar"}
        </button>
      </header>

      <main className="p-6 md:p-8 space-y-8 max-w-screen-xl mx-auto animate-fade-in">

        {/* ── KPI cards ── */}
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
                tooltip="Média aritmética dos scores (0–10) de todos os comentários analisados. Acima de 7 = positivo, abaixo de 4 = negativo."
              />
              <KpiCard
                icon="bar_chart_4_bars"
                label="Score ponderado"
                value={data?.weighted_avg_score != null ? `${data.weighted_avg_score.toFixed(1)}/10` : "—"}
                sub="Score ponderado"
                iconBg="bg-cyan-50 text-brand-cyanDark"
                valueClass={scoreColor(data?.weighted_avg_score ?? null)}
                tooltip="Média ponderada pela relevância de cada comentário (curtidas + engajamento). Reflete a opinião mais influente."
              />
              <KpiCard
                icon="ssid_chart"
                label="Polaridade"
                value={data?.avg_polarity != null ? data.avg_polarity.toFixed(2) : "—"}
                sub="Polaridade média"
                iconBg="bg-indigo-50 text-indigo-500"
                valueClass="text-slate-700"
                tooltip="Escala de −1 (muito negativo) a +1 (muito positivo) baseada na análise semântica. Complementa o score numérico."
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

        {/* ── Trend chart ── */}
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
            <div className="h-52 bg-slate-50 rounded-2xl animate-pulse" />
          ) : (
            <TrendChart data={trends} granularity={granularity} />
          )}
        </div>

        {/* ── Emotions + Topics ── */}
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
              <HBarChart data={data?.emotions_distribution ?? null} colorFrom="from-violet-300" colorTo="to-brand-lilac" limit={7} />
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
              <HBarChart data={data?.topics_frequency ?? null} colorFrom="from-cyan-300" colorTo="to-brand-cyan" limit={10} />
            )}
          </div>
        </div>

        {/* ── Sentiment distribution + Engagement ── */}
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

        {/* ── Posts list ── */}
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

        {/* ── Comments table ── */}
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
                  placeholder="Buscar comentários…"
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
