import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import { type PipelineRun } from "@sentimenta/types";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  FileText,
  MessageSquare,
  DollarSign,
} from "lucide-react";

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  completed: {
    icon: <CheckCircle2 size={16} />,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    label: "Completo",
  },
  failed: {
    icon: <XCircle size={16} />,
    color: "text-rose-500",
    bg: "bg-rose-50",
    label: "Falhou",
  },
  partial: {
    icon: <AlertTriangle size={16} />,
    color: "text-amber-500",
    bg: "bg-amber-50",
    label: "Parcial",
  },
  running: {
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    label: "Em execucao",
  },
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return "em andamento...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatCostBRL(usd: number): string {
  const brl = usd * 5.5;
  return `R$ ${brl.toFixed(2).replace(".", ",")}`;
}

export function LogsScreen() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.pipeline.listRuns()
      .then(setRuns)
      .catch((err) => console.error("Failed to load pipeline runs", err))
      .finally(() => setLoading(false));
  }, []);

  const totalPosts = runs.reduce((acc, r) => acc + r.posts_fetched, 0);
  const totalComments = runs.reduce((acc, r) => acc + r.comments_fetched, 0);
  const totalCost = runs.reduce((acc, r) => acc + r.total_cost_usd, 0);

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      <div className="px-5 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-slate-400 mb-3"
          style={{ fontSize: "13px" }}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "26px",
            fontWeight: 500,
            color: "#334155",
            lineHeight: 1.2,
          }}
        >
          Logs de Execucao
        </h1>
        <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
          Transparencia operacional do pipeline.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Carregando logs...</div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <DreamCard className="p-3 text-center">
                <FileText size={16} className="text-violet-400 mx-auto mb-1" />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}>
                  {totalPosts}
                </p>
                <p className="text-slate-400" style={{ fontSize: "9px" }}>Posts</p>
              </DreamCard>
              <DreamCard className="p-3 text-center">
                <MessageSquare size={16} className="text-cyan-400 mx-auto mb-1" />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}>
                  {totalComments.toLocaleString()}
                </p>
                <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios</p>
              </DreamCard>
              <DreamCard className="p-3 text-center">
                <DollarSign size={16} className="text-emerald-400 mx-auto mb-1" />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}>
                  {formatCostBRL(totalCost)}
                </p>
                <p className="text-slate-400" style={{ fontSize: "9px" }}>Custo total</p>
              </DreamCard>
            </div>

            {/* Log entries */}
            <div className="space-y-3">
              {runs.map((run) => {
                const st = statusConfig[run.status] || statusConfig.completed;
                return (
                  <DreamCard key={run.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${st.bg} flex items-center justify-center ${st.color}`}>
                          {st.icon}
                        </div>
                        <div>
                          <p className="text-slate-700" style={{ fontSize: "13px", fontWeight: 500 }}>
                            {run.connection_username ? `@${run.connection_username}` : run.platform || "Pipeline"}
                          </p>
                          <p className="text-slate-400" style={{ fontSize: "10px" }}>
                            {new Date(run.started_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}
                        style={{ fontSize: "10px", fontWeight: 500 }}
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="text-center">
                        <p className="text-slate-400" style={{ fontSize: "9px" }}>Duracao</p>
                        <p className="text-slate-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                          {formatDuration(run.started_at, run.ended_at)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400" style={{ fontSize: "9px" }}>Posts</p>
                        <p className="text-slate-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                          {run.posts_fetched}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios</p>
                        <p className="text-slate-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                          {run.comments_fetched}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400" style={{ fontSize: "9px" }}>Custo</p>
                        <p className="text-emerald-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                          {formatCostBRL(run.total_cost_usd)}
                        </p>
                      </div>
                    </div>

                    {run.notes && (
                      <div className="mt-2 px-3 py-2 bg-rose-50 rounded-xl">
                        <p className="text-rose-500" style={{ fontSize: "10px" }}>
                          Erro: {run.notes}
                        </p>
                      </div>
                    )}
                  </DreamCard>
                );
              })}
            </div>

            {runs.length === 0 && (
              <div className="text-center py-16">
                <Clock size={40} className="text-slate-200 mx-auto mb-3" />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 500, color: "#94A3B8" }}>
                  Nenhum log encontrado
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
