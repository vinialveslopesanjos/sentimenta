"""
Celery tasks for the ingestion and analysis pipeline.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection

from app.models.follower_snapshot import FollowerSnapshot

logger = logging.getLogger(__name__)

DEMOGRAPHICS_MAX_PROFILES_PER_RUN = 1000


def _mark_stale_running_runs(db, max_age_hours: int = 6) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    stale_runs = (
        db.query(PipelineRun)
        .filter(
            PipelineRun.status == "running",
            PipelineRun.started_at < cutoff,
        )
        .all()
    )
    for run in stale_runs:
        run.status = "failed"
        run.ended_at = datetime.now(timezone.utc)
        _append_step(db, run, "Execucao reconciliada automaticamente apos ficar presa em running")
    if stale_runs:
        db.commit()
        logger.warning("Reconciled %d stale pipeline runs", len(stale_runs))
    return len(stale_runs)


def _append_step(db, run, message: str):
    """Append a step message to run.notes JSON for terminal-style progress."""
    try:
        notes = json.loads(run.notes) if run.notes else {}
    except (json.JSONDecodeError, TypeError):
        notes = {"old_notes": run.notes} if run.notes else {}
    if "steps" not in notes:
        notes["steps"] = []
    notes["steps"].append({"msg": message, "ts": datetime.now(timezone.utc).isoformat()})
    notes["current_step"] = message
    run.notes = json.dumps(notes, ensure_ascii=False)
    try:
        db.commit()
    except Exception as exc:
        logger.error("_append_step commit failed (msg=%s): %s", message, exc)
        db.rollback()


def _run_async(coro):
    """Run an async function from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _do_ingest(db, connection, max_posts: int = 10, max_comments_per_post: int = 100, since_date: str | None = None, is_incremental: bool = False, mode: str = "full", progress_callback=None, step_callback=None, use_apify_comments: bool = False, comment_sample_mode: str = "all") -> dict:
    """Core ingest logic without creating a PipelineRun. Used by both task_ingest and task_full_pipeline."""
    if connection.platform == "youtube":
        from app.services.youtube_service import ingest_youtube_channel
        return _run_async(ingest_youtube_channel(
            db, connection.id,
            max_posts=max_posts,
            max_comments_per_post=max_comments_per_post,
            mode=mode,
            progress_callback=progress_callback,
            step_callback=step_callback,
        ))
    elif connection.platform == "instagram":
        from datetime import date as date_type
        since = date_type.fromisoformat(since_date) if since_date else None

        # OAuth connections use official Graph API — no XPoz/Apify needed
        if connection.has_oauth_token:
            from app.services.instagram_ingest_service import ingest_instagram_via_graph_api
            logger.info("Using Graph API for @%s (OAuth token present)", connection.username)
            return ingest_instagram_via_graph_api(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since, is_incremental=is_incremental, mode=mode, progress_callback=progress_callback, step_callback=step_callback)
        else:
            from app.services.instagram_ingest_service import ingest_instagram_profile
            logger.info("Using Apify for @%s (no OAuth token)", connection.username)
            return ingest_instagram_profile(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since, is_incremental=is_incremental, mode=mode, progress_callback=progress_callback, step_callback=step_callback, use_apify_comments=use_apify_comments, comment_sample_mode=comment_sample_mode)
    elif connection.platform == "twitter":
        logger.info("Twitter disabled for sync — skipping @%s", connection.username)
        return {"posts_fetched": 0, "comments_fetched": 0, "skipped": "twitter_disabled"}
    elif connection.platform == "tiktok":
        from app.services.tiktok_ingest_service import ingest_tiktok_profile
        return ingest_tiktok_profile(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, mode=mode, progress_callback=progress_callback, step_callback=step_callback)
    else:
        return {"error": f"Unsupported platform: {connection.platform}"}


@celery_app.task(bind=True)
def task_analyze_connection(self, connection_id: str, user_id: str, run_id: str | None = None) -> dict:
    """Analyze-only: run sentiment analysis on existing pending comments (no ingestion)."""
    db = SessionLocal()
    try:
        from app.models.comment import Comment
        from sqlalchemy import func as sa_func

        conn_uuid = uuid.UUID(connection_id)
        user_uuid = uuid.UUID(user_id)

        connection = db.get(SocialConnection, conn_uuid)
        if not connection:
            return {"error": f"Connection {connection_id} not found"}

        run = db.get(PipelineRun, uuid.UUID(run_id)) if run_id else None
        if not run:
            run = PipelineRun(
                user_id=user_uuid,
                connection_id=conn_uuid,
                run_type="analyze",
                status="running",
            )
            db.add(run)
        run.celery_task_id = self.request.id
        run.status = "running"
        db.commit()

        def step_cb(msg):
            _append_step(db, run, msg)

        # Count pending comments
        pending_count = (
            db.query(sa_func.count(Comment.id))
            .join(Post, Post.id == Comment.post_id)
            .filter(Post.connection_id == conn_uuid, Comment.status.in_(["pending", "error"]))
            .scalar()
        )

        # Reset error comments to pending for re-analysis
        reset_count = (
            db.query(Comment)
            .filter(
                Comment.connection_id == conn_uuid,
                Comment.status == "error",
            )
            .update({"status": "pending", "last_error": None}, synchronize_session=False)
        )
        if reset_count > 0:
            db.commit()
            step_cb(f"{reset_count} comentários com erro resetados para re-análise")

        step_cb(f"Iniciando análise de {pending_count} comentários pendentes...")

        posts = db.query(Post).filter(Post.connection_id == conn_uuid).all()
        run.posts_fetched = len(posts)
        total_comments = (
            db.query(sa_func.count(Comment.id))
            .filter(Comment.connection_id == conn_uuid)
            .scalar()
        )
        run.comments_fetched = total_comments
        run.target_posts = len(posts)
        run.target_comments = pending_count
        db.commit()

        from app.services.analysis_service import analyze_post_comments, generate_post_summary

        total_analyzed = 0
        total_llm_calls = 0
        total_errors = 0

        for idx, post in enumerate(posts, 1):
            stats = analyze_post_comments(db, post.id)
            analyzed = stats.get("analyzed", 0)
            total_analyzed += analyzed
            total_llm_calls += stats.get("llm_calls", 0)
            total_errors += stats.get("errors", 0)

            if analyzed > 0:
                generate_post_summary(db, post.id)

            run.comments_analyzed = total_analyzed
            step_cb(f"Post {idx}/{len(posts)}: {analyzed} comentários analisados")

        # Sync comment counts
        post_counts = (
            db.query(Post.id, sa_func.count(Comment.id))
            .join(Comment, Comment.post_id == Post.id)
            .filter(Post.connection_id == conn_uuid)
            .group_by(Post.id)
            .all()
        )
        for post_id, count in post_counts:
            db.query(Post).filter(Post.id == post_id).update({"comment_count": count})
        db.commit()

        run.comments_analyzed = total_analyzed
        run.llm_calls = total_llm_calls
        run.errors_count = total_errors
        run.status = "completed" if total_errors == 0 else "partial"
        run.ended_at = datetime.now(timezone.utc)
        if total_errors == 0:
            step_cb(f"Análise concluída: {total_analyzed} comentários processados")
        else:
            step_cb(f"Análise concluída com {total_errors} erro{'s' if total_errors > 1 else ''}: {total_analyzed} comentários processados")

        # Invalidate cache
        try:
            from app.core.cache import invalidate_pattern
            invalidate_pattern("dashboard_summary")
            invalidate_pattern("dashboard_trends")
        except Exception:
            pass

        return {
            "posts_fetched": len(posts),
            "comments_fetched": total_comments,
            "comments_analyzed": total_analyzed,
            "llm_calls": total_llm_calls,
            "errors": total_errors,
        }

    except Exception as e:
        logger.exception("Analyze-only failed for connection %s", connection_id)
        try:
            run.status = "failed"
            run.ended_at = datetime.now(timezone.utc)
            _append_step(db, run, f"Erro: {str(e)[:200]}")
        except Exception:
            pass
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True)
def task_full_pipeline(self, connection_id: str, user_id: str, max_posts: int = 10, max_comments_per_post: int = 100, since_date: str | None = None, use_apify_comments: bool = False, comment_sample_mode: str = "all", run_id: str | None = None) -> dict:
    """Run the full pipeline: ingest + analyze for all posts."""
    db = SessionLocal()
    try:
        conn_uuid = uuid.UUID(connection_id)
        user_uuid = uuid.UUID(user_id)

        # Reuse run created by router, or create a new one (for callers like daily_sync, oauth callbacks)
        if run_id:
            run = db.get(PipelineRun, uuid.UUID(run_id))
            if not run:
                logger.error("PipelineRun %s not found, creating new one", run_id)
                run = None
        else:
            run = None

        if run is None:
            run = PipelineRun(
                user_id=user_uuid,
                connection_id=conn_uuid,
                run_type="full",
                status="running",
            )
            run.target_posts = max_posts
            db.add(run)

        run.celery_task_id = self.request.id
        run.status = "running"
        db.commit()

        connection = db.get(SocialConnection, conn_uuid)
        if not connection:
            run.status = "failed"
            run.notes = f"Connection {connection_id} not found"
            run.ended_at = datetime.now(timezone.utc)
            db.commit()
            return {"error": run.notes}

        # Step 1: Ingest (uses shared logic, no separate PipelineRun)
        def update_progress(posts_done, comments_done):
            run.posts_fetched = posts_done
            run.comments_fetched = comments_done
            if posts_done == 1 or posts_done % 5 == 0:
                _append_step(db, run, f"Extraído {posts_done} post{'s' if posts_done > 1 else ''} · {comments_done} comentários")
            else:
                try:
                    db.commit()
                except Exception as exc:
                    logger.error("update_progress commit failed: %s", exc)
                    try:
                        db.rollback()
                    except Exception:
                        pass

        def step_cb(msg):
            _append_step(db, run, msg)

        _append_step(db, run, "Iniciando extração de dados...")
        ingest_result = _do_ingest(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since_date, mode="full", progress_callback=update_progress, step_callback=step_cb, use_apify_comments=use_apify_comments, comment_sample_mode=comment_sample_mode)
        if "error" in ingest_result:
            run.status = "failed"
            _append_step(db, run, f"Erro: {ingest_result['error']}")
            run.ended_at = datetime.now(timezone.utc)
            db.commit()
            return ingest_result

        run.posts_fetched = ingest_result.get("posts_fetched", 0)
        run.comments_fetched = ingest_result.get("comments_fetched", 0)
        run.target_comments = run.comments_fetched
        _append_step(db, run, f"Extração concluída: {run.posts_fetched} posts, {run.comments_fetched} comentários")

        # Log usage per platform (Fase 4)
        try:
            from app.services.plan_service import log_usage
            log_usage(
                db,
                user_id=user_uuid,
                connection_id=conn_uuid,
                platform=connection.platform or "instagram",
                operation="ingest",
                posts_count=run.posts_fetched,
                comments_count=run.comments_fetched,
            )
        except Exception as usage_exc:
            logger.warning("Failed to log usage for full_pipeline: %s", usage_exc)

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
        logger.info(f"Starting analysis for {total_posts} posts on connection {connection_id}")
        _append_step(db, run, "Iniciando análise de sentimento...")

        for idx, post in enumerate(posts, 1):
            logger.info(f"Analyzing post {idx}/{total_posts}: {post.platform_post_id}")

            stats = analyze_post_comments(db, post.id)
            analyzed_count = stats.get("analyzed", 0)
            total_analyzed += analyzed_count
            total_llm_calls += stats.get("llm_calls", 0)
            total_errors += stats.get("errors", 0)
            total_cost += stats.get("cost_usd", 0.0)

            if analyzed_count > 0:
                generate_post_summary(db, post.id)

            # Inform SSE continuously
            run.comments_analyzed = total_analyzed
            _append_step(db, run, f"Analisado post {idx}/{total_posts}: {analyzed_count} comentários processados")
            logger.info(f"Post {idx}/{total_posts} done. Total analyzed: {total_analyzed}")

        db.commit()

        # Stage 3: Demographics (disabled by default)
        try:
            from app.services.demographics_service import run_demographics_pipeline
            demo_result = run_demographics_pipeline(
                db, conn_uuid, enabled=True,
                platform=connection.platform or "instagram",
                max_usernames=DEMOGRAPHICS_MAX_PROFILES_PER_RUN,
            )
            if not demo_result.get("skipped"):
                profiles_enriched = demo_result.get("profiles_enriched", demo_result.get("enrichments_saved", 0))
                _append_step(db, run, f"Demographics: {profiles_enriched} perfis enriquecidos")
                # Consume credits for demographics (5 credits per profile — ADR-011)
                if profiles_enriched > 0:
                    try:
                        from app.services.credit_service import consume, DEMOGRAPHIC_CREDIT_COST
                        consume(
                            db, user_uuid, profiles_enriched * DEMOGRAPHIC_CREDIT_COST,
                            type="consume_demographic",
                            source="full_pipeline",
                            description=f"Demographics @{connection.username}: {profiles_enriched} perfis × {DEMOGRAPHIC_CREDIT_COST} créd",
                            metadata={"pipeline_run_id": str(run.id), "profiles": profiles_enriched},
                        )
                        db.commit()
                    except Exception as credit_exc:
                        logger.warning("Failed to consume credits for demographics: %s", credit_exc)
        except Exception as e:
            logger.warning("Demographics pipeline error for %s: %s", connection_id, e)

        # Consume credits for actually analyzed comments (ADR-011)
        try:
            from app.services.credit_service import consume, InsufficientCreditsError
            if total_analyzed > 0:
                consume(
                    db, user_uuid, total_analyzed,
                    type="consume_comment",
                    source="full_pipeline",
                    description=f"Sync @{connection.username}: {total_analyzed} comentários analisados",
                    metadata={"pipeline_run_id": str(run.id), "platform": connection.platform},
                )
                db.commit()
        except InsufficientCreditsError:
            logger.warning("Insufficient credits for user %s after analysis", user_uuid)
        except Exception as credit_exc:
            logger.warning("Failed to consume credits for full_pipeline: %s", credit_exc)

        # Update run
        run.comments_analyzed = total_analyzed
        run.llm_calls = total_llm_calls
        run.errors_count = total_errors
        run.total_cost_usd = total_cost
        run.status = "completed" if total_errors == 0 else "partial"
        run.ended_at = datetime.now(timezone.utc)
        if total_errors == 0:
            _append_step(db, run, "Pipeline concluído sem erros")
        else:
            _append_step(db, run, f"Pipeline concluído com {total_errors} erro{'s' if total_errors > 1 else ''} de análise")

        # Invalidate dashboard cache for this user
        try:
            from app.core.cache import invalidate_pattern
            invalidate_pattern("dashboard_summary")
            invalidate_pattern("dashboard_trends")
        except Exception:
            pass

        # Auto-generate health report only when there is analyzed data to summarize.
        if total_analyzed > 0:
            try:
                from app.routers.dashboard import _build_health_report
                _append_step(db, run, "Gerando diagnóstico de IA...")
                report = _build_health_report(db, user_uuid)
                if report and report.get("report_text"):
                    # Cache the report in Redis so dashboard loads it immediately
                    try:
                        from app.core.cache import redis_client
                        import json as _json
                        cache_key = f"health_report:{user_uuid}"
                        count_key = f"health_report_count:{user_uuid}"
                        from app.routers.dashboard import _count_analyzed, HEALTH_REPORT_TTL
                        redis_client.setex(cache_key, HEALTH_REPORT_TTL, _json.dumps(report))
                        redis_client.setex(count_key, HEALTH_REPORT_TTL, str(_count_analyzed(db, user_uuid)))
                    except Exception as cache_err:
                        logger.warning("Failed to cache health report: %s", cache_err)
                    _append_step(db, run, "Diagnóstico de IA gerado")
            except Exception as report_err:
                logger.warning("Auto health report generation failed: %s", report_err)
        else:
            _append_step(db, run, "Diagnóstico de IA não gerado: nenhum comentário foi analisado")

        return {
            "posts_fetched": run.posts_fetched,
            "comments_fetched": run.comments_fetched,
            "comments_analyzed": total_analyzed,
            "llm_calls": total_llm_calls,
            "errors": total_errors,
        }

    except Exception as e:
        logger.exception("Full pipeline failed for connection %s", connection_id)
        try:
            run.status = "failed"
            run.ended_at = datetime.now(timezone.utc)
            _append_step(db, run, f"Erro: {str(e)[:200]}")
        except Exception:
            pass
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True)
def task_daily_sync(self, frequency_filter: str = None) -> dict:
    """Scheduled ETL: ingest new posts + comments, enrich via Apify, analyze, for all active connections.
    frequency_filter: 'weekly' or 'daily' — filters connections by plan sync_frequency."""
    db = SessionLocal()
    try:
        from datetime import timedelta
        from app.models.user import User
        from app.services.plan_service import get_plan_limits, count_syncs_this_month
        _mark_stale_running_runs(db)
        connections = (
            db.query(SocialConnection)
            .filter(SocialConnection.status == "active")
            .all()
        )

        # Prioritize by cost: youtube (free API) > twitter (cheap) > tiktok > instagram (most expensive)
        PLATFORM_PRIORITY = {"youtube": 0, "twitter": 1, "tiktok": 2, "instagram": 3}
        connections.sort(key=lambda c: PLATFORM_PRIORITY.get(c.platform, 99))

        results = {}
        for conn in connections:
            run = None
            try:
                # Skip connections with auto_sync disabled
                if not conn.auto_sync:
                    logger.info("Skipping @%s — auto_sync disabled", conn.username)
                    results[conn.username] = {"skipped": "auto_sync_disabled"}
                    continue

                # Check if user reached monthly sync limit
                user = db.get(User, conn.user_id)
                if user:
                    limits = get_plan_limits(user.plan)
                    syncs_used = count_syncs_this_month(db, user.id)
                    if syncs_used >= limits["syncs_per_month"]:
                        logger.info("Skipping user %s (@%s) — reached monthly sync limit (%d/%d)",
                                    user.id, conn.username, syncs_used, limits["syncs_per_month"])
                        results[conn.username] = {"skipped": "monthly_limit_reached"}
                        continue

                # Skip plans with no recurring sync (e.g. free)
                plan_frequency = limits.get("sync_frequency", "weekly")
                if plan_frequency == "none":
                    logger.info("Skipping @%s — plan '%s' has no recurring sync",
                                conn.username, user.plan if user else "unknown")
                    results[conn.username] = {"skipped": "no_recurring_sync"}
                    continue

                # Filter by plan sync_frequency if frequency_filter is set
                if frequency_filter and user:
                    if plan_frequency != frequency_filter:
                        logger.info("Skipping @%s — plan frequency '%s' != filter '%s'",
                                    conn.username, plan_frequency, frequency_filter)
                        results[conn.username] = {"skipped": "frequency_mismatch"}
                        continue

                logger.info("Daily sync starting for @%s [platform=%s, priority=%d]",
                            conn.username, conn.platform, PLATFORM_PRIORITY.get(conn.platform, 99))

                # Check for concurrent running pipeline
                active_run = db.query(PipelineRun).filter(
                    PipelineRun.connection_id == conn.id,
                    PipelineRun.status == "running",
                    PipelineRun.started_at >= datetime.now(timezone.utc) - timedelta(hours=6),
                ).first()
                if active_run:
                    logger.info("Skipping %s — pipeline already running (run %s)", conn.id, active_run.id)
                    results[conn.username] = {"skipped": "already_running"}
                    continue

                # Create a PipelineRun for auditability
                run = PipelineRun(
                    user_id=conn.user_id,
                    connection_id=conn.id,
                    run_type="daily_sync",
                    status="running",
                )
                run.celery_task_id = self.request.id
                db.add(run)
                db.commit()

                def step_cb(msg, _run=run):
                    _append_step(db, _run, msg)

                def progress_cb(posts_done, comments_done, _run=run):
                    _run.posts_fetched = posts_done
                    _run.comments_fetched = comments_done
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()

                # Use plan limits for max_posts
                plan_limits = get_plan_limits(user.plan) if user else get_plan_limits("free")
                max_posts = 5  # Daily sync: only check last 5 posts for new comments
                max_comments = plan_limits["max_comments_per_post"]

                # Use last_sync_at to only fetch new posts since last sync
                if conn.last_sync_at:
                    since_date = conn.last_sync_at.date().isoformat()
                else:
                    # First sync: fetch last 7 days
                    since_date = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

                _append_step(db, run, f"Sync semanal iniciado para @{conn.username}")
                ingest_result = _do_ingest(
                    db, conn,
                    max_posts=max_posts,
                    max_comments_per_post=max_comments,
                    since_date=since_date,
                    is_incremental=True,
                    mode="daily",
                    progress_callback=progress_cb,
                    step_callback=step_cb,
                )

                if "error" in ingest_result:
                    run.status = "failed"
                    _append_step(db, run, f"Erro: {ingest_result['error']}")
                    run.ended_at = datetime.now(timezone.utc)
                    db.commit()
                    results[conn.username] = {"error": ingest_result["error"]}
                    continue

                run.posts_fetched = ingest_result.get("posts_fetched", 0) + ingest_result.get("posts_updated", 0)
                run.comments_fetched = ingest_result.get("comments_fetched", 0) + ingest_result.get("comments_updated", 0)

                # Log usage per platform (Fase 4)
                try:
                    from app.services.plan_service import log_usage
                    log_usage(
                        db,
                        user_id=conn.user_id,
                        connection_id=conn.id,
                        platform=conn.platform or "instagram",
                        operation="daily_sync",
                        posts_count=run.posts_fetched,
                        comments_count=run.comments_fetched,
                    )
                except Exception as usage_exc:
                    logger.warning("Failed to log usage for daily_sync @%s: %s", conn.username, usage_exc)

                # Analyze only posts with pending comments
                from app.services.analysis_service import analyze_post_comments, generate_post_summary
                from app.models.comment import Comment
                posts_with_pending = (
                    db.query(Post)
                    .join(Comment, Comment.post_id == Post.id)
                    .filter(
                        Post.connection_id == conn.id,
                        Comment.status == "pending",
                    )
                    .distinct()
                    .all()
                )
                total_analyzed = 0
                total_llm_calls = 0
                total_errors = 0
                total_cost = 0.0
                if posts_with_pending:
                    _append_step(db, run, f"Analisando {len(posts_with_pending)} posts com comentários pendentes")
                for idx, post in enumerate(posts_with_pending, 1):
                    stats = analyze_post_comments(db, post.id)
                    analyzed = stats.get("analyzed", 0)
                    total_analyzed += analyzed
                    total_llm_calls += stats.get("llm_calls", 0)
                    total_errors += stats.get("errors", 0)
                    total_cost += stats.get("cost_usd", 0.0)
                    if analyzed > 0:
                        generate_post_summary(db, post.id)
                        _append_step(db, run, f"Analisado post {idx}/{len(posts_with_pending)}: {analyzed} novos comentários")

                # Consume credits for actually analyzed comments (ADR-011)
                try:
                    from app.services.credit_service import consume, InsufficientCreditsError
                    if total_analyzed > 0:
                        consume(
                            db, conn.user_id, total_analyzed,
                            type="consume_comment",
                            source="daily_sync",
                            description=f"Daily sync @{conn.username}: {total_analyzed} comentários analisados",
                            metadata={"pipeline_run_id": str(run.id), "platform": conn.platform},
                        )
                        db.commit()
                except InsufficientCreditsError:
                    logger.warning("Insufficient credits for user %s during daily_sync @%s", conn.user_id, conn.username)
                except Exception as credit_exc:
                    logger.warning("Failed to consume credits for daily_sync @%s: %s", conn.username, credit_exc)

                # Stage 3: Demographics (only if enough new usernames)
                try:
                    from app.services.demographics_service import extract_new_usernames, run_demographics_pipeline
                    if not plan_limits.get("demographics", False):
                        _append_step(db, run, "Demographics: não disponível no plano atual")
                    else:
                        new_count = len(extract_new_usernames(db, conn.id, platform=conn.platform or "instagram"))
                        if new_count >= 10:
                            demo_result = run_demographics_pipeline(
                                db, conn.id, enabled=True,
                                platform=conn.platform or "instagram",
                                max_usernames=DEMOGRAPHICS_MAX_PROFILES_PER_RUN,
                            )
                            if demo_result.get("skipped"):
                                _append_step(db, run, "Demographics: desativado")
                            else:
                                profiles_enriched = demo_result.get("profiles_enriched", demo_result.get("enrichments_saved", 0))
                                _append_step(db, run, f"Demographics: {profiles_enriched} perfis enriquecidos")
                                # Consume credits for demographics (5 credits per profile — ADR-011)
                                if profiles_enriched > 0:
                                    try:
                                        from app.services.credit_service import consume, DEMOGRAPHIC_CREDIT_COST
                                        consume(
                                            db, conn.user_id, profiles_enriched * DEMOGRAPHIC_CREDIT_COST,
                                            type="consume_demographic",
                                            source="daily_sync",
                                            description=f"Demographics @{conn.username}: {profiles_enriched} perfis × {DEMOGRAPHIC_CREDIT_COST} créd",
                                            metadata={"pipeline_run_id": str(run.id), "profiles": profiles_enriched},
                                        )
                                        db.commit()
                                    except Exception as credit_exc:
                                        logger.warning("Failed to consume credits for demographics: %s", credit_exc)
                        elif new_count > 0:
                            _append_step(db, run, f"Demographics: {new_count} novos perfis (abaixo do mínimo de 10, adiado)")
                        else:
                            _append_step(db, run, "Demographics: nenhum perfil novo")
                except Exception as e:
                    logger.warning("Demographics pipeline error: %s", e)

                db.commit()

                run.comments_analyzed = total_analyzed
                run.llm_calls = total_llm_calls
                run.errors_count = total_errors
                run.total_cost_usd = total_cost
                run.status = "partial" if total_errors > 0 else "completed"
                run.ended_at = datetime.now(timezone.utc)
                _append_step(db, run, f"Sync concluído: {run.posts_fetched} posts, {total_analyzed} analisados, {total_llm_calls} LLM calls, custo ${total_cost:.4f}")

                # Invalidate cache
                try:
                    from app.core.cache import invalidate_pattern
                    invalidate_pattern("dashboard_summary")
                    invalidate_pattern("dashboard_trends")
                except Exception:
                    pass

                # Send email notification after successful sync
                try:
                    from app.services.email_service import send_analysis_ready_email
                    if user and user.email:
                        send_analysis_ready_email(
                            email=user.email,
                            name=user.name,
                            username=conn.username,
                            platform=conn.platform,
                        )
                except Exception as email_exc:
                    logger.warning("Failed to send sync email for @%s: %s", conn.username, email_exc)

                results[conn.username] = {
                    "posts": run.posts_fetched,
                    "comments": run.comments_fetched,
                    "analyzed": total_analyzed,
                }
                logger.info("Weekly sync done for @%s: %s", conn.username, results[conn.username])

            except Exception as exc:
                logger.error("Weekly sync failed for @%s: %s", conn.username, exc)
                if run is not None:
                    try:
                        run.status = "failed"
                        run.ended_at = datetime.now(timezone.utc)
                        _append_step(db, run, f"Erro: {str(exc)[:200]}")
                    except Exception:
                        db.rollback()
                results[conn.username] = {"error": str(exc)}

        return results
    finally:
        db.close()


@celery_app.task(bind=True)
def task_refresh_social_tokens(self) -> dict:
    """Refresh OAuth tokens for social connections expiring within 7 days."""
    db = SessionLocal()
    try:
        from datetime import timedelta
        from app.core.security import encrypt_token, decrypt_token

        threshold = datetime.now(timezone.utc) + timedelta(days=7)
        connections = (
            db.query(SocialConnection)
            .filter(
                SocialConnection.status == "active",
                SocialConnection.access_token_enc.isnot(None),
                SocialConnection.token_expires_at < threshold,
            )
            .all()
        )

        refreshed = 0
        errors = 0
        for conn in connections:
            try:
                if conn.platform == "instagram":
                    from app.services.instagram_service import refresh_long_lived_token

                    current_token = decrypt_token(conn.access_token_enc)
                    result = _run_async(refresh_long_lived_token(current_token))
                    conn.access_token_enc = encrypt_token(result["access_token"])
                    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=result.get("expires_in", 5184000)
                    )
                    refreshed += 1

                elif conn.platform == "tiktok" and conn.refresh_token_enc:
                    from app.services.tiktok_service import refresh_access_token

                    current_refresh = decrypt_token(conn.refresh_token_enc)
                    result = _run_async(refresh_access_token(current_refresh))
                    conn.access_token_enc = encrypt_token(result["access_token"])
                    if result.get("refresh_token"):
                        conn.refresh_token_enc = encrypt_token(result["refresh_token"])
                    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=result.get("expires_in", 86400)
                    )
                    refreshed += 1

                db.commit()
                logger.info("Refreshed token for %s @%s", conn.platform, conn.username)

            except Exception as exc:
                logger.error("Token refresh failed for %s @%s: %s", conn.platform, conn.username, exc)
                conn.status = "token_expired"
                db.commit()
                errors += 1

        logger.info("Token refresh done: %d refreshed, %d errors", refreshed, errors)
        return {"refreshed": refreshed, "errors": errors}
    finally:
        db.close()


def _create_follower_snapshot(db, connection) -> None:
    """Create a follower snapshot for a connection."""
    snapshot = FollowerSnapshot(
        connection_id=connection.id,
        followers_count=connection.followers_count or 0,
        following_count=connection.following_count or 0,
        media_count=connection.media_count or 0,
    )
    db.add(snapshot)
    db.commit()
    logger.info(
        "Follower snapshot created for @%s: %d followers",
        connection.username, snapshot.followers_count,
    )


@celery_app.task(bind=True)
def task_daily_follower_snapshots(self) -> dict:
    """Daily task: create follower snapshots for all active connections."""
    db = SessionLocal()
    try:
        connections = (
            db.query(SocialConnection)
            .filter(SocialConnection.status == "active")
            .all()
        )
        created = 0
        errors = 0
        for idx, conn in enumerate(connections):
            try:
                # Refresh profile info first (with 30s timeout)
                if conn.platform == "instagram":
                    from app.services.instagram_connection_service import discover_profile_info

                    def _fetch_profile(username):
                        return discover_profile_info(username)

                    try:
                        with ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(_fetch_profile, conn.username)
                            prof = future.result(timeout=30)
                        if prof:
                            conn.followers_count = prof.get("followers", 0)
                            conn.following_count = prof.get("following", 0)
                            conn.media_count = prof.get("post_count", 0)
                            db.commit()
                    except FuturesTimeoutError:
                        logger.warning("Timeout (30s) fetching profile for @%s — skipping refresh", conn.username)
                    except Exception as prof_exc:
                        logger.warning("Profile refresh failed for @%s: %s — using cached values", conn.username, prof_exc)

                elif conn.platform == "twitter":
                    from app.services.twitter_service import get_twitter_profile

                    try:
                        with ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(get_twitter_profile, conn.username)
                            prof = future.result(timeout=60)
                        if prof:
                            conn.followers_count = prof.get("followers_count", 0)
                            conn.following_count = prof.get("following_count", 0)
                            conn.media_count = prof.get("tweets_count", 0)
                            db.commit()
                    except FuturesTimeoutError:
                        logger.warning("Timeout (60s) fetching Twitter profile for @%s — skipping refresh", conn.username)
                    except Exception as prof_exc:
                        logger.warning("Twitter profile refresh failed for @%s: %s — using cached values", conn.username, prof_exc)

                elif conn.platform == "youtube":
                    from app.services.youtube_service import discover_channel_info

                    try:
                        channel_input = conn.platform_user_id or conn.username
                        with ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(discover_channel_info, channel_input)
                            info = future.result(timeout=30)
                        if info:
                            subscriber_count = info.get("subscriber_count", 0)
                            if subscriber_count:
                                conn.followers_count = subscriber_count
                                db.commit()
                                logger.info("YouTube @%s subscriber count updated: %d", conn.username, subscriber_count)
                    except FuturesTimeoutError:
                        logger.warning("Timeout (30s) fetching YouTube channel info for @%s — skipping refresh", conn.username)
                    except Exception as prof_exc:
                        logger.warning("YouTube channel info refresh failed for @%s: %s — using cached values", conn.username, prof_exc)

                elif conn.platform == "tiktok":
                    # TikTok: use OAuth token if available, otherwise skip (Apify scraping is too expensive for daily snapshots)
                    if conn.access_token_enc:
                        from app.services.tiktok_service import fetch_user_profile
                        from app.core.security import decrypt_token

                        try:
                            access_token = decrypt_token(conn.access_token_enc)

                            def _fetch_tiktok_profile(token):
                                return _run_async(fetch_user_profile(token))

                            with ThreadPoolExecutor(max_workers=1) as executor:
                                future = executor.submit(_fetch_tiktok_profile, access_token)
                                user_data = future.result(timeout=30)
                            if user_data:
                                conn.followers_count = user_data.get("follower_count", 0)
                                conn.following_count = user_data.get("following_count", 0)
                                conn.media_count = user_data.get("video_count", 0)
                                db.commit()
                                logger.info("TikTok @%s follower count updated: %d", conn.username, conn.followers_count)
                        except FuturesTimeoutError:
                            logger.warning("Timeout (30s) fetching TikTok profile for @%s — skipping refresh", conn.username)
                        except Exception as prof_exc:
                            logger.warning("TikTok profile refresh failed for @%s: %s — using cached values", conn.username, prof_exc)
                    else:
                        logger.info("TikTok @%s has no OAuth token — skipping follower refresh (using cached values)", conn.username)

                _create_follower_snapshot(db, conn)
                created += 1
            except Exception as exc:
                logger.error("Snapshot failed for connection %s: %s", conn.id, exc)
                errors += 1

            # Rate limit: wait between connections (skip after last)
            if idx < len(connections) - 1:
                time.sleep(3)

        logger.info("Daily snapshots done: %d created, %d errors", created, errors)
        return {"created": created, "errors": errors}
    finally:
        db.close()
