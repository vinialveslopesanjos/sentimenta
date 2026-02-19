import hashlib
import mimetypes
from pathlib import Path

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CACHE_DIR = BASE_DIR / "output" / "media_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _key_for_url(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _find_existing_file(key: str) -> Path | None:
    matches = list(CACHE_DIR.glob(f"{key}.*"))
    if not matches:
        return None
    return matches[0]


def _extension_from_content_type(content_type: str | None, url: str) -> str:
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guessed:
            return guessed
    parsed_ext = Path(url.split("?")[0]).suffix.lower()
    if parsed_ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return parsed_ext
    return ".jpg"


def cache_remote_image(url: str) -> Path | None:
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None

    key = _key_for_url(url)
    existing = _find_existing_file(key)
    if existing and existing.exists():
        return existing

    try:
        with httpx.Client(
            timeout=20.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                )
            },
        ) as client:
            response = client.get(url)
            if response.status_code != 200:
                return None

            content_type = response.headers.get("content-type")
            if not content_type or not content_type.startswith("image/"):
                return None

            ext = _extension_from_content_type(content_type, url)
            target = CACHE_DIR / f"{key}{ext}"
            target.write_bytes(response.content)
            return target
    except Exception:
        return None


def cache_path_for_url(url: str) -> str | None:
    cached = cache_remote_image(url)
    if not cached:
        return None
    return str(cached)
