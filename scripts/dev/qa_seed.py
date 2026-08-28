"""Resettable, provider-free QA seed suite for eight trust states plus an ops admin.

The command only accepts SQLite files inside the dedicated workspace QA
directory.  Every run rebuilds that throwaway database from deterministic IDs
and an explicit anchor timestamp.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


WORKSPACE = Path(__file__).resolve().parents[2]
BACKEND = WORKSPACE / "backend"
QA_DIRECTORY = WORKSPACE / "artifacts" / "product-audit-2026-08-26" / "qa"
DEFAULT_DB_PATH = QA_DIRECTORY / "sentimenta-qa.sqlite"
DEFAULT_ANCHOR = "2026-08-26T12:00:00+00:00"

sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")
os.environ.setdefault("SECRET_KEY", "synthetic-qa-seed-secret-not-for-production")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "synthetic-qa-seed-encryption-key")
os.environ.setdefault("DEBUG", "true")

from sqlalchemy import create_engine, event as sqlalchemy_event  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.db.session import Base  # noqa: E402
from app.models import (  # noqa: E402
    Comment,
    CommentAnalysis,
    CreditBalance,
    DataSnapshot,
    PipelineRun,
    Post,
    PostAnalysisSummary,
    OperationalEvent,
    SocialConnection,
    SupportTicket,
    User,
)
from app.services.connection_health_service import calculate_connection_health  # noqa: E402
from app.services.data_snapshot_service import (  # noqa: E402
    create_data_snapshot,
    snapshot_reference,
    verify_snapshot_integrity,
)
from app.schemas.auth import UserLogin  # noqa: E402
from app.services.auth_service import authenticate_user  # noqa: E402


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kwargs):
    return "JSON"


QA_PASSWORD = "QaSeed123!"
# example.com is reserved by IANA for documentation and is accepted by the
# production EmailStr validator. The seed never invokes an email provider.
QA_EMAIL_DOMAIN = "example.com"
# Fixed bcrypt hash for the synthetic password above, keeping resets stable.
QA_PASSWORD_HASH = "$2b$12$XwYp1CcEotZ/BiMXImuyKOuGu0ZPTwxrBILhv3lgz7.BqJ6k9F06m"
QA_NAMESPACE = uuid.UUID("a26ce57a-1f19-4c85-9c81-4c1f525eed01")
STALE_FIXTURE_AGE_DAYS = 49


@dataclass(frozen=True)
class Scenario:
    slug: str
    label: str
    expected_health: str
    expected_reason: str
    expected_action: str
    saved_count: int
    valid_count: int
    coverage_kind: str


SCENARIOS = (
    Scenario("healthy_recent", "Saudável e recente", "healthy", "healthy", "keep_monitoring", 24, 24, "complete"),
    Scenario("stale_snapshot", "Stale há 49 dias com último snapshot válido", "stale", "last_success_outside_sla", "sync_now", 24, 24, "historical_complete"),
    Scenario("failed_with_history", "Última tentativa falhou com histórico válido", "degraded", "latest_attempt_failed", "retry_sync", 24, 24, "unknown"),
    Scenario("partial_run", "Execução parcial", "degraded", "latest_attempt_partial", "review_partial_run", 24, 12, "partial"),
    Scenario("zero_valid_analyses", "Zero análises válidas", "failed", "zero_valid_analyses", "retry_sync", 53, 0, "partial"),
    Scenario("no_alert_window_data", "Sem dados na janela de alertas", "healthy", "healthy", "run_analysis", 0, 0, "none"),
    Scenario("never_synced", "Nunca sincronizado", "never_synced", "never_synced", "start_first_sync", 0, 0, "none"),
    Scenario("recovered_after_failure", "Recuperado depois de falha", "healthy", "healthy", "keep_monitoring", 24, 24, "complete"),
)
SCENARIO_BY_SLUG = {scenario.slug: scenario for scenario in SCENARIOS}
OPS_ADMIN_EMAIL = f"qa.ops_admin@{QA_EMAIL_DOMAIN}"


def _parse_anchor(value: str) -> datetime:
    if value.strip().lower() == "now":
        return datetime.now(timezone.utc).replace(microsecond=0)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _stable_uuid(*parts: str) -> uuid.UUID:
    return uuid.uuid5(QA_NAMESPACE, ":".join(parts))


def _guard_db_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = WORKSPACE / path
    resolved = path.resolve()
    qa_root = QA_DIRECTORY.resolve()
    if not resolved.is_relative_to(qa_root):
        raise ValueError(f"QA database must stay inside {qa_root}")
    if resolved.suffix.lower() not in {".sqlite", ".db", ".sqlite3"}:
        raise ValueError("QA database must use .sqlite, .sqlite3 or .db")
    return resolved


def _scores(count: int) -> list[float]:
    canonical = [8.0] * 12 + [5.0] * 7 + [3.56] * 5
    return canonical[:count]


def _add_run(
    db: Session,
    scenario: Scenario,
    connection: SocialConnection,
    *,
    key: str,
    status: str,
    started_at: datetime,
    ended_at: datetime,
    comments_fetched: int,
    comments_analyzed: int,
    errors_count: int = 0,
) -> PipelineRun:
    run = PipelineRun(
        id=_stable_uuid(scenario.slug, "run", key),
        user_id=connection.user_id,
        connection_id=connection.id,
        run_type="full",
        status=status,
        posts_fetched=1 if comments_fetched else 0,
        comments_fetched=comments_fetched,
        comments_analyzed=comments_analyzed,
        llm_calls=1 if comments_analyzed else 0,
        errors_count=errors_count,
        total_cost_usd=0.0,
        started_at=started_at,
        ended_at=ended_at,
        target_posts=1,
        target_comments=comments_fetched,
        notes=json.dumps(
            {
                "fixture": scenario.slug,
                "collection": {
                    "mode": "all",
                    "run_type": "full",
                    "max_posts": 1,
                    "max_comments_per_post": comments_fetched,
                    "since_date": None,
                    "use_apify_comments": False,
                },
                "steps": [{"msg": scenario.label, "ts": ended_at.isoformat()}],
            },
            ensure_ascii=False,
            sort_keys=True,
        ),
    )
    db.add(run)
    return run


def _scenario_runs(
    db: Session,
    scenario: Scenario,
    connection: SocialConnection,
    anchor: datetime,
) -> list[PipelineRun]:
    if scenario.slug == "never_synced":
        return []
    if scenario.slug == "stale_snapshot":
        completed = _add_run(
            db, scenario, connection,
            key="completed",
            status="completed",
            started_at=anchor - timedelta(days=STALE_FIXTURE_AGE_DAYS, minutes=5),
            ended_at=anchor - timedelta(days=STALE_FIXTURE_AGE_DAYS),
            comments_fetched=24,
            comments_analyzed=24,
        )
        connection.last_sync_at = completed.ended_at
        return [completed]
    if scenario.slug == "failed_with_history":
        completed = _add_run(
            db, scenario, connection,
            key="completed",
            status="completed",
            started_at=anchor - timedelta(hours=6, minutes=5),
            ended_at=anchor - timedelta(hours=6),
            comments_fetched=24,
            comments_analyzed=24,
        )
        failed = _add_run(
            db, scenario, connection,
            key="failed",
            status="failed",
            started_at=anchor - timedelta(hours=1),
            ended_at=anchor - timedelta(minutes=50),
            comments_fetched=0,
            comments_analyzed=0,
            errors_count=1,
        )
        connection.last_sync_at = completed.ended_at
        return [completed, failed]
    if scenario.slug == "partial_run":
        return [
            _add_run(
                db, scenario, connection,
                key="partial",
                status="partial",
                started_at=anchor - timedelta(hours=1),
                ended_at=anchor - timedelta(minutes=50),
                comments_fetched=24,
                comments_analyzed=12,
                errors_count=12,
            )
        ]
    if scenario.slug == "zero_valid_analyses":
        return [
            _add_run(
                db, scenario, connection,
                key="zero-valid",
                status="completed",
                started_at=anchor - timedelta(hours=1),
                ended_at=anchor - timedelta(minutes=50),
                comments_fetched=scenario.saved_count,
                comments_analyzed=scenario.valid_count,
            )
        ]
    if scenario.slug == "recovered_after_failure":
        failed = _add_run(
            db, scenario, connection,
            key="failed",
            status="failed",
            started_at=anchor - timedelta(hours=3),
            ended_at=anchor - timedelta(hours=2, minutes=50),
            comments_fetched=0,
            comments_analyzed=0,
            errors_count=1,
        )
        completed = _add_run(
            db, scenario, connection,
            key="recovered",
            status="completed",
            started_at=anchor - timedelta(hours=1),
            ended_at=anchor - timedelta(minutes=50),
            comments_fetched=24,
            comments_analyzed=24,
        )
        connection.last_sync_at = completed.ended_at
        return [failed, completed]

    completed = _add_run(
        db, scenario, connection,
        key="completed",
        status="completed",
        started_at=anchor - timedelta(hours=1),
        ended_at=anchor - timedelta(minutes=50),
        comments_fetched=scenario.saved_count,
        comments_analyzed=scenario.valid_count,
    )
    connection.last_sync_at = completed.ended_at
    return [completed]


def _add_content(
    db: Session,
    scenario: Scenario,
    connection: SocialConnection,
    anchor: datetime,
) -> tuple[datetime | None, datetime | None, dict[str, Any]]:
    if scenario.saved_count == 0:
        return None, None, {
            "valid_count": 0,
            "avg_score": None,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        }

    historical_offset = timedelta(days=STALE_FIXTURE_AGE_DAYS) if scenario.slug == "stale_snapshot" else timedelta(0)
    post = Post(
        id=_stable_uuid(scenario.slug, "post", "1"),
        connection_id=connection.id,
        platform="youtube",
        platform_post_id=f"qa-{scenario.slug}-post",
        post_type="video",
        content_text=f"Conteúdo sintético: {scenario.label}",
        content_clean=f"conteudo sintetico {scenario.slug}",
        like_count=120,
        comment_count=scenario.saved_count,
        comment_count_api=scenario.saved_count,
        view_count=1000,
        published_at=anchor - historical_offset - timedelta(days=6),
        post_url=f"https://example.invalid/{scenario.slug}/post",
        fetched_at=anchor - historical_offset,
    )
    db.add(post)

    scores = _scores(scenario.valid_count)
    published_values: list[datetime] = []
    for index in range(scenario.saved_count):
        published_at = anchor - historical_offset - timedelta(days=6) + timedelta(hours=index * 5)
        published_values.append(published_at)
        text = f"Comentário sintético {index + 1} para {scenario.slug}"
        comment = Comment(
            id=_stable_uuid(scenario.slug, "comment", str(index + 1)),
            post_id=post.id,
            connection_id=connection.id,
            platform="youtube",
            platform_comment_id=f"qa-{scenario.slug}-comment-{index + 1}",
            source_type="comment",
            author_name=f"Pessoa QA {index + 1}",
            author_username=f"qa_person_{index + 1}",
            like_count=index,
            published_at=published_at,
            text_original=text,
            text_clean=text.casefold(),
            text_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            status="processed" if index < scenario.valid_count else "pending",
            created_at=published_at,
        )
        db.add(comment)
        if index < scenario.valid_count:
            score = scores[index]
            db.add(
                CommentAnalysis(
                    id=_stable_uuid(scenario.slug, "analysis", str(index + 1)),
                    comment_id=comment.id,
                    model="qa-deterministic",
                    prompt_version="qa-v1",
                    score_0_10=score,
                    polarity=round((score - 5) / 5, 3),
                    intensity=0.5,
                    emotions=["confiança"],
                    topics=["fixture"],
                    sarcasm=False,
                    summary_pt="Análise sintética determinística.",
                    confidence=1.0,
                    analyzed_at=anchor - historical_offset,
                )
            )

    positive = sum(score > 6 for score in scores)
    neutral = sum(4 <= score <= 6 for score in scores)
    negative = sum(score < 4 for score in scores)
    avg_score = round(sum(scores) / len(scores), 2) if scores else None
    db.add(
        PostAnalysisSummary(
            id=_stable_uuid(scenario.slug, "post-summary"),
            post_id=post.id,
            total_comments=scenario.saved_count,
            total_analyzed=scenario.valid_count,
            avg_score=avg_score,
            avg_polarity=round((avg_score - 5) / 5, 3) if avg_score is not None else None,
            avg_intensity=0.5 if scores else None,
            avg_confidence=1.0 if scores else None,
            weighted_score=avg_score,
            emotions_distribution={"confiança": scenario.valid_count},
            topics_frequency={"fixture": scenario.valid_count},
            sentiment_distribution={"positive": positive, "neutral": neutral, "negative": negative},
            generated_at=anchor - historical_offset,
        )
    )
    return min(published_values), max(published_values), {
        "valid_count": scenario.valid_count,
        "avg_score": avg_score,
        "sentiment_distribution": {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
        },
    }


def _coverage(
    scenario: Scenario,
    connection: SocialConnection,
    anchor: datetime,
) -> dict[str, Any]:
    historical_offset = timedelta(days=STALE_FIXTURE_AGE_DAYS) if scenario.slug == "stale_snapshot" else timedelta(0)
    expected_start = anchor - historical_offset - timedelta(days=7)
    expected_end = anchor - historical_offset
    eligible = scenario.saved_count
    analysis_ratio = scenario.valid_count / eligible if eligible else 0.0

    if scenario.coverage_kind in {"complete", "historical_complete"}:
        status, ratio, reason = "complete", 1.0, "complete_window"
    elif scenario.coverage_kind == "partial":
        status, ratio, reason = "partial", analysis_ratio, "analysis_incomplete"
    elif scenario.coverage_kind == "unknown":
        status, ratio, reason = "unknown", None, "latest_attempt_failed"
    else:
        status, ratio, reason = "none", None, "no_saved_items"

    has_verified_time = scenario.slug not in {"never_synced", "failed_with_history"}
    return {
        "status": status,
        "ratio": ratio,
        "temporal_ratio": 1.0 if has_verified_time else None,
        "profile_ratio": 1.0 if has_verified_time else None,
        "analysis_ratio": analysis_ratio if scenario.slug != "never_synced" else None,
        "expected_period_start": expected_start.isoformat() if has_verified_time else None,
        "expected_period_end": expected_end.isoformat() if has_verified_time else None,
        "observed_period_start": None,
        "observed_period_end": None,
        "expected_profiles": 1,
        "evaluated_profiles": 1 if scenario.valid_count else 0,
        "verified_intervals": [
            {
                "connection_id": str(connection.id),
                "start": expected_start.isoformat(),
                "end": expected_end.isoformat(),
            }
        ] if has_verified_time else [],
        "reason_code": reason,
    }


def _seed_scenario(db: Session, scenario: Scenario, anchor: datetime) -> dict[str, Any]:
    user = User(
        id=_stable_uuid(scenario.slug, "user"),
        email=f"qa.{scenario.slug}@{QA_EMAIL_DOMAIN}",
        password_hash=QA_PASSWORD_HASH,
        name=f"QA · {scenario.label}",
        plan="pro",
        email_verified=True,
        onboarding_data={
            "profile_type": "brand",
            "main_goal": "monitor",
            "description": f"Fixture local {scenario.slug}",
        },
        terms_accepted_at=anchor,
        terms_accepted_version="qa-only",
        created_at=anchor,
        updated_at=anchor,
    )
    db.add(user)

    connection = SocialConnection(
        id=_stable_uuid(scenario.slug, "connection"),
        user_id=user.id,
        platform="youtube",
        platform_user_id=f"qa-{scenario.slug}",
        username=f"qa-{scenario.slug}",
        display_name=scenario.label,
        profile_url=f"https://example.invalid/{scenario.slug}",
        followers_count=1000,
        following_count=10,
        media_count=1 if scenario.saved_count else 0,
        status="active",
        persona="Fixture sintética sem PII",
        connected_at=anchor - timedelta(days=30),
        ignore_author_comments=True,
        auto_sync=True,
    )
    db.add(connection)
    db.flush()

    runs = _scenario_runs(db, scenario, connection, anchor)
    period_start, period_end, global_metrics = _add_content(db, scenario, connection, anchor)
    db.flush()

    health = calculate_connection_health(connection, runs, plan=user.plan, now=anchor)
    if health.state.value != scenario.expected_health or health.reason_code != scenario.expected_reason:
        raise RuntimeError(
            f"{scenario.slug}: expected {scenario.expected_health}/{scenario.expected_reason}, "
            f"got {health.state.value}/{health.reason_code}"
        )

    trigger_run = max(runs, key=lambda run: run.started_at) if runs else None
    coverage = _coverage(scenario, connection, anchor)
    coverage["observed_period_start"] = period_start.isoformat() if period_start else None
    coverage["observed_period_end"] = period_end.isoformat() if period_end else None
    found_count = scenario.saved_count + 6 if scenario.saved_count else 0
    if scenario.slug == "never_synced":
        found_count = None
        eligible_count = None
        ignored_count = None
        collected_count = None
    else:
        eligible_count = scenario.saved_count
        ignored_count = (found_count or 0) - scenario.saved_count
        collected_count = scenario.saved_count

    snapshot = create_data_snapshot(
        db,
        snapshot_id=_stable_uuid(scenario.slug, "snapshot"),
        user_id=user.id,
        trigger_run_id=trigger_run.id if trigger_run else None,
        period_start=period_start,
        period_end=period_end,
        last_attempt_at=health.last_attempt_at,
        last_success_at=health.last_success_at,
        source_platforms=["youtube"],
        profiles=[
            {
                "connection_id": str(connection.id),
                "platform": "youtube",
                "username": connection.username,
                "health": health.state.value,
                "reason_code": health.reason_code,
                "last_attempt_at": health.last_attempt_at.isoformat() if health.last_attempt_at else None,
                "last_success_at": health.last_success_at.isoformat() if health.last_success_at else None,
            }
        ],
        found_count=found_count,
        eligible_count=eligible_count,
        collected_count=collected_count,
        saved_count=scenario.saved_count,
        analyzed_count=scenario.valid_count,
        valid_count=scenario.valid_count,
        ignored_count=ignored_count,
        coverage=coverage,
        health=health.state.value,
        reason_code=health.reason_code,
        metrics={
            "global": global_metrics,
            "by_profile": [{"connection_id": str(connection.id), **global_metrics}],
            "trigger_run": {
                "id": str(trigger_run.id),
                "run_type": trigger_run.run_type,
                "status": trigger_run.status,
            } if trigger_run else None,
            "collection": {
                "mode": "all",
                "run_type": "full",
                "max_posts": 1,
                "max_comments_per_post": scenario.saved_count,
                "since_date": None,
                "use_apify_comments": False,
                "source": "qa_fixture",
            } if trigger_run else None,
            "fixture": scenario.slug,
        },
        created_at=anchor,
    )
    db.add(
        CreditBalance(
            id=_stable_uuid(scenario.slug, "credits"),
            user_id=user.id,
            plan_credits=20_000,
            pack_credits=0,
            cycle_start=anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
            cycle_end=(anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0) + timedelta(days=32)).replace(day=1),
            updated_at=anchor,
        )
    )
    db.flush()

    reference = snapshot_reference(snapshot)
    assert reference is not None
    if reference["language_policy"]["next_action"]["code"] != scenario.expected_action:
        raise RuntimeError(f"{scenario.slug}: unexpected next action")
    if not verify_snapshot_integrity(snapshot):
        raise RuntimeError(f"{scenario.slug}: snapshot integrity failed")

    return {
        "scenario": scenario.slug,
        "email": user.email,
        "user_id": str(user.id),
        "connection_id": str(connection.id),
        "snapshot_id": str(snapshot.id),
        "health": snapshot.health,
        "reason_code": snapshot.reason_code,
        "language_mode": reference["language_policy"]["mode"],
        "next_action": reference["language_policy"]["next_action"]["code"],
        "collected_count": snapshot.collected_count,
        "saved_count": snapshot.saved_count,
        "analyzed_count": snapshot.analyzed_count,
        "valid_count": snapshot.valid_count,
        "run_statuses": [run.status for run in sorted(runs, key=lambda run: run.started_at)],
    }


def _create_engine(db_path: Path):
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")

    @sqlalchemy_event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def _seed_ops_fixture(db: Session, anchor: datetime) -> dict[str, Any]:
    operator = User(
        id=_stable_uuid("ops_admin", "user"),
        email=OPS_ADMIN_EMAIL,
        password_hash=QA_PASSWORD_HASH,
        name="QA · Operações",
        plan="admin",
        email_verified=True,
        onboarding_data={"fixture": "ops_admin", "description": "Operação interna sintética"},
    )
    db.add(operator)
    db.add(
        CreditBalance(
            id=_stable_uuid("ops_admin", "credits"),
            user_id=operator.id,
            plan_credits=20_000,
            pack_credits=0,
            cycle_start=anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
            cycle_end=(anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0) + timedelta(days=32)).replace(day=1),
            updated_at=anchor,
        )
    )
    db.add_all(
        [
            OperationalEvent(
                id=_stable_uuid("ops_admin", "event", "post-404"),
                event_type="drilldown_404",
                route_template="/api/v1/posts/{post_id}",
                status_code=404,
                event_metadata={"method": "GET", "fixture": "ops_admin"},
                created_at=anchor - timedelta(minutes=18),
            ),
            OperationalEvent(
                id=_stable_uuid("ops_admin", "event", "profile-404"),
                event_type="drilldown_404",
                route_template="/api/v1/dashboard/connection/{connection_id}",
                status_code=404,
                event_metadata={"method": "GET", "fixture": "ops_admin"},
                created_at=anchor - timedelta(minutes=12),
            ),
        ]
    )
    ticket_specs = [
        ("origin", "data_trust", "Origem da leitura", "Não ficou claro quais comentários sustentam o score."),
        ("sync", "collection_sync", "Coleta sem atualização", "A coleta não apresentou um resultado novo."),
        ("coverage", "data_trust", "Cobertura de Alertas", "Preciso entender a janela coberta pelo alerta."),
        ("billing", "billing", "Créditos", "Dúvida sintética de créditos."),
    ]
    for index, (key, category, subject, message) in enumerate(ticket_specs):
        db.add(
            SupportTicket(
                id=_stable_uuid("ops_admin", "ticket", key),
                name=f"Pessoa QA {index + 1}",
                email=f"qa.ticket{index + 1}@{QA_EMAIL_DOMAIN}",
                category=category,
                subject=subject,
                message=message,
                source_path="/suporte",
                email_error="qa_fixture_no_delivery",
                created_at=anchor - timedelta(minutes=10 - index),
            )
        )
    db.flush()
    return {
        "email": operator.email,
        "user_id": str(operator.id),
        "plan": operator.plan,
        "operational_events": 2,
        "support_tickets": 4,
        "trust_tickets": 3,
    }


def seed_database(db_path: Path, anchor: datetime, scenario_slugs: list[str]) -> dict[str, Any]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # The guarded target is a dedicated throwaway QA file. Recreating it gives
    # every run a clean schema and logically deterministic contents. Raw SQLite
    # bytes are deliberately not part of the contract; the manifest and the
    # domain-level verification below are.
    if db_path.exists():
        db_path.unlink()
    engine = _create_engine(db_path)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as db:
        accounts = [_seed_scenario(db, SCENARIO_BY_SLUG[slug], anchor) for slug in scenario_slugs]
        operator = _seed_ops_fixture(db, anchor)
        db.commit()

    manifest = {
        "schema_version": 1,
        "database": str(db_path.relative_to(WORKSPACE)).replace("\\", "/"),
        "anchor": anchor.isoformat(),
        "provider_calls": 0,
        "contains_pii": False,
        "email_domain": f"{QA_EMAIL_DOMAIN} (IANA-reserved example domain)",
        "email_delivery_attempts": 0,
        "password": QA_PASSWORD,
        "accounts": accounts,
        "operators": [operator],
    }
    manifest_path = db_path.with_suffix(".manifest.json")
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest


def verify_database(db_path: Path, anchor: datetime, scenario_slugs: list[str]) -> dict[str, Any]:
    if not db_path.exists():
        raise FileNotFoundError(f"QA database does not exist: {db_path}")
    engine = _create_engine(db_path)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    verified = []
    with SessionLocal() as db:
        for slug in scenario_slugs:
            scenario = SCENARIO_BY_SLUG[slug]
            user = db.query(User).filter(User.email == f"qa.{slug}@{QA_EMAIL_DOMAIN}").one()
            login_input = UserLogin(email=user.email, password=QA_PASSWORD)
            authenticated = authenticate_user(db, str(login_input.email), login_input.password)
            connection = db.query(SocialConnection).filter(SocialConnection.user_id == user.id).one()
            analysis_rows = (
                db.query(CommentAnalysis)
                .join(Comment, Comment.id == CommentAnalysis.comment_id)
                .filter(Comment.connection_id == connection.id)
                .all()
            )
            runs = (
                db.query(PipelineRun)
                .filter(PipelineRun.user_id == user.id)
                .order_by(PipelineRun.started_at.asc())
                .all()
            )
            snapshot = (
                db.query(DataSnapshot)
                .filter(DataSnapshot.user_id == user.id)
                .order_by(DataSnapshot.created_at.desc(), DataSnapshot.id.desc())
                .first()
            )
            if snapshot is None or not verify_snapshot_integrity(snapshot):
                raise RuntimeError(f"{slug}: missing or invalid snapshot")
            health = calculate_connection_health(connection, runs, plan=user.plan, now=anchor)
            reference = snapshot_reference(snapshot)
            assert reference is not None
            expected_collected = None if slug == "never_synced" else scenario.saved_count
            checks = {
                "health": health.state.value == scenario.expected_health == snapshot.health,
                "reason": health.reason_code == scenario.expected_reason == snapshot.reason_code,
                "action": reference["language_policy"]["next_action"]["code"] == scenario.expected_action,
                "collected_count": snapshot.collected_count == expected_collected,
                "saved_count": snapshot.saved_count == scenario.saved_count,
                "analyzed_count": snapshot.analyzed_count == scenario.valid_count,
                "valid_count": snapshot.valid_count == scenario.valid_count,
                "login_contract": authenticated is not None and authenticated.id == user.id,
                "analysis_payloads": all(
                    isinstance(row.emotions, list) and isinstance(row.topics, list)
                    for row in analysis_rows
                ),
            }
            if not all(checks.values()):
                raise RuntimeError(f"{slug}: verification failed: {checks}")
            verified.append({"scenario": slug, "checks": checks})
        operator = db.query(User).filter(User.email == OPS_ADMIN_EMAIL).one()
        authenticated_operator = authenticate_user(db, OPS_ADMIN_EMAIL, QA_PASSWORD)
        operator_checks = {
            "login_contract": authenticated_operator is not None and authenticated_operator.id == operator.id,
            "admin_plan": operator.plan == "admin",
            "operational_events": db.query(OperationalEvent).count() == 2,
            "support_tickets": db.query(SupportTicket).count() == 4,
            "trust_tickets": db.query(SupportTicket).filter(SupportTicket.category.in_(["data_trust", "collection_sync"])).count() == 3,
        }
        if not all(operator_checks.values()):
            raise RuntimeError(f"ops_admin: verification failed: {operator_checks}")
    return {"verified": len(verified), "scenarios": verified, "operator": {"email": OPS_ADMIN_EMAIL, "checks": operator_checks}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH))
    parser.add_argument(
        "--anchor",
        default=DEFAULT_ANCHOR,
        help="ISO-8601 timestamp for reproducible fixtures, or 'now' for live freshness checks.",
    )
    parser.add_argument("--scenario", action="append", choices=sorted(SCENARIO_BY_SLUG), help="Repeat to seed a subset; default is all eight.")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    try:
        db_path = _guard_db_path(args.db_path)
        anchor = _parse_anchor(args.anchor)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))

    slugs = args.scenario or [scenario.slug for scenario in SCENARIOS]
    if args.verify_only:
        result = verify_database(db_path, anchor, slugs)
    else:
        manifest = seed_database(db_path, anchor, slugs)
        verification = verify_database(db_path, anchor, slugs)
        result = {"manifest": manifest, "verification": verification}
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
