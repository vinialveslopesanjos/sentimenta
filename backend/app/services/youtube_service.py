"""
YouTube ingestion service.

Uses YouTube Data API v3 (primary) with yt-dlp fallback.
API costs: ~1 unit per call (avoid search.list which costs 100 units).
Daily quota: 10,000 units.
"""

import logging
import re
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection
from app.models.demographics import CommenterProfile

logger = logging.getLogger(__name__)

YT_API_BASE = "https://www.googleapis.com/youtube/v3"


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Basic text cleaning: strip, collapse whitespace."""
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _use_api() -> bool:
    """Check if YouTube Data API should be used."""
    return bool(settings.YOUTUBE_API_KEY) and settings.YOUTUBE_USE_API


def _api_get(endpoint: str, params: dict, timeout: float = 30.0) -> dict:
    """Make a GET request to YouTube Data API v3."""
    params["key"] = settings.YOUTUBE_API_KEY
    url = f"{YT_API_BASE}/{endpoint}"
    resp = httpx.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# yt-dlp fallback functions (prefixed with _ytdlp_)
# ---------------------------------------------------------------------------

def _ytdlp_discover_channel_info(channel_handle: str) -> dict | None:
    """Return basic channel information using yt-dlp, or None if not found."""
    import yt_dlp

    if not channel_handle.startswith("@"):
        channel_handle = f"@{channel_handle}"

    channel_url = f"https://www.youtube.com/{channel_handle}/videos"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlist_items": "1",
        "skip_download": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            if not info:
                return None

            entries = info.get("entries", [])
            if not entries:
                return None

            channel_id = info.get("channel_id") or info.get("uploader_id")
            channel_title = info.get("channel") or info.get("uploader") or channel_handle

            return {
                "channel_id": channel_id,
                "channel_title": channel_title,
                "description": "",
                "subscriber_count": 0,
                "custom_url": channel_handle,
                "thumbnail_url": "",
            }
    except Exception as e:
        logger.warning("yt-dlp discover_channel_info error: %s", e)
        return None


def _ytdlp_get_video_info(video_id: str) -> dict:
    """Fetch metadata for a single video using yt-dlp."""
    import yt_dlp

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return {
                "video_id": video_id,
                "title": info.get("title", ""),
                "description": info.get("description", ""),
                "channel_id": info.get("channel_id"),
                "channel_title": info.get("uploader") or info.get("channel"),
                "like_count": info.get("like_count", 0) or 0,
                "view_count": info.get("view_count", 0) or 0,
                "comment_count": info.get("comment_count", 0) or 0,
                "published_at": info.get("upload_date"),  # YYYYMMDD
                "thumbnail_url": info.get("thumbnail", ""),
            }
    except Exception:
        return {}


def _ytdlp_fetch_comments(video_id: str, max_comments: int = 100) -> list[dict]:
    """Fetch comments for a video using yt-dlp."""
    import yt_dlp

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "getcomments": True,
        "extractor_args": {
            "youtube": {
                "max_comments": [str(max_comments)],
                "comment_sort": ["top"],
            }
        },
    }

    comments = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            raw_comments = info.get("comments") or []
            for c in raw_comments[:max_comments]:
                text = c.get("text", "")
                if not text:
                    continue
                comments.append({
                    "comment_id": c.get("id", ""),
                    "text": text,
                    "author_name": c.get("author", ""),
                    "author_channel_id": c.get("author_id", ""),
                    "like_count": c.get("like_count", 0) or 0,
                    "reply_count": c.get("reply_count", 0) or 0,
                    "published_at": None,
                    "raw_payload": c,
                })
    except Exception as e:
        logger.warning("yt-dlp fetch_comments error: %s", e)

    return comments


# ---------------------------------------------------------------------------
# YouTube Data API v3 functions
# ---------------------------------------------------------------------------

def _parse_channel_input(channel_input: str) -> tuple[str, str]:
    """Parse a channel input (URL, @handle, or ID) into (type, value).

    Returns: ("handle", "@name") or ("id", "UCxxx") or ("username", "name")
    """
    channel_input = channel_input.strip()

    # URL patterns
    url_patterns = [
        # https://www.youtube.com/@handle
        (r"youtube\.com/@([^/\s?]+)", "handle"),
        # https://www.youtube.com/channel/UCxxx
        (r"youtube\.com/channel/([^/\s?]+)", "id"),
        # https://www.youtube.com/c/CustomName or /user/Username
        (r"youtube\.com/(?:c|user)/([^/\s?]+)", "username"),
    ]

    for pattern, ptype in url_patterns:
        m = re.search(pattern, channel_input)
        if m:
            val = m.group(1)
            if ptype == "handle":
                return ("handle", f"@{val}")
            return (ptype, val)

    # Direct @handle
    if channel_input.startswith("@"):
        return ("handle", channel_input)

    # Looks like a channel ID (starts with UC)
    if channel_input.startswith("UC") and len(channel_input) == 24:
        return ("id", channel_input)

    # Assume it's a handle without @
    return ("handle", f"@{channel_input}")


def discover_channel_info(channel_input: str) -> dict | None:
    """Discover channel_id from a username, URL, or @handle.

    Returns: dict with channel_id, title, description, subscriber_count,
             custom_url, thumbnail_url  — or None if not found.
    """
    if not _use_api():
        return _ytdlp_discover_channel_info(channel_input)

    try:
        input_type, value = _parse_channel_input(channel_input)

        if input_type == "id":
            data = _api_get("channels", {
                "part": "snippet,statistics",
                "id": value,
            })
        elif input_type == "handle":
            data = _api_get("channels", {
                "part": "snippet,statistics",
                "forHandle": value.lstrip("@"),
            })
        else:
            # username — try forHandle first
            data = _api_get("channels", {
                "part": "snippet,statistics",
                "forHandle": value,
            })

        items = data.get("items", [])
        if not items:
            logger.warning("YouTube API: channel not found for input '%s'", channel_input)
            # Fallback to yt-dlp
            return _ytdlp_discover_channel_info(channel_input)

        ch = items[0]
        snippet = ch.get("snippet", {})
        stats = ch.get("statistics", {})

        return {
            "channel_id": ch["id"],
            "title": snippet.get("title", ""),
            "channel_title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "subscriber_count": int(stats.get("subscriberCount", 0)),
            "custom_url": snippet.get("customUrl", ""),
            "thumbnail_url": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
        }

    except Exception as e:
        logger.warning("YouTube API discover_channel_info error: %s — falling back to yt-dlp", e)
        return _ytdlp_discover_channel_info(channel_input)


def fetch_youtube_videos(channel_id: str, max_videos: int = 10) -> list[dict]:
    """List the latest N videos for a channel.

    Uses the uploads playlist (cheap: 1 unit per page of 50).
    Does NOT use search.list (100 units!).

    Returns: list of {video_id, title, description, published_at, thumbnail_url}
    """
    if not _use_api():
        # yt-dlp fallback: only return latest video
        info = _ytdlp_discover_channel_info(channel_id)
        if info and info.get("channel_id"):
            # We can't easily list multiple videos with yt-dlp in a cheap way
            return []
        return []

    try:
        # Step 1: Get the uploads playlist ID
        ch_data = _api_get("channels", {
            "part": "contentDetails",
            "id": channel_id,
        })
        items = ch_data.get("items", [])
        if not items:
            logger.warning("YouTube API: no channel found for ID %s", channel_id)
            return []

        uploads_playlist_id = (
            items[0]
            .get("contentDetails", {})
            .get("relatedPlaylists", {})
            .get("uploads")
        )
        if not uploads_playlist_id:
            logger.warning("YouTube API: no uploads playlist for channel %s", channel_id)
            return []

        # Step 2: Fetch playlist items (paginated, 50 per page)
        videos = []
        next_page_token = None
        remaining = max_videos

        while remaining > 0:
            page_size = min(remaining, 50)
            params = {
                "part": "snippet",
                "playlistId": uploads_playlist_id,
                "maxResults": page_size,
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            pl_data = _api_get("playlistItems", params)

            for item in pl_data.get("items", []):
                snippet = item.get("snippet", {})
                resource = snippet.get("resourceId", {})
                vid_id = resource.get("videoId")
                if not vid_id:
                    continue

                videos.append({
                    "video_id": vid_id,
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "thumbnail_url": (
                        snippet.get("thumbnails", {}).get("high", {}).get("url")
                        or snippet.get("thumbnails", {}).get("default", {}).get("url", "")
                    ),
                })
                remaining -= 1
                if remaining <= 0:
                    break

            next_page_token = pl_data.get("nextPageToken")
            if not next_page_token:
                break

        logger.info("YouTube API: fetched %d videos for channel %s", len(videos), channel_id)
        return videos

    except Exception as e:
        logger.error("YouTube API fetch_youtube_videos error: %s", e)
        return []


def _fetch_video_statistics(video_ids: list[str]) -> dict[str, dict]:
    """Fetch statistics for a batch of video IDs (up to 50 at a time).

    Returns: {video_id: {view_count, like_count, comment_count}}
    """
    if not _use_api() or not video_ids:
        return {}

    result = {}
    # Batch in groups of 50
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        try:
            data = _api_get("videos", {
                "part": "statistics",
                "id": ",".join(batch),
            })
            for item in data.get("items", []):
                stats = item.get("statistics", {})
                result[item["id"]] = {
                    "view_count": int(stats.get("viewCount", 0)),
                    "like_count": int(stats.get("likeCount", 0)),
                    "comment_count": int(stats.get("commentCount", 0)),
                }
        except Exception as e:
            logger.warning("YouTube API fetch video statistics error: %s", e)

    return result


def fetch_youtube_comments(video_id: str, max_comments: int = 500) -> list[dict]:
    """Fetch comments for a video using commentThreads.list.

    Cost: 1 unit per page of 100 comments.

    Returns: list of {comment_id, text, author_name, author_channel_id,
             like_count, reply_count, published_at}
    """
    if not _use_api():
        return _ytdlp_fetch_comments(video_id, max_comments)

    comments = []
    next_page_token = None

    try:
        while len(comments) < max_comments:
            page_size = min(100, max_comments - len(comments))
            params = {
                "part": "snippet,replies",
                "videoId": video_id,
                "maxResults": page_size,
                "order": "relevance",
                "textFormat": "plainText",
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            data = _api_get("commentThreads", params)

            for thread in data.get("items", []):
                # Top-level comment
                top = thread.get("snippet", {}).get("topLevelComment", {})
                top_snippet = top.get("snippet", {})
                text = top_snippet.get("textDisplay", "")
                if not text:
                    continue

                author_channel = top_snippet.get("authorChannelId", {})
                author_channel_id = author_channel.get("value", "") if isinstance(author_channel, dict) else ""

                published_str = top_snippet.get("publishedAt", "")
                published_at = None
                if published_str:
                    try:
                        published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass

                comments.append({
                    "comment_id": top.get("id", ""),
                    "text": text,
                    "author_name": top_snippet.get("authorDisplayName", ""),
                    "author_channel_id": author_channel_id,
                    "like_count": top_snippet.get("likeCount", 0),
                    "reply_count": thread.get("snippet", {}).get("totalReplyCount", 0),
                    "published_at": published_at,
                })

                if len(comments) >= max_comments:
                    break

                # Include replies if present
                replies = thread.get("replies", {}).get("comments", [])
                for reply in replies:
                    if len(comments) >= max_comments:
                        break
                    r_snippet = reply.get("snippet", {})
                    r_text = r_snippet.get("textDisplay", "")
                    if not r_text:
                        continue

                    r_author_channel = r_snippet.get("authorChannelId", {})
                    r_author_channel_id = r_author_channel.get("value", "") if isinstance(r_author_channel, dict) else ""

                    r_published_str = r_snippet.get("publishedAt", "")
                    r_published_at = None
                    if r_published_str:
                        try:
                            r_published_at = datetime.fromisoformat(r_published_str.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            pass

                    comments.append({
                        "comment_id": reply.get("id", ""),
                        "text": r_text,
                        "author_name": r_snippet.get("authorDisplayName", ""),
                        "author_channel_id": r_author_channel_id,
                        "like_count": r_snippet.get("likeCount", 0),
                        "reply_count": 0,
                        "published_at": r_published_at,
                    })

            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            logger.warning("YouTube API: comments disabled for video %s", video_id)
        else:
            logger.error("YouTube API fetch_youtube_comments HTTP error: %s", e)
    except Exception as e:
        logger.error("YouTube API fetch_youtube_comments error: %s", e)

    logger.info("YouTube API: fetched %d comments for video %s", len(comments), video_id)
    return comments


def fetch_channel_profiles(channel_ids: list[str]) -> list[dict]:
    """Fetch profiles for a batch of channel IDs (for demographics).

    Uses channels.list with batches of 50 IDs.
    Cost: 1 unit per batch of 50.

    Returns: list of {channel_id, title, description, country, subscriber_count, thumbnail_url}
    """
    if not _use_api() or not channel_ids:
        return []

    profiles = []
    # Deduplicate and filter empty
    unique_ids = list(set(cid for cid in channel_ids if cid))

    for i in range(0, len(unique_ids), 50):
        batch = unique_ids[i : i + 50]
        try:
            data = _api_get("channels", {
                "part": "snippet,statistics",
                "id": ",".join(batch),
            })
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                profiles.append({
                    "channel_id": item["id"],
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "country": snippet.get("country", ""),
                    "subscriber_count": int(stats.get("subscriberCount", 0)),
                    "thumbnail_url": (
                        snippet.get("thumbnails", {}).get("default", {}).get("url", "")
                    ),
                })
        except Exception as e:
            logger.warning("YouTube API fetch_channel_profiles error for batch: %s", e)

    logger.info("YouTube API: fetched %d channel profiles", len(profiles))
    return profiles


# ---------------------------------------------------------------------------
# Commenter profile saving
# ---------------------------------------------------------------------------

def _save_commenter_profiles(
    db: Session,
    comments: list[dict],
    channel_profiles: list[dict] | None = None,
) -> int:
    """Save commenter data into commenter_profiles with platform='youtube'.

    Uses author_channel_id as the username (unique identifier on YouTube).
    If channel_profiles are provided, enriches with channel metadata.

    Returns: number of profiles saved/updated.
    """
    # Build lookup of channel profiles
    profile_lookup = {}
    if channel_profiles:
        for p in channel_profiles:
            profile_lookup[p["channel_id"]] = p

    saved = 0
    seen = set()

    for comment in comments:
        author_channel_id = comment.get("author_channel_id", "")
        if not author_channel_id or author_channel_id in seen:
            continue
        seen.add(author_channel_id)

        # Check if profile already exists
        existing = (
            db.query(CommenterProfile)
            .filter(
                CommenterProfile.username == author_channel_id,
                CommenterProfile.platform == "youtube",
            )
            .first()
        )

        channel_data = profile_lookup.get(author_channel_id, {})
        full_name = channel_data.get("title") or comment.get("author_name", "")
        description = channel_data.get("description", "")
        country = channel_data.get("country", "")
        subscriber_count = channel_data.get("subscriber_count")
        thumbnail = channel_data.get("thumbnail_url", "")

        if existing:
            existing.full_name = full_name
            if description:
                existing.biography = description
            if country:
                existing.location_field = country
            if subscriber_count is not None:
                existing.followers_count = subscriber_count
            if thumbnail:
                existing.profile_pic_url_hd = thumbnail
            existing.scraped_at = datetime.now(timezone.utc)
        else:
            profile = CommenterProfile(
                username=author_channel_id,
                platform="youtube",
                full_name=full_name,
                biography=description,
                location_field=country,
                profile_pic_url_hd=thumbnail,
                followers_count=subscriber_count,
                following_count=None,
                is_business=False,
                category=None,
                website=None,
                raw_payload=channel_data if channel_data else None,
                scraped_at=datetime.now(timezone.utc),
            )
            db.add(profile)

        saved += 1

    return saved


# ---------------------------------------------------------------------------
# Main ingestion function
# ---------------------------------------------------------------------------

async def ingest_youtube_channel(
    db: Session,
    connection_id: uuid.UUID,
    max_posts: int = 10,
    max_comments_per_post: int = 500,
    progress_callback=None,
    step_callback=None,
    mode: str = "full",
    **kwargs,
) -> dict:
    """Ingest videos and comments for a YouTube connection.

    Compatible with the pipeline signature used by _do_ingest().
    Supports both YouTube Data API v3 (primary) and yt-dlp (fallback).
    """

    # -- 1. Retrieve connection
    connection: SocialConnection | None = db.get(SocialConnection, connection_id)
    if connection is None:
        raise ValueError(f"SocialConnection {connection_id} not found")

    channel_handle = connection.username
    channel_id = connection.platform_user_id

    if step_callback:
        step_callback(f"Buscando canal YouTube: {channel_handle}")

    # -- Daily mode: only check last 5 videos
    if mode == "daily":
        return await _ingest_youtube_daily(
            db, connection, connection_id, channel_handle, channel_id,
            max_comments_per_post=max_comments_per_post,
            progress_callback=progress_callback,
            step_callback=step_callback,
        )

    # -- 2. Discover channel info if we don't have a channel_id yet
    if not channel_id:
        info = discover_channel_info(channel_handle)
        if not info or not info.get("channel_id"):
            raise RuntimeError(
                f"Could not discover channel info for {channel_handle}"
            )
        channel_id = info["channel_id"]
        # Update the connection with the discovered channel_id
        connection.platform_user_id = channel_id
        connection.display_name = info.get("channel_title") or info.get("title") or channel_handle
        db.flush()

    # -- 3. Fetch videos
    if step_callback:
        step_callback(f"Buscando últimos {max_posts} vídeos...")

    if _use_api():
        videos = fetch_youtube_videos(channel_id, max_videos=max_posts)
    else:
        # yt-dlp fallback: fetch just the latest video
        info = discover_channel_info(channel_handle)
        videos = []
        if info and info.get("channel_id"):
            # Use yt-dlp to get latest video info
            vid_info = _ytdlp_get_video_info(info.get("latest_video_id", "")) if hasattr(info, "get") and info.get("latest_video_id") else {}
            if vid_info:
                videos = [{
                    "video_id": info.get("latest_video_id", ""),
                    "title": vid_info.get("title", ""),
                    "description": vid_info.get("description", ""),
                    "published_at": vid_info.get("published_at", ""),
                    "thumbnail_url": vid_info.get("thumbnail_url", ""),
                }]

    if not videos:
        logger.warning("No videos found for channel %s (%s)", channel_handle, channel_id)
        return {"posts_fetched": 0, "comments_fetched": 0}

    # Fetch video statistics in batch (for API mode)
    video_ids = [v["video_id"] for v in videos]
    video_stats = _fetch_video_statistics(video_ids)

    # -- 4. Process each video
    posts_fetched = 0
    comments_fetched = 0
    all_comments_for_profiles = []

    for idx, video in enumerate(videos):
        video_id = video["video_id"]
        title = video.get("title", "")
        title_clean = clean_text(title)

        # Parse published_at
        published_at = None
        raw_date = video.get("published_at", "")
        if raw_date:
            try:
                if "T" in str(raw_date):
                    # ISO format from API
                    published_at = datetime.fromisoformat(
                        str(raw_date).replace("Z", "+00:00")
                    )
                elif len(str(raw_date)) == 8:
                    # YYYYMMDD from yt-dlp
                    published_at = datetime.strptime(str(raw_date), "%Y%m%d").replace(
                        tzinfo=timezone.utc
                    )
            except (ValueError, TypeError):
                pass

        # Get stats
        stats = video_stats.get(video_id, {})
        view_count = stats.get("view_count", 0)
        like_count = stats.get("like_count", 0)
        comment_count = stats.get("comment_count", 0)

        thumbnail_url = video.get("thumbnail_url", "")

        # Upsert Post
        existing_post = (
            db.query(Post)
            .filter(
                Post.connection_id == connection_id,
                Post.platform_post_id == video_id,
                Post.platform == "youtube",
            )
            .first()
        )

        raw_payload = {
            "video_id": video_id,
            "title": title,
            "description": video.get("description", ""),
            "view_count": view_count,
            "like_count": like_count,
            "comment_count": comment_count,
        }

        if existing_post:
            existing_post.content_text = title
            existing_post.content_clean = title_clean
            existing_post.like_count = like_count
            existing_post.comment_count_api = comment_count
            existing_post.view_count = view_count
            existing_post.published_at = published_at
            existing_post.raw_payload = raw_payload
            existing_post.media_urls = {"thumbnail_url": thumbnail_url} if thumbnail_url else None
            existing_post.fetched_at = datetime.now(timezone.utc)
            post = existing_post
        else:
            post = Post(
                connection_id=connection_id,
                platform="youtube",
                platform_post_id=video_id,
                post_type="video",
                content_text=title,
                content_clean=title_clean,
                media_urls={"thumbnail_url": thumbnail_url} if thumbnail_url else None,
                like_count=like_count,
                comment_count=0,
                comment_count_api=comment_count,
                share_count=0,
                view_count=view_count,
                published_at=published_at,
                post_url=f"https://www.youtube.com/watch?v={video_id}",
                raw_payload=raw_payload,
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)

        db.flush()
        posts_fetched += 1

        # -- 5. Fetch comments for this video
        if step_callback:
            step_callback(f"Buscando comentários do vídeo {idx + 1}/{len(videos)}: {title[:50]}...")

        raw_comments = fetch_youtube_comments(video_id, max_comments=max_comments_per_post)

        video_comments_saved = 0
        for raw_comment in raw_comments:
            text_original = raw_comment.get("text", "")
            text_cleaned = clean_text(text_original)
            text_hash = compute_hash(text_cleaned)

            platform_comment_id = raw_comment.get("comment_id", "")
            if not platform_comment_id:
                continue

            author_channel_id = raw_comment.get("author_channel_id", "")
            comment_published_at = raw_comment.get("published_at")

            # Sanitize raw_payload: convert datetime objects to ISO strings for JSON serialization
            serializable_payload = {
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in raw_comment.items()
            }

            existing_comment = (
                db.query(Comment)
                .filter(
                    Comment.post_id == post.id,
                    Comment.platform_comment_id == platform_comment_id,
                )
                .first()
            )

            author_display_name = raw_comment.get("author_name", "") or author_channel_id

            if existing_comment:
                existing_comment.author_name = raw_comment.get("author_name")
                existing_comment.author_username = author_display_name
                existing_comment.like_count = raw_comment.get("like_count", 0)
                existing_comment.reply_count = raw_comment.get("reply_count", 0)
                existing_comment.text_original = text_original
                existing_comment.text_clean = text_cleaned
                existing_comment.text_hash = text_hash
                existing_comment.published_at = comment_published_at
                existing_comment.raw_payload = serializable_payload
            else:
                comment = Comment(
                    post_id=post.id,
                    connection_id=connection_id,
                    platform="youtube",
                    platform_comment_id=platform_comment_id,
                    parent_comment_id=None,
                    source_type="comment",
                    author_name=raw_comment.get("author_name"),
                    author_username=author_display_name,
                    author_profile_url=(
                        f"https://www.youtube.com/channel/{author_channel_id}"
                        if author_channel_id else None
                    ),
                    like_count=raw_comment.get("like_count", 0),
                    reply_count=raw_comment.get("reply_count", 0),
                    published_at=comment_published_at,
                    text_original=text_original,
                    text_clean=text_cleaned,
                    text_hash=text_hash,
                    raw_payload=serializable_payload,
                    status="pending",
                )
                db.add(comment)

            video_comments_saved += 1

        comments_fetched += video_comments_saved
        all_comments_for_profiles.extend(raw_comments)

        # Report progress
        if progress_callback:
            progress_callback(posts_fetched, comments_fetched)

        if step_callback:
            step_callback(
                f"Vídeo {idx + 1}/{len(videos)}: {video_comments_saved} comentários extraídos"
            )

    # -- 6. Save commenter profiles for demographics
    if all_comments_for_profiles:
        if step_callback:
            step_callback("Salvando perfis de comentaristas...")

        # Collect unique author channel IDs for profile fetching
        author_channel_ids = list(set(
            c.get("author_channel_id", "")
            for c in all_comments_for_profiles
            if c.get("author_channel_id")
        ))

        # Fetch channel profiles in batch (for demographics)
        channel_profiles = []
        if _use_api() and author_channel_ids:
            try:
                channel_profiles = fetch_channel_profiles(author_channel_ids)
            except Exception as e:
                logger.warning("Failed to fetch channel profiles for demographics: %s", e)

        profiles_saved = _save_commenter_profiles(db, all_comments_for_profiles, channel_profiles)
        logger.info("Saved %d commenter profiles for YouTube", profiles_saved)

    # -- 7. Update sync timestamp
    connection.last_sync_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "posts_fetched": posts_fetched,
        "comments_fetched": comments_fetched,
    }


async def _ingest_youtube_daily(
    db: Session,
    connection: SocialConnection,
    connection_id: uuid.UUID,
    channel_handle: str,
    channel_id: str,
    max_comments_per_post: int = 500,
    progress_callback=None,
    step_callback=None,
) -> dict:
    """Daily mode: only check last 5 videos for new comments + detect new videos."""

    if step_callback:
        step_callback("Daily mode: verificando últimos 5 vídeos...")

    # Discover channel if needed
    if not channel_id:
        info = discover_channel_info(channel_handle)
        if not info or not info.get("channel_id"):
            raise RuntimeError(f"Could not discover channel info for {channel_handle}")
        channel_id = info["channel_id"]
        connection.platform_user_id = channel_id
        connection.display_name = info.get("channel_title") or info.get("title") or channel_handle
        db.flush()

    posts_fetched = 0
    comments_fetched = 0
    all_comments_for_profiles = []

    # Get last 5 videos from DB
    recent_posts = (
        db.query(Post)
        .filter(Post.connection_id == connection_id, Post.platform == "youtube")
        .order_by(Post.published_at.desc())
        .limit(5)
        .all()
    )

    # Check for new videos published after our newest
    newest_date = max((p.published_at for p in recent_posts if p.published_at), default=None) if recent_posts else None

    if _use_api():
        # Fetch latest 10 videos to detect new ones
        latest_videos = fetch_youtube_videos(channel_id, max_videos=10)
        existing_ids = {p.platform_post_id for p in recent_posts}

        for video in latest_videos:
            vid_id = video["video_id"]
            if vid_id in existing_ids:
                continue

            # Parse date
            published_at = None
            raw_date = video.get("published_at", "")
            if raw_date:
                try:
                    if "T" in str(raw_date):
                        published_at = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
                    elif len(str(raw_date)) == 8:
                        published_at = datetime.strptime(str(raw_date), "%Y%m%d").replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass

            if newest_date and published_at and published_at < newest_date:
                continue  # Old video, skip in daily mode

            # Fetch stats
            stats_data = _fetch_video_statistics([vid_id])
            v_stats = stats_data.get(vid_id, {})

            title = video.get("title", "")
            title_clean = clean_text(title)
            view_count = v_stats.get("view_count", 0)
            like_count = v_stats.get("like_count", 0)
            api_comment_count = v_stats.get("comment_count", 0)
            thumbnail_url = video.get("thumbnail_url", "")

            post = Post(
                connection_id=connection_id,
                platform="youtube",
                platform_post_id=vid_id,
                post_type="video",
                content_text=title,
                content_clean=title_clean,
                media_urls={"thumbnail_url": thumbnail_url} if thumbnail_url else None,
                like_count=like_count,
                comment_count=0,
                comment_count_api=api_comment_count,
                share_count=0,
                view_count=view_count,
                published_at=published_at,
                post_url=f"https://www.youtube.com/watch?v={vid_id}",
                raw_payload={"video_id": vid_id, "title": title, "view_count": view_count, "like_count": like_count, "comment_count": api_comment_count},
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)
            db.flush()
            posts_fetched += 1

            if step_callback:
                step_callback(f"Novo vídeo encontrado: {title[:50]}...")

            # Fetch all comments for new video
            raw_comments = fetch_youtube_comments(vid_id, max_comments=max_comments_per_post)
            for rc in raw_comments:
                text_original = rc.get("text", "")
                text_cleaned = clean_text(text_original)
                text_hash = compute_hash(text_cleaned)
                pcid = rc.get("comment_id", "")
                if not pcid:
                    continue
                author_channel_id = rc.get("author_channel_id", "")
                author_display_name = rc.get("author_name", "") or author_channel_id
                serializable_payload = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in rc.items()}

                comment = Comment(
                    post_id=post.id,
                    connection_id=connection_id,
                    platform="youtube",
                    platform_comment_id=pcid,
                    parent_comment_id=None,
                    source_type="comment",
                    author_name=rc.get("author_name"),
                    author_username=author_display_name,
                    author_profile_url=f"https://www.youtube.com/channel/{author_channel_id}" if author_channel_id else None,
                    like_count=rc.get("like_count", 0),
                    reply_count=rc.get("reply_count", 0),
                    published_at=rc.get("published_at"),
                    text_original=text_original,
                    text_clean=text_cleaned,
                    text_hash=text_hash,
                    raw_payload=serializable_payload,
                    status="pending",
                )
                db.add(comment)
                comments_fetched += 1

            all_comments_for_profiles.extend(raw_comments)

    # Update stats for existing recent posts
    if recent_posts and _use_api():
        recent_video_ids = [p.platform_post_id for p in recent_posts]
        video_stats = _fetch_video_statistics(recent_video_ids)

        from sqlalchemy import func as sqlfunc
        comment_counts = dict(
            db.query(Comment.post_id, sqlfunc.count(Comment.id))
            .filter(Comment.connection_id == connection_id)
            .group_by(Comment.post_id)
            .all()
        )

        for post in recent_posts:
            stats = video_stats.get(post.platform_post_id, {})
            if not stats:
                continue

            api_comment_count = stats.get("comment_count", 0)
            post.comment_count_api = api_comment_count
            post.like_count = stats.get("like_count", 0)
            post.view_count = stats.get("view_count", 0)
            post.fetched_at = datetime.now(timezone.utc)

            db_count = comment_counts.get(post.id, 0)
            if api_comment_count > db_count:
                if step_callback:
                    step_callback(f"Vídeo {post.content_text[:40]}: API={api_comment_count} > DB={db_count}, buscando novos...")
                raw_comments = fetch_youtube_comments(post.platform_post_id, max_comments=max_comments_per_post)
                existing_comment_ids = set(
                    row[0] for row in
                    db.query(Comment.platform_comment_id)
                    .filter(Comment.post_id == post.id)
                    .all()
                )
                for rc in raw_comments:
                    pcid = rc.get("comment_id", "")
                    if not pcid or pcid in existing_comment_ids:
                        continue
                    text_original = rc.get("text", "")
                    text_cleaned = clean_text(text_original)
                    text_hash = compute_hash(text_cleaned)
                    author_channel_id = rc.get("author_channel_id", "")
                    author_display_name = rc.get("author_name", "") or author_channel_id
                    serializable_payload = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in rc.items()}

                    comment = Comment(
                        post_id=post.id,
                        connection_id=connection_id,
                        platform="youtube",
                        platform_comment_id=pcid,
                        parent_comment_id=None,
                        source_type="comment",
                        author_name=rc.get("author_name"),
                        author_username=author_display_name,
                        author_profile_url=f"https://www.youtube.com/channel/{author_channel_id}" if author_channel_id else None,
                        like_count=rc.get("like_count", 0),
                        reply_count=rc.get("reply_count", 0),
                        published_at=rc.get("published_at"),
                        text_original=text_original,
                        text_clean=text_cleaned,
                        text_hash=text_hash,
                        raw_payload=serializable_payload,
                        status="pending",
                    )
                    db.add(comment)
                    comments_fetched += 1

                all_comments_for_profiles.extend(raw_comments)

    # Save commenter profiles
    if all_comments_for_profiles:
        author_channel_ids = list(set(
            c.get("author_channel_id", "")
            for c in all_comments_for_profiles
            if c.get("author_channel_id")
        ))
        channel_profiles = []
        if _use_api() and author_channel_ids:
            try:
                channel_profiles = fetch_channel_profiles(author_channel_ids)
            except Exception as e:
                logger.warning("Failed to fetch channel profiles: %s", e)
        _save_commenter_profiles(db, all_comments_for_profiles, channel_profiles)

    connection.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    if step_callback:
        step_callback(f"Daily sync YouTube: {posts_fetched} novos vídeos, {comments_fetched} comentários")

    return {
        "posts_fetched": posts_fetched,
        "comments_fetched": comments_fetched,
    }
