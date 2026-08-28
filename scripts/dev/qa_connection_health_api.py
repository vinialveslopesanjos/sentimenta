"""Local-only API fixture for product testing the connection-health UI.

This server has no database and makes no provider calls.  It intentionally
implements only the endpoints required to log in with the synthetic QA user
and render ``/dashboard/connect``.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


QA_EMAIL = "qa-health@example.invalid"
QA_PASSWORD = "QaHealth123!"


def _connection(
    connection_id: str,
    state: str,
    reason_code: str,
    last_success_at: str | None,
) -> dict:
    return {
        "id": connection_id,
        "platform": "youtube",
        "username": "perfil-teste",
        "display_name": "Mesmo perfil de demonstração",
        "profile_url": "https://youtube.com/@perfil-teste",
        "profile_image_url": None,
        "followers_count": 12_345,
        "following_count": 0,
        "media_count": 42,
        "status": "active",
        "connected_at": "2026-08-01T12:00:00Z",
        "last_sync_at": last_success_at,
        "persona": None,
        "ignore_author_comments": True,
        "auto_sync": True,
        "has_oauth_token": False,
        "health": {
            "state": state,
            "reason_code": reason_code,
            "reason_codes": [reason_code],
            "freshness_sla_hours": 36,
            "last_attempt_at": (
                None if state == "never_synced" else "2026-08-26T10:00:00Z"
            ),
            "last_attempt_status": (
                "failed"
                if state in {"failed", "degraded"}
                else None if state == "never_synced" else "completed"
            ),
            "last_success_at": last_success_at,
            "fresh_until": "2026-08-27T22:00:00Z" if last_success_at else None,
            "data_age_hours": 2 if last_success_at else None,
            "is_syncing": False,
        },
    }


CONNECTIONS = [
    _connection(
        "00000000-0000-0000-0000-000000000101",
        "healthy",
        "healthy",
        "2026-08-26T10:00:00Z",
    ),
    _connection(
        "00000000-0000-0000-0000-000000000102",
        "degraded",
        "latest_attempt_failed",
        "2026-08-26T08:00:00Z",
    ),
    _connection(
        "00000000-0000-0000-0000-000000000103",
        "stale",
        "last_success_outside_sla",
        "2026-08-20T10:00:00Z",
    ),
    _connection(
        "00000000-0000-0000-0000-000000000104",
        "failed",
        "zero_valid_analyses",
        None,
    ),
    _connection(
        "00000000-0000-0000-0000-000000000105",
        "never_synced",
        "never_synced",
        None,
    ),
]


class FixtureHandler(BaseHTTPRequestHandler):
    server_version = "SentimentaQAFixture/1.0"

    def log_message(self, format: str, *args) -> None:
        # Keep automated QA output deterministic and free of request headers.
        return

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"status": "ok", "fixture": "connection-health"})
            return
        if self.path == "/api/v1/auth/me":
            self._json(
                200,
                {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "email": QA_EMAIL,
                    "name": "QA Health",
                    "avatar_url": None,
                    "plan": "pro",
                    "email_verified": True,
                    "onboarding_data": {
                        "profile_type": "brand",
                        "main_goal": "monitor",
                        "description": "Fixture QA",
                    },
                },
            )
            return
        if self.path == "/api/v1/billing/credits":
            self._json(
                200,
                {
                    "plan_credits": 20_000,
                    "pack_credits": 0,
                    "total": 20_000,
                    "cycle_start": "2026-08-01T00:00:00Z",
                    "cycle_end": "2026-09-01T00:00:00Z",
                    "plan": "pro",
                    "plan_allocation": 20_000,
                    "demographic_cost": 5,
                    "packs": [],
                },
            )
            return
        if self.path == "/api/v1/connections":
            self._json(200, CONNECTIONS)
            return
        self._json(404, {"detail": "Fixture route not defined"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/api/v1/auth/login":
            data = self._read_json()
            if data.get("email") != QA_EMAIL or data.get("password") != QA_PASSWORD:
                self._json(401, {"detail": "Invalid synthetic QA credentials"})
                return
            self._json(
                200,
                {
                    "access_token": "deterministic-health-token",
                    "refresh_token": "deterministic-health-refresh-token",
                },
            )
            return
        if self.path == "/api/v1/security/csp-report":
            self._read_json()
            self._json(204, {})
            return
        self._json(404, {"detail": "Fixture route not defined"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), FixtureHandler)
    print(f"Sentimenta QA fixture listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
