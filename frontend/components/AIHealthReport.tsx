"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function AIHealthReport() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function fetchReport() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await dashboardApi.healthReport(token);
      setReport(data.report_text);
      setHasLoaded(true);
    } catch {
      setReport("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load once on mount
  useEffect(() => {
    if (!hasLoaded) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
            </svg>
            Relatório de Saúde Reputacional
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchReport} disabled={loading}>
            {loading ? "Gerando..." : "Atualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !report ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-surface-hover rounded animate-pulse w-full" />
                <div className="h-4 bg-surface-hover rounded animate-pulse w-5/6" />
                <div className="h-4 bg-surface-hover rounded animate-pulse w-4/6" />
              </div>
            ))}
          </div>
        ) : report ? (
          <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed">
            {report.split("\n").map((line, i) => {
              if (line.startsWith("###")) {
                return <h4 key={i} className="text-text-primary font-semibold mt-4 mb-1 text-sm">{line.replace(/^#+\s*/, "")}</h4>;
              }
              if (line.startsWith("##")) {
                return <h3 key={i} className="text-text-primary font-bold mt-4 mb-2 text-base">{line.replace(/^#+\s*/, "")}</h3>;
              }
              if (line.startsWith("**") && line.endsWith("**")) {
                return <p key={i} className="font-semibold text-text-primary mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <div key={i} className="flex gap-2 ml-2">
                    <span className="text-accent mt-0.5">&#x2022;</span>
                    <span>{line.replace(/^[-*]\s*/, "")}</span>
                  </div>
                );
              }
              if (line.trim() === "") return <div key={i} className="h-2" />;
              return <p key={i} className="mb-1">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
            })}
          </div>
        ) : (
          <p className="text-text-muted text-sm">
            Clique em &quot;Atualizar&quot; para gerar o relatório de IA.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
