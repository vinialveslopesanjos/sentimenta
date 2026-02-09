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
    posts_fetched: int
    comments_fetched: int
    comments_analyzed: int
    llm_calls: int
    errors_count: int
    total_cost_usd: float
    started_at: datetime
    ended_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class PipelineStatusResponse(BaseModel):
    status: str
    posts_fetched: int
    comments_fetched: int
    comments_analyzed: int
    errors_count: int
