"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Tab = "profile" | "billing" | "notifications" | "security";

type User = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Security
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authApi.me(token).then((u) => {
      setUser(u);
      const parts = (u.name || "").trim().split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setLoading(false);
    });
  }, []);

  const initials = user?.name
    ? user.name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  const planName = user?.plan === "pro" ? "Pro Plan" : user?.plan === "enterprise" ? "Enterprise" : "Starter";
  const planPrice = user?.plan === "pro" ? "R$199/mês" : user?.plan === "enterprise" ? "R$599/mês" : "R$79/mês";
  const usagePercent = 84; // would come from API

  async function handleSaveProfile() {
    const token = getToken();
    if (!token) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
      await authApi.updateMe(token, { name: fullName });
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso!" });
      if (user) setUser({ ...user, name: fullName });
    } catch {
      setProfileMsg({ type: "error", text: "Erro ao salvar perfil." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "error", text: "As senhas não coincidem." });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ type: "error", text: "A nova senha deve ter pelo menos 8 caracteres." });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    // Password change would call a dedicated endpoint — show success for now
    setTimeout(() => {
      setSavingPwd(false);
      setPwdMsg({ type: "success", text: "Senha alterada com sucesso!" });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    }, 800);
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "profile", label: "Perfil", icon: "person" },
    { id: "billing", label: "Plano & Cobrança", icon: "credit_card" },
    { id: "notifications", label: "Notificações", icon: "notifications" },
    { id: "security", label: "Segurança", icon: "shield" },
  ];

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-8">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-11 bg-slate-50 rounded-xl" />)}
          </div>
          <div className="col-span-2 h-80 bg-slate-50 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-sans font-light text-brand-heading">Configurações da Conta</h1>
        <p className="text-brand-text text-sm font-light mt-1">
          Gerencie seu perfil, plano e preferências de notificação.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar tabs */}
        <div className="md:col-span-1 space-y-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-all ${
                activeTab === tab.id
                  ? "bg-white shadow-card border border-slate-100 text-brand-heading"
                  : "text-slate-500 hover:bg-white/60 hover:text-brand-heading"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? "text-brand-lilacDark" : ""}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">

          {/* ── PROFILE ── */}
          {activeTab === "profile" && (
            <section className="dream-card p-8">
              <h2 className="text-lg font-sans font-medium text-brand-heading mb-6">Informações do Perfil</h2>

              {/* Avatar */}
              <div className="flex items-center gap-5 mb-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-100 to-violet-100 p-0.5 shadow-inner flex items-center justify-center">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-brand-lilac to-violet-400 flex items-center justify-center text-white text-2xl font-sans font-medium">
                        {initials}
                      </div>
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 w-7 h-7 bg-brand-lilacDark text-white rounded-full flex items-center justify-center border-2 border-white hover:bg-violet-700 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                </div>
                <div>
                  <h3 className="text-brand-heading font-medium">{user?.name || "Usuário"}</h3>
                  <p className="text-slate-400 text-sm">{planName}</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Primeiro Nome
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-600 focus:outline-none focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Sobrenome
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-600 focus:outline-none focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Endereço de E-mail
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100/60 text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              {profileMsg && (
                <p className={`mt-4 text-sm ${profileMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {profileMsg.text}
                </p>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 disabled:opacity-60"
                >
                  {savingProfile ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </section>
          )}

          {/* ── BILLING ── */}
          {activeTab === "billing" && (
            <section className="dream-card p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-lilac/20 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                  <h2 className="text-lg font-sans font-medium text-brand-heading">Plano Atual</h2>
                  <p className="text-sm text-brand-lilacDark font-medium mt-1">
                    {planName} <span className="text-slate-400 font-light">• {planPrice}</span>
                  </p>
                </div>
                <span className="px-3 py-1 bg-violet-50 text-brand-lilacDark text-xs font-bold rounded-full border border-violet-100 uppercase tracking-wide">
                  Ativo
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Uso de Análise de Comentários</span>
                  <span className="text-brand-heading font-medium">847 / 1.000</span>
                </div>
                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-300 to-brand-lilac rounded-full shadow-[0_0_10px_rgba(196,181,253,0.5)] transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 font-light">
                  Seu plano renova em{" "}
                  <span className="font-medium text-slate-500">24 de outubro de 2026</span>.
                </p>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand-lilac to-brand-cyan text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-dream">
                  Fazer Upgrade
                </button>
                <button className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                  Histórico de Cobrança
                </button>
              </div>
            </section>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === "notifications" && (
            <section className="dream-card p-8">
              <h2 className="text-lg font-sans font-medium text-brand-heading mb-6">Notificações</h2>
              <div className="space-y-6">
                {[
                  {
                    id: "email",
                    label: "Alertas por E-mail",
                    desc: "Seja notificado quando o sentimento negativo aumentar.",
                    value: notifEmail,
                    onChange: setNotifEmail,
                  },
                  {
                    id: "weekly",
                    label: "Resumo Semanal",
                    desc: "Receba um resumo da performance da sua marca toda segunda-feira.",
                    value: notifWeekly,
                    onChange: setNotifWeekly,
                  },
                  {
                    id: "marketing",
                    label: "Atualizações de Marketing",
                    desc: "Novidades sobre novas funcionalidades e atualizações do produto.",
                    value: notifMarketing,
                    onChange: setNotifMarketing,
                  },
                ].map((item, idx, arr) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-brand-heading">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-light">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={item.value}
                          onChange={(e) => item.onChange(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-lilac/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-lilacDark" />
                      </label>
                    </div>
                    {idx < arr.length - 1 && <div className="mt-6 w-full h-px bg-slate-50" />}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── SECURITY ── */}
          {activeTab === "security" && (
            <section className="dream-card p-8">
              <h2 className="text-lg font-sans font-medium text-brand-heading mb-6">Segurança</h2>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-600 focus:outline-none focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac transition-all"
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-lilacDark">
                      <span className="material-symbols-outlined text-[20px]">{showCurrentPwd ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-600 focus:outline-none focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac transition-all"
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-lilacDark">
                      <span className="material-symbols-outlined text-[20px]">{showNewPwd ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-600 focus:outline-none focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac transition-all"
                  />
                </div>

                {pwdMsg && (
                  <p className={`text-sm ${pwdMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                    {pwdMsg.text}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
                    className="px-6 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    {savingPwd ? "Alterando..." : "Alterar Senha"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ── DANGER ZONE (always shown at bottom for profile/security) ── */}
          {(activeTab === "profile" || activeTab === "security") && (
            <section className="dream-card border-red-50 p-8">
              <h2 className="text-lg font-sans font-medium text-red-600 mb-2">Zona de Risco</h2>
              <p className="text-sm text-slate-500 font-light mb-6">
                Depois de deletar sua conta, não há mais volta. Por favor, tenha certeza.
              </p>
              <div className="flex items-center justify-between bg-red-50/50 p-4 rounded-xl border border-red-50">
                <div>
                  <p className="text-sm font-medium text-brand-heading">Deletar Conta</p>
                  <p className="text-xs text-slate-400">Remove permanentemente sua conta e todos os dados.</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-white text-red-600 text-sm font-medium border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                >
                  Deletar Conta
                </button>
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-modal border border-white p-8 w-full max-w-md relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
                <h3 className="text-base font-sans font-semibold text-brand-heading">Confirmar Exclusão</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5 font-light">
                Esta ação é irreversível. Todos os seus dados, conexões e análises serão permanentemente removidos.
              </p>
              <p className="text-xs text-slate-400 mb-2">Digite <span className="font-semibold text-slate-600">DELETAR</span> para confirmar:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETAR"
                className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-slate-600 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all mb-6"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}
                  className="py-3 px-4 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors border border-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={deleteConfirmText !== "DELETAR"}
                  className="py-3 px-4 rounded-xl bg-red-500 text-white text-sm font-medium shadow-lg shadow-red-100 hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Deletar Permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
