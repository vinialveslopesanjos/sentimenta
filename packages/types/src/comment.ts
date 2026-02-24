// ─── Comments & Analysis ──────────────────────────────────────────

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
