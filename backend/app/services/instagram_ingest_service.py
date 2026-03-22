"""
Instagram data ingestion service — incremental + parallel.

Smart sync: compares DB state vs Apify catalog, only fetches what's missing.
Comments fetched via Apify comment actor (parallel workers).
Apify enrichment for posts missing likes/views/thumbnails.
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
from app.models.user import User
from app.services.media_cache_service import cache_remote_image, cache_image_stable

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
    is_incremental: bool = False,
    progress_callback=None,
    step_callback=None,
    use_apify_comments: bool = True,
    comment_sample_mode: str = "all",
    mode: str = "full",
) -> dict:
    """
    Apify-first ingestion from Instagram.

    1. Fetch post catalog + metadata from Apify Instagram Scraper (1 API call)
    2. Diff against DB — classify each post into SKIP / NEEDS_COMMENTS
    3. Fetch comments via Apify Comment Scraper (1 run per post, parallel)
    4. Sync comment counts from real DB data
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
        # ── Daily mode: only check last 5 posts ───────────────────────
        if mode == "daily":
            return _ingest_instagram_daily(
                db, connection, max_comments_per_post=max_comments_per_post,
                progress_callback=progress_callback, step_callback=_step,
                use_apify_comments=use_apify_comments,
                comment_sample_mode=comment_sample_mode,
            )

        # ── Phase 1: Fetch post catalog from Apify ─────────────────────
        _step("Buscando catálogo de posts via Apify...")
        user_plan = db.query(User.plan).filter(User.id == connection.user_id).scalar() or "free"
        total_comment_budget = max_comments_per_post if user_plan == "free" else None
        from app.services.apify_service import fetch_posts_apify
        posts_data = fetch_posts_apify(username, max_posts=max_posts, step_callback=_step)

        if not posts_data:
            _step("Nenhum post encontrado via Apify")
            return stats

        # ── Phase 2: Diff DB vs Apify ─────────────────────────────────
        _step("Comparando com base de dados...")
        all_db_posts = db.query(Post).filter(Post.connection_id == connection.id).all()
        existing_posts = {p.platform_post_id: p for p in all_db_posts}
        # Secondary lookup by post_url (handles migration from numeric IDs to shortcodes)
        existing_by_url = {p.post_url: p for p in all_db_posts if p.post_url}
        comment_counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.connection_id == connection.id)
            .group_by(Comment.post_id)
            .all()
        )

        posts_need_comments = []  # (post_data, post_obj)
        skipped = 0

        # Compute sync boundary for incremental mode
        oldest_post_date = None
        if is_incremental and all_db_posts:
            dates = [p.published_at for p in all_db_posts if p.published_at]
            if dates:
                oldest_post_date = min(dates)
                _step(f"Incremental: boundary = {oldest_post_date.date()} ({len(all_db_posts)} posts no DB)")

        for post_data in posts_data:
            pid = post_data["platform_post_id"]
            permalink = post_data.get("permalink")
            # Match by platform_post_id first, then by post_url (migration support)
            existing = existing_posts.get(pid) or (existing_by_url.get(permalink) if permalink else None)

            if existing:
                # Migrate platform_post_id from numeric to shortcode if needed
                if existing.platform_post_id != pid:
                    existing.platform_post_id = pid
                # Always update metadata from Apify (most accurate source)
                caption = post_data.get("caption") or ""
                if caption:
                    existing.content_text = caption
                    existing.content_clean = caption
                existing.post_type = post_data.get("post_type") or existing.post_type
                existing.like_count = post_data.get("like_count", 0) or existing.like_count
                existing.comment_count_api = post_data.get("comment_count", 0) or existing.comment_count_api
                existing.view_count = post_data.get("view_count", 0) or existing.view_count
                existing.published_at = _parse_timestamp(post_data.get("timestamp")) or existing.published_at
                existing.post_url = post_data.get("permalink") or existing.post_url
                media_url = post_data.get("media_url")
                if media_url:
                    existing.media_urls = {"url": media_url, "thumbnail_url": media_url}
                    cache_image_stable(media_url, pid)
                existing.engagement_rate = _calc_engagement_rate(
                    existing.like_count or 0, existing.comment_count or 0, 0, followers
                )
                existing.fetched_at = datetime.now(timezone.utc)
                stats["posts_updated"] += 1

                db_comment_count = comment_counts.get(existing.id, 0)
                apify_comment_count = post_data.get("comment_count", 0) or 0

                if is_incremental:
                    # Incremental: only fetch if Apify reports more comments than we have
                    if apify_comment_count > db_comment_count:
                        posts_need_comments.append((post_data, existing))
                    else:
                        skipped += 1
                else:
                    # Manual: fetch comments if we have none
                    if db_comment_count == 0:
                        posts_need_comments.append((post_data, existing))
                    else:
                        skipped += 1
            else:
                # New post — in incremental mode, skip posts older than boundary
                post_timestamp = _parse_timestamp(post_data.get("timestamp"))
                if is_incremental and oldest_post_date and post_timestamp:
                    if post_timestamp < oldest_post_date:
                        skipped += 1
                        continue

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
                    comment_count=0,
                    comment_count_api=_comments,
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
                if media_url:
                    cache_image_stable(media_url, pid)

        db.commit()
        _step(f"Diff: {skipped} completos (skip), {len(posts_need_comments)} precisam comentários")

        if progress_callback:
            progress_callback(stats["posts_fetched"] + stats["posts_updated"], 0)

        # ── Phase 3: Fetch comments via Apify ──────────────────────────
        if posts_need_comments:
            _step(f"Buscando comentários via Apify para {len(posts_need_comments)} posts...")
            _fetch_comments_apify_path(
                db, connection, posts_need_comments,
                max_comments=max_comments_per_post,
                total_comments_cap=total_comment_budget,
                sample_mode=comment_sample_mode,
                stats=stats,
                step_callback=_step,
                progress_callback=progress_callback,
            )
            db.commit()
        else:
            _step("Nenhum post precisa de comentários")

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

        # Update last_sync_at for this connection
        connection.last_sync_at = datetime.now(timezone.utc)
        db.commit()

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
        """Thread worker: no DB access."""
        pid = post_data["platform_post_id"]
        try:
            from app.services.apify_service import fetch_comments_apify
            url = post_data.get("permalink") or f"https://www.instagram.com/p/{pid}/"
            result = fetch_comments_apify([url], max_per_post=max_comments)
            comments = result.get(url, [])
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


def _fetch_comments_apify_path(
    db: Session,
    connection: SocialConnection,
    posts_need_comments: list,
    max_comments: int = 10000,
    total_comments_cap: int | None = None,
    sample_mode: str = "all",
    stats: dict = None,
    step_callback=None,
    progress_callback=None,
):
    """Fetch comments via Apify comment actor and save to DB."""
    from app.services.apify_service import fetch_comments_apify

    _step = step_callback or (lambda msg: None)

    # Build post URL -> post_obj mapping and comment counts for sampling
    post_map: dict[str, object] = {}  # url -> post_obj
    comment_counts: dict[str, int] = {}  # url -> estimated count

    for post_data, post_obj in posts_need_comments:
        shortcode = _media_id_to_shortcode(post_data["platform_post_id"])
        url = post_data.get("permalink") or f"https://www.instagram.com/p/{shortcode}/"
        post_map[url] = post_obj
        comment_counts[url] = post_data.get("comment_count", 0) or 0

    post_urls = list(post_map.keys())
    per_post_limits: dict[str, int] | None = None
    if total_comments_cap is not None and post_urls:
        remaining = total_comments_cap
        per_post_limits = {}
        for index, url in enumerate(post_urls):
            posts_left = len(post_urls) - index
            if remaining <= 0:
                per_post_limits[url] = 0
                continue
            fair_share = max(1, remaining // posts_left)
            per_post_limits[url] = min(max_comments, fair_share)
            remaining -= per_post_limits[url]

    # Fetch comments via Apify
    comments_by_url = fetch_comments_apify(
        post_urls=post_urls,
        max_per_post=max_comments,
        per_post_limits=per_post_limits,
        sample_mode=sample_mode,
        comment_counts=comment_counts,
        step_callback=_step,
    )

    # Apply smart sampling (top-liked reservation) when in sample mode
    if sample_mode == "sample":
        from app.services.apify_service import _apply_smart_sample
        for url in comments_by_url:
            population = comment_counts.get(url, len(comments_by_url[url]))
            comments_by_url[url] = _apply_smart_sample(
                comments_by_url[url], population
            )

    # Save comments to DB — accumulate ALL, commit once, then report progress.
    # CRITICAL: Do NOT call _step() or progress_callback() while comments are
    # pending in the session. Those callbacks trigger _append_step → db.commit()
    # which, on failure, would db.rollback() ALL pending comments silently.
    total_new = 0
    seen_keys: set[tuple[str, str]] = set()  # (post_id, comment_id) — dedup within batch
    for url, comments_data in comments_by_url.items():
        post_obj = post_map.get(url)
        if not post_obj or not comments_data:
            continue

        existing_ids = set(
            row[0] for row in
            db.query(Comment.platform_comment_id)
            .filter(Comment.post_id == post_obj.id)
            .all()
        )

        for cd in comments_data:
            cid = str(cd.get("platform_comment_id", "")).strip()
            if not cid or cid in existing_ids:
                continue
            # Dedup within current batch (Apify may return same comment twice)
            batch_key = (str(post_obj.id), cid)
            if batch_key in seen_keys:
                continue
            seen_keys.add(batch_key)

            text_original = (cd.get("text") or "").strip()
            if not text_original:
                continue
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
            total_new += 1
            stats["comments_fetched"] += 1

    # Commit ALL comments in one transaction (no step/progress interference)
    if total_new > 0:
        db.commit()
        logger.info("Apify comments: committed %d new comments to DB", total_new)

    # ONLY AFTER successful commit: report progress
    _step(f"Apify: {total_new} comentários novos salvos")
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
                post.comment_count_api = data["comment_count"]
                changed = True
            if data.get("view_count"):
                post.view_count = data["view_count"]
                changed = True
            # Always update thumbnail (Apify URLs are fresher)
            if data.get("display_url"):
                post.media_urls = {"url": data["display_url"], "thumbnail_url": data["display_url"]}
                cache_image_stable(data["display_url"], post.platform_post_id)
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


def ingest_instagram_via_graph_api(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 50,
    max_comments_per_post: int = 100,
    since_date: Optional[date] = None,
    is_incremental: bool = False,
    progress_callback=None,
    step_callback=None,
    mode: str = "full",
) -> dict:
    """
    Ingest Instagram data using the official Graph API (OAuth token required).

    This is the preferred path when the connection has a valid OAuth token.
    No Apify needed — all data comes from Instagram's official API.
    """
    import asyncio
    from app.core.security import decrypt_token
    from app.services.instagram_service import fetch_user_posts, fetch_post_comments as graph_fetch_comments

    _step = step_callback or (lambda msg: None)
    username = connection.username
    followers = connection.followers_count or 0

    stats = {
        "posts_fetched": 0,
        "posts_updated": 0,
        "comments_fetched": 0,
        "comments_updated": 0,
        "errors": [],
    }

    try:
        # ── Daily mode: only check last 5 posts ───────────────────────
        if mode == "daily":
            return _ingest_instagram_graph_daily(
                db, connection, max_comments_per_post=max_comments_per_post,
                progress_callback=progress_callback, step_callback=_step,
            )

        access_token = decrypt_token(connection.access_token_enc)
        platform_user_id = connection.platform_user_id
        user_plan = db.query(User.plan).filter(User.id == connection.user_id).scalar() or "free"
        remaining_comment_budget = max_comments_per_post if user_plan == "free" else None

        # ── Phase 1: Fetch posts from Graph API ──────────────────────
        _step("Buscando posts via Instagram Graph API...")
        loop = asyncio.new_event_loop()
        try:
            posts_data = loop.run_until_complete(
                fetch_user_posts(access_token, platform_user_id, limit=max_posts)
            )
        finally:
            loop.close()
        _step(f"{len(posts_data)} posts obtidos via API oficial")

        # ── Phase 2: Upsert posts into DB ────────────────────────────
        existing_posts = {
            p.platform_post_id: p
            for p in db.query(Post).filter(Post.connection_id == connection.id).all()
        }
        comment_counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.connection_id == connection.id)
            .group_by(Comment.post_id)
            .all()
        )

        posts_need_comments = []
        skipped = 0

        # Compute sync boundary for incremental mode
        all_db_posts_list = list(existing_posts.values())
        oldest_post_date = None
        if is_incremental and all_db_posts_list:
            dates = [p.published_at for p in all_db_posts_list if p.published_at]
            if dates:
                oldest_post_date = min(dates)
                _step(f"Incremental: boundary = {oldest_post_date.date()} ({len(all_db_posts_list)} posts no DB)")

        for pd in posts_data:
            pid = pd["platform_post_id"]

            # Filter by since_date if provided
            if since_date and pd.get("timestamp"):
                ts = _parse_timestamp(pd["timestamp"])
                if ts and ts.date() < since_date:
                    continue

            existing = existing_posts.get(pid)
            media_type = pd.get("media_type", "IMAGE")
            post_type = "video" if media_type in ("VIDEO", "REELS") else "carousel" if media_type == "CAROUSEL_ALBUM" else "image"

            if existing:
                existing.content_text = pd.get("caption") or existing.content_text
                existing.content_clean = pd.get("caption") or existing.content_clean
                existing.post_type = post_type
                existing.like_count = pd.get("like_count", 0) or existing.like_count
                existing.comment_count_api = pd.get("comments_count", 0) or existing.comment_count_api
                existing.post_url = pd.get("permalink") or existing.post_url
                if pd.get("media_url"):
                    existing.media_urls = {
                        "url": pd["media_url"],
                        "thumbnail_url": pd.get("thumbnail_url") or pd["media_url"],
                    }
                if not existing.published_at:
                    existing.published_at = _parse_timestamp(pd.get("timestamp"))
                existing.fetched_at = datetime.now(timezone.utc)
                stats["posts_updated"] += 1

                db_comment_count = comment_counts.get(existing.id, 0)
                api_comment_count = pd.get("comments_count", 0) or 0

                if is_incremental:
                    if api_comment_count > db_comment_count:
                        posts_need_comments.append((pid, existing))
                    else:
                        skipped += 1
                else:
                    if db_comment_count == 0:
                        posts_need_comments.append((pid, existing))
                    else:
                        skipped += 1
            else:
                # New post — in incremental mode, skip posts older than boundary
                post_timestamp = _parse_timestamp(pd.get("timestamp"))
                if is_incremental and oldest_post_date and post_timestamp:
                    if post_timestamp < oldest_post_date:
                        skipped += 1
                        continue

                media_url = pd.get("media_url")
                _likes = pd.get("like_count", 0) or 0
                _comments = pd.get("comments_count", 0) or 0
                post = Post(
                    connection_id=connection.id,
                    platform="instagram",
                    platform_post_id=pid,
                    post_type=post_type,
                    content_text=pd.get("caption") or "",
                    content_clean=pd.get("caption") or "",
                    media_urls={
                        "url": media_url,
                        "thumbnail_url": pd.get("thumbnail_url") or media_url,
                    } if media_url else None,
                    like_count=_likes,
                    comment_count=0,
                    comment_count_api=_comments,
                    view_count=0,
                    engagement_rate=_calc_engagement_rate(_likes, _comments, 0, followers),
                    published_at=_parse_timestamp(pd.get("timestamp")),
                    post_url=pd.get("permalink"),
                    raw_payload=pd,
                    fetched_at=datetime.now(timezone.utc),
                )
                db.add(post)
                db.flush()
                stats["posts_fetched"] += 1
                posts_need_comments.append((pid, post))

        db.commit()
        _step(f"Posts salvos: {stats['posts_fetched']} novos, {stats['posts_updated']} atualizados")

        if progress_callback:
            progress_callback(stats["posts_fetched"] + stats["posts_updated"], 0)

        # ── Phase 3: Fetch comments via Graph API ────────────────────
        posts_with_comments = [
            (pid, po) for pid, po in posts_need_comments
            if (po.comment_count or 0) > 0
        ]
        if posts_with_comments:
            _step(f"Buscando comentários para {len(posts_with_comments)} posts via Graph API...")

            for idx, (pid, post_obj) in enumerate(posts_with_comments, 1):
                try:
                    if remaining_comment_budget is not None and remaining_comment_budget <= 0:
                        break
                    fetch_limit = (
                        min(max_comments_per_post, remaining_comment_budget)
                        if remaining_comment_budget is not None
                        else max_comments_per_post
                    )
                    loop = asyncio.new_event_loop()
                    try:
                        comments_data = loop.run_until_complete(
                            graph_fetch_comments(access_token, pid, limit=fetch_limit)
                        )
                    finally:
                        loop.close()

                    if not comments_data and (post_obj.comment_count or 0) > 0:
                        logger.warning(
                            "Graph API returned 0 comments for post %s (expected ~%d). "
                            "This usually means the Meta App is in Development mode — "
                            "comments from non-test users are filtered. "
                            "Submit the app for App Review to fix this.",
                            pid, post_obj.comment_count or 0,
                        )

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
                        if not text_original:
                            continue
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

                    db.commit()
                    if remaining_comment_budget is not None:
                        remaining_comment_budget -= len(comments_data)
                    _step(f"Post {idx}/{len(posts_with_comments)}: {new_count} comentários novos")

                    if progress_callback:
                        progress_callback(
                            stats["posts_fetched"] + stats["posts_updated"],
                            stats["comments_fetched"],
                        )
                except Exception as e:
                    logger.error("Graph API comments error for post %s: %s", pid, e)
                    stats["errors"].append(f"Comments {pid}: {e}")
        else:
            _step("Nenhum post precisa de comentários")

        # ── Phase 4: Sync comment counts ─────────────────────────────
        _sync_comment_counts(db, connection.id)
        _step("Contagens de comentários sincronizadas")

        # ── Phase 5: Engagement rates ────────────────────────────────
        all_posts = db.query(Post).filter(Post.connection_id == connection.id).all()
        for p in all_posts:
            p.engagement_rate = _calc_engagement_rate(
                p.like_count or 0, p.comment_count or 0, p.share_count or 0, followers
            )
        db.commit()

        # ── Follower snapshot ────────────────────────────────────────
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

        # Update last_sync_at for this connection
        connection.last_sync_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "Instagram Graph API ingestion for @%s: %s new posts, %s updated, %s comments",
            username, stats["posts_fetched"], stats["posts_updated"], stats["comments_fetched"],
        )

    except Exception as exc:
        logger.error("Instagram Graph API ingestion failed for @%s: %s", username, exc)
        stats["errors"].append(str(exc))
        db.rollback()

    return stats


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


def _ingest_instagram_daily(
    db: Session,
    connection: SocialConnection,
    max_comments_per_post: int = 100,
    progress_callback=None,
    step_callback=None,
    use_apify_comments: bool = True,
    comment_sample_mode: str = "all",
) -> dict:
    """Daily mode for Apify-based Instagram ingestion.

    Instead of fetching all posts, only checks the 5 most recent posts in DB:
    - Fetches latest posts from Apify to detect brand new posts
    - For existing posts, only fetches comments where API count > scraped count
    """
    _step = step_callback or (lambda msg: None)
    username = connection.username
    followers = connection.followers_count or 0

    stats = {
        "posts_fetched": 0,
        "posts_updated": 0,
        "comments_fetched": 0,
        "comments_updated": 0,
        "errors": [],
    }

    try:
        _step("Daily mode: verificando últimos 5 posts...")

        # Get last 5 posts from DB
        recent_posts = (
            db.query(Post)
            .filter(Post.connection_id == connection.id, Post.platform == "instagram")
            .order_by(Post.published_at.desc())
            .limit(5)
            .all()
        )
        recent_post_ids = {p.platform_post_id for p in recent_posts}

        # Fetch latest posts from Apify to detect new ones
        from app.services.apify_service import fetch_posts_apify
        posts_data = fetch_posts_apify(username, max_posts=10, step_callback=_step)

        if not posts_data:
            _step("Nenhum post encontrado via Apify")
            return stats

        # Separate new posts from existing ones
        posts_need_comments = []
        comment_counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.connection_id == connection.id)
            .group_by(Comment.post_id)
            .all()
        )

        for post_data in posts_data:
            pid = post_data["platform_post_id"]

            if pid in recent_post_ids:
                # Existing post — check if comment count increased
                existing = next((p for p in recent_posts if p.platform_post_id == pid), None)
                if not existing:
                    continue

                apify_comment_count = post_data.get("comment_count", 0) or 0
                # Update API count
                existing.comment_count_api = apify_comment_count
                existing.like_count = post_data.get("like_count", 0) or existing.like_count
                existing.view_count = post_data.get("view_count", 0) or existing.view_count
                existing.fetched_at = datetime.now(timezone.utc)
                stats["posts_updated"] += 1

                db_count = comment_counts.get(existing.id, 0)
                if apify_comment_count > db_count:
                    posts_need_comments.append((post_data, existing))
                    _step(f"Post {pid}: API={apify_comment_count} > DB={db_count}, buscando novos comentários")
            else:
                # Brand new post — check if it's newer than our newest
                post_timestamp = _parse_timestamp(post_data.get("timestamp"))
                newest_date = max((p.published_at for p in recent_posts if p.published_at), default=None) if recent_posts else None
                if newest_date and post_timestamp and post_timestamp < newest_date:
                    continue  # Old post we didn't have, skip in daily mode

                media_url = post_data.get("media_url")
                _likes = post_data.get("like_count", 0) or 0
                _comments = post_data.get("comment_count", 0) or 0
                post = Post(
                    connection_id=connection.id,
                    platform="instagram",
                    platform_post_id=pid,
                    post_type=post_data.get("post_type"),
                    content_text=post_data.get("caption") or "",
                    content_clean=post_data.get("caption") or "",
                    media_urls={"url": media_url, "thumbnail_url": media_url} if media_url else None,
                    like_count=_likes,
                    comment_count=0,
                    comment_count_api=_comments,
                    view_count=post_data.get("view_count", 0) or 0,
                    engagement_rate=_calc_engagement_rate(_likes, _comments, 0, followers),
                    published_at=_parse_timestamp(post_data.get("timestamp")),
                    post_url=post_data.get("permalink"),
                    raw_payload=post_data,
                    fetched_at=datetime.now(timezone.utc),
                )
                db.add(post)
                db.flush()
                stats["posts_fetched"] += 1
                posts_need_comments.append((post_data, post))
                _step(f"Novo post encontrado: {pid}")
                if media_url:
                    cache_image_stable(media_url, pid)

        db.commit()

        # Fetch comments for posts that need them
        if posts_need_comments:
            user_plan = db.query(User.plan).filter(User.id == connection.user_id).scalar() or "free"
            total_comment_budget = max_comments_per_post if user_plan == "free" else None
            _step(f"Buscando comentários para {len(posts_need_comments)} posts...")
            _fetch_comments_apify_path(
                db, connection, posts_need_comments,
                max_comments=max_comments_per_post,
                total_comments_cap=total_comment_budget,
                sample_mode=comment_sample_mode,
                stats=stats,
                step_callback=_step,
                progress_callback=progress_callback,
            )
            db.commit()

        _sync_comment_counts(db, connection.id)
        connection.last_sync_at = datetime.now(timezone.utc)
        db.commit()

        _step(f"Daily sync: {stats['posts_fetched']} novos, {stats['posts_updated']} atualizados, {stats['comments_fetched']} comentários")
        logger.info("Instagram daily sync @%s: %s", username, stats)

    except Exception as exc:
        logger.error("Instagram daily ingestion failed for @%s: %s", username, exc)
        stats["errors"].append(str(exc))
        db.rollback()

    return stats


def _ingest_instagram_graph_daily(
    db: Session,
    connection: SocialConnection,
    max_comments_per_post: int = 100,
    progress_callback=None,
    step_callback=None,
) -> dict:
    """Daily mode for Graph API-based Instagram ingestion.

    Only checks the 5 most recent posts in DB, fetches new comments where count increased.
    """
    import asyncio
    from app.core.security import decrypt_token
    from app.services.instagram_service import fetch_user_posts, fetch_post_comments as graph_fetch_comments

    _step = step_callback or (lambda msg: None)
    username = connection.username
    followers = connection.followers_count or 0

    stats = {
        "posts_fetched": 0,
        "posts_updated": 0,
        "comments_fetched": 0,
        "comments_updated": 0,
        "errors": [],
    }

    try:
        access_token = decrypt_token(connection.access_token_enc)
        platform_user_id = connection.platform_user_id

        _step("Daily mode (Graph API): verificando últimos 5 posts...")

        # Get last 5 posts from DB
        recent_posts = (
            db.query(Post)
            .filter(Post.connection_id == connection.id, Post.platform == "instagram")
            .order_by(Post.published_at.desc())
            .limit(5)
            .all()
        )
        recent_post_map = {p.platform_post_id: p for p in recent_posts}

        # Fetch latest posts from Graph API
        loop = asyncio.new_event_loop()
        try:
            posts_data = loop.run_until_complete(
                fetch_user_posts(access_token, platform_user_id, limit=10)
            )
        finally:
            loop.close()

        comment_counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.connection_id == connection.id)
            .group_by(Comment.post_id)
            .all()
        )

        posts_need_comments = []

        for pd in posts_data:
            pid = pd["platform_post_id"]
            api_comment_count = pd.get("comments_count", 0) or 0

            if pid in recent_post_map:
                existing = recent_post_map[pid]
                existing.comment_count_api = api_comment_count
                existing.like_count = pd.get("like_count", 0) or existing.like_count
                existing.fetched_at = datetime.now(timezone.utc)
                stats["posts_updated"] += 1

                db_count = comment_counts.get(existing.id, 0)
                if api_comment_count > db_count:
                    posts_need_comments.append((pid, existing))
                    _step(f"Post {pid}: API={api_comment_count} > DB={db_count}")
            else:
                # Brand new post
                newest_date = max((p.published_at for p in recent_posts if p.published_at), default=None) if recent_posts else None
                post_timestamp = _parse_timestamp(pd.get("timestamp"))
                if newest_date and post_timestamp and post_timestamp < newest_date:
                    continue

                media_type = pd.get("media_type", "IMAGE")
                post_type = "video" if media_type in ("VIDEO", "REELS") else "carousel" if media_type == "CAROUSEL_ALBUM" else "image"
                media_url = pd.get("media_url")
                _likes = pd.get("like_count", 0) or 0
                _comments = api_comment_count

                post = Post(
                    connection_id=connection.id,
                    platform="instagram",
                    platform_post_id=pid,
                    post_type=post_type,
                    content_text=pd.get("caption") or "",
                    content_clean=pd.get("caption") or "",
                    media_urls={
                        "url": media_url,
                        "thumbnail_url": pd.get("thumbnail_url") or media_url,
                    } if media_url else None,
                    like_count=_likes,
                    comment_count=0,
                    comment_count_api=_comments,
                    view_count=0,
                    engagement_rate=_calc_engagement_rate(_likes, _comments, 0, followers),
                    published_at=post_timestamp,
                    post_url=pd.get("permalink"),
                    raw_payload=pd,
                    fetched_at=datetime.now(timezone.utc),
                )
                db.add(post)
                db.flush()
                stats["posts_fetched"] += 1
                posts_need_comments.append((pid, post))
                _step(f"Novo post encontrado: {pid}")

        db.commit()

        # Fetch comments via Graph API for posts that need them
        if posts_need_comments:
            _step(f"Buscando comentários para {len(posts_need_comments)} posts via Graph API...")
            for idx, (pid, post_obj) in enumerate(posts_need_comments, 1):
                try:
                    loop = asyncio.new_event_loop()
                    try:
                        comments_data = loop.run_until_complete(
                            graph_fetch_comments(access_token, pid, limit=max_comments_per_post)
                        )
                    finally:
                        loop.close()

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
                        if not text_original:
                            continue
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

                    db.commit()
                    _step(f"Post {idx}/{len(posts_need_comments)}: {new_count} comentários novos")
                except Exception as e:
                    logger.error("Graph API daily comments error for post %s: %s", pid, e)
                    stats["errors"].append(f"Comments {pid}: {e}")

        _sync_comment_counts(db, connection.id)
        connection.last_sync_at = datetime.now(timezone.utc)
        db.commit()

        _step(f"Daily sync (Graph API): {stats['posts_fetched']} novos, {stats['posts_updated']} atualizados, {stats['comments_fetched']} comentários")
        logger.info("Instagram Graph API daily sync @%s: %s", username, stats)

    except Exception as exc:
        logger.error("Instagram Graph API daily ingestion failed for @%s: %s", username, exc)
        stats["errors"].append(str(exc))
        db.rollback()

    return stats
