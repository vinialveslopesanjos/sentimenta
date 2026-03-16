import hashlib
import ipaddress
import mimetypes
import socket
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CACHE_DIR = BASE_DIR / "output" / "media_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_REDIRECTS = 3
ALLOWED_IMAGE_HOST_SUFFIXES = (
    ".cdninstagram.com",
    ".fbcdn.net",
    ".googleusercontent.com",
    ".ggpht.com",
    ".instagram.com",
    ".muscdn.com",
    ".twimg.com",
    ".tiktokcdn.com",
    ".ytimg.com",
)


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


def _is_private_host(hostname: str) -> bool:
    try:
        addresses = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True

    for _, _, _, _, sockaddr in addresses:
        ip = ipaddress.ip_address(sockaddr[0])
        if any(
            (
                ip.is_private,
                ip.is_loopback,
                ip.is_link_local,
                ip.is_multicast,
                ip.is_reserved,
                ip.is_unspecified,
            )
        ):
            return True
    return False


def is_allowed_remote_image_url(url: str) -> bool:
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme != "https":
        return False
    hostname = (parsed.hostname or "").lower()
    if not hostname or hostname in {"localhost", "127.0.0.1", "::1"}:
        return False
    if not (
        hostname.endswith(ALLOWED_IMAGE_HOST_SUFFIXES)
        or hostname in {suffix.lstrip(".") for suffix in ALLOWED_IMAGE_HOST_SUFFIXES}
    ):
        return False
    return not _is_private_host(hostname)


def _download_image(url: str) -> tuple[bytes, str | None, str]:
    next_url = url
    for _ in range(MAX_REDIRECTS + 1):
        if not is_allowed_remote_image_url(next_url):
            raise ValueError("Image host is not allowed")
        with httpx.Client(
            timeout=20.0,
            follow_redirects=False,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                )
            },
        ) as client:
            with client.stream("GET", next_url) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("Invalid redirect from image host")
                    next_url = urljoin(str(response.url), location)
                    continue
                if response.status_code != 200:
                    raise ValueError("Image returned a non-200 status code")

                content_type = response.headers.get("content-type")
                if not content_type or not content_type.startswith("image/"):
                    raise ValueError("URL did not return an image")

                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > MAX_IMAGE_BYTES:
                    raise ValueError("Image too large")

                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > MAX_IMAGE_BYTES:
                        raise ValueError("Image too large")
                    chunks.append(chunk)
                return b"".join(chunks), content_type, next_url
    raise ValueError("Too many redirects while fetching image")


def cache_remote_image(url: str) -> Path | None:
    if not is_allowed_remote_image_url(url):
        return None

    key = _key_for_url(url)
    existing = _find_existing_file(key)
    if existing and existing.exists():
        return existing

    try:
        body, content_type, final_url = _download_image(url)
        ext = _extension_from_content_type(content_type, final_url)
        target = CACHE_DIR / f"{key}{ext}"
        target.write_bytes(body)
        return target
    except Exception:
        return None


def cache_path_for_url(url: str) -> str | None:
    cached = cache_remote_image(url)
    if not cached:
        return None
    return str(cached)
