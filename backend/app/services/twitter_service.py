"""
Twitter ingestion service.

Uses XPoz MCP tools to discover profiles, fetch tweets, and fetch replies/comments.
XPoz tools used:
  - getTwitterUser      → profile info
  - getTwitterPostsByAuthor → list of recent tweets
  - getTwitterPostComments  → replies for each tweet
"""

import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip())


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _parse_xpoz_text(text: str) -> dict:
    """Parse key:value lines returned by XPoz tools."""
    result = {}
    for line in text.split("\n"):
        s = line.strip()
        if ":" in s and not s.startswith("#"):
            k, _, v = s.partition(":")
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


def _xpoz_call(name: str, arguments: dict) -> dict:
    from app.services.xpoz_service import _call_mcp, _get_text
    res = _call_mcp(name, arguments)
    return {"raw": res, "text": _get_text(res)}


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").strip())
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Profile discovery
# ---------------------------------------------------------------------------

def get_twitter_profile(username: str) -> Optional[dict]:
    """Fetch Twitter profile via XPoz getTwitterUser, parsed by LLM."""
    if username.startswith("@"):
        username = username[1:]

    res = _xpoz_call("getTwitterUser", {
        "identifier": username,
        "identifierType": "username",
        "fields": [
            "id", "username", "name", "description",
            "followersCount", "followingCount",
            "verified", "profileImageUrl"
        ],
        "userPrompt": f"Get Twitter profile for @{username}",
    })

    text = res.get("text", "")
    from app.services.xpoz_parser_llm import parse_xpoz_data_with_llm, XpozProfile
    prof = parse_xpoz_data_with_llm(text, XpozProfile)

    if not prof.get("username"):
        logger.warning(f"XPoz could not find Twitter user @{username}. Response: {text[:200]}")
        return None

    return {
        "id": prof.get("id", ""),
        "username": prof.get("username", username),
        "name": prof.get("name", username),
        "description": prof.get("description", ""),
        "followers_count": _safe_int(prof.get("followers", 0)),
        "following_count": _safe_int(prof.get("following", 0)),
        "tweets_count": _safe_int(prof.get("media_count", 0)),
        "profile_image_url": prof.get("profile_url", ""),
        "url": f"https://twitter.com/{username}",
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
    logger.info(f"Twitter connection created for @{username}")
    return conn


# ---------------------------------------------------------------------------
# Posts fetch
# ---------------------------------------------------------------------------

def fetch_twitter_posts(username: str, max_posts: int = 10) -> list[dict]:
    """Fetch recent tweets from a user via XPoz getTwitterPostsByAuthor, parsed by LLM."""
    if username.startswith("@"):
        username = username[1:]

    res = _xpoz_call("getTwitterPostsByAuthor", {
        "identifier": username,
        "identifierType": "username",
        "limit": max_posts,
        "userPrompt": f"Get recent tweets from @{username}",
    })

    text = res.get("text", "")
    from app.services.xpoz_parser_llm import parse_xpoz_data_with_llm, ListOfPosts
    data = parse_xpoz_data_with_llm(text, ListOfPosts)

    normalized = []
    for p in data.get("items", []):
        post_id = str(p.get("id", ""))
        if not post_id: continue
        
        normalized.append({
            "platform_post_id": post_id,
            "post_type": "tweet",
            "content": p.get("text", ""),
            "permalink": p.get("url", f"https://twitter.com/{username}/status/{post_id}"),
            "like_count": _safe_int(p.get("likes", 0)),
            "reply_count": _safe_int(p.get("comments", 0)),
            "retweet_count": 0,
            "view_count": _safe_int(p.get("views", 0)),
            "timestamp": str(p.get("timestamp", "")),
        })

    logger.info(f"Fetched {len(normalized)} tweets for @{username}")
    return normalized


# ---------------------------------------------------------------------------
# Comments (replies) fetch
# ---------------------------------------------------------------------------

def fetch_tweet_comments(tweet_id: str, max_comments: int = 100) -> list[dict]:
    """Fetch replies for a tweet via XPoz getTwitterPostComments, parsed by LLM."""
    res = _xpoz_call("getTwitterPostComments", {
        "postId": tweet_id,
        "limit": max_comments,
        "userPrompt": f"Get comments/replies for tweet {tweet_id}",
    })

    text = res.get("text", "")
    from app.services.xpoz_parser_llm import parse_xpoz_data_with_llm, ListOfComments
    data = parse_xpoz_data_with_llm(text, ListOfComments)

    normalized = []
    for c in data.get("items", []):
        text_val = c.get("text", "")
        if not text_val: continue
        
        normalized.append({
            "platform_comment_id": str(c.get("id", "")),
            "text": text_val,
            "username": c.get("username", ""),
            "author_name": c.get("username", ""),
            "like_count": _safe_int(c.get("likes", 0)),
            "timestamp": str(c.get("timestamp", "")),
        })

    logger.info(f"Fetched {len(normalized)} replies for tweet {tweet_id}")
    return normalized


# ---------------------------------------------------------------------------
# Main ingestion
# ---------------------------------------------------------------------------

def ingest_twitter_profile(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 10,
    max_comments_per_post: int = 100,
) -> dict:
    """Full ingestion: fetch tweets + replies and save to DB."""
    username = connection.username
    if username.startswith("@"):
        username = username[1:]

    raw_posts = fetch_twitter_posts(username, max_posts)
    if not raw_posts:
        logger.warning(f"No posts fetched for Twitter @{username}")
        return {"posts_fetched": 0, "comments_fetched": 0}

    posts_fetched = 0
    comments_fetched = 0

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
                pass

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
            existing_post.raw_payload = raw_post
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
                raw_payload=raw_post,
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)

        db.flush()
        posts_fetched += 1

        # Fetch replies
        replies = fetch_tweet_comments(post_id, max_comments_per_post)
        for reply in replies:
            text_original = reply.get("text", "")
            text_clean = _clean_text(text_original)
            text_hash = _hash(text_clean)

            comment_id = reply.get("platform_comment_id", "")
            if not comment_id:
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
                existing_comment.raw_payload = reply
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
                    published_at=None,
                    text_original=text_original,
                    text_clean=text_clean,
                    text_hash=text_hash,
                    raw_payload=reply,
                    status="pending",
                )
                db.add(comment)
            comments_fetched += 1

    connection.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"Twitter @{username}: {posts_fetched} posts, {comments_fetched} comments ingested")
    return {"posts_fetched": posts_fetched, "comments_fetched": comments_fetched}
