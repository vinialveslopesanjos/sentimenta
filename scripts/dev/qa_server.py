"""Run Sentimenta locally against the isolated synthetic QA database.

The launcher is intentionally strict: it only binds to localhost, only accepts a
database inside the product-audit QA directory, enables read-only middleware and
clears every external-provider credential before importing the application.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
QA_DIR = (ROOT / "artifacts" / "product-audit-2026-08-26" / "qa").resolve()
DEFAULT_DB = QA_DIR / "sentimenta-qa.sqlite"


def _qa_database(value: str) -> Path:
    path = Path(value).expanduser().resolve()
    if path.parent != QA_DIR:
        raise argparse.ArgumentTypeError(
            f"database must stay directly inside the dedicated QA directory: {QA_DIR}"
        )
    if path.suffix != ".sqlite":
        raise argparse.ArgumentTypeError("QA database must use the .sqlite suffix")
    if not path.is_file():
        raise argparse.ArgumentTypeError(
            f"QA database does not exist: {path}. Run scripts/dev/qa_seed.py first."
        )
    return path


def _port(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def _configure_isolated_environment(db_path: Path) -> None:
    os.environ.update(
        {
            "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
            "DEBUG": "true",
            "READ_ONLY_MODE": "true",
            "QA_LOCAL_MODE": "true",
            "APP_URL": "http://127.0.0.1:3000",
            "SECRET_KEY": "qa-local-only-secret-key-not-for-production-2026",
            "TOKEN_ENCRYPTION_KEY": "qa-local-only-encryption-key-not-for-production-2026",
            "SESSION_COOKIE_SECURE": "false",
            "POSTHOG_API_KEY": "",
            "SENTRY_DSN": "",
            "RESEND_API_KEY": "",
            "APIFY_API_TOKEN": "",
            "OPENROUTER_API_KEY": "",
            "YOUTUBE_API_KEY": "",
            "YOUTUBE_USE_API": "false",
            "STRIPE_SECRET_KEY": "",
            "STRIPE_WEBHOOK_SECRET": "",
            "GOOGLE_CLIENT_ID": "",
            "GOOGLE_CLIENT_SECRET": "",
            "INSTAGRAM_APP_ID": "",
            "INSTAGRAM_APP_SECRET": "",
            "TIKTOK_CLIENT_KEY": "",
            "TIKTOK_CLIENT_SECRET": "",
            "REDIS_URL": "redis://127.0.0.1:6399/0",
            "CACHE_REDIS_URL": "redis://127.0.0.1:6399/0",
            # The isolated QA server has no Redis. An empty URL selects the
            # deterministic in-memory limiter without a cross-thread probe race.
            "RATE_LIMIT_REDIS_URL": "",
            "CELERY_BROKER_URL": "redis://127.0.0.1:6399/0",
            "CELERY_RESULT_BACKEND": "redis://127.0.0.1:6399/1",
        }
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-path", type=_qa_database, default=DEFAULT_DB)
    parser.add_argument("--port", type=_port, default=8000)
    args = parser.parse_args()

    db_path = _qa_database(str(args.db_path))
    _configure_isolated_environment(db_path)

    os.chdir(BACKEND_DIR)
    sys.path.insert(0, str(BACKEND_DIR))

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=args.port,
        log_level="info",
        access_log=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
