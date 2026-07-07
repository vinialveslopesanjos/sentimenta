import uuid
from datetime import datetime

from pydantic import BaseModel


class PipelineRunResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID | None
    platform: str | None = None
    connection_username: str | None = None
    run_type: str
    status: str
    stage: str | None = None
    posts_fetched: int
    comments_fetched: int
    comments_analyzed: int
    llm_calls: int
    errors_count: int
    total_cost_usd: float
    apify_cost_usd: float = 0.0
    credits_consumed: int = 0
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    target_posts: int | None = None
    target_comments: int | None = None

    model_config = {"from_attributes": True}


class PipelineStatusResponse(BaseModel):
    status: str
    stage: str | None = None
    posts_fetched: int
    comments_fetched: int
    comments_analyzed: int
    errors_count: int
