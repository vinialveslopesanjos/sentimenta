import React, { useState } from "react";
import { useNavigate } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { userProfile } from "./mockData";
import {
  User,
  CreditCard,
  Bell,
  Shield,
  ChevronRight,
  LogOut,
  FileText,
  AlertTriangle,
  Moon,
  Globe,
  HelpCircle,
  ScrollText,
} from "lucide-react";

export function SettingsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);

  const sections = [
    {
      title: "Conta",
      items: [
        {
          icon: <User size={18} />,
          label: "Informacoes do Perfil",
          sublabel: userProfile.email,
          color: "text-violet-500",
          bg: "bg-violet-50",
        },
        {
          icon: <CreditCard size={18} />,
          label: "Plano e Uso",
          sublabel: `Plano ${userProfile.plan}`,
          color: "text-cyan-500",
          bg: "bg-cyan-50",
        },
      ],
    },
    {
      title: "Preferencias",
      items: [
        {
          icon: <Bell size={18} />,
          label: "Notificacoes",
          sublabel: notifications ? "Ativadas" : "Desativadas",
          color: "text-amber-500",
          bg: "bg-amber-50",
          toggle: true,
        },
        {
          icon: <Moon size={18} />,
          label: "Tema",
          sublabel: "Claro",
          color: "text-slate-500",
          bg: "bg-slate-50",
        },
        {
          icon: <Globe size={18} />,
          label: "Idioma",
          sublabel: "Portugues (BR)",
          color: "text-emerald-500",
          bg: "bg-emerald-50",
        },
      ],
    },
    {
      title: "Operacional",
      items: [
        {
          icon: <ScrollText size={18} />,
          label: "Logs de Execucao",
          sublabel: "Historico de pipeline",
          color: "text-violet-500",
          bg: "bg-violet-50",
          action: () => navigate("/logs"),
        },
      ],
    },
    {
      title: "Seguranca",
      items: [
        {
          icon: <Shield size={18} />,
          label: "Alterar Senha",
          color: "text-violet-500",
          bg: "bg-violet-50",
        },
        {
          icon: <HelpCircle size={18} />,
          label: "Suporte",
          color: "text-cyan-500",
          bg: "bg-cyan-50",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      <div className="px-5 pt-4 pb-2">
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "26px",
            fontWeight: 500,
            color: "#334155",
            lineHeight: 1.2,
          }}
        >
          Configuracoes
        </h1>
      </div>

      <div className="px-5 mt-4 space-y-6">
        {/* Profile Header */}
        <DreamCard className="p-5 flex items-center gap-4" glow>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-300 to-cyan-200 flex items-center justify-center">
            <span
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "white" }}
            >
              {userProfile.avatar}
            </span>
          </div>
          <div>
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}
            >
              {userProfile.name}
            </p>
            <p className="text-slate-400" style={{ fontSize: "13px" }}>
              {userProfile.email}
            </p>
            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-violet-50 rounded-full w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-violet-600" style={{ fontSize: "10px", fontWeight: 500 }}>
                Plano {userProfile.plan}
              </span>
            </div>
          </div>
        </DreamCard>

        {/* Plan usage */}
        <DreamCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-600" style={{ fontSize: "13px", fontWeight: 500 }}>
              Uso do plano
            </span>
            <span className="text-violet-500" style={{ fontSize: "11px", fontWeight: 500 }}>
              68% usado
            </span>
          </div>
          <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
              style={{ width: "68%" }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-slate-400" style={{ fontSize: "10px" }}>
              3.400 de 5.000 comentarios/mes
            </span>
            <button className="text-violet-500" style={{ fontSize: "10px", fontWeight: 500 }}>
              Upgrade
            </button>
          </div>
        </DreamCard>

        {/* Settings Sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <p
              className="text-slate-300 mb-2 px-1"
              style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {section.title}
            </p>
            <DreamCard className="overflow-hidden divide-y divide-slate-50">
              {section.items.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={() => "action" in item ? (item as any).action() : null}
                  className="w-full p-4 flex items-center gap-3 active:bg-slate-50 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-slate-700" style={{ fontSize: "14px", fontWeight: 500 }}>
                      {item.label}
                    </p>
                    {"sublabel" in item && (item as any).sublabel && (
                      <p className="text-slate-400" style={{ fontSize: "11px" }}>
                        {(item as any).sublabel}
                      </p>
                    )}
                  </div>
                  {"toggle" in item && item.toggle ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotifications(!notifications);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifications ? "bg-violet-500" : "bg-slate-200"
                        }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${notifications ? "translate-x-5.5" : "translate-x-0.5"
                          }`}
                        style={{ transform: notifications ? "translateX(22px)" : "translateX(2px)" }}
                      />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-slate-300" />
                  )}
                </button>
              ))}
            </DreamCard>
          </div>
        ))}

        {/* Danger Zone */}
        <div>
          <p
            className="text-slate-300 mb-2 px-1"
            style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}
          >
            Zona de Risco
          </p>
          <DreamCard className="overflow-hidden">
            <button
              onClick={() => navigate("/login")}
              className="w-full p-4 flex items-center gap-3 active:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                <LogOut size={18} />
              </div>
              <span className="text-rose-500" style={{ fontSize: "14px", fontWeight: 500 }}>
                Sair da conta
              </span>
            </button>
            <button className="w-full p-4 flex items-center gap-3 active:bg-slate-50 transition-colors border-t border-slate-50">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                <AlertTriangle size={18} />
              </div>
              <span className="text-rose-500" style={{ fontSize: "14px", fontWeight: 500 }}>
                Excluir conta
              </span>
            </button>
          </DreamCard>
        </div>

        <p className="text-center text-slate-300 pb-4" style={{ fontSize: "11px" }}>
          Sentimenta v2.0 · 2026
        </p>
      </div>
    </div>
  );
}
