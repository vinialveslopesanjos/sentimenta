export interface SyncSettings {
  max_posts: number;
  max_comments_per_post: number;
  since_date: string;
}

const STORAGE_KEY = "sentimenta.sync.settings.v1";

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  max_posts: 10,
  max_comments_per_post: 100,
  since_date: "",
};

function normalize(settings: Partial<SyncSettings>): SyncSettings {
  const maxPosts = Number(settings.max_posts);
  const maxComments = Number(settings.max_comments_per_post);
  const sinceDate = typeof settings.since_date === "string" ? settings.since_date : "";

  return {
    max_posts: Number.isFinite(maxPosts) ? Math.min(Math.max(maxPosts, 1), 200) : DEFAULT_SYNC_SETTINGS.max_posts,
    max_comments_per_post: Number.isFinite(maxComments)
      ? Math.min(Math.max(maxComments, 10), 1000)
      : DEFAULT_SYNC_SETTINGS.max_comments_per_post,
    since_date: sinceDate,
  };
}

export function loadSyncSettings(): SyncSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SYNC_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYNC_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SyncSettings>;
    return normalize(parsed);
  } catch {
    return { ...DEFAULT_SYNC_SETTINGS };
  }
}

export function saveSyncSettings(settings: SyncSettings): SyncSettings {
  const normalized = normalize(settings);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function toSyncPayload(settings: SyncSettings): {
  max_posts: number;
  max_comments_per_post: number;
  since_date?: string;
} {
  return {
    max_posts: settings.max_posts,
    max_comments_per_post: settings.max_comments_per_post,
    since_date: settings.since_date || undefined,
  };
}
