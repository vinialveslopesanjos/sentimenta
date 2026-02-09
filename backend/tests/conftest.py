"""
Shared fixtures for backend tests.

Uses an in-memory SQLite database so tests run without PostgreSQL.
"""

import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Override DATABASE_URL before importing app modules
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["DEBUG"] = "true"

from app.db.session import Base, get_db
from app.main import app
from app.models import (
    User,
    SocialConnection,
    Post,
    Comment,
    CommentAnalysis,
    PostAnalysisSummary,
    PipelineRun,
)
from app.core.security import hash_password, create_access_token


# SQLite test engine
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test and drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Provide a test database session."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def test_user(db):
    """Create a test user and return (user, access_token)."""
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=hash_password("testpass123"),
        name="Test User",
        plan="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return user, token


@pytest.fixture
def auth_headers(test_user):
    """Return Authorization headers for the test user."""
    _, token = test_user
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_connection(db, test_user):
    """Create a test social connection."""
    user, _ = test_user
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username="@TestChannel",
        display_name="Test Channel",
        status="active",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@pytest.fixture
def test_post(db, test_connection):
    """Create a test post."""
    post = Post(
        id=uuid.uuid4(),
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="test_video_123",
        post_type="video",
        content_text="Test video title",
        content_clean="test video title",
        like_count=100,
        comment_count=50,
        published_at=datetime.now(timezone.utc),
        post_url="https://youtube.com/watch?v=test_video_123",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@pytest.fixture
def test_comments(db, test_post, test_connection):
    """Create test comments."""
    comments = []
    for i in range(5):
        c = Comment(
            id=uuid.uuid4(),
            post_id=test_post.id,
            connection_id=test_connection.id,
            platform="youtube",
            platform_comment_id=f"comment_{i}",
            source_type="comment",
            author_name=f"User {i}",
            like_count=i * 10,
            text_original=f"Test comment number {i}",
            text_clean=f"test comment number {i}",
            text_hash=f"hash_{i}",
            status="pending",
        )
        comments.append(c)
        db.add(c)
    db.commit()
    for c in comments:
        db.refresh(c)
    return comments
