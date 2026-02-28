// --- Pipeline ---

export interface PipelineRun {
  id: string;
  connection_id: string | null;
  platform: string | null;
  connection_username: string | null;
  run_type: string;
  status: string; // running | completed | failed | partial
  posts_fetched: number;
  comments_fetched: number;
  comments_analyzed: number;
  llm_calls: number;
  errors_count: number;
  total_cost_usd: number;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface PipelineStatus {
  status: string;
  posts_fetched: number;
  comments_fetched: number;
  comments_analyzed: number;
  errors_count: number;
}

// --- Dashboard ---

export interface SentimentDistribution {
  negative: number;
  neutral: number;
  positive: number;
}

export interface Connection {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  profile_image_url: string | null;
  followers_count: number;
  following_count?: number;
  media_count?: number;
  status: string;
  connected_at?: string;
  last_sync_at: string | null;
  persona?: string | null;
  ignore_author_comments?: boolean;
  total_posts?: number;
  total_analyzed?: number;
}

export interface DashboardSummary {
  total_connections: number;
  total_posts: number;
  total_comments: number;
  total_analyzed: number;
  avg_score: number | null;
  avg_polarity: number | null;
  sentiment_distribution: SentimentDistribution | null;
  recent_posts: PostSummary[];
  connections: Connection[];
}

export interface PostSummary {
  id: string;
  platform: string;
  platform_post_id: string;
  post_type: string | null;
  content_text: string | null;
  like_count: number;
  comment_count: number;
  view_count?: number;
  published_at: string | null;
  post_url: string | null;
  thumbnail_url?: string | null;
  summary?: {
    avg_score: number | null;
    sentiment_distribution: SentimentDistribution | null;
    total_analyzed: number;
  } | null;
}

export interface ConnectionDashboard {
  connection: Connection;
  total_posts: number;
  total_comments: number;
  total_analyzed: number;
  avg_score: number | null;
  avg_polarity: number | null;
  weighted_avg_score: number | null;
  sentiment_distribution: SentimentDistribution | null;
  emotions_distribution: Record<string, number> | null;
  topics_frequency: Record<string, number> | null;
  posts: PostSummary[];
  engagement_totals: {
    total_likes: number;
    total_comments: number;
    total_views: number;
  };
}

// --- Trends ---

export interface TrendDataPoint {
  period: string;
  positive: number;
  neutral: number;
  negative: number;
  total_comments: number;
  avg_score: number | null;
  total_likes: number;
}

export interface TrendResponse {
  data_points: TrendDataPoint[];
  granularity: string;
}

// --- Comments ---

export interface CommentAnalysisData {
  score_0_10: number | null;
  polarity: number | null;
  intensity: number | null;
  emotions: string[] | null;
  topics: string[] | null;
  sarcasm: boolean;
  summary_pt: string | null;
  confidence: number | null;
}

export interface CommentWithAnalysis {
  id: string;
  author_name: string | null;
  author_username: string | null;
  text_original: string;
  like_count: number;
  reply_count: number;
  published_at: string | null;
  platform: string;
  status: string;
  analysis: CommentAnalysisData | null;
}

export interface CommentListResponse {
  items: CommentWithAnalysis[];
  total: number;
  limit: number;
  offset: number;
}

// --- Trends Detailed ---

export interface TrendsDetailedPeriod {
  period: string;
  total_comments: number;
  positive: number;
  neutral: number;
  negative: number;
  emotions: Record<string, number>;
  topics: Record<string, number>;
}

export interface TrendsDetailedResponse {
  data_points: TrendsDetailedPeriod[];
  granularity: string;
}

// --- Health Report ---

export interface HealthReport {
  report_text: string;
  generated_at: string;
  data_summary: Record<string, unknown>;
}
