export interface SyncSettings {
  max_posts: number;
  max_comments_per_post: number;
  since_date: string;
  use_apify_comments: boolean;
  comment_sample_mode: "all" | "sample";
}

const STORAGE_KEY = "sentimenta.sync.settings.v3";

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  max_posts: 10,
  max_comments_per_post: 200,
  since_date: "",
  use_apify_comments: true,
  comment_sample_mode: "sample",
};

function normalize(settings: Partial<SyncSettings>): SyncSettings {
  const maxPosts = Number(settings.max_posts);
  const maxComments = Number(settings.max_comments_per_post);
  const sinceDate = typeof settings.since_date === "string" ? settings.since_date : "";

  return {
    max_posts: Number.isFinite(maxPosts) ? Math.min(Math.max(maxPosts, 1), 200) : DEFAULT_SYNC_SETTINGS.max_posts,
    max_comments_per_post: Number.isFinite(maxComments)
      ? Math.min(Math.max(maxComments, 10), 10000)
      : DEFAULT_SYNC_SETTINGS.max_comments_per_post,
    since_date: sinceDate,
    use_apify_comments: settings.use_apify_comments !== false,
    comment_sample_mode: settings.comment_sample_mode === "all" ? "all" : "sample",
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
  use_apify_comments: boolean;
  comment_sample_mode: string;
} {
  return {
    max_posts: settings.max_posts,
    max_comments_per_post: settings.max_comments_per_post,
    since_date: settings.since_date || undefined,
    use_apify_comments: settings.use_apify_comments,
    comment_sample_mode: settings.comment_sample_mode,
  };
}
