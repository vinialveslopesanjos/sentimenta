"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi, billingApi, connectionsApi } from "@/lib/api";
import { clearTokens, getToken, setTokens } from "@/lib/auth";

type Tab = "profile" | "billing" | "notifications" | "security" | "integrations";
type User = { id: string; email: string; name: string | null; avatar_url: string | null; plan: string };
type BillingPlan = { slug: string; name: string; price_brl: number; description: string };

const PLAN_ORDER = ["free", "creator", "pro", "agency", "enterprise"];
const PLAN_FALLBACK: Record<string, BillingPlan> = {
  free: { slug: "free", name: "Gratis", price_brl: 0, description: "Plano inicial" },
  creator: { slug: "creator", name: "Creator", price_brl: 67, description: "Para criadores" },
  pro: { slug: "pro", name: "Pro", price_brl: 167, description: "Para marcas" },
  agency: { slug: "agency", name: "Agency", price_brl: 397, description: "Para agencias" },
  enterprise: { slug: "enterprise", name: "Enterprise", price_brl: 0, description: "Sob consulta" },
  admin: { slug: "admin", name: "Admin", price_brl: 0, description: "Ilimitado" },
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthStatus = searchParams.get("status");
  const initialTab = (searchParams.get("tab") as Tab) || "profile";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState(false);
  const [integrationMsg, setIntegrationMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    oauthStatus === "success"
      ? { type: "success", text: "Conta Instagram conectada com sucesso." }
      : oauthStatus === "error"
        ? { type: "error", text: `Erro na conexao: ${searchParams.get("error") || "desconhecido"}` }
        : null
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [billingBusy, setBillingBusy] = useState<"checkout" | "portal" | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const [me, plans, usage, connections] = await Promise.all([
          authApi.me(token),
          billingApi.plans(token),
          billingApi.usage(token),
          connectionsApi.list(token),
        ]);
        if (!mounted) return;
        setUser(me);
        setBillingPlans(plans.plans || []);
        setSubscriptionStatus(usage.subscription_status || null);
        setIgConnected(connections.some((connection) => connection.platform === "instagram" && connection.has_oauth_token));
        const parts = (me.name || "").trim().split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      } catch {
        clearTokens();
        router.replace("/login");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const planMap = useMemo(() => {
    const entries = [...billingPlans, PLAN_FALLBACK.admin].map((plan) => [plan.slug, plan] as const);
    return Object.fromEntries(entries);
  }, [billingPlans]);
  const currentPlan = planMap[user?.plan || "free"] || PLAN_FALLBACK[user?.plan || "free"] || PLAN_FALLBACK.free;
  const currentPlanIndex = PLAN_ORDER.indexOf(user?.plan || "free");
  const nextPlanSlug = currentPlanIndex >= 0 ? PLAN_ORDER[currentPlanIndex + 1] : null;
  const nextPlan = nextPlanSlug ? planMap[nextPlanSlug] || PLAN_FALLBACK[nextPlanSlug] : null;
  const planPrice = currentPlan.price_brl > 0 ? `R$${currentPlan.price_brl}/mes` : currentPlan.slug === "admin" ? "Ilimitado" : "Sob consulta";

  async function handleSaveProfile() {
    const token = getToken();
    if (!token) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const name = [firstName, lastName].filter(Boolean).join(" ") || null;
      await authApi.updateMe(token, { name });
      setUser((prev) => (prev ? { ...prev, name } : prev));
      setProfileMsg("Perfil atualizado com sucesso.");
    } catch (error) {
      setProfileMsg(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;
    if (newPwd !== confirmPwd) return setPwdMsg("As senhas nao coincidem.");
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      const tokens = await authApi.changePassword(token, currentPwd, newPwd);
      setTokens(tokens.access_token, tokens.refresh_token);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg("Senha alterada com sucesso.");
    } catch (error) {
      setPwdMsg(error instanceof Error ? error.message : "Nao foi possivel alterar a senha.");
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleUpgrade() {
    const token = getToken();
    if (!token || !nextPlan) return;
    setBillingBusy("checkout");
    setBillingMsg(null);
    try {
      const response = await billingApi.createCheckoutSession(token, nextPlan.slug);
      window.location.href = response.url;
    } catch (error) {
      setBillingMsg(error instanceof Error ? error.message : "Nao foi possivel abrir o checkout.");
      setBillingBusy(null);
    }
  }

  async function handlePortal() {
    const token = getToken();
    if (!token) return;
    setBillingBusy("portal");
    setBillingMsg(null);
    try {
      const response = await billingApi.createPortalSession(token);
      window.location.href = response.url;
    } catch (error) {
      setBillingMsg(error instanceof Error ? error.message : "Nao foi possivel abrir o portal de cobranca.");
      setBillingBusy(null);
    }
  }

  async function handleDeleteAccount() {
    const token = getToken();
    if (!token) return;
    setDeletingAccount(true);
    setDeleteMsg(null);
    try {
      await authApi.deleteAccount(token, "DELETAR", deletePassword || undefined);
      clearTokens();
      router.replace("/login");
    } catch (error) {
      setDeleteMsg(error instanceof Error ? error.message : "Nao foi possivel deletar a conta.");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleInstagramOAuth() {
    const token = getToken();
    if (!token) return;
    setConnectingOAuth(true);
    setIntegrationMsg(null);
    try {
      const { auth_url } = await connectionsApi.getInstagramAuthUrl(token);
      window.location.href = auth_url;
    } catch (error) {
      setIntegrationMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Erro ao gerar URL de autorizacao.",
      });
      setConnectingOAuth(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-8 text-sm text-slate-400">Carregando configuracoes...</div>;
  }

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-sans font-light text-brand-heading">Configuracoes da Conta</h1>
        <p className="text-brand-text text-sm font-light mt-1">Perfil, cobranca, seguranca e integracoes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-1.5">
          {[
            ["profile", "Perfil"],
            ["billing", "Plano & Cobranca"],
            ["notifications", "Notificacoes"],
            ["security", "Seguranca"],
            ["integrations", "Integracoes"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as Tab)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                activeTab === tab ? "bg-white shadow-card border border-slate-100 text-brand-heading" : "text-slate-500 hover:bg-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === "profile" && (
            <section className="dream-card p-8 space-y-5">
              <div>
                <h2 className="text-lg font-medium text-brand-heading">Informacoes do Perfil</h2>
                <p className="text-sm text-slate-400">{currentPlan.name}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Primeiro nome" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50" />
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Sobrenome" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50" />
              </div>
              <input value={user?.email || ""} readOnly className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100/60 text-slate-400" />
              {profileMsg && <p className="text-sm text-slate-600">{profileMsg}</p>}
              <div className="flex justify-end">
                <button onClick={handleSaveProfile} disabled={savingProfile} className="px-6 py-2.5 bg-slate-800 text-white text-sm rounded-xl disabled:opacity-60">
                  {savingProfile ? "Salvando..." : "Salvar Alteracoes"}
                </button>
              </div>
            </section>
          )}

          {activeTab === "billing" && (
            <section className="dream-card p-8 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium text-brand-heading">Plano Atual</h2>
                  <p className="text-sm text-brand-lilacDark">{currentPlan.name} . {planPrice}</p>
                </div>
                <span className="px-3 py-1 bg-violet-50 text-brand-lilacDark text-xs font-bold rounded-full border border-violet-100 uppercase tracking-wide">
                  {subscriptionStatus || "active"}
                </span>
              </div>
              <p className="text-sm text-slate-400">{currentPlan.description}</p>
              {billingMsg && <p className="text-sm text-slate-600">{billingMsg}</p>}
              <div className="flex gap-3 flex-wrap">
                {nextPlan && user?.plan !== "admin" && (
                  <button onClick={handleUpgrade} disabled={billingBusy !== null} className="px-4 py-2.5 bg-slate-900 text-white text-sm rounded-xl disabled:opacity-60">
                    {billingBusy === "checkout" ? "Abrindo checkout..." : `Upgrade para ${nextPlan.name}`}
                  </button>
                )}
                <button onClick={handlePortal} disabled={billingBusy !== null} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl disabled:opacity-60">
                  {billingBusy === "portal" ? "Abrindo portal..." : "Gerenciar cobranca"}
                </button>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="dream-card p-8 space-y-4">
              <h2 className="text-lg font-medium text-brand-heading">Notificacoes</h2>
              <label className="flex items-center justify-between text-sm"><span>Alertas por e-mail</span><input type="checkbox" defaultChecked /></label>
              <label className="flex items-center justify-between text-sm"><span>Resumo semanal</span><input type="checkbox" defaultChecked /></label>
              <label className="flex items-center justify-between text-sm"><span>Atualizacoes de marketing</span><input type="checkbox" /></label>
            </section>
          )}

          {activeTab === "security" && (
            <section className="dream-card p-8 space-y-5">
              <h2 className="text-lg font-medium text-brand-heading">Seguranca</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <input type="password" value={currentPwd} onChange={(event) => setCurrentPwd(event.target.value)} placeholder="Senha atual" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50" />
                <input type="password" value={newPwd} onChange={(event) => setNewPwd(event.target.value)} placeholder="Nova senha" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50" />
                <input type="password" value={confirmPwd} onChange={(event) => setConfirmPwd(event.target.value)} placeholder="Confirmar nova senha" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50" />
                {pwdMsg && <p className="text-sm text-slate-600">{pwdMsg}</p>}
                <div className="flex justify-end">
                  <button type="submit" disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd} className="px-6 py-2.5 bg-slate-800 text-white text-sm rounded-xl disabled:opacity-60">
                    {savingPwd ? "Alterando..." : "Alterar Senha"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === "integrations" && (
            <section className="dream-card p-8 space-y-4">
              <div>
                <h2 className="text-lg font-medium text-brand-heading">Integracoes</h2>
                <p className="text-sm text-slate-400">Conecte a conta oficial para enriquecer a coleta.</p>
              </div>
              {integrationMsg && (
                <div className={`p-3 rounded-xl text-sm ${integrationMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                  {integrationMsg.text}
                </div>
              )}
              <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-brand-heading">Instagram Graph API</p>
                    <p className="text-xs text-slate-400">Usa OAuth com state seguro salvo no servidor.</p>
                  </div>
                  {igConnected && <span className="px-2.5 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded-full border border-green-100">Conectado</span>}
                </div>
                {!igConnected && (
                  <button onClick={handleInstagramOAuth} disabled={connectingOAuth} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-60">
                    {connectingOAuth ? "Redirecionando..." : "Conectar conta oficial"}
                  </button>
                )}
              </div>
            </section>
          )}

          {(activeTab === "profile" || activeTab === "security") && (
            <section className="dream-card border-red-50 p-8 space-y-4">
              <h2 className="text-lg font-medium text-red-600">Zona de Risco</h2>
              <p className="text-sm text-slate-500">Deletar a conta remove permanentemente conexoes, posts e analises.</p>
              <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-white text-red-600 text-sm font-medium border border-red-100 rounded-lg">
                Deletar Conta
              </button>
            </section>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-modal border border-white p-8 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-brand-heading">Confirmar Exclusao</h3>
            <p className="text-sm text-slate-500">Digite DELETAR e informe a senha atual se esta conta usa login por senha.</p>
            <input value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} placeholder="DELETAR" className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30" />
            <input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Senha atual" className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30" />
            {deleteMsg && <p className="text-sm text-red-500">{deleteMsg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); setDeletePassword(""); setDeleteMsg(null); }} className="py-3 px-4 rounded-xl text-sm font-medium text-slate-500 border border-slate-100">
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETAR" || deletingAccount} className="py-3 px-4 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-40">
                {deletingAccount ? "Deletando..." : "Deletar Permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
