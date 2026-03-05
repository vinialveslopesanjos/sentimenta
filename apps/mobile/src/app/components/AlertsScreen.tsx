import React, { useState, useEffect } from "react";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import { type Alert, type AlertsResponse } from "@sentimenta/types";
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  CircleDot,
} from "lucide-react";

const severityConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; borderColor: string }> = {
  high: {
    icon: <AlertTriangle size={16} />,
    color: "text-amber-500",
    bg: "bg-amber-50",
    borderColor: "border-l-amber-400",
  },
  medium: {
    icon: <Info size={16} />,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    borderColor: "border-l-cyan-400",
  },
  low: {
    icon: <CheckCircle2 size={16} />,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    borderColor: "border-l-emerald-400",
  },
};

export function AlertsScreen() {
  const [alertsData, setAlertsData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.alerts()
      .then(setAlertsData)
      .catch((err) => console.error("Failed to load alerts", err))
      .finally(() => setLoading(false));
  }, []);

  const alerts = alertsData?.alerts || [];

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "26px",
              fontWeight: 500,
              color: "#334155",
              lineHeight: 1.2,
            }}
          >
            Alertas
          </h1>
          {alerts.length > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 rounded-full">
              <CircleDot size={12} className="text-rose-400" />
              <span className="text-rose-500" style={{ fontSize: "11px", fontWeight: 500 }}>
                {alerts.length} alertas
              </span>
            </div>
          )}
        </div>
        <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
          Sinais de risco e oportunidades.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Carregando alertas...</div>
        ) : (
          <>
            {/* Alert cards */}
            <div className="space-y-3">
              {alerts.map((alert, idx) => {
                const tc = severityConfig[alert.severity] || severityConfig.medium;
                return (
                  <DreamCard
                    key={`${alert.connection_id}-${idx}`}
                    className={`p-4 border-l-4 ${tc.borderColor}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl ${tc.bg} flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                        {tc.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="text-slate-700"
                            style={{ fontSize: "13px", fontWeight: 500 }}
                          >
                            @{alert.username} ({alert.platform})
                          </span>
                        </div>
                        <p className="text-slate-500" style={{ fontSize: "12px", lineHeight: 1.5 }}>
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-slate-400" style={{ fontSize: "10px" }}>
                            Score: {alert.avg_score?.toFixed(1) ?? "—"}
                          </span>
                          <span className="text-slate-400" style={{ fontSize: "10px" }}>
                            Neg: {(alert.negative_rate * 100).toFixed(0)}%
                          </span>
                          <span className="text-slate-400" style={{ fontSize: "10px" }}>
                            {alert.total_analyzed} analisados
                          </span>
                        </div>
                      </div>
                    </div>
                  </DreamCard>
                );
              })}
            </div>

            {alerts.length === 0 && (
              <div className="text-center py-16">
                <Bell size={40} className="text-slate-200 mx-auto mb-3" />
                <p
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#94A3B8" }}
                >
                  Nenhum alerta novo
                </p>
                <p className="text-slate-300 mt-1" style={{ fontSize: "13px" }}>
                  Voce esta em dia com tudo!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
