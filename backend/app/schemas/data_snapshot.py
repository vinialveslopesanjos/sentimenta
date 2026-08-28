import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


SnapshotHealthState = Literal[
    "healthy",
    "degraded",
    "stale",
    "failed",
    "never_synced",
]


class DataSnapshotResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    trigger_run_id: uuid.UUID | None
    schema_version: int
    period_start: datetime | None
    period_end: datetime | None
    last_attempt_at: datetime | None
    last_success_at: datetime | None
    source_platforms: list[str]
    profiles: list[dict[str, Any]]
    found_count: int | None
    eligible_count: int | None
    collected_count: int | None
    saved_count: int | None
    analyzed_count: int | None
    valid_count: int | None
    ignored_count: int | None
    coverage: dict[str, Any]
    health: SnapshotHealthState
    reason_code: str
    metrics: dict[str, Any]
    content_hash: str = Field(min_length=64, max_length=64)
    created_at: datetime
    language_policy: dict[str, Any]

    model_config = {"from_attributes": True}


class SnapshotReference(BaseModel):
    id: uuid.UUID
    schema_version: int
    source_platforms: list[str]
    profiles: list[dict[str, Any]]
    period_start: datetime | None
    period_end: datetime | None
    last_attempt_at: datetime | None
    last_success_at: datetime | None
    found_count: int | None
    eligible_count: int | None
    collected_count: int | None
    saved_count: int | None
    analyzed_count: int | None
    valid_count: int | None
    ignored_count: int | None
    coverage: dict[str, Any]
    health: SnapshotHealthState
    reason_code: str
    metrics: dict[str, Any]
    content_hash: str
    created_at: datetime
    language_policy: dict[str, Any]

    model_config = {"from_attributes": True}
