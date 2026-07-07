"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { pipelineApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { PipelineRun } from "@/lib/types";

const POLL_MS = 5000;

interface ActiveRunsValue {
  runs: PipelineRun[];
  activeRuns: PipelineRun[];
  refresh: () => void;
}

const ActiveRunsContext = createContext<ActiveRunsValue>({
  runs: [],
  activeRuns: [],
  refresh: () => {},
});

export function useActiveRuns() {
  return useContext(ActiveRunsContext);
}

export function ActiveRunsProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRuns = useCallback(async () => {
    const token = getToken();
    if (!token) return [];
    try {
      const data = await pipelineApi.listRuns(token);
      setRuns(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const schedule = useCallback((data: PipelineRun[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (data.some((r) => r.status === "running")) {
      timerRef.current = setTimeout(async () => {
        const next = await fetchRuns();
        schedule(next);
      }, POLL_MS);
    }
  }, [fetchRuns]);

  const refresh = useCallback(() => {
    fetchRuns().then(schedule);
  }, [fetchRuns, schedule]);

  useEffect(() => {
    refresh();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh]);

  const activeRuns = runs.filter((r) => r.status === "running");

  return (
    <ActiveRunsContext.Provider value={{ runs, activeRuns, refresh }}>
      {children}
    </ActiveRunsContext.Provider>
  );
}

function runProgress(run: PipelineRun): number | null {
  if ((run.comments_fetched || 0) > 0) {
    return Math.min(95, Math.round(((run.comments_analyzed || 0) / run.comments_fetched) * 100));
  }
  return null;
}

export function ActiveRunPill() {
  const { activeRuns } = useActiveRuns();
  const t = useTranslations("runsPill");

  if (activeRuns.length === 0) return null;

  const run = activeRuns[0];
  const pct = runProgress(run);
  const stageKey = run.stage && ["queued", "ingesting", "analyzing", "demographics", "report"].includes(run.stage)
    ? run.stage
    : "running";

  return (
    <Link
      href="/dashboard/logs"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors max-w-[60vw]"
      style={{
        backgroundColor: "var(--primary-bg)",
        color: "var(--primary)",
        border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
      }}
      title={t("tooltip")}
    >
      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" strokeWidth={2} />
      <span className="truncate">
        {run.connection_username ? `@${run.connection_username}` : t("genericRun")}
        {" · "}
        {t(`stage.${stageKey}`)}
        {pct !== null ? ` · ${pct}%` : ""}
      </span>
      {activeRuns.length > 1 && (
        <span className="shrink-0 px-1.5 rounded-full" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
          +{activeRuns.length - 1}
        </span>
      )}
    </Link>
  );
}
