"use client";

import { useState } from "react";
import { Coins, ShoppingCart, Zap, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { creditsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreditPack {
  id: string;
  credits: number;
  price_brl: number;
}

interface CreditBalanceProps {
  planCredits: number;
  packCredits: number;
  total: number;
  planAllocation: number;
  plan: string;
  packs: CreditPack[];
  demographicCost: number;
  onPurchase?: () => void;
}

export function CreditBalance({
  planCredits,
  packCredits,
  total,
  planAllocation,
  plan,
  packs,
  demographicCost,
  onPurchase,
}: CreditBalanceProps) {
  const [showPackModal, setShowPackModal] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const usedCredits = planAllocation - planCredits;
  const usedPct = planAllocation > 0 ? Math.min((usedCredits / planAllocation) * 100, 100) : 0;

  async function handleBuyPack(packId: string) {
    const token = getToken();
    if (!token) return;
    setBuyingPack(packId);
    setBuyError(null);
    try {
      const response = await creditsApi.buyCredits(token, packId);
      window.open(response.url, "_blank");
      setShowPackModal(false);
      onPurchase?.();
    } catch (error) {
      setBuyError(error instanceof Error ? error.message : "Erro ao processar compra.");
    } finally {
      setBuyingPack(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Saldo de Créditos
          </h3>
          <Badge variant="primary">{plan.charAt(0).toUpperCase() + plan.slice(1)}</Badge>
        </div>

        {/* Total credits display */}
        <div className="flex items-baseline gap-2 mb-5">
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>
            {total.toLocaleString("pt-BR")}
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            créditos disponíveis
          </span>
        </div>

        {/* Usage bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Uso do ciclo
            </label>
            <span style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontWeight: 500 }}>
              {usedCredits.toLocaleString("pt-BR")} / {planAllocation.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="w-full rounded-full" style={{ height: 8, backgroundColor: "var(--border)" }}>
            <div
              className="rounded-full transition-all"
              style={{
                height: 8,
                width: `${usedPct}%`,
                backgroundColor: usedPct >= 90 ? "var(--sentiment-negative)" : usedPct >= 70 ? "var(--secondary)" : "var(--primary)",
              }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Plano
              </span>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {planCredits.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-3.5 h-3.5" style={{ color: "var(--accent, var(--secondary))" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Pacotes
              </span>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {packCredits.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Info line */}
        <p className="mb-4" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          1 crédito = 1 comentário analisado. Demographics: {demographicCost} créditos/perfil.
        </p>

        {/* Buy button */}
        {packs.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<ShoppingCart className="w-3.5 h-3.5" />}
            onClick={() => setShowPackModal(true)}
            fullWidth
          >
            Comprar créditos
          </Button>
        )}
      </div>

      {/* Buy Packs Modal */}
      <Dialog open={showPackModal} onOpenChange={setShowPackModal}>
        <DialogContent
          className="sm:max-w-md"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
              Comprar Créditos
            </DialogTitle>
            <DialogDescription style={{ color: "var(--text-muted)" }}>
              Pacotes avulsos somam ao saldo do seu plano e não expiram no ciclo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-4 rounded-xl transition-colors"
                style={{ backgroundColor: "var(--bg-subtle)" }}
              >
                <div>
                  <p style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {pack.credits.toLocaleString("pt-BR")} créditos
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    R$ {(pack.price_brl / pack.credits * 100).toFixed(1)} centavos/crédito
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={buyingPack !== null}
                  onClick={() => handleBuyPack(pack.id)}
                >
                  {buyingPack === pack.id ? "Abrindo..." : `R$ ${pack.price_brl}`}
                </Button>
              </div>
            ))}
          </div>
          {buyError && (
            <p className="mt-2" style={{ fontSize: "0.78rem", color: "var(--sentiment-negative)" }}>{buyError}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* Compact sidebar credit indicator */
export function CreditIndicator({
  total,
  planAllocation,
  planCredits,
}: {
  total: number;
  planAllocation: number;
  planCredits: number;
}) {
  // Planos admin/enterprise têm alocação sentinela (999.999) — nunca alarmar.
  const isUnlimited = planAllocation >= 900_000;
  const usedCredits = planAllocation - planCredits;
  const usedPct = planAllocation > 0 ? Math.min(Math.max((usedCredits / planAllocation) * 100, 0), 100) : 0;
  const isLow = !isUnlimited && (total <= 0 || usedPct >= 90);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer"
      style={{ backgroundColor: isLow ? "var(--sentiment-negative-bg)" : "var(--bg-subtle)" }}
    >
      <Coins className="w-4 h-4 shrink-0" style={{ color: isLow ? "var(--sentiment-negative)" : "var(--primary)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: isLow ? "var(--sentiment-negative)" : "var(--text-primary)" }}>
            {isUnlimited ? "Sem limite" : total.toLocaleString("pt-BR")}
          </span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{isUnlimited ? "" : "créd."}</span>
        </div>
        <div className="w-full rounded-full mt-0.5" style={{ height: 3, backgroundColor: "var(--border)" }}>
          <div
            className="rounded-full transition-all"
            style={{
              height: 3,
              width: `${usedPct}%`,
              backgroundColor: isLow ? "var(--sentiment-negative)" : "var(--primary)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* Credit depleted banner */
export function CreditDepletedBanner({ plan }: { plan: string }) {
  const isFree = plan === "free";

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        backgroundColor: "var(--sentiment-negative-bg)",
        border: "1px solid var(--sentiment-negative)",
      }}
    >
      <Coins className="w-5 h-5 shrink-0" style={{ color: "var(--sentiment-negative)" }} />
      <div className="flex-1">
        <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--sentiment-negative)" }}>
          {isFree
            ? "Seus créditos acabaram. Faça upgrade para continuar analisando."
            : "Seus créditos acabaram. Compre um pacote extra para continuar."}
        </p>
      </div>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          window.location.href = isFree
            ? "/dashboard/settings?tab=billing"
            : "/dashboard/settings?tab=billing";
        }}
      >
        {isFree ? "Fazer upgrade" : "Comprar créditos"}
      </Button>
    </div>
  );
}
