"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Connection = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  followers_count: number;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
};

type PlatformId = "instagram" | "youtube";

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `Há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Há ${hrs}h`;
  return `Há ${Math.floor(hrs / 24)}d`;
}

function PlatformIcon({ platform, size = 24 }: { platform: string; size?: number }) {
  if (platform === "instagram") {
    return (
      <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
        <rect height="20" rx="5" ry="5" width="20" x="2" y="2"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
    );
  }
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/>
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
    </svg>
  );
}

type SyncParams = {
  max_posts: number;
  max_comments_per_post: number;
  since_date: string;
};

export default function ConnectPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({ instagram: "", youtube: "" });
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showSyncParams, setShowSyncParams] = useState(false);
  const [syncParams, setSyncParams] = useState<SyncParams>({
    max_posts: 10,
    max_comments_per_post: 100,
    since_date: "",
  });

  const loadConnections = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await connectionsApi.list(token);
      setConnections(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleConnect = async (platformId: PlatformId) => {
    const handle = inputs[platformId]?.trim();
    if (!handle) {
      setErrors(e => ({ ...e, [platformId]: "Informe o usuário ou URL." }));
      return;
    }
    setErrors(e => ({ ...e, [platformId]: "" }));
    setConnecting(c => ({ ...c, [platformId]: true }));
    try {
      const token = getToken()!;
      if (platformId === "instagram") {
        await connectionsApi.connectInstagram(token, handle.replace("@", ""));
      } else {
        await connectionsApi.connectYoutube(token, handle);
      }
      setInputs(i => ({ ...i, [platformId]: "" }));
      setSuccess(s => ({ ...s, [platformId]: "Perfil conectado!" }));
      setTimeout(() => setSuccess(s => ({ ...s, [platformId]: "" })), 3000);
      await loadConnections();
    } catch (err) {
      setErrors(e => ({ ...e, [platformId]: err instanceof Error ? err.message : "Falha ao conectar." }));
    } finally {
      setConnecting(c => ({ ...c, [platformId]: false }));
    }
  };

  const handleSync = async (connId: string) => {
    const token = getToken()!;
    setSyncing(s => ({ ...s, [connId]: true }));
    try {
      await connectionsApi.sync(token, connId, {
        max_posts: syncParams.max_posts,
        max_comments_per_post: syncParams.max_comments_per_post,
        since_date: syncParams.since_date || undefined,
      });
    } finally {
      setTimeout(() => setSyncing(s => ({ ...s, [connId]: false })), 2500);
    }
  };

  const handleDelete = async (connId: string) => {
    const token = getToken()!;
    try {
      await connectionsApi.delete(token, connId);
      setConnections(c => c.filter(x => x.id !== connId));
    } finally {
      setConfirmDelete(null);
    }
  };

  const platforms = [
    { id: "instagram" as PlatformId, name: "Instagram", desc: "Perfil público funciona sem login", placeholder: "@usuario", colorBg: "from-orange-100 to-pink-100", colorText: "text-pink-500" },
    { id: "youtube" as PlatformId, name: "YouTube", desc: "Análise de comentários em vídeos", placeholder: "@canal ou URL", colorBg: "from-red-50 to-red-100", colorText: "text-red-500" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-medium text-slate-800">Conectar Perfis</h1>
          <p className="text-sm text-slate-400 font-light">Gerencie suas fontes de dados para análise de sentimento.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />
          <span className="text-xs text-brand-cyanDark font-medium hidden sm:block">Sincronização automática ativa</span>
        </div>
      </header>

      <main className="p-6 md:p-8 max-w-screen-xl mx-auto space-y-10 animate-fade-in">
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Adicionar Perfil</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {platforms.map((p) => (
              <div key={p.id} className="dream-card p-6 flex flex-col items-center text-center hover:shadow-float transition-all duration-300 group">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${p.colorBg} ${p.colorText} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <PlatformIcon platform={p.id} size={26} />
                </div>
                <h4 className="font-sans font-medium text-slate-700 mb-1">{p.name}</h4>
                <p className="text-xs text-slate-400 font-light mb-5">{p.desc}</p>
                <div className="w-full space-y-3">
                  <input
                    type="text"
                    value={inputs[p.id] ?? ""}
                    onChange={(e) => setInputs(i => ({ ...i, [p.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConnect(p.id); }}
                    placeholder={p.placeholder}
                    disabled={connecting[p.id]}
                    className="w-full text-center text-sm px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 placeholder:text-slate-300 focus:bg-white focus:border-brand-lilac focus:ring-4 focus:ring-brand-lilac/10 outline-none transition-all disabled:opacity-50"
                  />
                  {errors[p.id] && <p className="text-[11px] text-rose-500">{errors[p.id]}</p>}
                  {success[p.id] && <p className="text-[11px] text-emerald-600">{success[p.id]}</p>}
                  <button
                    onClick={() => handleConnect(p.id)}
                    disabled={connecting[p.id]}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-gradient-to-r hover:from-brand-lilacDark hover:to-brand-cyanDark transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {connecting[p.id] ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Conectando...</>
                    ) : "Conectar"}
                  </button>
                </div>
              </div>
            ))}

            {/* TikTok — em breve */}
            <div className="dream-card p-6 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[24px]">
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-400 shadow-sm border border-slate-100">Em Breve</span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <svg fill="none" height="26" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="26">
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
                </svg>
              </div>
              <h4 className="font-sans font-medium text-slate-400 mb-1">TikTok</h4>
              <p className="text-xs text-slate-300 font-light mb-5">Tendências virais</p>
              <div className="w-full space-y-3 opacity-50">
                <input disabled placeholder="@usuario" className="w-full text-center text-sm px-4 py-2.5 rounded-xl bg-white border border-slate-100" readOnly />
                <button disabled className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-400 text-sm font-medium cursor-not-allowed">Conectar</button>
              </div>
            </div>
          </div>
        </section>

        {/* Connected profiles list */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Perfis Conectados</h2>
            <span className="text-xs text-slate-400">{connections.length} perfil{connections.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Scraping params — show only when there are connections */}
          {!loading && connections.length > 0 && (
            <div className="dream-card overflow-hidden mb-6">
              <button
                onClick={() => setShowSyncParams(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-brand-lilacDark">tune</span>
                  <span className="text-sm font-medium text-slate-700">Configurações de Análise</span>
                  <span className="text-xs text-slate-400 font-light hidden sm:block">— posts, comentários e período</span>
                </div>
                <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${showSyncParams ? "rotate-180" : ""}`}>expand_more</span>
              </button>
              {showSyncParams && (
                <div className="px-6 pb-5 border-t border-slate-50 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Posts a analisar */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Posts a analisar</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ label: "Últimos 10", value: 10 }, { label: "Últimos 50", value: 50 }, { label: "Todos (200)", value: 200 }].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setSyncParams(p => ({ ...p, max_posts: opt.value }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${syncParams.max_posts === opt.value ? "bg-brand-lilacDark text-white border-brand-lilacDark" : "bg-white text-slate-500 border-slate-200 hover:border-brand-lilac"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Comentários por post */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Comentários por post</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ label: "10", value: 10 }, { label: "100", value: 100 }, { label: "Todos (1000)", value: 1000 }].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setSyncParams(p => ({ ...p, max_comments_per_post: opt.value }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${syncParams.max_comments_per_post === opt.value ? "bg-brand-cyanDark text-white border-brand-cyanDark" : "bg-white text-slate-500 border-slate-200 hover:border-brand-cyan"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* A partir de */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">A partir de</p>
                    <input
                      type="date"
                      value={syncParams.since_date}
                      onChange={e => setSyncParams(p => ({ ...p, since_date: e.target.value }))}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-brand-lilac transition-colors"
                      placeholder="Sem filtro de data"
                    />
                    {syncParams.since_date && (
                      <button onClick={() => setSyncParams(p => ({ ...p, since_date: "" }))} className="text-[10px] text-slate-400 hover:text-rose-500 mt-1">
                        Limpar filtro de data
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {loading ? (
            <div className="dream-card p-6 space-y-4 animate-pulse">
              {[0,1,2].map(i => <div key={i} className="h-14 bg-slate-50 rounded-2xl" />)}
            </div>
          ) : connections.length === 0 ? (
            <div className="dream-card p-16 flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-200 mb-4">link_off</span>
              <p className="text-slate-400 font-light">Nenhum perfil conectado ainda.</p>
            </div>
          ) : (
            <div className="dream-card overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-50 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-4">Perfil</div>
                <div className="col-span-2">Seguidores</div>
                <div className="col-span-3">Último Sync</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Ações</div>
              </div>
              <div className="divide-y divide-slate-50">
                {connections.map((conn) => {
                  const colorBg = conn.platform === "instagram" ? "from-orange-100 to-pink-100 text-pink-500" : "from-red-50 to-red-100 text-red-500";
                  const isSyncing = syncing[conn.id];
                  return (
                    <div key={conn.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                      <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${colorBg} flex items-center justify-center shrink-0`}>
                          <PlatformIcon platform={conn.platform} size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 text-sm">@{conn.username}</p>
                          {conn.display_name && <p className="text-xs text-slate-400 truncate">{conn.display_name}</p>}
                        </div>
                      </div>
                      <div className="hidden md:block col-span-2 text-sm text-slate-500">
                        {conn.followers_count > 0 ? conn.followers_count.toLocaleString("pt-BR") : "—"}
                      </div>
                      <div className="hidden md:block col-span-3 text-xs text-slate-400">{relativeTime(conn.last_sync_at)}</div>
                      <div className="hidden md:block col-span-1">
                        {isSyncing ? (
                          <span className="flex items-center gap-1 text-xs text-brand-cyanDark font-medium">
                            <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />Sync
                          </span>
                        ) : conn.status === "active" ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />Ativo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-rose-500 font-medium">
                            <span className="w-2 h-2 rounded-full bg-rose-400" />Erro
                          </span>
                        )}
                      </div>
                      <div className="col-span-12 md:col-span-2 flex items-center gap-1">
                        <Link href={`/dashboard/connection/${conn.id}`} className="p-2 rounded-xl text-slate-400 hover:text-brand-lilacDark hover:bg-brand-lilacLight transition-colors" title="Analisar">
                          <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                        </Link>
                        <button onClick={() => handleSync(conn.id)} disabled={isSyncing} className="p-2 rounded-xl text-slate-400 hover:text-brand-cyanDark hover:bg-brand-cyanLight transition-colors disabled:opacity-50" title="Sincronizar">
                          <span className={`material-symbols-outlined text-[18px] ${isSyncing ? "animate-spin" : ""}`}>sync</span>
                        </button>
                        <button onClick={() => setConfirmDelete(conn.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="Remover">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-modal p-8 max-w-sm w-full animate-slide-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-5">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <h3 className="font-sans font-semibold text-slate-800 text-lg mb-2">Remover perfil?</h3>
            <p className="text-slate-400 font-light text-sm mb-6">Todos os dados de análise serão excluídos permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl bg-slate-50 text-slate-600 font-medium text-sm hover:bg-slate-100 transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-medium text-sm hover:bg-rose-600 transition-colors">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
