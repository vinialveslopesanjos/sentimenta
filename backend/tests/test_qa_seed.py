"""The local QA seed suite is resettable, deterministic and path-guarded."""

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "dev" / "qa_seed.py"
QA_DIR = ROOT / "artifacts" / "product-audit-2026-08-26" / "qa"
DB_PATH = QA_DIR / "pytest-qa-seed.sqlite"
MANIFEST_PATH = DB_PATH.with_suffix(".manifest.json")
ANCHOR = "2026-08-26T12:00:00+00:00"


def _run_seed(*extra: str, check: bool = True):
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--db-path",
            str(DB_PATH),
            "--anchor",
            ANCHOR,
            *extra,
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=check,
        timeout=120,
    )


def test_qa_seed_resets_all_eight_states_deterministically():
    QA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        first = json.loads(_run_seed().stdout)
        second = json.loads(_run_seed().stdout)
        verified = json.loads(_run_seed("--verify-only").stdout)

        assert first["manifest"] == second["manifest"]
        assert first["manifest"]["contains_pii"] is False
        assert first["manifest"]["provider_calls"] == 0
        assert first["manifest"]["email_delivery_attempts"] == 0
        assert first["manifest"]["password"] == "QaSeed123!"
        assert len(first["manifest"]["accounts"]) == 8
        assert first["manifest"]["operators"] == [
            {
                "email": "qa.ops_admin@example.com",
                "operational_events": 2,
                "plan": "admin",
                "support_tickets": 4,
                "trust_tickets": 3,
                "user_id": first["manifest"]["operators"][0]["user_id"],
            }
        ]
        assert verified["verified"] == 8
        assert all(verified["operator"]["checks"].values())
        assert all(
            account["email"].endswith("@example.com")
            for account in first["manifest"]["accounts"]
        )
        assert all(
            scenario["checks"]["login_contract"]
            for scenario in verified["scenarios"]
        )

        accounts = {account["scenario"]: account for account in first["manifest"]["accounts"]}
        assert accounts["healthy_recent"]["health"] == "healthy"
        assert accounts["stale_snapshot"]["health"] == "stale"
        assert accounts["failed_with_history"]["health"] == "degraded"
        assert accounts["failed_with_history"]["run_statuses"] == ["completed", "failed"]
        assert accounts["partial_run"]["valid_count"] == 12
        assert accounts["zero_valid_analyses"]["health"] == "failed"
        assert accounts["zero_valid_analyses"]["collected_count"] == 53
        assert accounts["zero_valid_analyses"]["saved_count"] == 53
        assert accounts["zero_valid_analyses"]["analyzed_count"] == 0
        assert accounts["zero_valid_analyses"]["valid_count"] == 0
        assert accounts["no_alert_window_data"]["saved_count"] == 0
        assert accounts["never_synced"]["run_statuses"] == []
        assert accounts["recovered_after_failure"]["run_statuses"] == ["failed", "completed"]
    finally:
        for path in (DB_PATH, MANIFEST_PATH):
            if path.exists():
                path.unlink()


def test_qa_seed_refuses_a_database_outside_the_dedicated_directory():
    unsafe = ROOT / "backend" / "unsafe-qa.sqlite"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--db-path", str(unsafe)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
        timeout=30,
    )

    assert result.returncode == 2
    assert "must stay inside" in result.stderr
    assert not unsafe.exists()
