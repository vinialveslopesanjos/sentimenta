"use client";

import { useState, useEffect, useCallback } from "react";
import { pipelineApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import type { PipelineRun } from "@/lib/types";

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return { text: "Em andamento", class: "bg-blue-500/10 text-blue-400 animate-pulse" };
    case "completed":
      return { text: "Concluído", class: "bg-positive/10 text-positive" };
    case "failed":
      return { text: "Falhou", class: "bg-negative/10 text-negative" };
    case "partial":
      return { text: "Parcial", class: "bg-neutral/10 text-neutral" };
    default:
      return { text: status, class: "bg-surface text-text-muted" };
  }
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PipelineLogViewer() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await pipelineApi.listRuns(token);
      setRuns(data);
    } catch {
      // handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Auto-poll if any run is still running
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(fetchRuns, 3000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center text-text-muted py-12">
        Nenhuma execução registrada. Use o botão &quot;Analisar&quot; em uma conexão para iniciar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const badge = statusBadge(run.status);
        return (
          <Card key={run.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${badge.class}`}>
                    {badge.text}
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {run.platform ? run.platform.charAt(0).toUpperCase() + run.platform.slice(1) : "Pipeline"}{" "}
                    {run.connection_username && `@${run.connection_username}`}
                  </span>
                  <span className="text-xs text-text-muted">
                    {run.run_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>Posts: {run.posts_fetched}</span>
                  <span>Comentários: {run.comments_fetched}</span>
                  <span>Analisados: {run.comments_analyzed}</span>
                  {run.errors_count > 0 && (
                    <span className="text-negative">Erros: {run.errors_count}</span>
                  )}
                  <span>Duração: {formatDuration(run.started_at, run.ended_at)}</span>
                </div>
                {run.status === "running" && (
                  <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all animate-pulse"
                      style={{
                        width: run.comments_fetched > 0
                          ? `${Math.min(100, (run.comments_analyzed / Math.max(run.comments_fetched, 1)) * 100)}%`
                          : "10%",
                      }}
                    />
                  </div>
                )}
                {run.notes && run.status === "failed" && (
                  <div className="mt-2 text-xs text-negative bg-negative/5 p-2 rounded">
                    {run.notes}
                  </div>
                )}
              </div>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {formatTime(run.started_at)}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
