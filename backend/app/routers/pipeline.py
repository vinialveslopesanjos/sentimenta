import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.schemas.pipeline import PipelineRunResponse, PipelineStatusResponse

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.get("/runs", response_model=list[PipelineRunResponse])
def list_pipeline_runs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = (
        db.query(PipelineRun)
        .filter(PipelineRun.user_id == current_user.id)
        .order_by(PipelineRun.started_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for run in runs:
        conn = None
        if run.connection_id:
            conn = db.query(SocialConnection).filter(
                SocialConnection.id == run.connection_id
            ).first()

        result.append(PipelineRunResponse(
            id=run.id,
            connection_id=run.connection_id,
            platform=conn.platform if conn else None,
            connection_username=conn.username if conn else None,
            run_type=run.run_type,
            status=run.status,
            posts_fetched=run.posts_fetched,
            comments_fetched=run.comments_fetched,
            comments_analyzed=run.comments_analyzed,
            llm_calls=run.llm_calls,
            errors_count=run.errors_count,
            total_cost_usd=run.total_cost_usd,
            started_at=run.started_at,
            ended_at=run.ended_at,
            notes=run.notes,
        ))

    return result


@router.get("/runs/{run_id}", response_model=PipelineRunResponse)
def get_pipeline_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(PipelineRun).filter(
        PipelineRun.id == run_id,
        PipelineRun.user_id == current_user.id,
    ).first()

    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    conn = None
    if run.connection_id:
        conn = db.query(SocialConnection).filter(
            SocialConnection.id == run.connection_id
        ).first()

    return PipelineRunResponse(
        id=run.id,
        connection_id=run.connection_id,
        platform=conn.platform if conn else None,
        connection_username=conn.username if conn else None,
        run_type=run.run_type,
        status=run.status,
        posts_fetched=run.posts_fetched,
        comments_fetched=run.comments_fetched,
        comments_analyzed=run.comments_analyzed,
        llm_calls=run.llm_calls,
        errors_count=run.errors_count,
        total_cost_usd=run.total_cost_usd,
        started_at=run.started_at,
        ended_at=run.ended_at,
        notes=run.notes,
    )


@router.get("/runs/{run_id}/status", response_model=PipelineStatusResponse)
def get_pipeline_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(PipelineRun).filter(
        PipelineRun.id == run_id,
        PipelineRun.user_id == current_user.id,
    ).first()

    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    return PipelineStatusResponse(
        status=run.status,
        posts_fetched=run.posts_fetched,
        comments_fetched=run.comments_fetched,
        comments_analyzed=run.comments_analyzed,
        errors_count=run.errors_count,
    )


@router.get("/runs/{run_id}/stream")
async def stream_run_progress(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE endpoint to stream pipeline run progress."""

    async def event_generator():
        while True:
            run = (
                db.query(PipelineRun)
                .filter(
                    PipelineRun.id == run_id,
                    PipelineRun.user_id == current_user.id,
                )
                .first()
            )
            if not run:
                yield {"event": "error", "data": json.dumps({"message": "Run not found"})}
                break

            progress_data = {
                "status": run.status,
                "posts_fetched": run.posts_fetched or 0,
                "comments_fetched": run.comments_fetched or 0,
                "comments_analyzed": run.comments_analyzed or 0,
                "errors_count": run.errors_count or 0,
            }

            # Parse notes for detailed progress
            if run.notes:
                try:
                    notes = json.loads(run.notes)
                    progress_data.update(notes)
                except (json.JSONDecodeError, TypeError):
                    progress_data["notes"] = run.notes

            yield {"event": "progress", "data": json.dumps(progress_data)}

            if run.status in ("completed", "failed", "partial"):
                yield {"event": "complete", "data": json.dumps(progress_data)}
                break

            # Expire the cached object so next query gets fresh data
            db.expire(run)
            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())
