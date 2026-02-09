import uuid
from datetime import datetime

from pydantic import BaseModel

# Import here to avoid circular import
from app.schemas.connection import ConnectionResponse  # noqa: E402


class PostResponse(BaseModel):
    id: uuid.UUID
    platform: str
    platform_post_id: str
    post_type: str | None
    content_text: str | None
    like_count: int
    comment_count: int
    share_count: int
    view_count: int
    published_at: datetime | None
    post_url: str | None
    fetched_at: datetime

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: uuid.UUID
    platform_comment_id: str
    source_type: str
    author_name: str | None
    author_username: str | None
    like_count: int
    published_at: datetime | None
    text_original: str
    status: str

    model_config = {"from_attributes": True}


class AnalysisResponse(BaseModel):
    comment_id: uuid.UUID
    score_0_10: float | None
    polarity: float | None
    intensity: float | None
    emotions: list | None
    topics: list | None
    sarcasm: bool
    summary_pt: str | None
    confidence: float | None

    model_config = {"from_attributes": True}


class PostDetailResponse(BaseModel):
    post: PostResponse
    comments: list[CommentResponse]
    analysis: list[AnalysisResponse]
    summary: dict | None


class DashboardSummary(BaseModel):
    total_connections: int
    total_posts: int
    total_comments: int
    total_analyzed: int
    avg_score: float | None
    avg_polarity: float | None
    sentiment_distribution: dict | None
    recent_posts: list[PostResponse]
    connections: list[ConnectionResponse]

    model_config = {"from_attributes": True}


# --- New schemas for expanded dashboard ---


class AnalysisInline(BaseModel):
    score_0_10: float | None
    polarity: float | None
    intensity: float | None
    emotions: list | None
    topics: list | None
    sarcasm: bool
    summary_pt: str | None
    confidence: float | None


class CommentWithAnalysis(BaseModel):
    id: uuid.UUID
    author_name: str | None
    author_username: str | None
    text_original: str
    like_count: int
    reply_count: int = 0
    published_at: datetime | None
    platform: str
    status: str
    analysis: AnalysisInline | None = None

    model_config = {"from_attributes": True}


class CommentListResponse(BaseModel):
    items: list[CommentWithAnalysis]
    total: int
    limit: int
    offset: int


class TrendDataPoint(BaseModel):
    period: str
    positive: int = 0
    neutral: int = 0
    negative: int = 0
    total_comments: int = 0
    avg_score: float | None = None
    total_likes: int = 0


class TrendResponse(BaseModel):
    data_points: list[TrendDataPoint]
    granularity: str


class PostWithSummary(BaseModel):
    id: uuid.UUID
    platform: str
    platform_post_id: str
    post_type: str | None
    content_text: str | None
    like_count: int
    comment_count: int
    view_count: int
    published_at: datetime | None
    post_url: str | None
    summary: dict | None = None

    model_config = {"from_attributes": True}


class ConnectionDashboard(BaseModel):
    connection: ConnectionResponse
    total_posts: int
    total_comments: int
    total_analyzed: int
    avg_score: float | None
    avg_polarity: float | None
    weighted_avg_score: float | None
    sentiment_distribution: dict | None
    emotions_distribution: dict | None
    topics_frequency: dict | None
    posts: list[PostWithSummary]
    engagement_totals: dict


class HealthReportResponse(BaseModel):
    report_text: str
    generated_at: datetime
    data_summary: dict
