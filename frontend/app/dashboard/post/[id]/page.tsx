"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Eye, ThumbsUp, ExternalLink, Search } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { postsApi, commentsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useTranslations } from "next-intl";
import type { CommentWithAnalysis, CommentListResponse } from "@/lib/types";
import { fmt, fmtDatetime, scoreBg } from "@/lib/helpers";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { StatCard } from "@/components/ds/StatCard";
import { Section } from "@/components/ds/Section";
import { SentimentBar } from "@/components/ds/SentimentBar";
import { getScoreStyle } from "@/components/ds/tokens";
import SentimentRadar from "@/components/charts/SentimentRadar";
import WordCloudChart from "@/components/charts/WordCloudChart";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";

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
  topics_frequency?: Record<string, number> | null;
  word_frequency?: Record<string, number> | null;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("post");
  const tc = useTranslations("common");
  const postId = params.id as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [summary, setSummary] = useState<PostSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const [comments, setComments] = useState<CommentListResponse | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentFilter, setCommentFilter] = useState("");
  const [emotionFilter, setEmotionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPost = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await postsApi.detail(token, postId);
      setPost(res.post as unknown as PostDetail);
      if (res.summary) setSummary(res.summary as unknown as PostSummaryData);
    } finally { setLoading(false); }
  }, [postId]);

  const loadComments = useCallback(async (q: { search: string; sentiment: string; emotion: string; offset: number }) => {
    const token = getToken();
    if (!token) return;
    setCommentsLoading(true);
    try {
      const c = await commentsApi.list(token, {
        post_id: postId,
        sentiment: q.sentiment || undefined,
        emotion: q.emotion || undefined,
        search: q.search || undefined,
        limit: LIMIT,
        offset: q.offset,
        sort: "date",
        order: "desc",
      });
      setComments(c);
    } finally { setCommentsLoading(false); }
  }, [postId]);

  useEffect(() => {
    loadPost();
    loadComments({ search: searchQuery, sentiment: commentFilter, emotion: emotionFilter, offset });
  }, [loadPost]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (v: string) => {
    setSearchQuery(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      loadComments({ search: v, sentiment: commentFilter, emotion: emotionFilter, offset: 0 });
    }, 400);
  };

  const handleSentiment = (v: string) => {
    setCommentFilter(v);
    setOffset(0);
    loadComments({ search: searchQuery, sentiment: v, emotion: emotionFilter, offset: 0 });
  };

  const handleEmotion = (v: string) => {
    setEmotionFilter(v);
    setOffset(0);
    loadComments({ search: searchQuery, sentiment: commentFilter, emotion: v, offset: 0 });
  };

  const handlePage = (dir: "prev" | "next") => {
    const newOffset = dir === "next" ? offset + LIMIT : Math.max(0, offset - LIMIT);
    setOffset(newOffset);
    loadComments({ search: searchQuery, sentiment: commentFilter, emotion: emotionFilter, offset: newOffset });
  };

  const dist = summary?.sentiment_distribution;
  const distTotal = dist ? (dist.positive + dist.neutral + dist.negative) || 1 : 1;
  const posRate = dist ? Math.round((dist.positive / distTotal) * 100) : 0;
  const neuRate = dist ? Math.round((dist.neutral / distTotal) * 100) : 0;
  const negRate = dist ? Math.round((dist.negative / distTotal) * 100) : 0;

  const avgScore = summary?.avg_score ?? null;
  const weightedScore = summary?.weighted_avg_score ?? null;
  const avgPolarity = summary?.avg_polarity ?? null;
  const emotionsDist = summary?.emotions_distribution ?? null;
  const topicsDist = summary?.topics_frequency ?? null;
  const wordFreq = summary?.word_frequency ?? null;

  const emotionsList = emotionsDist ? Object.entries(emotionsDist).sort((a, b) => b[1] - a[1]).map(([k]) => k) : [];
  const topicsList = topicsDist ? Object.entries(topicsDist).sort((a, b) => b[1] - a[1]).map(([k]) => k) : [];

  const TEXT_LIMIT = 200;
  const postText = post?.content_text ?? "";
  const isLong = postText.length > TEXT_LIMIT;
  const displayText = isLong && !expanded ? postText.slice(0, TEXT_LIMIT) + "\u2026" : postText;

  const platformLabel = post?.platform ? post.platform.charAt(0).toUpperCase() + post.platform.slice(1) : "Post";

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </button>
        {post?.connection_id && (
          <Link href={`/profile/${post.connection_id}`} style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--primary)" }}>{t("backToProfile")}</Link>
        )}
        <span style={{ color: "var(--text-xfaint)" }}>/</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("post")}</span>
      </div>

      {/* Post info */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-24 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
            <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
          </div>
        ) : post ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <GlassSocialIcon platform={post.platform} size={20} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{platformLabel} {post.post_type ? `\u00B7 ${post.post_type}` : ""}</span>
              {post.published_at && <span className="ml-auto" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{fmtDatetime(post.published_at)}</span>}
            </div>
            {postText ? (
              <div className="mb-4">
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.15rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>{displayText}</h2>
                {isLong && (
                  <button onClick={() => setExpanded(!expanded)} style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 500 }}>
                    {expanded ? t("viewLess") : t("viewMore")}
                  </button>
                )}
              </div>
            ) : (
              <p className="mb-4" style={{ fontSize: "0.82rem", color: "var(--text-faint)", fontStyle: "italic" }}>{t("noText")}</p>
            )}
            <div className="flex items-center gap-5">
              {[
                { icon: Heart, value: fmt(post.like_count), color: "var(--sentiment-negative)" },
                { icon: MessageCircle, value: fmt(post.comment_count), color: "var(--primary)" },
                ...(post.view_count ? [{ icon: Eye, value: fmt(post.view_count), color: "var(--text-muted)" }] : []),
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{s.value}</span>
                </div>
              ))}
              {post.post_url && (
                <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 hover:underline" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
                  {t("viewOnPlatform", { platform: platformLabel })} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("notFound")}</p>
        )}
      </div>

      {/* Stats */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard variant="tinted" tintColor="var(--primary)" tintBg="var(--primary-bg)" icon={<Heart className="w-5 h-5" style={{ color: "var(--primary)" }} />} label={t("stats.score")} value={weightedScore != null ? `${weightedScore.toFixed(1)}/10` : avgScore != null ? `${avgScore.toFixed(1)}/10` : "\u2014"} />
          {avgPolarity != null && (
            <StatCard variant="tinted" tintColor="var(--primary)" tintBg="var(--primary-bg)" icon={<ThumbsUp className="w-5 h-5" style={{ color: "var(--primary)" }} />} label={t("stats.positivity")} value={avgPolarity.toFixed(2)} />
          )}
          <StatCard icon={<MessageCircle className="w-5 h-5" style={{ color: "var(--secondary)" }} />} label={t("stats.analyzed")} value={fmt(summary.total_analyzed)} />
          {posRate > 0 && (
            <StatCard variant="highlighted" icon={<ThumbsUp className="w-5 h-5 text-white/60" />} label={t("stats.positive")} value={`${posRate}%`} />
          )}
        </div>
      )}

      {/* Sentiment */}
      {!loading && dist && (
        <Section title={t("sentimentDistribution")}>
          <SentimentBar positive={dist.positive} neutral={dist.neutral} negative={dist.negative} height={24} showLabels />
        </Section>
      )}

      {/* Emotions + Topics */}
      {!loading && (emotionsList.length > 0 || topicsList.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title={t("emotions")}>
            <div className="flex flex-wrap gap-2">
              {emotionsList.map(e => (
                <span key={e} className="px-3 py-1.5 rounded-lg capitalize" style={{ fontSize: "0.72rem", fontWeight: 500, backgroundColor: "var(--primary-bg)", color: "var(--primary)" }}>{e}</span>
              ))}
            </div>
          </Section>
          <Section title={t("topics")}>
            <div className="flex flex-wrap gap-2">
              {topicsList.map(tp => (
                <span key={tp} className="px-3 py-1.5 rounded-lg capitalize" style={{ fontSize: "0.72rem", fontWeight: 500, backgroundColor: "var(--secondary-bg)", color: "var(--secondary)" }}>{tp}</span>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Radar + Words */}
      {!loading && (summary?.total_analyzed ?? 0) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title={t("emotionRadar")} subtitle={t("emotionRadarSub")}>
            <SentimentRadar distribution={emotionsDist} height={200} />
          </Section>
          <Section title={t("wordCloud")} subtitle={t("wordCloudSub")}>
            <WordCloudChart topics={wordFreq} maxWords={15} height={200} />
          </Section>
        </div>
      )}

      {/* Comments */}
      <Section title={t("comments")}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
            <input type="text" placeholder={tc("search")} value={searchQuery} onChange={e => handleSearch(e.target.value)} className="bg-transparent focus:outline-none w-28" style={{ fontSize: "0.78rem", color: "var(--text-primary)" }} />
          </div>
          <select value={commentFilter} onChange={e => handleSentiment(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all" style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
            <option value="">{t("commentFilter.all")}</option>
            <option value="positive">{t("commentFilter.positive")}</option>
            <option value="neutral">{t("commentFilter.neutral")}</option>
            <option value="negative">{t("commentFilter.negative")}</option>
          </select>
          <select value={emotionFilter} onChange={e => handleEmotion(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all" style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
            <option value="">{t("commentFilter.allEmotions")}</option>
            {["Alegria", "Tristeza", "Raiva", "Surpresa", "Nojo", "Medo", "Amor"].map(em => (
              <option key={em} value={em}>{em}</option>
            ))}
          </select>
        </div>
        {commentsLoading ? (
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 p-3">
                <div className="w-12 h-8 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                  <div className="h-3 w-full rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (comments?.items ?? []).length === 0 ? (
          <div className="py-12 text-center" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            {t("noComments")}
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" style={{ fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{t("tableHeaders.score")}</th>
                    <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{t("tableHeaders.user")}</th>
                    <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{t("tableHeaders.comment")}</th>
                    <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{t("tableHeaders.emotion")}</th>
                    <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{t("tableHeaders.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(comments?.items ?? []).map((c) => {
                    const score = c.analysis?.score_0_10 ?? null;
                    const emotions = c.analysis?.emotions ?? [];
                    const ss = score !== null ? getScoreStyle(score) : null;
                    return (
                      <tr key={c.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2.5 px-3">
                          {score !== null && ss && (
                            <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.68rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>{score.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.author_name || c.author_username || tc("anonymous")}</span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[400px]">
                          <p className="line-clamp-2" style={{ color: "var(--text-muted)" }}>{c.text_original}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          {emotions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {emotions.map((e: string) => (
                                <span key={e} className="px-2 py-0.5 rounded-md capitalize" style={{ fontSize: "0.62rem", fontWeight: 500, backgroundColor: "var(--primary-bg)", color: "var(--primary)" }}>{e}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.published_at && (
                            <span style={{ color: "var(--text-faint)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>{fmtDatetime(c.published_at)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {(comments?.items ?? []).map((c) => {
                const score = c.analysis?.score_0_10 ?? null;
                const emotions = c.analysis?.emotions ?? [];
                const ss = score !== null ? getScoreStyle(score) : null;
                return (
                  <div key={c.id} className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {score !== null && ss && (
                        <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.65rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>{score.toFixed(1)}</span>
                      )}
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{c.author_name || c.author_username || tc("anonymous")}</span>
                      {c.published_at && (
                        <span className="ml-auto" style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>{fmtDatetime(c.published_at)}</span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--text-muted)", wordBreak: "break-word" }}>{c.text_original}</p>
                    {emotions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {emotions.map((e: string) => (
                          <span key={e} className="px-2 py-0.5 rounded capitalize" style={{ fontSize: "0.6rem", fontWeight: 500, backgroundColor: "var(--primary-bg)", color: "var(--primary)" }}>{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {(comments?.total ?? 0) > LIMIT && (
              <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                  {offset + 1}\u2013{Math.min(offset + LIMIT, comments?.total ?? 0)} {tc("of")} {comments?.total ?? 0}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handlePage("prev")} disabled={offset === 0}>{t("pagination.previous")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePage("next")} disabled={offset + LIMIT >= (comments?.total ?? 0)}>{t("pagination.next")}</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
