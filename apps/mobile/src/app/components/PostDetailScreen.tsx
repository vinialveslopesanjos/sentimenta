import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import {
  ArrowLeft,
  Heart,
  BarChart3,
  MessageSquare,
  TrendingDown,
  ExternalLink,
  Instagram,
  Search,
  Filter,
  ChevronDown,
  Loader2,
} from "lucide-react";

interface PostDetailData {
  post: Record<string, any>;
  comments: Array<Record<string, any>>;
  analysis: Array<Record<string, any>>;
  summary: Record<string, any> | null;
}

function fmtDate(s: string | null) {
  if (!s) return "?";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildThumbnailSrc(url?: string | null) {
  if (!url) return null;
  const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${baseUrl}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function platformIcon(platform: string) {
  if (platform === "instagram") return <Instagram size={14} className="text-white" />;
  return <Instagram size={14} className="text-white" />;
}

export function PostDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PostDetailData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.apiFetch<PostDetailData>(`/posts/${id}`)
      .then((d) => setData(d))
      .catch((err) => console.error("Failed to load post:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center">
        <StatusBar />
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-violet-400 animate-spin" />
          <p className="text-slate-400" style={{ fontSize: "13px" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center">
        <StatusBar />
        <p className="text-slate-400" style={{ fontSize: "14px" }}>Post nao encontrado</p>
      </div>
    );
  }

  const { post, comments, analysis, summary } = data;

  // Parse media_urls for thumbnail
  let thumbnailUrl: string | null = null;
  if (post.media_urls) {
    try {
      const urls = typeof post.media_urls === "string" ? JSON.parse(post.media_urls) : post.media_urls;
      if (Array.isArray(urls) && urls.length > 0) {
        thumbnailUrl = buildThumbnailSrc(urls[0]);
      }
    } catch { /* ignore */ }
  }
  if (!thumbnailUrl && post.thumbnail_url) {
    thumbnailUrl = buildThumbnailSrc(post.thumbnail_url);
  }

  const platform = post.platform || "instagram";
  const postType = post.post_type || "Post";
  const title = post.content_text || "Post sem texto";
  const publishedAt = post.published_at || null;
  const likeCount = post.like_count || 0;
  const commentCount = post.comment_count || 0;
  const postUrl = post.post_url || null;

  // Summary data
  const avgScore = summary?.avg_score ?? null;
  const avgPolarity = summary?.avg_polarity ?? null;
  const totalAnalyzed = summary?.total_analyzed ?? comments.length;

  // Sentiment distribution from summary
  const sentDist = summary?.sentiment_distribution;
  const totalSent = sentDist ? (sentDist.positive || 0) + (sentDist.neutral || 0) + (sentDist.negative || 0) : 0;
  const positivePercent = totalSent > 0 ? Math.round(((sentDist?.positive || 0) / totalSent) * 100) : 0;
  const neutralPercent = totalSent > 0 ? Math.round(((sentDist?.neutral || 0) / totalSent) * 100) : 0;
  const negativePercent = totalSent > 0 ? Math.round(((sentDist?.negative || 0) / totalSent) * 100) : 0;

  // Emotions from summary or analysis
  const emotionsDist = summary?.emotions_distribution as Record<string, number> | undefined;
  const emotionsList = emotionsDist
    ? Object.entries(emotionsDist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k)
    : [...new Set(analysis.flatMap((a) => a.emotions || []))].slice(0, 8);

  // Topics from summary or analysis
  const topicsDist = summary?.topics_distribution as Record<string, number> | undefined;
  const topicsList = topicsDist
    ? Object.entries(topicsDist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k)
    : [...new Set(analysis.flatMap((a) => a.topics || []))].slice(0, 8);

  // Filter comments
  const filteredComments = comments.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.text_original || "").toLowerCase().includes(q) ||
      (c.author_username || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-400"
            style={{ fontSize: "13px" }}
          >
            <ArrowLeft size={16} />
            Voltar ao perfil
          </button>
          <span className="text-slate-300 mx-1">·</span>
          <span
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
          >
            Post
          </span>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Post Header Card */}
        <DreamCard className="p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-cyan-50 to-violet-50 rounded-full blur-2xl opacity-60" />

          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="w-full h-40 rounded-xl overflow-hidden mb-3 relative z-10">
              <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              {platformIcon(platform)}
            </div>
            <div>
              <span className="text-slate-600" style={{ fontSize: "12px", fontWeight: 500 }}>
                {platform} · {postType}
              </span>
            </div>
            <span className="text-slate-300 ml-auto" style={{ fontSize: "11px" }}>
              {fmtDate(publishedAt)}
            </span>
          </div>

          <p
            className="relative z-10"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}
          >
            {title}
          </p>

          <div className="flex items-center gap-4 mt-3 relative z-10">
            <div className="flex items-center gap-1 text-slate-400">
              <Heart size={14} className="text-rose-400" />
              <span style={{ fontSize: "12px" }}>{likeCount}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <MessageSquare size={14} className="text-cyan-400" />
              <span style={{ fontSize: "12px" }}>{commentCount} comentarios</span>
            </div>
          </div>

          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-3 text-violet-500 relative z-10"
              style={{ fontSize: "12px", fontWeight: 500 }}
            >
              <ExternalLink size={13} />
              Ver no {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </a>
          )}
        </DreamCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
              <Heart size={14} className="text-violet-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#06B6D4" }}>
              {avgScore !== null ? avgScore.toFixed(1) : "—"}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Score medio</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <BarChart3 size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}>
              —
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Score predominante</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <MessageSquare size={14} className="text-emerald-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#334155" }}>
              {totalAnalyzed}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Analisados</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center mb-2">
              <TrendingDown size={14} className="text-cyan-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#334155" }}>
              {avgPolarity !== null ? avgPolarity.toFixed(2) : "—"}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Polaridade</p>
          </DreamCard>
        </div>

        {/* Sentiment Distribution */}
        {totalSent > 0 && (
          <DreamCard className="p-5">
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
              className="mb-3"
            >
              Distribuicao de Sentimento
            </p>
            <div className="flex rounded-xl overflow-hidden h-4 mb-3">
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${positivePercent}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${neutralPercent}%` }}
              />
              <div
                className="bg-rose-400 transition-all"
                style={{ width: `${negativePercent}%` }}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-500" style={{ fontSize: "11px" }}>
                  Positivo <span className="text-emerald-500" style={{ fontWeight: 600 }}>{positivePercent}%</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-500" style={{ fontSize: "11px" }}>
                  Neutro <span className="text-amber-500" style={{ fontWeight: 600 }}>{neutralPercent}%</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-slate-500" style={{ fontSize: "11px" }}>
                  Negativo <span className="text-rose-500" style={{ fontWeight: 600 }}>{negativePercent}%</span>
                </span>
              </div>
            </div>
          </DreamCard>
        )}

        {/* Emotions & Topics */}
        <div className="grid grid-cols-2 gap-3">
          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>😊</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Emocoes
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {emotionsList.length > 0 ? emotionsList.map((e) => (
                <span
                  key={e}
                  className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  {e}
                </span>
              )) : (
                <span className="text-slate-300" style={{ fontSize: "11px" }}>Sem dados</span>
              )}
            </div>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>🏷️</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Topicos
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topicsList.length > 0 ? topicsList.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-600"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  {t}
                </span>
              )) : (
                <span className="text-slate-300" style={{ fontSize: "11px" }}>Sem dados</span>
              )}
            </div>
          </DreamCard>
        </div>

        {/* Comments */}
        <div>
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 500, color: "#334155" }}
            className="mb-3"
          >
            Comentarios
          </p>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <Search size={14} className="text-slate-300" />
              <input
                placeholder="Buscar comentarios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-slate-600 placeholder-slate-300 outline-none"
                style={{ fontSize: "12px" }}
              />
            </div>
            <button className="px-3 py-2 bg-slate-50 rounded-xl flex items-center gap-1 text-slate-500">
              <span style={{ fontSize: "11px" }}>Todos</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="space-y-2">
            {filteredComments.slice(0, 20).map((c) => {
              const score = c.analysis?.score_0_10 ?? c.score_0_10 ?? 0;
              const scoreNum = typeof score === "number" ? score : 0;
              const aiNote = c.analysis?.summary_pt || c.summary_pt || "";
              const emotion = c.analysis?.emotions?.[0] || c.emotions?.[0] || "—";
              const author = c.author_username || c.author_name || "Anonimo";
              const likes = c.like_count || 0;
              const text = c.text_original || "";
              const date = c.published_at ? fmtDate(c.published_at) : "";

              return (
                <DreamCard key={c.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex-shrink-0 mt-0.5 ${scoreNum >= 9
                          ? "text-emerald-500"
                          : scoreNum >= 7
                            ? "text-cyan-500"
                            : "text-amber-500"
                        }`}
                      style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 600 }}
                    >
                      {scoreNum.toFixed(1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-slate-600 truncate" style={{ fontSize: "12px", fontWeight: 500 }}>
                          {author}
                        </span>
                        {likes > 0 && (
                          <span className="flex items-center gap-0.5 text-slate-300" style={{ fontSize: "10px" }}>
                            <Heart size={10} /> {likes}
                          </span>
                        )}
                        <span className="text-slate-300 ml-auto" style={{ fontSize: "10px" }}>{date}</span>
                      </div>
                      <p className="text-slate-600 mb-1" style={{ fontSize: "12px" }}>
                        {text}
                      </p>
                      {aiNote && (
                        <p className="text-slate-400 mb-1.5" style={{ fontSize: "10px" }}>
                          IA: {aiNote}
                        </p>
                      )}
                      <div className="flex gap-1">
                        <span
                          className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600"
                          style={{ fontSize: "9px", fontWeight: 500 }}
                        >
                          {emotion}
                        </span>
                      </div>
                    </div>
                  </div>
                </DreamCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
