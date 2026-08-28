import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class YouTubeConnectRequest(BaseModel):
    channel_handle: str  # e.g. "@RaiamSantos"

class ConnectionUpdateRequest(BaseModel):
    persona: str | None = None
    ignore_author_comments: bool | None = None
    auto_sync: bool | None = None


class ConnectionHealthResponse(BaseModel):
    state: Literal["healthy", "degraded", "stale", "failed", "never_synced"]
    reason_code: str
    reason_codes: list[str]
    freshness_sla_hours: int
    last_attempt_at: datetime | None
    last_attempt_status: str | None
    last_attempt_saved_count: int | None
    last_attempt_valid_count: int | None
    last_success_at: datetime | None
    fresh_until: datetime | None
    data_age_hours: float | None
    is_syncing: bool
    sync_frequency: Literal["daily", "weekly", "none"]
    next_scheduled_at: datetime | None

class ConnectionResponse(BaseModel):
    id: uuid.UUID
    platform: str
    username: str
    display_name: str | None
    profile_url: str | None
    profile_image_url: str | None
    followers_count: int
    following_count: int
    media_count: int
    status: str
    connected_at: datetime
    last_sync_at: datetime | None
    persona: str | None
    ignore_author_comments: bool
    auto_sync: bool
    has_oauth_token: bool = False
    health: ConnectionHealthResponse | None = None

    model_config = {"from_attributes": True}


class OAuthURLResponse(BaseModel):
    auth_url: str


class CollectionPreviewResponse(BaseModel):
    model_version: str
    selection_mode: Literal["all", "engagement"]
    engagement_priority_max_per_post: int
    target_profiles: int
    selection_applies_to_profiles: int
    requested_posts_per_profile: int
    requested_comments_per_post: int
    request_comment_ceiling: int
    observed_posts: int
    requested_post_slots: int
    posts_with_known_counts: int
    found_status: Literal["complete", "partial", "unknown"]
    found_known_comments: int
    last_observed_at: datetime | None
    estimated_candidate_comments_known: int
    estimated_candidate_comments_max: int
    estimated_selected_comments_known: int
    estimated_selected_comments_max: int
    estimated_analyzed_comments_max: int
    estimated_coverage_pct: float | None
    available_credits: int
    operational_cost_brl_min: float
    operational_cost_brl_max: float
    duration_minutes_min: int
    duration_minutes_max: int
    forecast_confidence: Literal["low", "medium"]
    fixed_costs_included: bool
    explanation_codes: list[str]


class SyncResponse(BaseModel):
    connection_id: uuid.UUID
    task_id: str
    run_id: str | None = None
    message: str
