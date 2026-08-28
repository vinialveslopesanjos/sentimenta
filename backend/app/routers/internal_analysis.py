import ipaddress
import secrets
import socket
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.llm_client import LLMClient


router = APIRouter(prefix="/internal/analysis", tags=["internal-analysis"])


class PoliticalCandidateContext(BaseModel):
    id: str | None = Field(default=None, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    handle: str | None = Field(default=None, max_length=100)
    party: str | None = Field(default=None, max_length=80)
    position: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=80)
    persona: str | None = Field(default=None, max_length=6000)


class PoliticalPostContext(BaseModel):
    id: str | None = Field(default=None, max_length=150)
    caption: str | None = Field(default=None, max_length=12000)
    image_url: str | None = Field(default=None, max_length=4000)
    image_context: str | None = Field(default=None, max_length=6000)
    post_url: str | None = Field(default=None, max_length=4000)
    author_username: str | None = Field(default=None, max_length=100)


class PoliticalCommentInput(BaseModel):
    comment_id: str = Field(min_length=1, max_length=150)
    text: str = Field(max_length=5000)
    author_username: str | None = Field(default=None, max_length=100)
    likes: int = Field(default=0, ge=0)
    parent_text: str | None = Field(default=None, max_length=5000)


class PoliticalAnalysisRequest(BaseModel):
    candidate: PoliticalCandidateContext
    post: PoliticalPostContext
    comments: list[PoliticalCommentInput] = Field(min_length=1, max_length=25)
    generate_image_context: bool = True


def _require_internal_key(x_internal_analysis_key: Annotated[str | None, Header()] = None) -> None:
    expected = settings.INTERNAL_ANALYSIS_API_KEY
    if not expected or not x_internal_analysis_key or not secrets.compare_digest(expected, x_internal_analysis_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal analysis key")


def _safe_external_https_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)}
    except OSError:
        return False
    if not addresses:
        return False
    return all(ipaddress.ip_address(address).is_global for address in addresses)


@router.post("/v2", dependencies=[])
def analyze_political_v2(
    payload: PoliticalAnalysisRequest,
    x_internal_analysis_key: Annotated[str | None, Header()] = None,
) -> dict:
    _require_internal_key(x_internal_analysis_key)
    client = LLMClient()
    image_context = payload.post.image_context
    image_error = None
    if payload.generate_image_context and not image_context and payload.post.image_url:
        if not _safe_external_https_url(payload.post.image_url):
            image_error = "Unsafe or unavailable image URL"
        else:
            generated = client.analyze_image(payload.post.image_url, payload.post.caption)
            if generated and not generated.startswith("Erro"):
                image_context = generated
            else:
                image_error = generated or "Image analysis returned no context"

    context = {
        "candidate": payload.candidate.model_dump(exclude_none=True),
        "post": {
            **payload.post.model_dump(exclude={"image_url", "image_context"}, exclude_none=True),
            "image_context": image_context,
        },
    }
    results = list(
        client.analyze_political_comments_v2(
            [comment.model_dump() for comment in payload.comments],
            context,
        )
    )
    return {
        "engine_version": "political-context-v2",
        "model": client.model,
        "image_context": image_context,
        "image_context_error": image_error,
        "items": results,
    }
