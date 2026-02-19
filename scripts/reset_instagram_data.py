"""
reset_instagram_data.py
-----------------------
Deletes all Instagram scraped data (posts, comments, analyses, pipeline runs)
while keeping users and social_connections intact.

Usage (from project root):
    python scripts/reset_instagram_data.py [--dry-run] [--username USERNAME]

Options:
    --dry-run   Show what would be deleted without committing.
    --username  Only reset data for a specific @username (optional).
"""

import argparse
import sys
import os

# Add backend to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Load .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.social_connection import SocialConnection
from app.models.post import Post
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.pipeline_run import PipelineRun


def reset_instagram_data(dry_run: bool = False, username: str | None = None):
    db = SessionLocal()
    try:
        # Find Instagram connections
        q = db.query(SocialConnection).filter(SocialConnection.platform == "instagram")
        if username:
            q = q.filter(SocialConnection.username == username.lstrip("@"))
        connections = q.all()

        if not connections:
            print("No Instagram connections found.")
            return

        conn_ids = [c.id for c in connections]
        print(f"\nFound {len(connections)} Instagram connection(s):")
        for c in connections:
            print(f"  @{c.username} (id={c.id})")

        # Count what will be deleted
        post_ids_q = db.query(Post.id).filter(Post.connection_id.in_(conn_ids))
        post_ids = [r[0] for r in post_ids_q.all()]

        comment_ids_q = db.query(Comment.id).filter(Comment.connection_id.in_(conn_ids))
        comment_ids = [r[0] for r in comment_ids_q.all()]

        n_analyses = db.query(CommentAnalysis).filter(
            CommentAnalysis.comment_id.in_(comment_ids)
        ).count() if comment_ids else 0

        n_summaries = db.query(PostAnalysisSummary).filter(
            PostAnalysisSummary.post_id.in_(post_ids)
        ).count() if post_ids else 0

        n_pipeline_runs = db.query(PipelineRun).filter(
            PipelineRun.connection_id.in_(conn_ids)
        ).count()

        print(f"\nData to be deleted:")
        print(f"  Posts:              {len(post_ids)}")
        print(f"  Comments:           {len(comment_ids)}")
        print(f"  Comment analyses:   {n_analyses}")
        print(f"  Post summaries:     {n_summaries}")
        print(f"  Pipeline runs:      {n_pipeline_runs}")
        print()

        if dry_run:
            print("[DRY RUN] No changes made.")
            return

        confirm = input("Confirm deletion? This cannot be undone. (yes/no): ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

        # Delete in dependency order
        if comment_ids:
            db.query(CommentAnalysis).filter(
                CommentAnalysis.comment_id.in_(comment_ids)
            ).delete(synchronize_session=False)

        if post_ids:
            db.query(PostAnalysisSummary).filter(
                PostAnalysisSummary.post_id.in_(post_ids)
            ).delete(synchronize_session=False)

        db.query(Comment).filter(Comment.connection_id.in_(conn_ids)).delete(
            synchronize_session=False
        )
        db.query(Post).filter(Post.connection_id.in_(conn_ids)).delete(
            synchronize_session=False
        )
        db.query(PipelineRun).filter(PipelineRun.connection_id.in_(conn_ids)).delete(
            synchronize_session=False
        )

        # Reset last_sync_at on connections so the UI shows "never synced"
        for c in connections:
            c.last_sync_at = None

        db.commit()
        print("Done. All Instagram data deleted. Connections preserved.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset Instagram scraped data")
    parser.add_argument("--dry-run", action="store_true", help="Preview without deleting")
    parser.add_argument("--username", type=str, default=None, help="Only reset specific username")
    args = parser.parse_args()
    reset_instagram_data(dry_run=args.dry_run, username=args.username)
