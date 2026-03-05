"""
Instagram data ingestion service — incremental + parallel.

Smart sync: compares DB state vs XPoz catalog, only fetches what's missing.
Comments fetched in parallel (ThreadPoolExecutor, 3 workers).
Apify enrichment only for posts missing likes/views/thumbnails.
"""

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services.media_cache_service import cache_remote_image
from app.services.instagram_scrape_service import (
    fetch_post_comments,
    fetch_recent_posts,
    fetch_post_thumbnail,
)

logger = logging.getLogger(__name__)

PARALLEL_WORKERS = 3

# Instagram media_id <-> shortcode conversion
_ENCODING_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def _media_id_to_shortcode(media_id: str) -> str:
    """Convert Instagram numeric media_id to shortcode."""
    # Strip the _userid suffix if present
    numeric = media_id.split("_")[0]
    try:
        mid = int(numeric)
    except (ValueError, TypeError):
        return media_id
    shortcode = ""
    while mid > 0:
        shortcode = _ENCODING_CHARS[mid % 64] + shortcode
        mid //= 64
    return shortcode


def _calc_engagement_rate(likes: int, comments: int, shares: int, followers: int) -> float | None:
    if followers <= 0:
        return None
    return round((likes + comments + shares) / followers * 100, 4)


def _parse_timestamp(value: str | None, step_callback=None) -> datetime | None:
    if not value or str(value).strip().lower() in ("null", "none", ""):
        return None
    raw = str(value).strip()
    try:
        normalized = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(raw, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        pass
    try:
        ts = float(raw)
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except (ValueError, TypeError):
        pass
    try:
        import re
        match = re.match(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", raw.lower().strip())
        if match:
            from datetime import timedelta
            amount = int(match.group(1))
            unit = match.group(2)
            deltas = {"second": 1, "minute": 60, "hour": 3600, "day": 86400, "week": 604800, "month": 2592000, "year": 31536000}
            return datetime.now(timezone.utc) - timedelta(seconds=amount * deltas.get(unit, 0))
    except Exception:
        pass

    logger.warning("_parse_timestamp: could not parse '%s'", raw)
    return None


def ingest_instagram_profile(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 10,
    max_comments_per_post: int = 100,
    since_date: Optional[date] = None,
    progress_callback=None,
    step_callback=None,
) -> dict:
    """
    Incremental + parallel ingestion from Instagram.

    1. Fetch post catalog from XPoz (1 API call)
    2. Diff against DB — classify each post into SKIP / ENRICH_ONLY / NEEDS_COMMENTS
    3. Fetch missing comments in parallel (3 workers)
    4. Apify enrichment only for posts missing likes/views/thumbnails
    5. Sync comment counts from real DB data
    """
    username = connection.username
    followers = connection.followers_count or 0
    _step = step_callback or (lambda msg: None)

    stats = {
        "posts_fetched": 0,
        "posts_updated": 0,
        "comments_fetched": 0,
        "comments_updated": 0,
        "errors": [],
    }

    try:
        # ── Phase 1: Fetch post catalog from XPoz ──────────────────────
        _step("Buscando catálogo de posts via XPoz...")
        posts_data = fetch_recent_posts(username, max_posts=max_posts, since_date=since_date)
        _step(f"{len(posts_data)} posts no perfil")

        # ── Phase 2: Diff DB vs XPoz ──────────────────────────────────
        _step("Comparando com base de dados...")
        existing_posts = {
            p.platform_post_id: p
            for p in db.query(Post).filter(Post.connection_id == connection.id).all()
        }
        # Pre-load comment counts per post in one query
        comment_counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.connection_id == connection.id)
            .group_by(Comment.post_id)
            .all()
        )

        posts_need_comments = []   # (post_data, post_obj) — need XPoz comment fetch
        posts_need_enrichment = [] # shortcodes for Apify
        skipped = 0

        for post_data in posts_data:
            pid = post_data["platform_post_id"]
            existing = existing_posts.get(pid)

            if existing:
                # Update metadata that might be missing
                if not existing.content_text and post_data.get("caption"):
                    existing.content_text = post_data.get("caption") or ""
                    existing.content_clean = post_data.get("caption") or ""
                existing.post_type = post_data.get("post_type") or existing.post_type
                new_likes = post_data.get("like_count", 0) or 0
                new_comments = post_data.get("comment_count", 0) or 0
                new_views = post_data.get("view_count", 0) or 0
                if new_likes > 0:
                    existing.like_count = new_likes
                if new_comments > 0:
                    existing.comment_count = new_comments
                if new_views > 0:
                    existing.view_count = new_views
                if not existing.published_at:
                    existing.published_at = _parse_timestamp(post_data.get("timestamp"))
                existing.post_url = post_data.get("permalink") or existing.post_url
                existing.fetched_at = datetime.now(timezone.utc)
                stats["posts_updated"] += 1

                db_comment_count = comment_counts.get(existing.id, 0)

                if db_comment_count == 0:
                    posts_need_comments.append((post_data, existing))
                else:
                    skipped += 1

                # Always enrich via Apify on re-sync (updates likes, views, thumbnails, timestamps)
                posts_need_enrichment.append(pid)
            else:
                # New post — create it
                media_url = post_data.get("media_url")
                _likes = post_data.get("like_count", 0) or 0
                _comments = post_data.get("comment_count", 0) or 0
                _shares = post_data.get("share_count", 0) or 0
                post = Post(
                    connection_id=connection.id,
                    platform="instagram",
                    platform_post_id=pid,
                    post_type=post_data.get("post_type"),
                    content_text=post_data.get("caption") or "",
                    content_clean=post_data.get("caption") or "",
                    media_urls={"url": media_url, "thumbnail_url": media_url} if media_url else None,
                    like_count=_likes,
                    comment_count=_comments,
                    view_count=post_data.get("view_count", 0) or 0,
                    engagement_rate=_calc_engagement_rate(_likes, _comments, _shares, followers),
                    published_at=_parse_timestamp(post_data.get("timestamp")),
                    post_url=post_data.get("permalink"),
                    raw_payload=post_data,
                    fetched_at=datetime.now(timezone.utc),
                )
                db.add(post)
                db.flush()
                stats["posts_fetched"] += 1
                posts_need_comments.append((post_data, post))
                posts_need_enrichment.append(pid)

        db.commit()
        _step(f"Diff: {skipped} posts completos (skip), {len(posts_need_comments)} precisam comentários, {len(posts_need_enrichment)} precisam enrichment")

        if progress_callback:
            progress_callback(stats["posts_fetched"] + stats["posts_updated"], 0)

        # ── Phase 3: XPoz comments + Apify enrichment IN PARALLEL ────
        # Filter out posts with 0 comments (no point fetching)
        posts_with_comments = [
            (pd, po) for pd, po in posts_need_comments
            if (pd.get("comment_count", 0) or 0) > 0
        ]
        posts_no_comments = len(posts_need_comments) - len(posts_with_comments)
        if posts_no_comments > 0:
            _step(f"Pulando {posts_no_comments} posts sem comentários")

        # Run Apify enrichment and XPoz comments in parallel threads
        from concurrent.futures import ThreadPoolExecutor as TPE, as_completed as ac

        def _apify_thread():
            """Apify runs with its own DB session (thread-safe)."""
            from app.db.session import SessionLocal
            apify_db = SessionLocal()
            try:
                _enrich_via_apify(apify_db, connection.id, posts_need_enrichment, followers, _step)
            except Exception as e:
                logger.error("Apify thread error: %s", e)
                stats["errors"].append(f"Apify: {e}")
            finally:
                apify_db.close()

        # Launch Apify in background thread while XPoz comments run
        if posts_need_enrichment:
            _step(f"Lançando Apify para {len(posts_need_enrichment)} posts em paralelo...")
            from threading import Thread
            apify_thread = Thread(target=_apify_thread, daemon=True)
            apify_thread.start()
        else:
            apify_thread = None
            _step("Nenhum post para enriquecer via Apify")

        if posts_with_comments:
            _step(f"Buscando comentários para {len(posts_with_comments)} posts ({PARALLEL_WORKERS} workers)...")
            _fetch_comments_parallel(
                db, connection, posts_with_comments,
                max_comments=max_comments_per_post,
                stats=stats,
                step_callback=_step,
                progress_callback=progress_callback,
            )
            db.commit()
        else:
            _step("Nenhum post precisa de comentários")

        # Wait for Apify to finish
        if apify_thread is not None:
            _step("Aguardando Apify finalizar...")
            apify_thread.join(timeout=660)
            if apify_thread.is_alive():
                _step("Apify: timeout após 10min")
                stats["errors"].append("Apify timeout")
            else:
                _step("Apify finalizado")

        # ── Phase 5: Sync comment counts from real DB ─────────────────
        _sync_comment_counts(db, connection.id)
        _step("Contagens de comentários sincronizadas")

        # ── Phase 6: Fix comments without dates (inherit from post) ──
        orphan_comments = (
            db.query(Comment)
            .filter(Comment.connection_id == connection.id, Comment.published_at.is_(None))
            .all()
        )
        if orphan_comments:
            post_dates = dict(
                db.query(Post.id, Post.published_at)
                .filter(Post.connection_id == connection.id)
                .all()
            )
            for c in orphan_comments:
                c.published_at = post_dates.get(c.post_id)
            db.commit()
            _step(f"{len(orphan_comments)} comentários sem data corrigidos")

        # ── Phase 7: Engagement rates ─────────────────────────────────
        all_posts = db.query(Post).filter(Post.connection_id == connection.id).all()
        for p in all_posts:
            p.engagement_rate = _calc_engagement_rate(
                p.like_count or 0, p.comment_count or 0, p.share_count or 0, followers
            )
        db.commit()

        # ── Follower snapshot ─────────────────────────────────────────
        try:
            from app.models.follower_snapshot import FollowerSnapshot
            snapshot = FollowerSnapshot(
                connection_id=connection.id,
                followers_count=connection.followers_count or 0,
                following_count=connection.following_count or 0,
                media_count=connection.media_count or 0,
            )
            db.add(snapshot)
            db.commit()
        except Exception as snap_exc:
            logger.warning("Failed to create follower snapshot: %s", snap_exc)

        logger.info(
            "Instagram ingestion complete for @%s: %s new, %s updated, %s comments new, %s comments existing",
            username, stats["posts_fetched"], stats["posts_updated"],
            stats["comments_fetched"], stats["comments_updated"],
        )

    except Exception as exc:
        logger.error("Instagram ingestion failed for @%s: %s", username, exc)
        stats["errors"].append(str(exc))
        db.rollback()

    return stats


def _fetch_comments_parallel(
    db: Session,
    connection: SocialConnection,
    posts_need_comments: list,
    max_comments: int = 100,
    stats: dict = None,
    step_callback=None,
    progress_callback=None,
):
    """Fetch comments for multiple posts in parallel using ThreadPoolExecutor."""
    _step = step_callback or (lambda msg: None)

    def _fetch_one(post_data):
        """Thread worker: only XPoz call, no DB access."""
        pid = post_data["platform_post_id"]
        try:
            comments = fetch_post_comments(pid, max_comments=max_comments)
            return (pid, comments, None)
        except Exception as e:
            return (pid, [], str(e))

    # Launch parallel fetches
    results = {}
    total = len(posts_need_comments)
    done = 0

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        future_map = {
            executor.submit(_fetch_one, pd): (pd, post_obj)
            for pd, post_obj in posts_need_comments
        }
        for future in as_completed(future_map):
            post_data, post_obj = future_map[future]
            pid = post_data["platform_post_id"]
            done += 1
            try:
                _, comments_data, error = future.result()
                if error:
                    _step(f"Erro ao buscar comentários de post {done}/{total}: {error}")
                    stats["errors"].append(error)
                else:
                    results[pid] = (post_obj, comments_data)
                    _step(f"Comentários obtidos: post {done}/{total} ({len(comments_data)} encontrados)")
            except Exception as e:
                _step(f"Erro inesperado post {done}/{total}: {e}")
                stats["errors"].append(str(e))

    # Save all comments sequentially (single DB session, thread-safe)
    for pid, (post_obj, comments_data) in results.items():
        # Get existing comment IDs for this post in one query
        existing_ids = set(
            row[0] for row in
            db.query(Comment.platform_comment_id)
            .filter(Comment.post_id == post_obj.id)
            .all()
        )
        new_count = 0
        for cd in comments_data:
            cid = str(cd.get("platform_comment_id", "")).strip()
            if not cid or cid in existing_ids:
                continue

            text_original = (cd.get("text") or "").strip()
            text_hash = hashlib.sha256(text_original.encode("utf-8")).hexdigest()

            comment = Comment(
                post_id=post_obj.id,
                connection_id=connection.id,
                platform="instagram",
                platform_comment_id=cid,
                source_type="comment",
                author_username=cd.get("username"),
                author_name=cd.get("username"),
                like_count=cd.get("like_count", 0) or 0,
                published_at=_parse_timestamp(cd.get("timestamp")) or post_obj.published_at,
                text_original=text_original,
                text_clean=text_original,
                text_hash=text_hash,
                status="pending",
                raw_payload=cd,
            )
            db.add(comment)
            new_count += 1
            stats["comments_fetched"] += 1

        if new_count > 0:
            _step(f"Post {pid}: {new_count} comentários novos salvos")

        if progress_callback:
            progress_callback(
                stats["posts_fetched"] + stats["posts_updated"],
                stats["comments_fetched"] + stats["comments_updated"],
            )


def _enrich_via_apify(db, connection_id, platform_post_ids, followers, step_callback):
    """Apify batch enrichment — always updates likes/views/thumbnails/timestamps.

    Converts platform_post_ids (numeric) to Instagram shortcodes for Apify API.
    Uses its own DB session when called from a thread.
    """
    try:
        from app.services.apify_service import enrich_posts_apify

        # Build shortcode <-> platform_post_id mapping
        pid_to_sc = {}
        shortcodes = []
        for pid in platform_post_ids:
            sc = _media_id_to_shortcode(pid)
            pid_to_sc[pid] = sc
            shortcodes.append(sc)

        total_batches = (len(shortcodes) + 19) // 20
        step_callback(f"Apify: {len(shortcodes)} posts em {total_batches} batch(es)...")
        enriched = enrich_posts_apify(shortcodes)

        if not enriched:
            step_callback("Apify: nenhum dado retornado")
            return

        posts = (
            db.query(Post)
            .filter(
                Post.connection_id == connection_id,
                Post.platform_post_id.in_(platform_post_ids),
            )
            .all()
        )

        updated = 0
        for post in posts:
            sc = pid_to_sc.get(post.platform_post_id, "")
            data = enriched.get(sc)
            if not data:
                continue
            changed = False
            # Always update metrics from Apify (most accurate source)
            if data.get("like_count"):
                post.like_count = data["like_count"]
                changed = True
            if data.get("comment_count"):
                post.comment_count = data["comment_count"]
                changed = True
            if data.get("view_count"):
                post.view_count = data["view_count"]
                changed = True
            # Always update thumbnail (Apify URLs are fresher)
            if data.get("display_url"):
                post.media_urls = {"url": data["display_url"], "thumbnail_url": data["display_url"]}
                cache_remote_image(data["display_url"])
                changed = True
            if data.get("post_type"):
                post.post_type = data["post_type"]
                changed = True
            # Always fill timestamp; use Apify as fallback for null dates
            if data.get("timestamp"):
                parsed_ts = _parse_timestamp(data["timestamp"])
                if parsed_ts:
                    post.published_at = parsed_ts
                    changed = True
            # Fix post_url with correct shortcode
            if sc and (not post.post_url or post.post_url.endswith("/p//")):
                post.post_url = f"https://www.instagram.com/p/{sc}/"
                changed = True
            if changed:
                post.engagement_rate = _calc_engagement_rate(
                    post.like_count or 0, post.comment_count or 0, post.share_count or 0, followers
                )
                updated += 1

        db.commit()
        step_callback(f"Apify: {updated}/{len(shortcodes)} posts enriquecidos")
    except Exception as exc:
        logger.warning("Apify enrichment failed: %s", exc)
        step_callback(f"Apify: erro — {exc}")


def _sync_comment_counts(db, connection_id):
    """Sync post.comment_count with actual COUNT from comments table."""
    post_counts = (
        db.query(Post.id, func.count(Comment.id))
        .join(Comment, Comment.post_id == Post.id)
        .filter(Post.connection_id == connection_id)
        .group_by(Post.id)
        .all()
    )
    for post_id, count in post_counts:
        db.query(Post).filter(Post.id == post_id).update({"comment_count": count})
    db.commit()
