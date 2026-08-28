"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ds/Badge";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_IDS,
  type PlatformCapabilityId,
  type PlatformCapabilityStatus,
} from "@/lib/platformCapabilities";

const STATUS_VARIANTS: Record<PlatformCapabilityStatus, "positive" | "warning" | "negative" | "muted"> = {
  available: "positive",
  beta: "warning",
  unavailable: "negative",
  planned: "muted",
};

export function PlatformCapabilityBadge({ platform }: { platform: string }) {
  const t = useTranslations("platformCapabilities");
  const capability = PLATFORM_CAPABILITIES[platform.toLowerCase() as PlatformCapabilityId];
  if (!capability) return null;
  return (
    <Badge variant={STATUS_VARIANTS[capability.status]}>
      {t(`statuses.${capability.status}`)}
    </Badge>
  );
}

interface PlatformCapabilityPickerProps {
  selected: PlatformCapabilityId[];
  onToggle: (platform: PlatformCapabilityId) => void;
  surface: string;
}

export function PlatformCapabilityPicker({ selected, onToggle, surface }: PlatformCapabilityPickerProps) {
  const t = useTranslations("platformCapabilities");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid={`platform-capability-picker-${surface}`}>
      {PLATFORM_CAPABILITY_IDS.map(platform => {
        const capability = PLATFORM_CAPABILITIES[platform];
        const isSelected = selected.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            data-testid={`platform-capability-option-${surface}-${platform}`}
            data-platform={platform}
            data-status={capability.status}
            aria-pressed={isSelected}
            disabled={!capability.connectable}
            onClick={() => onToggle(platform)}
            className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed"
            style={{
              backgroundColor: isSelected ? "var(--primary-bg)" : "var(--bg-card)",
              border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
              opacity: capability.connectable ? 1 : 0.72,
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <GlassSocialIcon platform={platform} size={28} />
              <span className="truncate" style={{ fontSize: "0.78rem", fontWeight: 650, color: "var(--text-primary)" }}>
                {t(`platforms.${platform}.name`)}
              </span>
            </span>
            <Badge variant={STATUS_VARIANTS[capability.status]}>{t(`statuses.${capability.status}`)}</Badge>
          </button>
        );
      })}
    </div>
  );
}

interface PlatformCapabilityMatrixProps {
  surface: "home" | "dashboard" | "profiles" | "settings";
  embedded?: boolean;
}

export function PlatformCapabilityMatrix({ surface, embedded = false }: PlatformCapabilityMatrixProps) {
  const t = useTranslations("platformCapabilities");

  return (
    <section
      data-testid={`platform-capability-matrix-${surface}`}
      data-capability-contract="2026-08-26"
      className={embedded ? "" : "rounded-2xl p-4 md:p-5"}
      style={embedded ? undefined : { backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      aria-labelledby={`platform-capability-title-${surface}`}
    >
      <div className="mb-4">
        <h2 id={`platform-capability-title-${surface}`} style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
        <p className="mt-1" style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
          {t("subtitle")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table
          aria-labelledby={`platform-capability-title-${surface}`}
          className="w-full min-w-[900px] border-collapse"
        >
          <thead>
            <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
              {(["platform", "status", "posts", "comments", "history", "frequency"] as const).map(header => (
                <th key={header} scope="col" className="px-3 py-2.5 text-left" style={{ fontSize: "0.62rem", fontWeight: 750, letterSpacing: "0.05em", color: "var(--text-faint)", textTransform: "uppercase" }}>
                  {t(`headers.${header}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_CAPABILITY_IDS.map(platform => {
              const capability = PLATFORM_CAPABILITIES[platform];
              return (
                <tr
                  key={platform}
                  data-testid={`platform-capability-${surface}-${platform}`}
                  data-platform={platform}
                  data-status={capability.status}
                  data-posts={capability.posts}
                  data-comments={capability.comments}
                  data-history={capability.history}
                  data-frequency={capability.frequency}
                  style={{ borderBottom: platform === "twitter" ? undefined : "1px solid var(--border)" }}
                >
                  <th scope="row" className="px-3 py-3 text-left">
                    <span className="flex items-center gap-2.5">
                      <GlassSocialIcon platform={platform} size={30} />
                      <span>
                        <span className="block" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{t(`platforms.${platform}.name`)}</span>
                        <span className="block mt-0.5" style={{ fontSize: "0.64rem", fontWeight: 400, lineHeight: 1.35, color: "var(--text-muted)" }}>{t(`platforms.${platform}.note`)}</span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-3"><Badge variant={STATUS_VARIANTS[capability.status]}>{t(`statuses.${capability.status}`)}</Badge></td>
                  <td className="px-3 py-3" style={{ fontSize: "0.7rem", color: "var(--text-primary)" }}>{t(`support.${capability.posts}`)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "0.7rem", color: "var(--text-primary)" }}>{t(`support.${capability.comments}`)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "0.7rem", lineHeight: 1.4, color: "var(--text-primary)" }}>{t(`history.${capability.history}`)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "0.7rem", lineHeight: 1.4, color: "var(--text-primary)" }}>{t(`frequency.${capability.frequency}`)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3" style={{ fontSize: "0.64rem", lineHeight: 1.45, color: "var(--text-faint)" }}>{t("footnote")}</p>
    </section>
  );
}
