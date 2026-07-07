"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Coins, FileText, MessageSquare, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PreflightEstimate } from "@/lib/types";

export interface PreflightConfirmOptions {
  includeDemographics: boolean;
}

interface Props {
  open: boolean;
  mode: "sync" | "analyze";
  targetLabel: string; // "@usuario" ou "4 perfis"
  estimate: PreflightEstimate | null;
  loading: boolean;
  confirming: boolean;
  onConfirm: (options: PreflightConfirmOptions) => void;
  onClose: () => void;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function PreflightModal({ open, mode, targetLabel, estimate, loading, confirming, onConfirm, onClose }: Props) {
  const t = useTranslations("preflight");
  const [mounted, setMounted] = useState(false);
  const [includeDemographics, setIncludeDemographics] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setIncludeDemographics(false);
  }, [open]);

  if (!mounted || !open) return null;

  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const nothingToDo = !loading && estimate !== null && estimate.estimated_credits === 0 && mode === "analyze";
  const blocked = !loading && estimate !== null && estimate.available_credits <= 0;

  return createPortal(
    <div className="fixed inset-0 z-[99999] grid place-items-center p-4" style={{ backgroundColor: "rgba(10, 20, 22, 0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl p-6 sm:p-7"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px -24px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {mode === "analyze" ? t("titleAnalyze") : t("titleSync")}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }} aria-label={t("cancel")}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{targetLabel}</p>

        {loading || !estimate ? (
          <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{t("loading")}</div>
        ) : (
          <>
            <div className="mb-4">
              {mode === "sync" && (
                <Row icon={<FileText className="w-4 h-4" />} label={t("posts")} value={`~${fmt(estimate.estimated_posts)}`} />
              )}
              <Row
                icon={<MessageSquare className="w-4 h-4" />}
                label={mode === "analyze" ? t("pendingComments") : t("comments")}
                value={`~${fmt(estimate.estimated_comments)}`}
              />
              {mode === "sync" && (estimate.pending_backlog ?? 0) > 0 && (
                <Row
                  icon={<MessageSquare className="w-4 h-4" />}
                  label={t("backlog")}
                  value={`+${fmt(estimate.pending_backlog ?? 0)}`}
                />
              )}
              <Row
                icon={<Coins className="w-4 h-4" />}
                label={t("credits")}
                value={t("creditsValue", { est: fmt(estimate.estimated_credits), avail: fmt(estimate.available_credits) })}
              />
              <Row
                icon={<Clock className="w-4 h-4" />}
                label={t("eta")}
                value={t("etaValue", { min: estimate.estimated_minutes_min, max: estimate.estimated_minutes_max })}
              />
            </div>

            {mode === "sync" && estimate.last_sync_at && (
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                {t("incrementalNote", { date: new Date(estimate.last_sync_at).toLocaleDateString("pt-BR") })}
              </p>
            )}

            {mode === "sync" && estimate.demographics_available && (
              <label className="flex items-start gap-2.5 rounded-xl p-3 mb-4 cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <input
                  type="checkbox"
                  checked={includeDemographics}
                  onChange={(e) => setIncludeDemographics(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                  <span style={{ fontWeight: 600 }}>{t("demographicsTitle")}</span>
                  <br />
                  <span style={{ color: "var(--text-muted)" }}>{t("demographicsDesc", { cost: estimate.demographics_cost_per_profile ?? 5 })}</span>
                </span>
              </label>
            )}

            {nothingToDo && (
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{t("nothingPending")}</p>
            )}

            {!estimate.fits && !blocked && !nothingToDo && (
              <div className="flex items-start gap-2 rounded-xl p-3 mb-4 text-xs" style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "var(--text-primary)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f59e0b" }} />
                <span>{t("partialWarning", { missing: fmt(estimate.missing_credits) })}</span>
              </div>
            )}

            {blocked && (
              <div className="flex items-start gap-2 rounded-xl p-3 mb-4 text-xs" style={{ backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)", color: "var(--text-primary)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                <span>{t("noCredits")}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {blocked ? (
                <Link
                  href="/dashboard/settings"
                  className="flex-1 py-3 rounded-xl text-center text-sm font-semibold"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {t("getCredits")}
                </Link>
              ) : (
                <button
                  onClick={() => onConfirm({ includeDemographics })}
                  disabled={confirming || nothingToDo}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {confirming ? t("starting") : t("confirm")}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-3 rounded-xl text-sm font-medium"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)" }}
              >
                {t("cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
