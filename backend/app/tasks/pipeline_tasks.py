"""
Celery tasks for the ingestion and analysis pipeline.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async function from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True)
def task_ingest(self, connection_id: str, user_id: str) -> dict:
    """Ingest data from a social media platform.

    Determines the platform from the SocialConnection record and
    delegates to the appropriate service.
    """
    db = SessionLocal()
    try:
        conn_uuid = uuid.UUID(connection_id)
        user_uuid = uuid.UUID(user_id)

        connection = db.get(SocialConnection, conn_uuid)
        if not connection:
            return {"error": f"Connection {connection_id} not found"}

        # Create pipeline run
        run = PipelineRun(
            user_id=user_uuid,
            connection_id=conn_uuid,
            run_type="ingest",
            status="running",
        )
        db.add(run)
        db.commit()

        try:
            if connection.platform == "youtube":
                from app.services.youtube_service import ingest_youtube_channel

                result = _run_async(
                    ingest_youtube_channel(db, conn_uuid, max_comments=500)
                )

            elif connection.platform == "instagram":
                # Instagram uses public scraping (no OAuth)
                from app.services.instagram_ingest_service import ingest_instagram_profile

                result = ingest_instagram_profile(
                    db, connection, max_posts=10, max_comments_per_post=100
                )

                connection.last_sync_at = datetime.now(timezone.utc)
                db.commit()
            else:
                result = {"error": f"Unsupported platform: {connection.platform}"}

            # Update run
            run.posts_fetched = result.get("posts_fetched", 0)
            run.comments_fetched = result.get("comments_fetched", 0)
            run.status = "completed"
            run.ended_at = datetime.now(timezone.utc)
            db.commit()

            return result

        except Exception as e:
            logger.exception("Ingestion failed for connection %s", connection_id)
            run.status = "failed"
            run.errors_count += 1
            run.notes = str(e)[:500]
            run.ended_at = datetime.now(timezone.utc)
            db.commit()
            return {"error": str(e)}

    finally:
        db.close()


@celery_app.task(bind=True)
def task_analyze(self, post_id: str, user_id: str) -> dict:
    """Analyze all pending comments for a single post."""
    db = SessionLocal()
    try:
        from app.services.analysis_service import (
            analyze_post_comments,
            generate_post_summary,
        )

        post_uuid = uuid.UUID(post_id)

        stats = analyze_post_comments(
            db, post_uuid, batch_size=30, prompt_version="v1"
        )
        generate_post_summary(db, post_uuid)

        return stats

    except Exception as e:
        logger.exception("Analysis failed for post %s", post_id)
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True)
def task_full_pipeline(self, connection_id: str, user_id: str) -> dict:
    """Run the full pipeline: ingest + analyze for all posts."""
    db = SessionLocal()
    try:
        conn_uuid = uuid.UUID(connection_id)
        user_uuid = uuid.UUID(user_id)

        # Create run
        run = PipelineRun(
            user_id=user_uuid,
            connection_id=conn_uuid,
            run_type="full",
            status="running",
        )
        db.add(run)
        db.commit()

        # Step 1: Ingest
        ingest_result = task_ingest(connection_id, user_id)
        if "error" in ingest_result:
            run.status = "failed"
            run.notes = ingest_result["error"]
            run.ended_at = datetime.now(timezone.utc)
            db.commit()
            return ingest_result

        run.posts_fetched = ingest_result.get("posts_fetched", 0)
        run.comments_fetched = ingest_result.get("comments_fetched", 0)

        # Step 2: Analyze each post
        posts = (
            db.query(Post)
            .filter(Post.connection_id == conn_uuid)
            .all()
        )

        total_analyzed = 0
        total_llm_calls = 0
        total_errors = 0
        total_cost = 0.0

        from app.services.analysis_service import (
            analyze_post_comments,
            generate_post_summary,
        )

        total_posts = len(posts)
        for idx, post in enumerate(posts, 1):
            # Update progress in notes
            progress_info = {
                "step": "analyzing",
                "current": idx,
                "total": total_posts,
                "current_post": (post.content_text[:80] if post.content_text else post.platform_post_id),
            }
            run.notes = json.dumps(progress_info)
            db.commit()

            stats = analyze_post_comments(db, post.id)
            total_analyzed += stats.get("analyzed", 0)
            total_llm_calls += stats.get("llm_calls", 0)
            total_errors += stats.get("errors", 0)

            generate_post_summary(db, post.id)

        # Update run
        run.comments_analyzed = total_analyzed
        run.llm_calls = total_llm_calls
        run.errors_count = total_errors
        run.total_cost_usd = total_cost
        run.status = "completed" if total_errors == 0 else "partial"
        run.ended_at = datetime.now(timezone.utc)
        run.notes = json.dumps({"step": "done", "current": total_posts, "total": total_posts})
        db.commit()

        # Invalidate dashboard cache for this user
        try:
            from app.core.cache import invalidate_pattern
            invalidate_pattern("dashboard_summary")
            invalidate_pattern("dashboard_trends")
        except Exception:
            pass

        return {
            "posts_fetched": run.posts_fetched,
            "comments_fetched": run.comments_fetched,
            "comments_analyzed": total_analyzed,
            "llm_calls": total_llm_calls,
            "errors": total_errors,
        }

    except Exception as e:
        logger.exception("Full pipeline failed for connection %s", connection_id)
        return {"error": str(e)}
    finally:
        db.close()
