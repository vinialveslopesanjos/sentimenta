"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ds/Button";
import { User, Target, X } from "lucide-react";

interface OnboardingModalProps {
  onComplete: () => void;
}

const PROFILE_TYPES = [
  { id: "criador", icon: "🎨" },
  { id: "marca", icon: "🏢" },
  { id: "agencia", icon: "📋" },
  { id: "pessoal", icon: "👤" },
] as const;

const GOALS = [
  { id: "monitorar_sentimento", icon: "📊" },
  { id: "benchmark", icon: "📈" },
  { id: "gestao_crise", icon: "🛡️" },
] as const;

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const [profileType, setProfileType] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    const token = getToken();
    if (!token || !profileType || !mainGoal) return;
    setSaving(true);
    try {
      await authApi.saveOnboarding(token, { profile_type: profileType, main_goal: mainGoal, description });
      onComplete();
    } catch (err) {
      console.error("Onboarding save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)" }}>
        <button onClick={onComplete} className="absolute top-4 right-4 p-1 rounded-lg transition-colors" style={{ color: "var(--text-faint)" }}>
          <X className="w-4 h-4" />
        </button>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[0, 1].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ backgroundColor: step >= i ? "var(--primary)" : "var(--border)" }} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5" style={{ color: "var(--primary)" }} />
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("profileTitle")}</h2>
            </div>
            <p className="mb-6" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("profileSubtitle")}</p>
            <div className="space-y-2">
              {PROFILE_TYPES.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => setProfileType(pt.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left"
                  style={{
                    backgroundColor: profileType === pt.id ? "var(--primary-bg)" : "var(--bg-subtle)",
                    border: profileType === pt.id ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{pt.icon}</span>
                  <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 600, color: profileType === pt.id ? "var(--primary)" : "var(--text-primary)" }}>{t(`profiles.${pt.id}`)}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t(`profilesDesc.${pt.id}`)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>
                {t("descriptionLabel")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-xl p-3 resize-none focus:outline-none transition-all"
                style={{
                  fontSize: "0.82rem",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  minHeight: 80,
                }}
                rows={3}
                maxLength={500}
              />
              <p style={{ fontSize: "0.62rem", color: "var(--text-faint)", marginTop: 4 }}>
                {t("descriptionHint")} ({description.length}/500)
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setStep(1)} disabled={!profileType || description.length < 20}>{t("next")}</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5" style={{ color: "var(--primary)" }} />
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("goalTitle")}</h2>
            </div>
            <p className="mb-6" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("goalSubtitle")}</p>
            <div className="space-y-2">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setMainGoal(g.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left"
                  style={{
                    backgroundColor: mainGoal === g.id ? "var(--primary-bg)" : "var(--bg-subtle)",
                    border: mainGoal === g.id ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{g.icon}</span>
                  <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 600, color: mainGoal === g.id ? "var(--primary)" : "var(--text-primary)" }}>{t(`goals.${g.id}`)}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t(`goalsDesc.${g.id}`)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>{t("back")}</Button>
              <Button variant="primary" onClick={handleFinish} disabled={!mainGoal || saving}>{saving ? t("saving") : t("finish")}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
