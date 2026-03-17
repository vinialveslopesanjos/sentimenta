"""Refresh Instagram post media URLs via Apify and cache images locally.

Usage:
    python refresh_media.py <username> [max_posts]

This script:
1. Fetches fresh post data from Apify (with current CDN URLs)
2. Downloads each image to local cache (permanent)
3. Updates media_urls in DB with both CDN URL and local cache path
4. The thumbnail proxy will serve from local cache even if CDN URL expires
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

from pathlib import Path
from app.db.session import SessionLocal
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services.apify_service import fetch_posts_apify
from app.services.media_cache_service import cache_remote_image, CACHE_DIR, _key_for_url, _find_existing_file


def refresh_media_for_connection(username: str, max_posts: int = 60):
    """Fetch fresh media URLs from Apify and cache images locally."""
    db = SessionLocal()
    try:
        # Find connection
        conn = db.query(SocialConnection).filter(
            SocialConnection.username == username
        ).first()
        if not conn:
            print(f"Connection @{username} not found")
            return

        print(f"Refreshing media for @{username} (connection {conn.id})")

        # Fetch fresh post data from Apify
        print(f"Fetching up to {max_posts} posts from Apify...")
        apify_posts = fetch_posts_apify(username, max_posts=max_posts)
        print(f"Got {len(apify_posts)} posts from Apify")

        if not apify_posts:
            print("No posts returned from Apify. Check token/limits.")
            return

        # Build lookup: shortcode -> media_url
        apify_lookup = {}
        for ap in apify_posts:
            shortcode = ap.get("platform_post_id")
            media_url = ap.get("media_url")
            if shortcode and media_url:
                apify_lookup[shortcode] = media_url

        # Get all DB posts for this connection
        db_posts = db.query(Post).filter(
            Post.connection_id == conn.id,
            Post.platform == "instagram",
        ).all()

        updated = 0
        cached = 0
        skipped = 0

        for post in db_posts:
            shortcode = post.platform_post_id
            fresh_url = apify_lookup.get(shortcode)

            if not fresh_url:
                skipped += 1
                continue

            # Check if we already have this cached by post_id key
            post_cache_key = f"post_{shortcode}"
            existing_cache = _find_existing_file(post_cache_key)

            if existing_cache and existing_cache.exists():
                # Already cached permanently
                cached += 1
            else:
                # Download and cache with stable key based on shortcode
                print(f"  Downloading {shortcode}...", end=" ", flush=True)
                cached_path = cache_remote_image(fresh_url)
                if cached_path and cached_path.exists():
                    # Rename to stable key so it persists even if URL changes
                    stable_name = f"post_{shortcode}{cached_path.suffix}"
                    stable_path = CACHE_DIR / stable_name
                    if not stable_path.exists():
                        cached_path.rename(stable_path)
                    cached += 1
                    print("OK")
                else:
                    print("FAIL")
                    skipped += 1
                    continue

            # Update DB with fresh URL
            post.media_urls = {"url": fresh_url, "thumbnail_url": fresh_url}
            updated += 1

        db.commit()
        print(f"\nDone: {updated} updated, {cached} cached, {skipped} skipped")

    finally:
        db.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python refresh_media.py <username> [max_posts]")
        sys.exit(1)

    username = sys.argv[1].lstrip("@")
    max_posts = int(sys.argv[2]) if len(sys.argv) > 2 else 60

    refresh_media_for_connection(username, max_posts)


if __name__ == "__main__":
    main()
