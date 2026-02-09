"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatNumber, scoreColor } from "@/lib/utils";
import SentimentDonut from "@/components/charts/SentimentDonut";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import EngagementChart from "@/components/charts/EngagementChart";
import EmotionChart from "@/components/charts/EmotionChart";
import TopicsChart from "@/components/charts/TopicsChart";
import GranularitySelector from "@/components/GranularitySelector";
import SyncButton from "@/components/SyncButton";
import CommentsTable from "@/components/CommentsTable";
import type { ConnectionDashboard, TrendResponse } from "@/lib/types";

export default function ConnectionDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  const [data, setData] = useState<ConnectionDashboard | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [granularity, setGranularity] = useState("day");
  const [loading, setLoading] = useState(true);

  function fetchData() {
    const token = getToken();
    if (!token) return;
    Promise.all([
      dashboardApi.connectionDashboard(token, connectionId),
      dashboardApi.trends(token, { connection_id: connectionId, granularity, days: 90 }),
    ])
      .then(([connData, trendData]) => {
        setData(connData);
        setTrends(trendData);
      })
      .catch((err) => {
        console.error(err);
        router.push("/dashboard");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, granularity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-text-muted py-12">
        Conexão não encontrada.
      </div>
    );
  }

  const conn = data.connection;
  const platformLabel = conn.platform === "youtube" ? "YouTube" : "Instagram";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-text-muted hover:text-text-primary transition-colors text-sm"
          >
            &larr; Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-sm font-medium">
              {conn.platform === "youtube" ? "YT" : "IG"}
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {platformLabel} @{conn.username}
              </h1>
              <p className="text-xs text-text-muted">
                {formatNumber(conn.followers_count)} seguidores
                {conn.last_sync_at && (
                  <> &middot; Última análise: {new Date(conn.last_sync_at).toLocaleDateString("pt-BR")}</>
                )}
              </p>
            </div>
          </div>
        </div>
        <SyncButton connectionId={connectionId} onComplete={fetchData} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Score", value: data.avg_score?.toFixed(1) ?? "--", color: scoreColor(data.avg_score) },
          { label: "Ponderado", value: data.weighted_avg_score?.toFixed(1) ?? "--", color: scoreColor(data.weighted_avg_score) },
          { label: "Polaridade", value: data.avg_polarity?.toFixed(2) ?? "--" },
          { label: "Comentários", value: formatNumber(data.total_comments) },
          { label: "Views", value: formatNumber(data.engagement_totals.total_views) },
          { label: "Likes", value: formatNumber(data.engagement_totals.total_likes) },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-text-secondary mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color || "text-text-primary"}`}>
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Sentiment Trend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tendência de Sentimento</CardTitle>
            <GranularitySelector value={granularity} onChange={setGranularity} />
          </div>
        </CardHeader>
        <CardContent>
          <SentimentTrendChart
            data={trends?.data_points || []}
            granularity={granularity}
          />
        </CardContent>
      </Card>

      {/* Charts Row: Emotions + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Emoções</CardTitle>
          </CardHeader>
          <CardContent>
            <EmotionChart distribution={data.emotions_distribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tópicos</CardTitle>
          </CardHeader>
          <CardContent>
            <TopicsChart topics={data.topics_frequency} />
          </CardContent>
        </Card>
      </div>

      {/* Donut + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentDonut
              distribution={data.sentiment_distribution}
              avgScore={data.avg_score}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementChart
              data={trends?.data_points || []}
              granularity={granularity}
            />
          </CardContent>
        </Card>
      </div>

      {/* Posts */}
      {data.posts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Posts ({data.total_posts})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-surface-hover transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm truncate">{post.content_text || "Sem texto"}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatNumber(post.comment_count)} comentários &middot;{" "}
                      {formatNumber(post.like_count)} likes
                      {post.summary && (
                        <> &middot; Score: <span className={scoreColor(post.summary.avg_score)}>{post.summary.avg_score?.toFixed(1) ?? "--"}</span></>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">&rarr;</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comentários</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentsTable connectionId={connectionId} />
        </CardContent>
      </Card>
    </div>
  );
}
