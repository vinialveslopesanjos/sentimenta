export const PLATFORM_CAPABILITY_IDS = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
] as const;

export type PlatformCapabilityId = typeof PLATFORM_CAPABILITY_IDS[number];
export type PlatformCapabilityStatus = "available" | "beta" | "unavailable" | "planned";
export type PlatformFeatureSupport = "supported" | "beta" | "unavailable";
export type PlatformHistorySupport = "start_date" | "recent_only" | "unavailable";
export type PlatformFrequencySupport = "plan_schedule" | "unavailable";

export interface PlatformCapability {
  id: PlatformCapabilityId;
  status: PlatformCapabilityStatus;
  connectable: boolean;
  posts: PlatformFeatureSupport;
  comments: PlatformFeatureSupport;
  history: PlatformHistorySupport;
  frequency: PlatformFrequencySupport;
}

export const PLATFORM_CAPABILITIES: Record<PlatformCapabilityId, PlatformCapability> = {
  instagram: {
    id: "instagram",
    status: "available",
    connectable: true,
    posts: "supported",
    comments: "supported",
    history: "start_date",
    frequency: "plan_schedule",
  },
  youtube: {
    id: "youtube",
    status: "available",
    connectable: true,
    posts: "supported",
    comments: "supported",
    history: "recent_only",
    frequency: "plan_schedule",
  },
  tiktok: {
    id: "tiktok",
    status: "beta",
    connectable: true,
    posts: "beta",
    comments: "beta",
    history: "recent_only",
    frequency: "plan_schedule",
  },
  twitter: {
    id: "twitter",
    status: "planned",
    connectable: false,
    posts: "unavailable",
    comments: "unavailable",
    history: "unavailable",
    frequency: "unavailable",
  },
};

export function getPlatformCapability(platform: string): PlatformCapability | null {
  const normalized = platform.toLowerCase() === "x" ? "twitter" : platform.toLowerCase();
  return PLATFORM_CAPABILITIES[normalized as PlatformCapabilityId] ?? null;
}
