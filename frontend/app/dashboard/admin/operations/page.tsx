"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";

import { authApi, opsApi, type OperationalTrustAlert, type OperationalTrustReport } from "@/lib/api";
import { getToken } from "@/lib/auth";

function formatRate(value: number | null): string {
  return value == null ? "N/D" : `${Math.round(value * 100)}%`;
}

function formatDuration(value: number | null): string {
  if (value == null) return "N/D";
  if (value < 60) return `${Math.round(value)}s`;
  return `${(value / 60).toFixed(value < 600 ? 1 : 0)}min`;
}

function formatAge(value: number | null): string {
  if (value == null) return "Sem dado válido";
  if (value < 3600) return `${Math.max(1, Math.round(value / 60))}min`;
  if (value < 86400) return `${Math.round(value / 3600)}h`;
  return `${Math.round(value / 86400)}d`;
}

function platformLabel(platform: string): string {
  return ({ youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", twitter: "X / Twitter" } as Record<string, string>)[platform] ?? platform;
}

function alertTone(severity: OperationalTrustAlert["severity"]) {
  if (severity === "critical") return { bg: "var(--sentiment-negative-bg)", color: "var(--sentiment-negative)", fg: "var(--destructive-foreground)", label: "Crítico" };
  if (severity === "warning") return { bg: "var(--accent-bg)", color: "var(--accent)", fg: "var(--accent-foreground)", label: "Atenção" };
  return { bg: "var(--primary-bg)", color: "var(--primary)", fg: "var(--primary-foreground)", label: "Informativo" };
}

function MetricCard({ label, value, detail, testId }: { label: string; value: string | number; detail: string; testId: string }) {
  return (
    <article data-testid={testId} className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{detail}</p>
    </article>
  );
}

export default function OperationsPage() {
  const [hours, setHours] = useState(24);
  const [report, setReport] = useState<OperationalTrustReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      setError("Faça login novamente para abrir a operação interna.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.me(token);
      if (user.plan !== "admin") {
        setIsAdmin(false);
        setReport(null);
        return;
      }
      setIsAdmin(true);
      setReport(await opsApi.getTrust(token, hours));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a confiança operacional.");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return <main className="p-6" data-testid="ops-loading"><p style={{ color: "var(--text-muted)" }}>Carregando confiança operacional…</p></main>;
  }

  if (!isAdmin && !error) {
    return (
      <main className="p-6" data-testid="ops-forbidden">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Acesso restrito</h1>
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>A confiança operacional está disponível somente para contas administrativas.</p>
      </main>
    );
  }

  const pipeline = report?.metrics.pipeline;
  const statusLabel = report?.status === "critical" ? "Ação imediata" : report?.status === "degraded" ? "Investigação necessária" : "Operação estável";
  const statusColor = report?.status === "critical" ? "var(--sentiment-negative)" : report?.status === "degraded" ? "var(--accent)" : "var(--sentiment-positive)";
  const StatusIcon = report?.status === "critical" ? ShieldAlert : report?.status === "degraded" ? AlertTriangle : CheckCircle2;

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6" data-testid="ops-trust-page">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--primary)" }}>
            <Activity className="h-4 w-4" /> Operação interna
          </div>
          <h1 className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>Confiança operacional</h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            Sinais que podem transformar falha técnica em uma leitura enganosa para a pessoa usuária. Nenhum dado pessoal é exibido aqui.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ops-window" className="sr-only">Janela observada</label>
          <select
            id="ops-window"
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            className="rounded-xl px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <option value={24}>Últimas 24h</option>
            <option value={72}>Últimas 72h</option>
            <option value={168}>Últimos 7 dias</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </header>

      {error && (
        <section role="alert" className="rounded-2xl p-4" style={{ backgroundColor: "var(--sentiment-negative-bg)", border: "1px solid var(--sentiment-negative)", color: "var(--sentiment-negative)" }}>
          <p className="font-semibold">Não foi possível confirmar o estado operacional.</p>
          <p className="mt-1 text-sm">{error}</p>
        </section>
      )}

      {report && pipeline && (
        <>
          <section data-testid="ops-status" data-status={report.status} className="flex flex-col justify-between gap-4 rounded-2xl p-5 md:flex-row md:items-center" style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${statusColor}` }}>
            <div className="flex items-start gap-3">
              <StatusIcon className="mt-0.5 h-6 w-6 shrink-0" style={{ color: statusColor }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: statusColor }}>Estado do gate</p>
                <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{statusLabel}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{report.alerts.length} {report.alerts.length === 1 ? "alerta ativo" : "alertas ativos"} na janela de {report.window.hours}h.</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Atualizado em {new Date(report.generated_at).toLocaleString("pt-BR")}</p>
          </section>

          <section aria-labelledby="ops-metrics-title">
            <h2 id="ops-metrics-title" className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Métricas mínimas do gate</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard testId="ops-success-rate" label="Sucesso operacional" value={formatRate(pipeline.operational_success_rate)} detail={`${pipeline.completed_runs} de ${pipeline.terminal_runs} ${pipeline.terminal_runs === 1 ? "execução terminal" : "execuções terminais"}`} />
              <MetricCard testId="ops-duration" label="Duração p50 / p95" value={`${formatDuration(pipeline.duration_seconds.p50)} / ${formatDuration(pipeline.duration_seconds.p95)}`} detail={`${pipeline.duration_seconds.sample_count} execuções com duração válida`} />
              <MetricCard testId="ops-partial-rate" label="Execuções parciais" value={formatRate(pipeline.partial_rate)} detail={`${pipeline.partial_runs} ${pipeline.partial_runs === 1 ? "execução parcial" : "execuções parciais"}`} />
              <MetricCard testId="ops-stuck-runs" label="Execuções presas" value={pipeline.stuck_runs} detail={`Limite: ${report.thresholds.stuck_after_minutes} minutos`} />
              <MetricCard testId="ops-zero-valid" label="Zero análises válidas" value={pipeline.zero_valid_analyses} detail="Coletou comentários, mas não produziu base válida" />
              <MetricCard testId="ops-divergences" label="Divergências de contagem" value={report.metrics.count_reconciliation.divergences} detail={`${report.metrics.count_reconciliation.snapshots_evaluated} snapshot(s) verificado(s)`} />
              <MetricCard testId="ops-drilldown-404" label="404 no drill-down" value={report.metrics.drilldown_404.count} detail={`${Object.keys(report.metrics.drilldown_404.by_route).length} rota(s) afetada(s)`} />
              <MetricCard testId="ops-trust-tickets" label="Tickets de confiança" value={report.metrics.support_tickets.trust_related} detail={`${report.metrics.support_tickets.total} ticket(s) total(is)`} />
            </div>
          </section>

          <section aria-labelledby="ops-alerts-title">
            <h2 id="ops-alerts-title" className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Alertas internos ativos</h2>
            <div className="space-y-3" data-testid="ops-alert-list">
              {report.alerts.length === 0 ? (
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--sentiment-positive-bg)", border: "1px solid var(--sentiment-positive)" }}>
                  <p className="font-semibold" style={{ color: "var(--sentiment-positive)" }}>Nenhum limiar ultrapassado nesta janela.</p>
                </div>
              ) : report.alerts.map((alert) => {
                const tone = alertTone(alert.severity);
                return (
                  <article key={alert.code} data-testid={`ops-alert-${alert.code.replace(/[^a-z0-9_-]/gi, "-")}`} className="rounded-2xl p-4" style={{ backgroundColor: tone.bg, border: `1px solid ${tone.color}` }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase" style={{ backgroundColor: tone.color, color: tone.fg }}>{tone.label}</span>
                      <code className="text-xs" style={{ color: tone.color }}>{alert.code}</code>
                    </div>
                    <p className="mt-2 font-semibold" style={{ color: "var(--text-primary)" }}>{alert.message}</p>
                    {alert.href ? (
                      <Link href={alert.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline" style={{ color: tone.color }}>
                        {alert.action} <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{alert.action}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section id="ops-reference-details" aria-labelledby="ops-reference-title">
            <h2 id="ops-reference-title" className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Detalhes para investigação</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <article id="ops-drilldown-details" className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Rotas com 404</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Somente o template da rota é armazenado; IDs solicitados não são retidos.</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(report.metrics.drilldown_404.by_route).length === 0 ? (
                    <li style={{ color: "var(--text-muted)" }}>Nenhuma rota afetada.</li>
                  ) : Object.entries(report.metrics.drilldown_404.by_route).map(([route, count]) => (
                    <li key={route} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <code className="break-all" style={{ color: "var(--text-primary)" }}>{route}</code>
                      <strong style={{ color: "var(--text-primary)" }}>{count}</strong>
                    </li>
                  ))}
                </ul>
              </article>

              <article id="ops-ticket-details" className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Tickets por categoria</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>A operação recebe apenas contagens; nome, e-mail e mensagem ficam fora deste relatório.</p>
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(report.metrics.support_tickets.by_category).map(([category, count]) => (
                    <div key={category} className="flex justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <dt style={{ color: "var(--text-muted)" }}>{category}</dt>
                      <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>{count}</dd>
                    </div>
                  ))}
                </dl>
              </article>

              <article className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Referências técnicas</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Referências curtas permitem cruzar a tela com Logs sem expor conteúdo.</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt style={{ color: "var(--text-muted)" }}>Zero análises válidas</dt>
                    <dd className="mt-1 font-mono" style={{ color: "var(--text-primary)" }}>{pipeline.zero_valid_run_refs.join(", ") || "Nenhuma"}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--text-muted)" }}>Execuções presas</dt>
                    <dd className="mt-1 font-mono" style={{ color: "var(--text-primary)" }}>{pipeline.stuck_run_refs.join(", ") || "Nenhuma"}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--text-muted)" }}>Snapshots divergentes</dt>
                    <dd className="mt-1 font-mono" style={{ color: "var(--text-primary)" }}>{report.metrics.count_reconciliation.sample_snapshot_refs.join(", ") || "Nenhum"}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          <section aria-labelledby="ops-platforms-title" className="overflow-hidden rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="p-4">
              <h2 id="ops-platforms-title" className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Saúde por plataforma</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>A idade válida vem de snapshots imutáveis; ausência permanece N/D.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                  <tr>
                    <th className="px-4 py-3">Plataforma</th>
                    <th className="px-4 py-3">Conexões</th>
                    <th className="px-4 py-3">Execuções</th>
                    <th className="px-4 py-3">Sucesso</th>
                    <th className="px-4 py-3">Parciais / falhas</th>
                    <th className="px-4 py-3">Último dado válido</th>
                    <th className="px-4 py-3">p95</th>
                  </tr>
                </thead>
                <tbody>
                  {report.metrics.platforms.map((platform) => (
                    <tr key={platform.platform} data-testid={`ops-platform-${platform.platform}`} style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <th className="px-4 py-3">{platformLabel(platform.platform)}</th>
                      <td className="px-4 py-3">{platform.active_connections}</td>
                      <td className="px-4 py-3">{platform.terminal_runs}</td>
                      <td className="px-4 py-3">{formatRate(platform.operational_success_rate)}</td>
                      <td className="px-4 py-3">{platform.partial_runs} / {platform.failed_runs}</td>
                      <td className="px-4 py-3">{formatAge(platform.valid_data_age_seconds)}</td>
                      <td className="px-4 py-3">{formatDuration(platform.duration_seconds.p95)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}><Clock3 className="h-4 w-4" /> Cobertura da instrumentação</summary>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              {Object.entries(report.instrumentation).map(([metric, state]) => (
                <div key={metric} className="flex justify-between gap-4 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-subtle)" }}>
                  <dt style={{ color: "var(--text-muted)" }}>{metric}</dt>
                  <dd className="text-right font-medium" style={{ color: "var(--text-primary)" }}>{state}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </main>
  );
}
