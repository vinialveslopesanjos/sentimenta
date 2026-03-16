"""
Celery tasks for the ingestion and analysis pipeline.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection

from app.models.follower_snapshot import FollowerSnapshot

logger = logging.getLogger(__name__)


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


def _do_ingest(db, connection, max_posts: int = 10, max_comments_per_post: int = 100, since_date: str | None = None, is_incremental: bool = False, progress_callback=None, step_callback=None, use_apify_comments: bool = False, comment_sample_mode: str = "all") -> dict:
    """Core ingest logic without creating a PipelineRun. Used by both task_ingest and task_full_pipeline."""
    if connection.platform == "youtube":
        from app.services.youtube_service import ingest_youtube_channel
        return _run_async(ingest_youtube_channel(db, connection.id, max_comments=max_comments_per_post))
    elif connection.platform == "instagram":
        from datetime import date as date_type
        since = date_type.fromisoformat(since_date) if since_date else None

        # OAuth connections use official Graph API — no XPoz/Apify needed
        if connection.has_oauth_token:
            from app.services.instagram_ingest_service import ingest_instagram_via_graph_api
            logger.info("Using Graph API for @%s (OAuth token present)", connection.username)
            return ingest_instagram_via_graph_api(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since, is_incremental=is_incremental, progress_callback=progress_callback, step_callback=step_callback)
        else:
            from app.services.instagram_ingest_service import ingest_instagram_profile
            logger.info("Using XPoz/Apify for @%s (no OAuth token)", connection.username)
            return ingest_instagram_profile(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since, is_incremental=is_incremental, progress_callback=progress_callback, step_callback=step_callback, use_apify_comments=use_apify_comments, comment_sample_mode=comment_sample_mode)
    elif connection.platform == "twitter":
        from app.services.twitter_service import ingest_twitter_profile
        return ingest_twitter_profile(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post)
    else:
        return {"error": f"Unsupported platform: {connection.platform}"}


@celery_app.task(bind=True)
def task_ingest(self, connection_id: str, user_id: str, max_posts: int = 10, max_comments_per_post: int = 100, since_date: str | None = None, use_apify_comments: bool = False, comment_sample_mode: str = "all") -> dict:
    """Ingest data from a social media platform (standalone task with its own PipelineRun)."""
    db = SessionLocal()
    try:
        conn_uuid = uuid.UUID(connection_id)
        user_uuid = uuid.UUID(user_id)

        connection = db.get(SocialConnection, conn_uuid)
        if not connection:
            return {"error": f"Connection {connection_id} not found"}

        run = PipelineRun(
            user_id=user_uuid,
            connection_id=conn_uuid,
            run_type="ingest",
            status="running",
        )
        run.celery_task_id = self.request.id
        run.target_posts = max_posts
        db.add(run)
        db.commit()

        def update_progress(posts_done, comments_done):
            run.posts_fetched = posts_done
            run.comments_fetched = comments_done
            try:
                db.commit()
            except Exception as exc:
                logger.error("update_progress commit failed: %s", exc)
                try:
                    db.rollback()
                except Exception:
                    pass

        try:
            result = _do_ingest(db, connection, max_posts, max_comments_per_post, since_date, progress_callback=update_progress, use_apify_comments=use_apify_comments, comment_sample_mode=comment_sample_mode)

            if "error" in result:
                run.status = "failed"
                run.notes = result["error"]
            else:
                run.posts_fetched = result.get("posts_fetched", 0)
                run.comments_fetched = result.get("comments_fetched", 0)
                run.target_comments = run.comments_fetched
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
def task_analyze_connection(self, connection_id: str, user_id: str) -> dict:
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

        # Create pipeline run for tracking
        run = PipelineRun(
            user_id=user_uuid,
            connection_id=conn_uuid,
            run_type="analyze",
            status="running",
        )
        run.celery_task_id = self.request.id
        db.add(run)
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
        step_cb(f"Análise concluída: {total_analyzed} comentários processados")

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
def task_full_pipeline(self, connection_id: str, user_id: str, max_posts: int = 10, max_comments_per_post: int = 100, since_date: str | None = None, use_apify_comments: bool = False, comment_sample_mode: str = "all") -> dict:
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
        run.celery_task_id = self.request.id
        run.target_posts = max_posts
        db.add(run)
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
        ingest_result = _do_ingest(db, connection, max_posts=max_posts, max_comments_per_post=max_comments_per_post, since_date=since_date, progress_callback=update_progress, step_callback=step_cb, use_apify_comments=use_apify_comments, comment_sample_mode=comment_sample_mode)
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

            generate_post_summary(db, post.id)

            # Inform SSE continuously
            run.comments_analyzed = total_analyzed
            _append_step(db, run, f"Analisado post {idx}/{total_posts}: {analyzed_count} comentários processados")
            logger.info(f"Post {idx}/{total_posts} done. Total analyzed: {total_analyzed}")

        # Sync comment counts from actual DB data
        from app.models.comment import Comment
        from sqlalchemy import func
        post_counts = (
            db.query(Post.id, func.count(Comment.id))
            .join(Comment, Comment.post_id == Post.id)
            .filter(Post.connection_id == conn_uuid)
            .group_by(Post.id)
            .all()
        )
        for post_id, count in post_counts:
            db.query(Post).filter(Post.id == post_id).update({"comment_count": count})
        db.commit()
        _append_step(db, run, f"Contagem de comentários atualizada para {len(post_counts)} posts")

        # Update run
        run.comments_analyzed = total_analyzed
        run.llm_calls = total_llm_calls
        run.errors_count = total_errors
        run.total_cost_usd = total_cost
        run.status = "completed" if total_errors == 0 else "partial"
        run.ended_at = datetime.now(timezone.utc)
        _append_step(db, run, "Pipeline concluído ✓")

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
def task_daily_sync(self) -> dict:
    """Weekly ETL: ingest new posts + comments, enrich via Apify, analyze, for all active connections."""
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

                logger.info("Weekly sync starting for @%s (%s)", conn.username, conn.platform)

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
                max_posts = plan_limits["max_posts_per_sync"]
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

                # Analyze new pending comments
                from app.services.analysis_service import analyze_post_comments, generate_post_summary
                posts = db.query(Post).filter(Post.connection_id == conn.id).all()
                total_analyzed = 0
                for idx, post in enumerate(posts, 1):
                    stats = analyze_post_comments(db, post.id)
                    analyzed = stats.get("analyzed", 0)
                    total_analyzed += analyzed
                    if analyzed > 0:
                        generate_post_summary(db, post.id)
                        _append_step(db, run, f"Analisado post {idx}/{len(posts)}: {analyzed} novos comentários")

                # Sync comment counts
                from app.models.comment import Comment
                from sqlalchemy import func
                post_counts = (
                    db.query(Post.id, func.count(Comment.id))
                    .join(Comment, Comment.post_id == Post.id)
                    .filter(Post.connection_id == conn.id)
                    .group_by(Post.id)
                    .all()
                )
                for post_id, count in post_counts:
                    db.query(Post).filter(Post.id == post_id).update({"comment_count": count})
                db.commit()

                run.comments_analyzed = total_analyzed
                run.status = "completed"
                run.ended_at = datetime.now(timezone.utc)
                _append_step(db, run, f"Sync semanal concluído: {run.posts_fetched} posts, {total_analyzed} analisados")

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
        for conn in connections:
            try:
                # Refresh profile info first for Instagram
                if conn.platform == "instagram":
                    from app.services.instagram_scrape_service import discover_profile_info
                    prof = discover_profile_info(conn.username)
                    if prof:
                        conn.followers_count = prof.get("followers", 0)
                        conn.following_count = prof.get("following", 0)
                        conn.media_count = prof.get("post_count", 0)
                        db.commit()

                _create_follower_snapshot(db, conn)
                created += 1
            except Exception as exc:
                logger.error("Snapshot failed for connection %s: %s", conn.id, exc)
                errors += 1

        logger.info("Daily snapshots done: %d created, %d errors", created, errors)
        return {"created": created, "errors": errors}
    finally:
        db.close()
