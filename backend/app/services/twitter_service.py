"""
Twitter/X ingestion service.

Uses Apify actors to fetch tweets and replies. Replaces the previous XPoz MCP
implementation with direct Apify HTTP calls (same pattern as demographics_service).

Actors used:
  - apidojo/tweet-scraper → fetch tweets by user + replies per tweet

Demographics: author data from replies is saved directly to commenter_profiles
(no separate profile scraper needed).
"""

import hashlib
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.apify_cost_tracker import is_limit_reached, add_cost, fetch_last_run_cost
from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection
from app.models.demographics import CommenterProfile

logger = logging.getLogger(__name__)

# ── Apify config ─────────────────────────────────────────────────────────
APIFY_BASE_URL = "https://api.apify.com/v2"
TWEET_SCRAPER_ACTOR = "apidojo~tweet-scraper"
POLL_INTERVAL = 5  # seconds between status polls
POLL_TIMEOUT = 300  # max seconds to wait for a run
APIFY_TIMEOUT = 30  # HTTP request timeout


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip())


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").strip())
    except Exception:
        return 0


def _get_apify_token() -> str:
    return settings.APIFY_API_TOKEN


def _record_run_cost(run_id: str) -> float:
    """Fetch and record the cost of an Apify run."""
    token = _get_apify_token()
    if not token:
        return 0.0
    try:
        url = f"{APIFY_BASE_URL}/actor-runs/{run_id}?token={token}"
        with httpx.Client(timeout=10) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json().get("data", {})
        cost = float(data.get("usageTotalUsd", 0.0))
        if cost > 0:
            total = add_cost(cost)
            logger.info("Apify cost (twitter): $%.4f this run, $%.4f today", cost, total)
        return cost
    except Exception as exc:
        logger.debug("Failed to record Apify run cost: %s", exc)
        return 0.0


# ---------------------------------------------------------------------------
# Apify run helper (start → poll → get results)
# ---------------------------------------------------------------------------

def _run_apify_actor(actor_id: str, input_data: dict) -> list[dict]:
    """Start an Apify actor, poll for completion, return dataset items."""
    token = _get_apify_token()
    if not token:
        logger.error("Twitter: APIFY_API_TOKEN not configured")
        return []

    if is_limit_reached():
        logger.warning("Twitter: Apify daily limit reached, skipping")
        return []

    # Start run
    start_url = f"{APIFY_BASE_URL}/acts/{actor_id}/runs?token={token}"
    try:
        resp = httpx.post(start_url, json=input_data, timeout=APIFY_TIMEOUT)
        resp.raise_for_status()
        run_data = resp.json().get("data", {})
        run_id = run_data.get("id")
        if not run_id:
            logger.error("Twitter: Apify run start returned no run id")
            return []
    except Exception as exc:
        logger.error("Twitter: Failed to start Apify actor %s: %s", actor_id, exc)
        return []

    logger.info("Twitter: Apify run %s started for actor %s", run_id, actor_id)

    # Poll for completion
    status_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}?token={token}"
    elapsed = 0
    while elapsed < POLL_TIMEOUT:
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        try:
            resp = httpx.get(status_url, timeout=APIFY_TIMEOUT)
            resp.raise_for_status()
            run_status = resp.json().get("data", {}).get("status")
        except Exception as exc:
            logger.warning("Twitter: Poll error for run %s: %s", run_id, exc)
            continue

        if run_status == "SUCCEEDED":
            break
        elif run_status in ("FAILED", "ABORTED", "TIMED-OUT"):
            logger.error("Twitter: Apify run %s ended with status %s", run_id, run_status)
            _record_run_cost(run_id)
            return []

    else:
        logger.error("Twitter: Apify run %s timed out after %ds", run_id, POLL_TIMEOUT)
        _record_run_cost(run_id)
        return []

    # Record cost
    _record_run_cost(run_id)

    # Get results
    dataset_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}/dataset/items?token={token}"
    try:
        resp = httpx.get(dataset_url, timeout=60)
        resp.raise_for_status()
        items = resp.json()
        logger.info("Twitter: Apify run %s returned %d items", run_id, len(items) if items else 0)
        return items if isinstance(items, list) else []
    except Exception as exc:
        logger.error("Twitter: Failed to fetch dataset for run %s: %s", run_id, exc)
        return []


# ---------------------------------------------------------------------------
# Profile discovery via Apify
# ---------------------------------------------------------------------------

def get_twitter_profile(username: str) -> Optional[dict]:
    """Fetch Twitter profile info via Apify tweet-scraper (user tweets mode)."""
    if username.startswith("@"):
        username = username[1:]

    items = _run_apify_actor(TWEET_SCRAPER_ACTOR, {
        "handles": [username],
        "tweetsDesired": 1,
        "addUserInfo": True,
        "proxyConfig": {"useApifyProxy": True},
    })

    if not items:
        logger.warning("Twitter: Could not find profile for @%s", username)
        return None

    # The actor returns tweet objects; extract author info from first item
    first = items[0]
    author = first.get("author", first.get("user", {}))

    # Depending on actor output format, author data may be at top level
    screen_name = (
        author.get("userName") or author.get("screen_name")
        or first.get("author_name") or username
    )
    display_name = (
        author.get("name") or author.get("displayname")
        or first.get("author_name") or username
    )
    user_id = str(
        author.get("id") or author.get("id_str")
        or first.get("author_id") or ""
    )

    return {
        "id": user_id,
        "username": screen_name.lstrip("@"),
        "name": display_name,
        "description": author.get("description") or author.get("rawDescription") or "",
        "followers_count": _safe_int(author.get("followers") or author.get("followersCount") or 0),
        "following_count": _safe_int(author.get("following") or author.get("friendsCount") or 0),
        "tweets_count": _safe_int(author.get("statusesCount") or 0),
        "profile_image_url": author.get("profileImageUrl") or author.get("profilePicUrl") or "",
        "location": author.get("location") or "",
        "url": f"https://twitter.com/{screen_name.lstrip('@')}",
    }


# ---------------------------------------------------------------------------
# Connection creation
# ---------------------------------------------------------------------------

def create_twitter_connection(
    db: Session, user_id: str, username: str
) -> Optional[SocialConnection]:
    """Create or update a SocialConnection for Twitter."""
    if username.startswith("@"):
        username = username[1:]

    profile = get_twitter_profile(username)
    if not profile:
        return None

    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == "twitter",
            SocialConnection.username == profile["username"],
        )
        .first()
    )

    if existing:
        existing.display_name = profile["name"]
        existing.followers_count = profile["followers_count"]
        existing.following_count = profile["following_count"]
        existing.media_count = profile["tweets_count"]
        existing.profile_image_url = profile["profile_image_url"]
        existing.raw_profile_json = profile
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

    conn = SocialConnection(
        user_id=user_id,
        platform="twitter",
        platform_user_id=profile["id"],
        username=profile["username"],
        display_name=profile["name"],
        profile_url=profile["url"],
        profile_image_url=profile["profile_image_url"],
        followers_count=profile["followers_count"],
        following_count=profile["following_count"],
        media_count=profile["tweets_count"],
        status="active",
        raw_profile_json=profile,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    logger.info("Twitter connection created for @%s", username)
    return conn


# ---------------------------------------------------------------------------
# Fetch tweets for a user via Apify
# ---------------------------------------------------------------------------

def fetch_twitter_posts(username: str, max_posts: int = 10) -> list[dict]:
    """Fetch recent tweets from a user via Apify tweet-scraper."""
    if username.startswith("@"):
        username = username[1:]

    items = _run_apify_actor(TWEET_SCRAPER_ACTOR, {
        "handles": [username],
        "tweetsDesired": max_posts,
        "addUserInfo": True,
        "proxyConfig": {"useApifyProxy": True},
    })

    normalized = []
    for item in items:
        tweet_id = str(
            item.get("id") or item.get("id_str") or item.get("tweetId") or ""
        )
        if not tweet_id:
            continue

        text = item.get("text") or item.get("full_text") or item.get("tweetText") or ""
        url = item.get("url") or item.get("tweetUrl") or f"https://twitter.com/{username}/status/{tweet_id}"

        # Timestamp parsing
        timestamp = item.get("createdAt") or item.get("created_at") or item.get("timestamp") or ""

        # conversationId is the same as tweet id for original tweets,
        # but differs for retweets/quotes — we use it for fetching replies
        conversation_id = str(item.get("conversationId") or tweet_id)

        normalized.append({
            "platform_post_id": tweet_id,
            "conversation_id": conversation_id,
            "post_type": "tweet",
            "content": text,
            "permalink": url,
            "like_count": _safe_int(item.get("likeCount") or item.get("likes") or item.get("favorite_count") or 0),
            "reply_count": _safe_int(item.get("replyCount") or item.get("replies") or 0),
            "retweet_count": _safe_int(item.get("retweetCount") or item.get("retweets") or 0),
            "view_count": _safe_int(item.get("viewCount") or item.get("views") or 0),
            "timestamp": str(timestamp),
            # Keep author data for demographics
            "_author": item.get("author") or item.get("user") or {},
            "_raw": item,
        })

    logger.info("Twitter: Fetched %d tweets for @%s", len(normalized), username)
    return normalized


# ---------------------------------------------------------------------------
# Fetch replies for a conversation/tweet via Apify
# ---------------------------------------------------------------------------

def fetch_tweet_comments(tweet_id: str, tweet_url: str = "", max_comments: int = 100) -> list[dict]:
    """Fetch replies for a tweet via Apify tweet-scraper using searchTerms.

    Uses Twitter's search operator 'conversation_id:<tweet_id>' via the
    searchTerms input to retrieve all replies in a conversation thread.
    """
    items = _run_apify_actor(TWEET_SCRAPER_ACTOR, {
        "searchTerms": [f"conversation_id:{tweet_id}"],
        "tweetsDesired": max_comments,
        "addUserInfo": True,
        "proxyConfig": {"useApifyProxy": True},
    })

    # Filter out sentinel items like {"noResults": true}
    items = [item for item in items if not item.get("noResults")]

    normalized = []
    for item in items:
        reply_id = str(
            item.get("id") or item.get("id_str") or item.get("tweetId") or ""
        )
        # Skip the original tweet itself (same id as the conversation root)
        if reply_id == tweet_id:
            continue
        if not reply_id:
            continue
        # Skip non-reply items that may appear in conversation search
        if item.get("isReply") is False:
            continue

        text = item.get("text") or item.get("full_text") or item.get("tweetText") or ""
        if not text:
            continue

        author = item.get("author") or item.get("user") or {}
        author_username = (
            author.get("userName") or author.get("screen_name")
            or item.get("author_name") or ""
        )
        author_name = (
            author.get("name") or author.get("displayname")
            or author_username
        )

        timestamp = item.get("createdAt") or item.get("created_at") or item.get("timestamp") or ""

        normalized.append({
            "platform_comment_id": reply_id,
            "text": text,
            "username": author_username.lstrip("@") if author_username else "",
            "author_name": author_name,
            "like_count": _safe_int(item.get("likeCount") or item.get("likes") or item.get("favorite_count") or 0),
            "timestamp": str(timestamp),
            # Demographics data from the reply author
            "_author": author,
            "_raw": item,
        })

    logger.info("Twitter: Fetched %d replies for tweet %s", len(normalized), tweet_id)
    return normalized


# ---------------------------------------------------------------------------
# Demographics: save commenter profiles from reply author data
# ---------------------------------------------------------------------------

def _save_twitter_commenter_profiles(db: Session, replies: list[dict]) -> int:
    """Extract and save commenter profiles from Twitter reply author data.

    The tweet-scraper actor returns author info (name, bio, location, followers)
    with each tweet/reply. We save this directly to commenter_profiles with
    platform='twitter', so the existing LLM inference pipeline can enrich them.

    Returns number of profiles saved/updated.
    """
    saved_count = 0

    for reply in replies:
        author = reply.get("_author", {})
        username = (
            author.get("userName") or author.get("screen_name")
            or reply.get("username") or ""
        )
        if not username:
            continue
        username = username.lstrip("@").lower().strip()
        if not username:
            continue

        # Upsert: check if profile exists for this username+platform
        profile = (
            db.query(CommenterProfile)
            .filter(
                func.lower(CommenterProfile.username) == username,
                CommenterProfile.platform == "twitter",
            )
            .first()
        )

        if not profile:
            profile = CommenterProfile(username=username, platform="twitter")
            db.add(profile)

        profile.full_name = (
            author.get("name") or author.get("displayname") or reply.get("author_name")
        )
        profile.biography = author.get("description") or author.get("rawDescription")
        profile.location_field = author.get("location") or None
        profile.followers_count = _safe_int(author.get("followers") or author.get("followersCount") or 0)
        profile.following_count = _safe_int(author.get("following") or author.get("friendsCount") or 0)
        profile.profile_pic_url_hd = author.get("profileImageUrl") or author.get("profilePicUrl")
        profile.website = author.get("url") or None
        profile.raw_payload = {
            "source": "tweet_reply_author",
            "author_data": author,
        }
        profile.scraped_at = datetime.now(timezone.utc)

        saved_count += 1

    if saved_count > 0:
        try:
            db.flush()
            logger.info("Twitter demographics: %d commenter profiles saved/updated", saved_count)
        except Exception as exc:
            logger.error("Twitter demographics: failed to save profiles: %s", exc)
            db.rollback()
            return 0

    return saved_count


# ---------------------------------------------------------------------------
# Main ingestion
# ---------------------------------------------------------------------------

def ingest_twitter_profile(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 10,
    max_comments_per_post: int = 100,
) -> dict:
    """Full ingestion: fetch tweets + replies and save to DB.

    Also extracts commenter profiles for demographics from reply author data.
    """
    username = connection.username
    if username.startswith("@"):
        username = username[1:]

    raw_posts = fetch_twitter_posts(username, max_posts)
    if not raw_posts:
        logger.warning("Twitter: No posts fetched for @%s", username)
        return {"posts_fetched": 0, "comments_fetched": 0, "profiles_saved": 0}

    posts_fetched = 0
    comments_fetched = 0
    all_replies_for_demographics: list[dict] = []

    for raw_post in raw_posts:
        post_id = raw_post["platform_post_id"]
        if not post_id:
            continue

        content = raw_post.get("content", "")
        content_clean = _clean_text(content)

        # Parse timestamp
        published_at = None
        ts = raw_post.get("timestamp", "")
        if ts:
            try:
                published_at = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                # Try other common formats
                for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ"):
                    try:
                        published_at = datetime.strptime(ts, fmt)
                        if published_at.tzinfo is None:
                            published_at = published_at.replace(tzinfo=timezone.utc)
                        break
                    except (ValueError, TypeError):
                        continue

        existing_post = (
            db.query(Post)
            .filter(
                Post.connection_id == connection.id,
                Post.platform_post_id == post_id,
                Post.platform == "twitter",
            )
            .first()
        )

        if existing_post:
            existing_post.content_text = content
            existing_post.content_clean = content_clean
            existing_post.like_count = raw_post.get("like_count", 0)
            existing_post.comment_count = raw_post.get("reply_count", 0)
            existing_post.share_count = raw_post.get("retweet_count", 0)
            existing_post.view_count = raw_post.get("view_count", 0)
            existing_post.published_at = published_at
            existing_post.post_url = raw_post.get("permalink", "")
            existing_post.raw_payload = raw_post.get("_raw", raw_post)
            existing_post.fetched_at = datetime.now(timezone.utc)
            post = existing_post
        else:
            post = Post(
                connection_id=connection.id,
                platform="twitter",
                platform_post_id=post_id,
                post_type="tweet",
                content_text=content,
                content_clean=content_clean,
                media_urls=None,
                like_count=raw_post.get("like_count", 0),
                comment_count=raw_post.get("reply_count", 0),
                share_count=raw_post.get("retweet_count", 0),
                view_count=raw_post.get("view_count", 0),
                published_at=published_at,
                post_url=raw_post.get("permalink", ""),
                raw_payload=raw_post.get("_raw", raw_post),
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)

        db.flush()
        posts_fetched += 1

        # Fetch replies (skip if tweet has no replies to save API calls)
        reply_count = raw_post.get("reply_count", 0)
        if reply_count == 0:
            logger.debug("Twitter: Skipping replies for tweet %s (reply_count=0)", post_id)
            replies = []
        else:
            conversation_id = raw_post.get("conversation_id", post_id)
            tweet_url = raw_post.get("permalink", "")
            replies = fetch_tweet_comments(conversation_id, tweet_url, max_comments_per_post)

        for reply in replies:
            text_original = reply.get("text", "")
            text_clean = _clean_text(text_original)
            text_hash = _hash(text_clean)

            comment_id = reply.get("platform_comment_id", "")
            if not comment_id:
                continue

            # Parse reply timestamp
            reply_published_at = None
            reply_ts = reply.get("timestamp", "")
            if reply_ts:
                try:
                    reply_published_at = datetime.fromisoformat(reply_ts.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ"):
                        try:
                            reply_published_at = datetime.strptime(reply_ts, fmt)
                            if reply_published_at.tzinfo is None:
                                reply_published_at = reply_published_at.replace(tzinfo=timezone.utc)
                            break
                        except (ValueError, TypeError):
                            continue

            existing_comment = (
                db.query(Comment)
                .filter(
                    Comment.post_id == post.id,
                    Comment.platform_comment_id == comment_id,
                )
                .first()
            )

            if existing_comment:
                existing_comment.author_name = reply.get("author_name", "")
                existing_comment.author_username = reply.get("username", "")
                existing_comment.like_count = reply.get("like_count", 0)
                existing_comment.text_original = text_original
                existing_comment.text_clean = text_clean
                existing_comment.text_hash = text_hash
                existing_comment.published_at = reply_published_at
                existing_comment.raw_payload = reply.get("_raw", reply)
            else:
                comment = Comment(
                    post_id=post.id,
                    connection_id=connection.id,
                    platform="twitter",
                    platform_comment_id=comment_id,
                    parent_comment_id=None,
                    source_type="comment",
                    author_name=reply.get("author_name", ""),
                    author_username=reply.get("username", ""),
                    author_profile_url=None,
                    like_count=reply.get("like_count", 0),
                    reply_count=0,
                    published_at=reply_published_at,
                    text_original=text_original,
                    text_clean=text_clean,
                    text_hash=text_hash,
                    raw_payload=reply.get("_raw", reply),
                    status="pending",
                )
                db.add(comment)
            comments_fetched += 1

        # Collect replies for demographics
        all_replies_for_demographics.extend(replies)

    # Save commenter profiles for demographics (from reply author data)
    profiles_saved = _save_twitter_commenter_profiles(db, all_replies_for_demographics)

    connection.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(
        "Twitter @%s: %d posts, %d comments ingested, %d profiles saved",
        username, posts_fetched, comments_fetched, profiles_saved,
    )
    return {
        "posts_fetched": posts_fetched,
        "comments_fetched": comments_fetched,
        "profiles_saved": profiles_saved,
    }
