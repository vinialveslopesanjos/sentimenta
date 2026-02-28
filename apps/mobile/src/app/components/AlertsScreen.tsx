import React, { useState } from "react";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { alerts } from "./mockData";
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  CircleDot,
} from "lucide-react";

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; borderColor: string }> = {
  warning: {
    icon: <AlertTriangle size={16} />,
    color: "text-amber-500",
    bg: "bg-amber-50",
    borderColor: "border-l-amber-400",
  },
  info: {
    icon: <Info size={16} />,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    borderColor: "border-l-cyan-400",
  },
  success: {
    icon: <CheckCircle2 size={16} />,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    borderColor: "border-l-emerald-400",
  },
};

export function AlertsScreen() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const filteredAlerts = filter === "unread" ? alerts.filter((a) => !a.read) : alerts;
  const unreadCount = alerts.filter((a) => !a.read).length;

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
          {unreadCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 rounded-full">
              <CircleDot size={12} className="text-rose-400" />
              <span className="text-rose-500" style={{ fontSize: "11px", fontWeight: 500 }}>
                {unreadCount} novos
              </span>
            </div>
          )}
        </div>
        <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
          Sinais de risco e oportunidades.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* Filter */}
        <div className="flex bg-slate-50 rounded-2xl p-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              filter === "all"
                ? "bg-white shadow-sm text-violet-600"
                : "text-slate-400"
            }`}
            style={{ fontSize: "13px", fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              filter === "unread"
                ? "bg-white shadow-sm text-violet-600"
                : "text-slate-400"
            }`}
            style={{ fontSize: "13px", fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}
          >
            Nao lidos ({unreadCount})
          </button>
        </div>

        {/* Alert cards */}
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const tc = typeConfig[alert.type] || typeConfig.info;
            return (
              <DreamCard
                key={alert.id}
                className={`p-4 border-l-4 ${tc.borderColor} ${!alert.read ? "ring-1 ring-violet-100" : ""}`}
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
                        {alert.title}
                      </span>
                      {!alert.read && (
                        <div className="w-2 h-2 rounded-full bg-violet-400" />
                      )}
                    </div>
                    <p className="text-slate-500" style={{ fontSize: "12px", lineHeight: 1.5 }}>
                      {alert.description}
                    </p>
                    <p className="text-slate-300 mt-1.5" style={{ fontSize: "10px" }}>
                      {alert.date}
                    </p>
                  </div>
                </div>
              </DreamCard>
            );
          })}
        </div>

        {filteredAlerts.length === 0 && (
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
      </div>
    </div>
  );
}
