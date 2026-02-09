"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn, formatNumber, scoreColor } from "@/lib/utils";
import SentimentDonut from "@/components/charts/SentimentDonut";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import GranularitySelector from "@/components/GranularitySelector";
import AIHealthReport from "@/components/AIHealthReport";
import SyncButton from "@/components/SyncButton";
import { FadeIn } from "@/components/animations/FadeIn";
import { StaggerList } from "@/components/animations/StaggerList";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
import type { DashboardSummary, TrendResponse } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [granularity, setGranularity] = useState("day");
  const [loading, setLoading] = useState(true);

  function fetchData() {
    const token = getToken();
    if (!token) return;
    Promise.all([
      dashboardApi.summary(token),
      dashboardApi.trends(token, { granularity, days: 90 }),
    ])
      .then(([summary, trendData]) => {
        setData(summary);
        setTrends(trendData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="h-8 w-36 bg-[#21262d] rounded animate-pulse" />
          <div className="h-9 w-28 bg-[#21262d] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart />
          <SkeletonChart className="lg:col-span-2" />
        </div>
        <SkeletonChart />
      </div>
    );
  }

  if (!data || data.total_connections === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CardContent>
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-accent">+</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Conecte sua primeira rede social
            </h2>
            <p className="text-text-secondary mb-6 max-w-sm">
              Vincule seu Instagram ou YouTube para começar a analisar o
              sentimento dos seus seguidores.
            </p>
            <Link href="/connect">
              <Button size="lg">Conectar rede social</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/connect">
          <Button variant="secondary" size="sm">
            + Conectar
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Conexões",
            value: data.total_connections,
            sub: "redes sociais",
          },
          { label: "Posts", value: data.total_posts, sub: "coletados" },
          {
            label: "Comentários",
            value: data.total_comments,
            sub: `${data.total_analyzed} analisados`,
          },
          {
            label: "Score médio",
            value: data.avg_score !== null ? data.avg_score.toFixed(1) : "--",
            sub: "de 0 a 10",
            color: scoreColor(data.avg_score),
          },
        ].map((stat) => (
          <Card key={stat.label} className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10 hover:border-[#7c3aed]/50">
            <CardContent className="pt-0">
              <p className="text-sm text-text-secondary mb-1">{stat.label}</p>
              <p
                className={cn(
                  "text-3xl font-bold",
                  stat.color || "text-text-primary"
                )}
              >
                {typeof stat.value === "number"
                  ? formatNumber(stat.value)
                  : stat.value}
              </p>
              <p className="text-xs text-text-muted mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </StaggerList>

      {/* Sentiment Donut + AI Report */}
      <FadeIn delay={0.15}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/10 hover:border-[#7c3aed]/50">
            <CardHeader>
              <CardTitle>Sentimento Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <SentimentDonut
                distribution={data.sentiment_distribution}
                avgScore={data.avg_score}
              />
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <AIHealthReport />
          </div>
        </div>
      </FadeIn>

      {/* Sentiment Trend */}
      <FadeIn delay={0.3}>
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
      </FadeIn>

      {/* Connected Platforms */}
      <FadeIn delay={0.45}>
        <Card>
          <CardHeader>
            <CardTitle>Redes Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background border border-border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10 hover:border-[#7c3aed]/50"
                >
                  <Link
                    href={`/dashboard/connection/${conn.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-sm font-medium shrink-0">
                      {conn.platform === "youtube" ? "YT" : "IG"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conn.display_name || conn.username}
                      </p>
                      <p className="text-xs text-text-muted">
                        {conn.platform} &middot;{" "}
                        {formatNumber(conn.followers_count)} seguidores
                      </p>
                    </div>
                  </Link>
                  <SyncButton connectionId={conn.id} onComplete={fetchData} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent Posts */}
      {data.recent_posts.length > 0 && (
        <FadeIn delay={0.55}>
          <Card>
            <CardHeader>
              <CardTitle>Posts Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recent_posts.slice(0, 5).map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-surface-hover transition-all duration-200 hover:translate-x-1"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm truncate">
                        {post.content_text || "Sem texto"}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {post.platform} &middot;{" "}
                        {formatNumber(post.comment_count)} comentários
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">&rarr;</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
