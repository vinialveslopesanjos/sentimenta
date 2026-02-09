"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/animations/FadeIn";
import { StaggerList } from "@/components/animations/StaggerList";
import { SkeletonCard } from "@/components/ui/skeleton";

interface Connection {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  followers_count: number;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
}

export default function ConnectPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [ytHandle, setYtHandle] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [igHandle, setIgHandle] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadConnections();

    // Check for OAuth callback results in URL
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const platform = params.get("platform");
    const errorMsg = params.get("error");

    if (status === "success" && platform) {
      setSuccess(`${platform.charAt(0).toUpperCase() + platform.slice(1)} conectado com sucesso!`);
      // Clean URL
      window.history.replaceState({}, "", "/connect");
      setTimeout(() => loadConnections(), 500);
    } else if (status === "error" && platform) {
      setError(`Erro ao conectar ${platform}: ${errorMsg || "Erro desconhecido"}`);
      // Clean URL
      window.history.replaceState({}, "", "/connect");
    }
  }, []);

  async function loadConnections() {
    const token = getToken();
    if (!token) return;
    try {
      const data = await connectionsApi.list(token);
      setConnections(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function connectYoutube() {
    const token = getToken();
    if (!token || !ytHandle.trim()) return;
    setYtLoading(true);
    setError("");
    setSuccess("");

    try {
      await connectionsApi.connectYoutube(token, ytHandle.trim());
      setSuccess("Canal YouTube conectado!");
      setYtHandle("");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar YouTube");
    } finally {
      setYtLoading(false);
    }
  }

  async function connectInstagram() {
    const token = getToken();
    if (!token || !igHandle.trim()) return;
    setIgLoading(true);
    setError("");
    setSuccess("");

    try {
      await connectionsApi.connectInstagram(token, igHandle.trim());
      setSuccess("Perfil Instagram conectado!");
      setIgHandle("");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar Instagram");
    } finally {
      setIgLoading(false);
    }
  }

  async function syncConnection(id: string) {
    const token = getToken();
    if (!token) return;
    setSyncingId(id);
    setError("");
    setSuccess("");

    try {
      const result = await connectionsApi.sync(token, id);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncingId(null);
    }
  }

  async function deleteConnection(id: string) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Tem certeza que deseja desconectar?")) return;

    try {
      await connectionsApi.delete(token, id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      setSuccess("Conexão removida");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-56 bg-[#21262d] rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard className="h-52" />
          <SkeletonCard className="h-52" />
          <SkeletonCard className="h-52" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Conectar redes sociais</h1>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-negative/10 border border-negative/20 text-negative text-sm rounded-lg px-4 py-3"
        >
          {error}
        </motion.div>
      )}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-positive/10 border border-positive/20 text-positive text-sm rounded-lg px-4 py-3"
        >
          {success}
        </motion.div>
      )}

      {/* Connect platforms */}
      <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          // Instagram
          <Card key="instagram" className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10 hover:border-[#7c3aed]/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">I</span>
                </div>
                <div>
                  <h3 className="font-semibold">Instagram</h3>
                  <p className="text-sm text-text-secondary">
                    Informe o perfil publico
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-muted">
                Analisa perfis publicos do Instagram. Busca posts e comentarios
                automaticamente via scraping (sem precisar de OAuth).
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="@username"
                  value={igHandle}
                  onChange={(e) => setIgHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connectInstagram()}
                />
                <Button
                  onClick={connectInstagram}
                  disabled={igLoading || !igHandle.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shrink-0"
                >
                  {igLoading ? "..." : "Conectar"}
                </Button>
              </div>
            </CardContent>
          </Card>,

          // YouTube
          <Card key="youtube" className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10 hover:border-red-500/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">Y</span>
                </div>
                <div>
                  <h3 className="font-semibold">YouTube</h3>
                  <p className="text-sm text-text-secondary">
                    Informe o canal para analisar
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-muted">
                Busca automaticamente o ultimo video do canal e analisa os
                comentarios via scraping.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="@NomeDoCanal"
                  value={ytHandle}
                  onChange={(e) => setYtHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connectYoutube()}
                />
                <Button
                  onClick={connectYoutube}
                  disabled={ytLoading || !ytHandle.trim()}
                  className="bg-red-600 hover:bg-red-700 shrink-0"
                >
                  {ytLoading ? "..." : "Conectar"}
                </Button>
              </div>
            </CardContent>
          </Card>,

          // Twitter (Coming soon)
          <Card key="twitter" className="opacity-50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">X</span>
                </div>
                <div>
                  <h3 className="font-semibold">Twitter / X</h3>
                  <p className="text-sm text-text-secondary">Em breve</p>
                </div>
              </div>
              <p className="text-sm text-text-muted">
                Integracao com Twitter API v2 sera adicionada na proxima versao.
              </p>
              <Button disabled className="w-full">
                Em breve
              </Button>
            </CardContent>
          </Card>,
        ]}
      </StaggerList>

      {/* Connected accounts */}
      {connections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Contas conectadas</h2>
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        conn.platform === "instagram"
                          ? "bg-gradient-to-br from-purple-500 to-pink-500"
                          : conn.platform === "youtube"
                          ? "bg-red-600"
                          : "bg-sky-500"
                      )}
                    >
                      {conn.platform[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">
                        {conn.display_name || conn.username}
                      </p>
                      <p className="text-xs text-text-muted">
                        {conn.platform} &middot;{" "}
                        {formatNumber(conn.followers_count)} seguidores
                        {conn.last_sync_at && (
                          <> &middot; Sync: {new Date(conn.last_sync_at).toLocaleDateString("pt-BR")}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        conn.status === "active"
                          ? "bg-positive/10 text-positive"
                          : "bg-neutral/10 text-neutral"
                      )}
                    >
                      {conn.status === "active" ? "Ativo" : conn.status}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => syncConnection(conn.id)}
                      disabled={syncingId === conn.id}
                    >
                      {syncingId === conn.id ? "Sincronizando..." : "Sync"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteConnection(conn.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
