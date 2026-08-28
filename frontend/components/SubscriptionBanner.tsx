"use client";

import { Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ds/Button";

const TRIAL_DAYS = 14;

/**
 * Gate de assinatura no topo do dashboard.
 * - Sem assinatura (plan=free, nunca assinou): CTA para iniciar o trial de 14 dias.
 * - Em trial (subscription_status=trialing): dias restantes, estimados a partir
 *   de plan_changed_at (momento em que o webhook ativou o plano).
 */
export function SubscriptionBanner({
  plan,
  subscriptionStatus,
  planChangedAt,
}: {
  plan: string;
  subscriptionStatus: string | null;
  planChangedAt: string | null;
}) {
  if (subscriptionStatus === "trialing") {
    let daysLeft = TRIAL_DAYS;
    if (planChangedAt) {
      const elapsed = (Date.now() - new Date(planChangedAt).getTime()) / 86_400_000;
      daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
    }
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--primary-bg)", border: "1px solid var(--primary)" }}
      >
        <Clock className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
        <div className="flex-1">
          <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>
            Trial ativo — {daysLeft} dia{daysLeft === 1 ? "" : "s"} restante{daysLeft === 1 ? "" : "s"}.
            Sua assinatura começa automaticamente ao fim do período.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { window.location.href = "/dashboard/settings?tab=billing"; }}>
          Ver plano
        </Button>
      </div>
    );
  }

  if (plan === "free" && !subscriptionStatus) {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--primary-bg)", border: "1px solid var(--primary)" }}
      >
        <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
        <div className="flex-1">
          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Escolha seu plano — 14 dias grátis
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Para analisar comentários, inicie seu trial. Cancele quando quiser.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { window.location.href = "/dashboard/settings?tab=billing"; }}>
          Iniciar trial
        </Button>
      </div>
    );
  }

  return null;
}
