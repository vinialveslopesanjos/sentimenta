"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { User, CreditCard, Bell, Shield, Link2, Camera, Trash2, Check, X, Eye, EyeOff, Key, Smartphone, Globe, Mail, Clock, AlertTriangle } from "lucide-react";
import { authApi, billingApi, connectionsApi } from "@/lib/api";
import { clearTokens, getToken, setTokens } from "@/lib/auth";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";

type Tab = "Perfil" | "Plano & Cobranca" | "Notificacoes" | "Seguranca" | "Integracoes";
type UserData = { id: string; email: string; name: string | null; avatar_url: string | null; plan: string };
type BillingPlan = { slug: string; name: string; price_brl: number; description: string; highlight?: boolean; limits: Record<string, unknown> };

const tabItems: { icon: React.ElementType; label: Tab }[] = [
  { icon: User, label: "Perfil" },
  { icon: CreditCard, label: "Plano & Cobranca" },
  { icon: Bell, label: "Notificacoes" },
  { icon: Shield, label: "Seguranca" },
  { icon: Link2, label: "Integracoes" },
];

const PLAN_ORDER = ["free", "starter", "pro", "business", "enterprise"];
const PLAN_FALLBACK: Record<string, BillingPlan> = {
  free: { slug: "free", name: "Gratis", price_brl: 0, description: "500 comentarios/mes", limits: {} },
  starter: { slug: "starter", name: "Starter", price_brl: 97, description: "5.000 comentarios/mes", limits: {} },
  pro: { slug: "pro", name: "Pro", price_brl: 247, description: "20.000 comentarios/mes", limits: {} },
  business: { slug: "business", name: "Business", price_brl: 597, description: "80.000 comentarios/mes", limits: {} },
  enterprise: { slug: "enterprise", name: "Enterprise", price_brl: 0, description: "Sob consulta", limits: {} },
  admin: { slug: "admin", name: "Admin", price_brl: 0, description: "Ilimitado", limits: {} },
  // Legacy mappings
  creator: { slug: "starter", name: "Starter", price_brl: 97, description: "5.000 comentarios/mes", limits: {} },
  agency: { slug: "business", name: "Business", price_brl: 597, description: "80.000 comentarios/mes", limits: {} },
};

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative rounded-full transition-colors" style={{ width: 40, height: 22, backgroundColor: on ? "var(--primary)" : "var(--border)" }}>
      <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all shadow-sm ${on ? "left-[20px]" : "left-0.5"}`} style={{ backgroundColor: "var(--bg-card)" }} />
    </button>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthStatus = searchParams.get("status");
  const initialTab = (searchParams.get("tab") as Tab) || "Perfil";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [usageData, setUsageData] = useState<any>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(searchParams.get("payment") === "success");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  const [billingBusy, setBillingBusy] = useState<"checkout" | "portal" | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifAlertScore, setNotifAlertScore] = useState(true);
  const [notifAlertVolume, setNotifAlertVolume] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifNewComment, setNotifNewComment] = useState(false);
  const [notifSync, setNotifSync] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [integrationMsg, setIntegrationMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    oauthStatus === "success"
      ? { type: "success", text: "Conta Instagram conectada com sucesso." }
      : oauthStatus === "error"
        ? { type: "error", text: `Erro na conexao: ${searchParams.get("error") || "desconhecido"}` }
        : null
  );

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    let mounted = true;
    (async () => {
      try {
        const [me, plans, usage, conns] = await Promise.all([
          authApi.me(token),
          billingApi.plans(token),
          billingApi.usage(token),
          connectionsApi.list(token),
        ]);
        if (!mounted) return;
        setUser(me);
        setBillingPlans(plans.plans || []);
        setSubscriptionStatus(usage.subscription_status || null);
        setUsageData(usage.usage || null);
        setIgConnected(conns.some(c => c.platform === "instagram" && c.has_oauth_token));
        setConnections(conns);
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
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    if (paymentSuccess) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("payment");
      const remaining = params.toString();
      router.replace(remaining ? `?${remaining}` : window.location.pathname, { scroll: false });
    }
  }, [paymentSuccess, router, searchParams]);

  const planMap = useMemo(() => {
    const entries = [...billingPlans, PLAN_FALLBACK.admin].map(p => [p.slug, p] as const);
    return Object.fromEntries(entries);
  }, [billingPlans]);
  const currentPlan = planMap[user?.plan || "free"] || PLAN_FALLBACK[user?.plan || "free"] || PLAN_FALLBACK.free;
  const currentPlanIndex = PLAN_ORDER.indexOf(user?.plan || "free");
  const nextPlanSlug = currentPlanIndex >= 0 ? PLAN_ORDER[currentPlanIndex + 1] : null;
  const nextPlan = nextPlanSlug ? planMap[nextPlanSlug] || PLAN_FALLBACK[nextPlanSlug] : null;

  async function handleSaveProfile() {
    const token = getToken();
    if (!token) return;
    setSavingProfile(true); setProfileMsg(null);
    try {
      const name = [firstName, lastName].filter(Boolean).join(" ") || null;
      await authApi.updateMe(token, { name });
      setUser(prev => prev ? { ...prev, name } : prev);
      setProfileMsg("Perfil atualizado com sucesso.");
    } catch (error) {
      setProfileMsg(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally { setSavingProfile(false); }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;
    if (newPwd !== confirmPwd) return setPwdMsg("As senhas nao coincidem.");
    setSavingPwd(true); setPwdMsg(null);
    try {
      const tokens = await authApi.changePassword(token, currentPwd, newPwd);
      setTokens(tokens.access_token, tokens.refresh_token);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setPwdMsg("Senha alterada com sucesso.");
    } catch (error) {
      setPwdMsg(error instanceof Error ? error.message : "Nao foi possivel alterar a senha.");
    } finally { setSavingPwd(false); }
  }

  async function handleUpgrade() {
    const token = getToken();
    if (!token || !nextPlan) return;
    setBillingBusy("checkout"); setBillingMsg(null);
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
    setBillingBusy("portal"); setBillingMsg(null);
    try {
      const response = await billingApi.createPortalSession(token);
      window.location.href = response.url;
    } catch (error) {
      setBillingMsg(error instanceof Error ? error.message : "Nao foi possivel abrir o portal.");
      setBillingBusy(null);
    }
  }

  async function handleDeleteAccount() {
    const token = getToken();
    if (!token) return;
    setDeletingAccount(true); setDeleteMsg(null);
    try {
      await authApi.deleteAccount(token, "DELETAR", deletePassword || undefined);
      clearTokens();
      router.replace("/login");
    } catch (error) {
      setDeleteMsg(error instanceof Error ? error.message : "Nao foi possivel deletar a conta.");
    } finally { setDeletingAccount(false); }
  }

  async function handleInstagramOAuth() {
    const token = getToken();
    if (!token) return;
    setConnectingOAuth(true); setIntegrationMsg(null);
    try {
      const { auth_url } = await connectionsApi.getInstagramAuthUrl(token);
      window.location.href = auth_url;
    } catch (error) {
      setIntegrationMsg({ type: "error", text: error instanceof Error ? error.message : "Erro ao gerar URL." });
      setConnectingOAuth(false);
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl transition-all";
  const inputStyle: React.CSSProperties = { fontSize: "0.82rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" };

  if (loading) {
    return <div className="p-8" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Carregando configuracoes...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Configuracoes da Conta</h1>
        <p className="mt-1" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Gerencie seu perfil, plano e preferencias.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <div className="flex md:flex-col md:w-52 shrink-0 gap-0.5 overflow-x-auto md:overflow-visible">
          {tabItems.map(t => (
            <button
              key={t.label}
              onClick={() => setActiveTab(t.label)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left whitespace-nowrap"
              style={{ fontSize: "0.82rem", fontWeight: activeTab === t.label ? 500 : 400, backgroundColor: activeTab === t.label ? "var(--primary-bg)" : "transparent", color: activeTab === t.label ? "var(--primary)" : "var(--text-muted)" }}
            >
              <t.icon className="w-[18px] h-[18px]" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6">
          {activeTab === "Perfil" && (
            <>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-6" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Informacoes do Perfil</h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--secondary), var(--primary))" }}>
                      <span className="text-white" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 600 }}>{(firstName || user?.email || "U")[0].toUpperCase()}</span>
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <Camera className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                    </button>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{firstName || user?.email}</p>
                    <Badge variant="primary">{currentPlan.name}</Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>PRIMEIRO NOME</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>SOBRENOME</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>ENDERECO DE E-MAIL</label>
                    <input type="email" value={user?.email || ""} readOnly className={inputClass} style={{ ...inputStyle, opacity: 0.6 }} />
                  </div>
                  {profileMsg && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{profileMsg}</p>}
                  <div className="flex justify-end pt-2"><Button variant="primary" onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? "Salvando..." : "Salvar Alteracoes"}</Button></div>
                </div>
              </div>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--sentiment-negative)" }}>
                <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--sentiment-negative)" }}>Zona de Risco</h3>
                <p className="mb-4" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Depois de deletar sua conta, nao ha mais volta.</p>
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "var(--sentiment-negative-bg)" }}>
                  <div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>Deletar Conta</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Remove permanentemente sua conta e todos os dados.</p>
                  </div>
                  <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setShowDeleteModal(true)}>Deletar Conta</Button>
                </div>
              </div>
            </>
          )}

          {activeTab === "Plano & Cobranca" && (
            <>
              {paymentSuccess && (
                <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--sentiment-positive-bg)", border: "1px solid var(--sentiment-positive)" }}>
                  <Check className="w-5 h-5 shrink-0" style={{ color: "var(--sentiment-positive)" }} />
                  <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--sentiment-positive)" }}>Plano ativado com sucesso! Seus novos limites ja estao ativos.</p>
                </div>
              )}

              {/* Current Plan Card */}
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Seu Plano Atual</h3>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="primary">{currentPlan.name}</Badge>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      fontSize: "0.68rem",
                      backgroundColor: subscriptionStatus === "past_due" ? "rgba(245,158,11,0.12)" : subscriptionStatus === "canceled" ? "var(--sentiment-negative-bg)" : "var(--sentiment-positive-bg)",
                      color: subscriptionStatus === "past_due" ? "#f59e0b" : subscriptionStatus === "canceled" ? "var(--sentiment-negative)" : "var(--sentiment-positive)",
                    }}
                  >
                    {subscriptionStatus || "active"}
                  </span>
                </div>
                {currentPlan.price_brl > 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", fontWeight: 700 }}>R$ {currentPlan.price_brl}</span>
                    <span style={{ color: "var(--text-muted)" }}>/mes</span>
                  </p>
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{currentPlan.slug === "enterprise" ? "Sob consulta" : "Gratuito"}</p>
                )}
                {usageData?.billing_period_start && usageData?.billing_period_end && (
                  <p className="mt-1" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    Periodo: {new Date(usageData.billing_period_start).toLocaleDateString("pt-BR")} - {new Date(usageData.billing_period_end).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>

              {/* Usage Bars */}
              {usageData && (
                <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <h3 className="mb-5" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Uso do Plano</h3>
                  <div className="space-y-5">
                    {[
                      { label: "Comentarios", used: usageData.comments_used_this_month, limit: usageData.comments_included, unit: "comentarios" },
                      { label: "Conexoes", used: usageData.connections_used, limit: usageData.connections_limit, unit: "conexoes" },
                      { label: "Syncs", used: usageData.syncs_used_this_month, limit: usageData.syncs_limit, unit: "syncs este mes" },
                    ].map(item => {
                      const pct = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{item.label}</label>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontWeight: 500 }}>
                              {item.used.toLocaleString("pt-BR")} / {item.limit.toLocaleString("pt-BR")} {item.unit}
                            </span>
                          </div>
                          <div className="w-full rounded-full" style={{ height: 8, backgroundColor: "var(--border)" }}>
                            <div
                              className="rounded-full transition-all"
                              style={{
                                height: 8,
                                width: `${pct}%`,
                                backgroundColor: pct >= 90 ? "var(--sentiment-negative)" : "var(--primary)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overage Section */}
                  {usageData.overage_comments > 0 && (
                    <div className="mt-5 p-4 rounded-xl" style={{ backgroundColor: "var(--sentiment-negative-bg)" }}>
                      <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--sentiment-negative)" }}>
                        {usageData.overage_comments.toLocaleString("pt-BR")} comentarios excedentes x R$ {usageData.overage_price_per_comment.toFixed(4)} = <strong>R$ {usageData.overage_cost_brl.toFixed(2)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons & Available Plans */}
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {billingMsg && <p className="mb-4" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{billingMsg}</p>}
                <div className="flex gap-3 flex-wrap mb-6">
                  {nextPlan && user?.plan !== "admin" && (
                    <Button variant="primary" onClick={handleUpgrade} disabled={billingBusy !== null}>
                      {billingBusy === "checkout" ? "Abrindo checkout..." : `Upgrade para ${nextPlan.name}`}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handlePortal} disabled={billingBusy !== null}>
                    {billingBusy === "portal" ? "Abrindo portal..." : "Gerenciar cobranca"}
                  </Button>
                </div>

                {user?.plan !== "admin" && billingPlans.length > 0 && (
                  <>
                    <h4 className="mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>Planos Disponiveis</h4>
                    <div className="space-y-3">
                      {billingPlans
                        .filter(p => PLAN_ORDER.indexOf(p.slug) > currentPlanIndex && p.slug !== "enterprise")
                        .sort((a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug))
                        .map(plan => (
                          <div key={plan.slug} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
                            <div>
                              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{plan.name}</p>
                              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                R$ {plan.price_brl}/mes — {plan.description}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={billingBusy !== null}
                              onClick={async () => {
                                const token = getToken();
                                if (!token) return;
                                setBillingBusy("checkout"); setBillingMsg(null);
                                try {
                                  const response = await billingApi.createCheckoutSession(token, plan.slug);
                                  window.location.href = response.url;
                                } catch (error) {
                                  setBillingMsg(error instanceof Error ? error.message : "Nao foi possivel abrir o checkout.");
                                  setBillingBusy(null);
                                }
                              }}
                            >
                              Upgrade
                            </Button>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === "Notificacoes" && (
            <>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Canais de Notificacao</h3>
                <p className="mb-6" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Escolha como deseja receber suas notificacoes.</p>
                <div className="space-y-4">
                  {[
                    { icon: Mail, label: "E-mail", desc: "Receba alertas e relatorios por e-mail", on: notifEmail, set: () => setNotifEmail(!notifEmail) },
                    { icon: Smartphone, label: "Push (Navegador)", desc: "Notificacoes em tempo real no navegador", on: notifPush, set: () => setNotifPush(!notifPush) },
                  ].map(ch => (
                    <div key={ch.label} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <div className="flex items-center gap-3"><ch.icon className="w-5 h-5" style={{ color: "var(--primary)" }} /><div><p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{ch.label}</p><p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{ch.desc}</p></div></div>
                      <Toggle on={ch.on} onChange={ch.set} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Tipos de Notificacao</h3>
                <p className="mb-6" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Configure quais eventos geram notificacoes.</p>
                <div className="space-y-3">
                  {[
                    { label: "Alerta de Score", desc: "Quando o score cai abaixo do limiar", icon: AlertTriangle, on: notifAlertScore, set: () => setNotifAlertScore(!notifAlertScore) },
                    { label: "Pico de Volume", desc: "Quando o volume de comentarios sobe acima do normal", icon: Bell, on: notifAlertVolume, set: () => setNotifAlertVolume(!notifAlertVolume) },
                    { label: "Relatorio Semanal", desc: "Resumo semanal por e-mail toda segunda-feira", icon: Clock, on: notifWeekly, set: () => setNotifWeekly(!notifWeekly) },
                    { label: "Novos Comentarios", desc: "Notificar a cada novo comentario analisado", icon: Bell, on: notifNewComment, set: () => setNotifNewComment(!notifNewComment) },
                    { label: "Status de Sincronizacao", desc: "Avisar quando a sincronizacao falhar ou completar", icon: Globe, on: notifSync, set: () => setNotifSync(!notifSync) },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between p-4 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary-bg)" }}><n.icon className="w-4 h-4" style={{ color: "var(--primary)" }} /></div>
                        <div><p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{n.label}</p><p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{n.desc}</p></div>
                      </div>
                      <Toggle on={n.on} onChange={n.set} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "Seguranca" && (
            <>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-6" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Alterar Senha</h3>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>SENHA ATUAL</label>
                    <div className="relative">
                      <input type={showCurrentPass ? "text" : "password"} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="********" className={inputClass + " pr-10"} style={inputStyle} />
                      <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>{showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>NOVA SENHA</label>
                    <div className="relative">
                      <input type={showNewPass ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="********" className={inputClass + " pr-10"} style={inputStyle} />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>{showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>CONFIRMAR NOVA SENHA</label>
                    <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="********" className={inputClass} style={inputStyle} />
                  </div>
                  {pwdMsg && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{pwdMsg}</p>}
                  <Button type="submit" variant="primary" disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}>{savingPwd ? "Alterando..." : "Alterar Senha"}</Button>
                </form>
              </div>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Autenticacao de Dois Fatores (2FA)</h3>
                <p className="mb-4" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Adicione uma camada extra de seguranca a sua conta.</p>
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}><Key className="w-5 h-5" style={{ color: "var(--primary)" }} /></div>
                    <div><p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>Autenticacao por App</p><p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Use Google Authenticator ou Authy</p></div>
                  </div>
                  <Toggle on={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                </div>
              </div>
            </>
          )}

          {activeTab === "Integracoes" && (
            <>
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Plataformas Conectadas</h3>
                <p className="mb-6" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Gerencie as conexoes OAuth e API das suas redes sociais.</p>
                {integrationMsg && (
                  <div className="p-3 rounded-xl text-sm mb-4" style={{ backgroundColor: integrationMsg.type === "success" ? "var(--sentiment-positive-bg)" : "var(--sentiment-negative-bg)", color: integrationMsg.type === "success" ? "var(--sentiment-positive)" : "var(--sentiment-negative)" }}>
                    {integrationMsg.text}
                  </div>
                )}
                <div className="space-y-3">
                  {connections.map((c: any) => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl gap-3" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <div className="flex items-center gap-3">
                        <GlassSocialIcon platform={c.platform} size={40} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{c.platform.charAt(0).toUpperCase() + c.platform.slice(1)}</p>
                            <Badge variant="positive">Ativo</Badge>
                          </div>
                          <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>@{c.username}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {connections.length === 0 && (
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Nenhuma plataforma conectada.</p>
                  )}
                </div>
              </div>
              {!igConnected && (
                <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <h3 className="mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Instagram Graph API</h3>
                  <p className="mb-4" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Conecte a conta oficial para enriquecer a coleta.</p>
                  <Button variant="primary" size="sm" onClick={handleInstagramOAuth} disabled={connectingOAuth}>
                    {connectingOAuth ? "Redirecionando..." : "Conectar conta oficial"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Confirmar Exclusao</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Digite DELETAR e informe a senha atual.</p>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETAR" className={inputClass} style={{ ...inputStyle, borderColor: "var(--sentiment-negative)" }} />
            <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Senha atual" className={inputClass} style={{ ...inputStyle, borderColor: "var(--sentiment-negative)" }} />
            {deleteMsg && <p style={{ fontSize: "0.78rem", color: "var(--sentiment-negative)" }}>{deleteMsg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); setDeletePassword(""); setDeleteMsg(null); }}>Cancelar</Button>
              <Button variant="danger" onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETAR" || deletingAccount}>
                {deletingAccount ? "Deletando..." : "Deletar Permanentemente"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Carregando...</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
