import React from "react";
import { useNavigate } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { logs } from "./mockData";
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

export function LogsScreen() {
  const navigate = useNavigate();

  // Calculate totals
  const totalPosts = logs.reduce((acc, l) => acc + l.posts, 0);
  const totalComments = logs.reduce((acc, l) => acc + l.comments, 0);
  const totalCost = logs.reduce((acc, l) => {
    const val = parseFloat(l.costBRL.replace("R$ ", "").replace(",", "."));
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

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
              R$ {totalCost.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-slate-400" style={{ fontSize: "9px" }}>Custo total</p>
          </DreamCard>
        </div>

        {/* Log entries */}
        <div className="space-y-3">
          {logs.map((log) => {
            const st = statusConfig[log.status] || statusConfig.completed;
            return (
              <DreamCard key={log.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${st.bg} flex items-center justify-center ${st.color}`}>
                      {st.icon}
                    </div>
                    <div>
                      <p className="text-slate-700" style={{ fontSize: "13px", fontWeight: 500 }}>
                        {log.profile}
                      </p>
                      <p className="text-slate-400" style={{ fontSize: "10px" }}>
                        {log.date}
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
                      {log.duration}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400" style={{ fontSize: "9px" }}>Posts</p>
                    <p className="text-slate-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                      {log.posts}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400" style={{ fontSize: "9px" }}>Comentarios</p>
                    <p className="text-slate-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                      {log.comments}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400" style={{ fontSize: "9px" }}>Custo</p>
                    <p className="text-emerald-600" style={{ fontSize: "11px", fontWeight: 500 }}>
                      {log.costBRL}
                    </p>
                  </div>
                </div>

                {log.error && (
                  <div className="mt-2 px-3 py-2 bg-rose-50 rounded-xl">
                    <p className="text-rose-500" style={{ fontSize: "10px" }}>
                      Erro: {log.error}
                    </p>
                  </div>
                )}
              </DreamCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
