"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, TrendingDown, MessageCircle, CheckCircle, Shield, Zap, Clock, Settings2, X as XIcon } from "lucide-react";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { relativeTime } from "@/lib/helpers";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { Section } from "@/components/ds/Section";

type Alert = {
  connection_id: string;
  platform: string;
  username: string;
  severity: string;
  negative_rate: number;
  sarcasm_rate: number;
  total_analyzed: number;
  avg_score: number | null;
  message: string;
};

type AlertsData = {
  days: number;
  total_alerts: number;
  alerts: Alert[];
  generated_at: string;
};

function alertTypeFromSeverity(severity: string): "danger" | "warning" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  return "info";
}

function alertIconFromSeverity(severity: string) {
  if (severity === "critical") return Shield;
  if (severity === "high") return TrendingDown;
  return Zap;
}

function Slider({ value, onChange, min = 0, max = 100, unit = "%", label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string; label: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        <span className="px-2.5 py-0.5 rounded-lg" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{value}{unit}</span>
      </div>
      <div className="relative h-2 rounded-full cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)" }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); onChange(Math.round(min + x * (max - min))); }}>
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--primary), var(--secondary))` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 shadow-md" style={{ left: `calc(${pct}% - 8px)`, backgroundColor: "var(--bg-card)", borderColor: "var(--primary)" }} />
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState("Todos");
  const [tab, setTab] = useState<"history" | "config">("history");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Config state
  const [scoreThreshold, setScoreThreshold] = useState(50);
  const [negativeThreshold, setNegativeThreshold] = useState(40);
  const [emotionThreshold, setEmotionThreshold] = useState(30);
  const [wordThreshold, setWordThreshold] = useState(15);
  const [keywords, setKeywords] = useState(["vergonha", "mentira", "fraude", "roubo"]);
  const [newKeyword, setNewKeyword] = useState("");

  async function loadAlerts(d: number) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.alerts(token, { days: d });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar alertas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAlerts(days); }, [days]);

  const allAlerts = (data?.alerts || []).filter(a => !dismissedIds.has(a.connection_id));
  const unreadAlerts = allAlerts.filter(a => !readIds.has(a.connection_id));

  const filtered = filter === "Todos"
    ? allAlerts
    : filter === "Nao lidos"
      ? unreadAlerts
      : filter === "Crise"
        ? allAlerts.filter(a => a.severity === "critical")
        : allAlerts.filter(a => a.severity === "high");

  const markRead = (id: string) => setReadIds(prev => new Set(Array.from(prev).concat(id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-primary)" }}>Alertas</h1>
          <p className="mt-1" style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>Notificacoes e configuracoes de sensibilidade.</p>
        </div>
        <Badge variant="negative" dot>{unreadAlerts.length} nao lidos</Badge>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--bg-subtle)" }}>
        {[{ k: "history" as const, l: "Historico de Alertas", icon: Bell }, { k: "config" as const, l: "Configuracao", icon: Settings2 }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all" style={{ fontSize: "0.82rem", fontWeight: 500, backgroundColor: tab === t.k ? "var(--bg-card)" : "transparent", color: tab === t.k ? "var(--text-primary)" : "var(--text-muted)", boxShadow: tab === t.k ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
            <t.icon className="w-4 h-4" />
            {t.l}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {["Todos", "Nao lidos", "Crise", "Aviso"].map(f => (
                <button key={f} onClick={() => setFilter(f)} className="px-3.5 py-2 rounded-lg transition-all" style={{ fontSize: "0.82rem", fontWeight: 500, backgroundColor: filter === f ? "var(--primary-bg)" : "transparent", color: filter === f ? "var(--primary)" : "var(--text-muted)" }}>
                  {f}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={<Clock className="w-3.5 h-3.5" />} onClick={() => setReadIds(new Set(allAlerts.map(a => a.connection_id)))}>
              Marcar tudo como lido
            </Button>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                      <div className="h-3 w-64 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--sentiment-negative)" }}>{error}</p>
              <Button variant="primary" size="sm" className="mt-4" onClick={() => loadAlerts(days)}>Tentar novamente</Button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--sentiment-positive-bg)" }}>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--sentiment-positive)" }} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                {filter === "Nao lidos" ? "Nenhum alerta nao lido!" : "Tudo certo!"}
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {filter === "Nao lidos" ? "Voce esta em dia com todos os alertas." : `Nenhum alerta encontrado nos ultimos ${days} dias.`}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((alert, i) => {
                const alertType = alertTypeFromSeverity(alert.severity);
                const AlertIcon = alertIconFromSeverity(alert.severity);
                const isUnread = !readIds.has(alert.connection_id);
                return (
                  <div
                    key={alert.connection_id}
                    onClick={() => markRead(alert.connection_id)}
                    className="rounded-2xl p-5 flex items-start gap-4 transition-all cursor-pointer"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: `1px solid ${isUnread ? "var(--primary)" : "var(--border)"}`,
                      borderLeftWidth: isUnread ? 3 : 1,
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: alertType === "danger" ? "var(--sentiment-negative-bg)" : alertType === "warning" ? "var(--secondary-bg)" : "var(--primary-bg)" }}>
                      <AlertIcon className="w-5 h-5" style={{ color: alertType === "danger" ? "var(--sentiment-negative)" : alertType === "warning" ? "var(--secondary)" : "var(--primary)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {alert.message.split(":")[0] || `Alerta @${alert.username}`}
                          </h3>
                          {isUnread && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                        </div>
                        <span className="shrink-0" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
                          {relativeTime(data?.generated_at ?? new Date().toISOString())}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{alert.message}</p>
                      {alert.avg_score !== null && (
                        <p className="mt-1" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                          Score: {alert.avg_score.toFixed(1)}/10 &middot; @{alert.username}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={`/dashboard/profile/${alert.connection_id}`} onClick={e => e.stopPropagation()}>
                          <Button variant="primary" size="sm">Ver detalhes</Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDismissedIds(prev => new Set(Array.from(prev).concat(alert.connection_id))); }}>
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "config" && (
        <div className="space-y-5">
          <Section title="Limiar de Score" subtitle="Receba um alerta quando o score cair abaixo deste valor">
            <Slider value={scoreThreshold} onChange={setScoreThreshold} min={0} max={100} unit="/10" label={`Alerta quando score < ${(scoreThreshold / 10).toFixed(1)}`} />
            <p className="mt-3" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>Atualmente configurado em {(scoreThreshold / 10).toFixed(1)}/10.</p>
          </Section>

          <Section title="Comentarios Negativos" subtitle="Alerte quando a porcentagem de comentarios negativos ultrapassar o limite">
            <Slider value={negativeThreshold} onChange={setNegativeThreshold} min={0} max={100} unit="%" label={`Alerta quando negativos > ${negativeThreshold}%`} />
          </Section>

          <Section title="Emocoes de Risco" subtitle="Raiva, odio e tristeza combinados ultrapassando o limite">
            <Slider value={emotionThreshold} onChange={setEmotionThreshold} min={0} max={100} unit="%" label={`Alerta quando raiva + odio + tristeza > ${emotionThreshold}%`} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {["Raiva", "Nojo", "Tristeza"].map(e => (
                <span key={e} className="px-2.5 py-1 rounded-lg" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>{e}</span>
              ))}
            </div>
          </Section>

          <Section title="Palavras-Chave Monitoradas" subtitle="Alerte quando palavras especificas ultrapassarem uma porcentagem dos comentarios">
            <Slider value={wordThreshold} onChange={setWordThreshold} min={0} max={50} unit="%" label={`Alerta quando palavras-chave > ${wordThreshold}% dos comentarios`} />
            <div className="mt-4">
              <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>PALAVRAS MONITORADAS</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
                    {kw}
                    <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="hover:opacity-70"><XIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar palavra..."
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}
                  className="flex-1 px-3 py-2 rounded-xl transition-all"
                  style={{ fontSize: "0.82rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                />
                <Button variant="primary" size="sm" onClick={() => { if (newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}>Adicionar</Button>
              </div>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button variant="primary">Salvar Configuracoes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
