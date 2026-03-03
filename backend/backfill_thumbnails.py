"""Backfill Instagram post thumbnails using Instaloader.

Uses longer delays and retry with backoff to handle Instagram rate limiting.
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.post import Post
from app.services.instagram_scrape_service import fetch_post_thumbnail
from app.services.media_cache_service import cache_remote_image


def fetch_with_retry(platform_post_id: str, max_retries: int = 2) -> str | None:
    """Fetch thumbnail with retry and exponential backoff."""
    for attempt in range(max_retries + 1):
        url = fetch_post_thumbnail(platform_post_id)
        if url:
            return url
        if attempt < max_retries:
            wait = 30 * (attempt + 1)
            print(f"retry in {wait}s...", end=" ", flush=True)
            time.sleep(wait)
    return None


def main():
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0
    db = SessionLocal()
    try:
        posts = (
            db.query(Post)
            .filter(Post.platform == "instagram")
            .all()
        )
        needs_thumb = [
            p for p in posts
            if not p.media_urls
            or not p.media_urls.get("thumbnail_url")
            or p.media_urls.get("thumbnail_url") is None
        ]
        print(f"Found {len(needs_thumb)} posts needing thumbnails (delay={delay}s)")

        updated = 0
        consecutive_failures = 0
        for i, post in enumerate(needs_thumb):
            print(f"[{i+1}/{len(needs_thumb)}] {post.platform_post_id}...", end=" ", flush=True)
            url = fetch_with_retry(post.platform_post_id)
            if url:
                cache_remote_image(url)
                post.media_urls = {"url": url, "thumbnail_url": url}
                db.commit()
                updated += 1
                consecutive_failures = 0
                print("OK")
            else:
                consecutive_failures += 1
                print("SKIP")
                if consecutive_failures >= 5:
                    print(f"\n5 consecutive failures - pausing 120s before continuing...")
                    time.sleep(120)
                    consecutive_failures = 0
            if i < len(needs_thumb) - 1:
                time.sleep(delay)

        print(f"\nDone: {updated}/{len(needs_thumb)} posts updated")
    finally:
        db.close()


if __name__ == "__main__":
    main()
