import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.data_snapshot import SnapshotReference


class PipelineRunSummaryStatement(BaseModel):
    code: str
    parameters: dict[str, int | float | str | bool | None]


class PipelineRunSummaryAction(BaseModel):
    code: str
    href: str | None
    priority: Literal["low", "medium", "high"]
    target: Literal["page", "technical_log", "none"]


class PipelineRunHumanSummary(BaseModel):
    contract_version: int
    effective_status: Literal["running", "success", "attention", "failed", "cancelled"]
    reason_code: str
    happened: PipelineRunSummaryStatement
    impact: PipelineRunSummaryStatement
    next_action: PipelineRunSummaryAction
    technical_log_available: bool


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
    snapshot: SnapshotReference | None = None
    human_summary: PipelineRunHumanSummary

    model_config = {"from_attributes": True}


class PipelineStatusResponse(BaseModel):
    status: str
    stage: str | None = None
    posts_fetched: int
    comments_fetched: int
    comments_analyzed: int
    errors_count: int
