"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { postsApi, commentsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { CommentWithAnalysis, CommentListResponse } from "@/lib/types";

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

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function platformIcon(platform: string, size = 16) {
  const isInstagram = String(platform).toLowerCase() === "instagram";
  const isTwitter = String(platform).toLowerCase() === "twitter";
  const src = isInstagram ? "/icons/instagram.svg" : isTwitter ? "/icons/twitter-x.svg" : "/icons/youtube.svg";
  return <img src={src} alt={platform} style={{ width: size, height: size }} />;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface PostDetail {
  id: string;
  platform: string;
  post_type: string | null;
  content_text: string | null;
  like_count: number;
  comment_count: number;
  view_count?: number;
  published_at: string | null;
  post_url: string | null;
  connection_id?: string;
}

interface PostSummaryData {
  avg_score: number | null;
  weighted_avg_score?: number | null;
  avg_polarity?: number | null;
  sentiment_distribution: { positive: number; neutral: number; negative: number } | null;
  total_analyzed: number;
  emotions_distribution?: Record<string, number> | null;
  topics_distribution?: Record<string, number> | null;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  iconBg,
  valueClass,
}: {
  icon: string;
  label: string;
  value: string | number;
  iconBg: string;
  valueClass?: string;
}) {
  return (
    <div className="dream-card p-5 hover:shadow-float transition-all duration-300 group">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <h3 className={`text-2xl font-sans font-semibold ${valueClass ?? "text-slate-700"}`}>{value}</h3>
      <p className="text-xs text-slate-400 font-light mt-1">{label}</p>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div className="dream-card p-5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-100 mb-4" />
      <div className="h-7 w-20 bg-slate-100 rounded-lg mb-2" />
      <div className="h-3 w-24 bg-slate-100 rounded" />
    </div>
  );
}

function BadgeList({
  items,
  bgClass,
  textClass,
  borderClass,
}: {
  items: string[];
  bgClass: string;
  textClass: string;
  borderClass: string;
}) {
  if (items.length === 0) return <p className="text-xs text-slate-200 font-light">Sem dados</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`text-xs px-2.5 py-1 rounded-full border ${bgClass} ${textClass} ${borderClass} capitalize font-light`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function CommentCard({ comment }: { comment: CommentWithAnalysis }) {
  const score = comment.analysis?.score_0_10 ?? null;
  const emotions = comment.analysis?.emotions ?? [];
  const topics = comment.analysis?.topics ?? [];
  const sarcasm = comment.analysis?.sarcasm ?? false;
  const summary = comment.analysis?.summary_pt ?? null;

  return (
    <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50/60 transition-colors group">
      {/* Score badge */}
      <div className="shrink-0 pt-0.5">
        {score !== null ? (
          <span className={`inline-block text-sm font-bold px-2.5 py-1 rounded-xl border ${scoreBg(score)} min-w-[3rem] text-center`}>
            {score.toFixed(1)}
          </span>
        ) : (
          <span className="inline-block text-sm px-2.5 py-1 rounded-xl bg-slate-50 text-slate-300 border border-slate-100 min-w-[3rem] text-center">
            —
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Author + likes */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-sm font-medium text-slate-700">
            {comment.author_name || comment.author_username || "Anônimo"}
          </span>
          {comment.author_username && comment.author_name && (
            <span className="text-xs text-slate-300">@{comment.author_username}</span>
          )}
          {comment.like_count > 0 && (
            <span className="text-xs text-slate-300 flex items-center gap-1 ml-auto">
              ❤ {fmt(comment.like_count)}
            </span>
          )}
          {comment.published_at && (
            <span className="text-[10px] text-slate-200 font-light shrink-0">
              {new Date(comment.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>

        {/* Text */}
        <p className="text-sm text-slate-600 font-light leading-relaxed">{comment.text_original}</p>

        {/* AI summary */}
        {summary && (
          <p className="text-xs text-slate-400 italic mt-1.5">
            <span className="not-italic font-medium text-brand-lilacDark">IA:</span> {summary}
          </p>
        )}

        {/* Badges */}
        {(emotions.length > 0 || topics.length > 0 || sarcasm) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sarcasm && (
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                🎭 sarcasmo
              </span>
            )}
            {emotions.map((e) => (
              <span key={e} className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-100 px-2 py-0.5 rounded-full font-light capitalize">
                {e}
              </span>
            ))}
            {topics.map((t) => (
              <span key={t} className="text-xs bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full font-light capitalize">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [summary, setSummary] = useState<PostSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const [comments, setComments] = useState<CommentListResponse | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPost = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await postsApi.detail(token, postId);
      const p = res.post as unknown as PostDetail;
      setPost(p);
      if (res.summary) {
        setSummary(res.summary as unknown as PostSummaryData);
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadComments = useCallback(
    async (q: { search: string; sentiment: string; offset: number }) => {
      const token = getToken();
      if (!token) return;
      setCommentsLoading(true);
      try {
        const c = await commentsApi.list(token, {
          post_id: postId,
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
    [postId]
  );

  useEffect(() => {
    loadPost();
    loadComments({ search, sentiment, offset });
  }, [loadPost]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const dist = summary?.sentiment_distribution;
  const distTotal = dist ? (dist.positive + dist.neutral + dist.negative) || 1 : 1;
  const posRate = dist ? Math.round((dist.positive / distTotal) * 100) : 0;
  const neuRate = dist ? Math.round((dist.neutral / distTotal) * 100) : 0;
  const negRate = dist ? Math.round((dist.negative / distTotal) * 100) : 0;

  const avgScore = summary?.avg_score ?? null;
  const summaryAny = summary as unknown as Record<string, unknown> | null;
  const weightedScore = (summaryAny?.weighted_avg_score as number | null) ?? null;
  const avgPolarity = (summaryAny?.avg_polarity as number | null) ?? null;

  const TEXT_LIMIT = 200;
  const postText = post?.content_text ?? "";
  const isLong = postText.length > TEXT_LIMIT;
  const displayText = isLong && !expanded ? postText.slice(0, TEXT_LIMIT) + "…" : postText;

  // emotions & topics from summary if available
  const emotionsDist = (summaryAny?.emotions_distribution as Record<string, number> | null) ?? null;
  const topicsDist = (summaryAny?.topics_distribution as Record<string, number> | null) ?? null;

  const emotionsList = emotionsDist
    ? Object.entries(emotionsDist)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
    : [];

  const topicsList = topicsDist
    ? Object.entries(topicsDist)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
    : [];

  const platformLabel = post?.platform
    ? post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
    : "Post";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-8 py-4 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-lilacDark transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Voltar ao perfil
        </Link>
        {post?.connection_id && (
          <>
            <span className="text-slate-200">/</span>
            <Link
              href={`/dashboard/connection/${post.connection_id}`}
              className="text-sm text-slate-400 hover:text-brand-lilacDark transition-colors truncate"
            >
              Perfil
            </Link>
          </>
        )}
        <span className="text-slate-200 shrink-0">/</span>
        <span className="text-sm text-slate-600 font-medium truncate">Post</span>
      </header>

      <main className="p-6 md:p-8 space-y-8 max-w-screen-xl mx-auto animate-fade-in">

        {/* ── Post card ── */}
        <div className="dream-card p-6 md:p-8">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-5 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-4 w-3/4 bg-slate-100 rounded" />
              <div className="flex gap-4 mt-4">
                {Array(4).fill(0).map((_, i) => <div key={i} className="h-8 w-20 bg-slate-100 rounded-xl" />)}
              </div>
            </div>
          ) : post ? (
            <>
              {/* Platform + type row */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-slate-50 shadow-sm overflow-hidden`}>
                  {platformIcon(post.platform)}
                </div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide capitalize">
                  {platformLabel}
                  {post.post_type && ` · ${post.post_type}`}
                </span>
                {post.published_at && (
                  <span className="text-xs text-slate-300 font-light ml-auto">{fmtDate(post.published_at)}</span>
                )}
              </div>

              {/* Text */}
              {postText ? (
                <div className="mb-5">
                  <p className="text-sm text-slate-600 font-light leading-relaxed whitespace-pre-line">
                    {displayText}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="text-xs text-brand-lilacDark font-medium mt-2 hover:underline"
                    >
                      {expanded ? "Ver menos" : "Ver mais"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-300 font-light italic mb-5">Post sem texto</p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <span className="text-rose-400">❤</span>
                  <span>{fmt(post.like_count)}</span>
                  <span className="text-xs text-slate-300 ml-0.5">likes</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <span>💬</span>
                  <span>{fmt(post.comment_count)}</span>
                  <span className="text-xs text-slate-300 ml-0.5">comentários</span>
                </div>
                {(post.view_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <span>👁</span>
                    <span>{fmt(post.view_count ?? 0)}</span>
                    <span className="text-xs text-slate-300 ml-0.5">views</span>
                  </div>
                )}
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-100 text-xs font-medium text-slate-500 hover:border-brand-lilac hover:text-brand-lilacDark transition-colors"
                  >
                    Ver no {platformLabel}
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300">Post não encontrado</p>
          )}
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {loading ? (
            Array(4).fill(0).map((_, i) => <SkeletonKpi key={i} />)
          ) : (
            <>
              <KpiCard
                icon="favorite"
                label="Score médio"
                value={avgScore != null ? avgScore.toFixed(1) : "—"}
                iconBg="bg-violet-50 text-brand-lilacDark"
                valueClass={scoreColor(avgScore)}
              />
              <KpiCard
                icon="bar_chart_4_bars"
                label="Score ponderado"
                value={weightedScore != null ? weightedScore.toFixed(1) : "—"}
                iconBg="bg-cyan-50 text-brand-cyanDark"
                valueClass={scoreColor(weightedScore)}
              />
              <KpiCard
                icon="check_circle"
                label="Analisados"
                value={fmt(summary?.total_analyzed ?? 0)}
                iconBg="bg-emerald-50 text-emerald-500"
              />
              <KpiCard
                icon="ssid_chart"
                label="Polaridade"
                value={avgPolarity != null ? avgPolarity.toFixed(2) : "—"}
                iconBg="bg-indigo-50 text-indigo-500"
              />
            </>
          )}
        </div>

        {/* ── Sentiment distribution bar ── */}
        <div className="dream-card p-6">
          <h2 className="text-base font-sans font-medium text-slate-700 mb-5">Distribuição de Sentimento</h2>
          {loading ? (
            <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
          ) : dist ? (
            <>
              <div className="h-4 rounded-full overflow-hidden flex gap-0.5 mb-4">
                <div
                  className="h-full rounded-l-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${posRate}%` }}
                />
                <div
                  className="h-full bg-amber-300 transition-all duration-700"
                  style={{ width: `${neuRate}%` }}
                />
                <div
                  className="h-full rounded-r-full bg-rose-400 transition-all duration-700"
                  style={{ width: `${negRate}%` }}
                />
              </div>
              <div className="flex gap-6">
                {[
                  { label: "Positivo", pct: posRate, count: dist.positive, dot: "bg-emerald-400", text: "text-emerald-600" },
                  { label: "Neutro", pct: neuRate, count: dist.neutral, dot: "bg-amber-300", text: "text-amber-600" },
                  { label: "Negativo", pct: negRate, count: dist.negative, dot: "bg-rose-400", text: "text-rose-600" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.dot} shrink-0`} />
                    <span className="text-sm text-slate-500 font-light">{item.label}</span>
                    <span className={`text-sm font-sans font-semibold ${item.text}`}>{item.pct}%</span>
                    <span className="text-xs text-slate-300 font-light">({fmt(item.count)})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-slate-200 text-sm font-light">Sem dados de sentimento</div>
          )}
        </div>

        {/* ── Emotions + Topics ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="dream-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 text-brand-cyanDark flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">sentiment_satisfied</span>
              </div>
              <h2 className="text-base font-sans font-medium text-slate-700">Emoções</h2>
            </div>
            {loading ? (
              <div className="flex flex-wrap gap-2 animate-pulse">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-6 w-20 bg-slate-100 rounded-full" />
                ))}
              </div>
            ) : (
              <BadgeList
                items={emotionsList.length > 0 ? emotionsList : []}
                bgClass="bg-cyan-50"
                textClass="text-cyan-700"
                borderClass="border-cyan-100"
              />
            )}
          </div>

          <div className="dream-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 text-brand-lilacDark flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">label</span>
              </div>
              <h2 className="text-base font-sans font-medium text-slate-700">Tópicos</h2>
            </div>
            {loading ? (
              <div className="flex flex-wrap gap-2 animate-pulse">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-6 w-20 bg-slate-100 rounded-full" />
                ))}
              </div>
            ) : (
              <BadgeList
                items={topicsList.length > 0 ? topicsList : []}
                bgClass="bg-violet-50"
                textClass="text-violet-600"
                borderClass="border-violet-100"
              />
            )}
          </div>
        </div>

        {/* ── Comments section ── */}
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
            <div className="p-6 space-y-4 animate-pulse">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-8 bg-slate-50 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-slate-100 rounded" />
                    <div className="h-3 w-full bg-slate-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (comments?.items ?? []).length === 0 ? (
            <div className="py-16 text-center text-slate-200 text-sm font-light">
              <span className="material-symbols-outlined text-[36px] block mb-2">forum</span>
              Nenhum comentário encontrado
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-50 p-2">
                {(comments?.items ?? []).map((c) => (
                  <CommentCard key={c.id} comment={c} />
                ))}
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
