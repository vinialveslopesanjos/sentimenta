"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn, scoreColor, scoreBg, formatNumber } from "@/lib/utils";

interface PostDetail {
  post: {
    id: string;
    platform: string;
    platform_post_id: string;
    post_type: string | null;
    content_text: string | null;
    like_count: number;
    comment_count: number;
    share_count: number;
    view_count: number;
    published_at: string | null;
    post_url: string | null;
  };
  comments: Array<{
    id: string;
    platform_comment_id: string;
    author_name: string | null;
    author_username: string | null;
    like_count: number;
    text_original: string;
    status: string;
  }>;
  analysis: Array<{
    comment_id: string;
    score_0_10: number | null;
    polarity: number | null;
    emotions: string[] | null;
    topics: string[] | null;
    sarcasm: boolean;
    summary_pt: string | null;
    confidence: number | null;
  }>;
  summary: {
    total_comments: number;
    total_analyzed: number;
    avg_score: number | null;
    avg_polarity: number | null;
    weighted_score: number | null;
    emotions_distribution: Record<string, number> | null;
    topics_frequency: Record<string, number> | null;
    sentiment_distribution: {
      negative: number;
      neutral: number;
      positive: number;
    } | null;
  } | null;
}

export default function PostDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token || !id) return;
    postsApi
      .detail(token, id as string)
      .then((d) => setData(d as unknown as PostDetail))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-text-secondary">Post não encontrado.</p>;
  }

  const { post, comments, analysis, summary } = data;

  // Map analysis by comment_id for quick lookup
  const analysisMap = new Map(
    analysis.map((a) => [a.comment_id, a])
  );

  const sentTotal = summary?.sentiment_distribution
    ? summary.sentiment_distribution.negative +
      summary.sentiment_distribution.neutral +
      summary.sentiment_distribution.positive
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          &larr; Voltar ao dashboard
        </Link>
      </div>

      {/* Post header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-surface-hover text-text-secondary">
                  {post.platform}
                </span>
                <span className="text-xs text-text-muted">
                  {post.post_type}
                </span>
              </div>
              <p className="text-text-primary">
                {post.content_text || "Sem texto"}
              </p>
              <div className="flex gap-4 mt-3 text-sm text-text-muted">
                <span>{formatNumber(post.like_count)} likes</span>
                <span>{formatNumber(post.comment_count)} comentários</span>
                {post.view_count > 0 && (
                  <span>{formatNumber(post.view_count)} views</span>
                )}
              </div>
            </div>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline shrink-0 ml-4"
              >
                Ver original &rarr;
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Score médio",
              value: summary.avg_score?.toFixed(1) ?? "--",
              color: scoreColor(summary.avg_score),
            },
            {
              label: "Score ponderado",
              value: summary.weighted_score?.toFixed(1) ?? "--",
              color: scoreColor(summary.weighted_score),
            },
            {
              label: "Analisados",
              value: `${summary.total_analyzed}/${summary.total_comments}`,
              color: "",
            },
            {
              label: "Polaridade",
              value: summary.avg_polarity?.toFixed(2) ?? "--",
              color:
                summary.avg_polarity !== null
                  ? summary.avg_polarity > 0
                    ? "text-positive"
                    : summary.avg_polarity < 0
                    ? "text-negative"
                    : "text-neutral"
                  : "",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-0">
                <p className="text-xs text-text-muted mb-1">{s.label}</p>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sentiment bar */}
      {summary?.sentiment_distribution && sentTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
              {(["positive", "neutral", "negative"] as const).map((key) => {
                const count = summary.sentiment_distribution![key];
                const pct = (count / sentTotal) * 100;
                const colors = {
                  positive: "bg-positive",
                  neutral: "bg-neutral",
                  negative: "bg-negative",
                };
                if (pct === 0) return null;
                return (
                  <div
                    key={key}
                    className={colors[key]}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top emotions and topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary?.emotions_distribution &&
          Object.keys(summary.emotions_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Emoções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.emotions_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([emotion, count]) => (
                      <span
                        key={emotion}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm"
                      >
                        {emotion}
                        <span className="text-xs text-text-muted">{count}</span>
                      </span>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

        {summary?.topics_frequency &&
          Object.keys(summary.topics_frequency).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tópicos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.topics_frequency)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([topic, count]) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-hover text-text-secondary text-sm"
                      >
                        {topic}
                        <span className="text-xs text-text-muted">{count}</span>
                      </span>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Comments list */}
      <Card>
        <CardHeader>
          <CardTitle>
            Comentários ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comments.map((comment) => {
              const a = analysisMap.get(comment.id);
              return (
                <div
                  key={comment.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background"
                >
                  {/* Score badge */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                      scoreBg(a?.score_0_10 ?? null),
                      scoreColor(a?.score_0_10 ?? null)
                    )}
                  >
                    {a?.score_0_10 !== null && a?.score_0_10 !== undefined
                      ? a.score_0_10.toFixed(0)
                      : "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {comment.author_name || comment.author_username || "Anônimo"}
                      </span>
                      {comment.like_count > 0 && (
                        <span className="text-xs text-text-muted">
                          {formatNumber(comment.like_count)} likes
                        </span>
                      )}
                      {a?.sarcasm && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral/10 text-neutral">
                          sarcasmo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {comment.text_original}
                    </p>
                    {a?.summary_pt && (
                      <p className="text-xs text-text-muted mt-1 italic">
                        {a.summary_pt}
                      </p>
                    )}
                    {a?.emotions && a.emotions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {a.emotions.map((em) => (
                          <span
                            key={em}
                            className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {em}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
