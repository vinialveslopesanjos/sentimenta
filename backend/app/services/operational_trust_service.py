"""Aggregate the minimum operational trust signals without exposing user PII."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from math import floor

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.data_snapshot import DataSnapshot
from app.models.operational_event import OperationalEvent
from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.models.support_ticket import SupportTicket

TERMINAL_STATUSES = {"completed", "partial", "failed"}
TRUST_TICKET_CATEGORIES = {"data_trust", "collection_sync"}


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 2)
    position = (len(ordered) - 1) * quantile
    lower = floor(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * fraction, 2)


def _duration_seconds(run: PipelineRun) -> float | None:
    started_at = _aware(run.started_at)
    ended_at = _aware(run.ended_at)
    if started_at is None or ended_at is None or ended_at < started_at:
        return None
    return (ended_at - started_at).total_seconds()


def _age_seconds(value: datetime | None, now: datetime) -> int | None:
    aware = _aware(value)
    if aware is None:
        return None
    return max(0, int((now - aware).total_seconds()))


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def snapshot_count_diverges(snapshot: DataSnapshot) -> bool:
    ordered_counts = [
        snapshot.found_count,
        snapshot.eligible_count,
        snapshot.collected_count,
        snapshot.saved_count,
        snapshot.analyzed_count,
        snapshot.valid_count,
    ]
    known = [int(value) for value in ordered_counts if value is not None]
    if any(current < following for current, following in zip(known, known[1:])):
        return True
    if snapshot.found_count is not None and snapshot.eligible_count is not None and snapshot.ignored_count is not None:
        return int(snapshot.ignored_count) != int(snapshot.found_count) - int(snapshot.eligible_count)
    return False


def _duration_summary(runs: list[PipelineRun]) -> dict:
    durations = [duration for run in runs if (duration := _duration_seconds(run)) is not None]
    return {
        "sample_count": len(durations),
        "p50": _percentile(durations, 0.50),
        "p95": _percentile(durations, 0.95),
    }


def _latest_snapshot_dates(db: Session) -> tuple[dict[str, datetime], dict[str, datetime]]:
    latest_data: dict[str, datetime] = {}
    latest_valid_data: dict[str, datetime] = {}
    snapshots = (
        db.query(DataSnapshot)
        .filter(DataSnapshot.period_end.isnot(None))
        .order_by(DataSnapshot.period_end.desc())
        .limit(5000)
        .all()
    )
    for snapshot in snapshots:
        period_end = _aware(snapshot.period_end)
        if period_end is None:
            continue
        for platform in snapshot.source_platforms or []:
            key = str(platform).lower()
            if (snapshot.saved_count or 0) > 0 and key not in latest_data:
                latest_data[key] = period_end
            if (snapshot.valid_count or 0) > 0 and key not in latest_valid_data:
                latest_valid_data[key] = period_end
    return latest_data, latest_valid_data


def build_operational_trust_report(
    db: Session,
    *,
    hours: int = 24,
    now: datetime | None = None,
) -> dict:
    now_utc = _aware(now) or datetime.now(timezone.utc)
    window_start = now_utc - timedelta(hours=hours)
    stuck_cutoff = now_utc - timedelta(minutes=settings.OPS_STUCK_AFTER_MINUTES)

    run_rows = (
        db.query(PipelineRun, SocialConnection.platform)
        .outerjoin(SocialConnection, SocialConnection.id == PipelineRun.connection_id)
        .filter(PipelineRun.started_at >= window_start)
        .all()
    )
    active_connection_rows = (
        db.query(SocialConnection.platform, func.count(SocialConnection.id))
        .filter(SocialConnection.status == "active")
        .group_by(SocialConnection.platform)
        .all()
    )
    active_connections = {str(platform).lower(): int(count) for platform, count in active_connection_rows}

    by_platform: dict[str, list[PipelineRun]] = defaultdict(list)
    all_runs: list[PipelineRun] = []
    for run, platform in run_rows:
        key = str(platform or "unknown").lower()
        by_platform[key].append(run)
        all_runs.append(run)

    latest_data, latest_valid_data = _latest_snapshot_dates(db)
    platform_keys = sorted(set(active_connections) | set(by_platform) | set(latest_data) | set(latest_valid_data))

    platform_metrics = []
    for platform in platform_keys:
        runs = by_platform.get(platform, [])
        terminal = [run for run in runs if run.status in TERMINAL_STATUSES]
        completed = [run for run in terminal if run.status == "completed"]
        partial = [run for run in terminal if run.status == "partial"]
        failed = [run for run in terminal if run.status == "failed"]
        usable = [run for run in terminal if (run.comments_analyzed or 0) > 0]
        raw_last = latest_data.get(platform)
        valid_last = latest_valid_data.get(platform)
        platform_metrics.append(
            {
                "platform": platform,
                "active_connections": active_connections.get(platform, 0),
                "terminal_runs": len(terminal),
                "completed_runs": len(completed),
                "partial_runs": len(partial),
                "failed_runs": len(failed),
                "operational_success_rate": _rate(len(completed), len(terminal)),
                "usable_result_rate": _rate(len(usable), len(terminal)),
                "duration_seconds": _duration_summary(terminal),
                "last_data_at": raw_last.isoformat() if raw_last else None,
                "data_age_seconds": _age_seconds(raw_last, now_utc),
                "last_valid_data_at": valid_last.isoformat() if valid_last else None,
                "valid_data_age_seconds": _age_seconds(valid_last, now_utc),
            }
        )

    terminal_runs = [run for run in all_runs if run.status in TERMINAL_STATUSES]
    completed_runs = [run for run in terminal_runs if run.status == "completed"]
    partial_runs = [run for run in terminal_runs if run.status == "partial"]
    failed_runs = [run for run in terminal_runs if run.status == "failed"]
    running_runs = [run for run in all_runs if run.status == "running"]
    stuck_runs = [run for run in running_runs if (_aware(run.started_at) or now_utc) < stuck_cutoff]
    zero_valid_runs = [
        run
        for run in terminal_runs
        if (run.comments_fetched or 0) > 0 and (run.comments_analyzed or 0) == 0
    ]

    snapshots = db.query(DataSnapshot).filter(DataSnapshot.created_at >= window_start).all()
    divergent_snapshots = [snapshot for snapshot in snapshots if snapshot_count_diverges(snapshot)]

    event_rows = (
        db.query(OperationalEvent.route_template, func.count(OperationalEvent.id))
        .filter(
            OperationalEvent.event_type == "drilldown_404",
            OperationalEvent.created_at >= window_start,
        )
        .group_by(OperationalEvent.route_template)
        .all()
    )
    drilldown_by_route = {str(route or "unknown"): int(count) for route, count in event_rows}
    drilldown_count = sum(drilldown_by_route.values())

    ticket_rows = (
        db.query(SupportTicket.category, func.count(SupportTicket.id))
        .filter(SupportTicket.created_at >= window_start)
        .group_by(SupportTicket.category)
        .all()
    )
    tickets_by_category = {str(category): int(count) for category, count in ticket_rows}
    total_tickets = sum(tickets_by_category.values())
    trust_tickets = sum(tickets_by_category.get(category, 0) for category in TRUST_TICKET_CATEGORIES)

    duration = _duration_summary(terminal_runs)
    partial_rate = _rate(len(partial_runs), len(terminal_runs))
    thresholds = {
        "success_rate_min": settings.OPS_SUCCESS_RATE_MIN,
        "partial_rate_max": settings.OPS_PARTIAL_RATE_MAX,
        "data_max_age_hours": settings.OPS_DATA_MAX_AGE_HOURS,
        "duration_p95_max_seconds": settings.OPS_DURATION_P95_MAX_SECONDS,
        "stuck_after_minutes": settings.OPS_STUCK_AFTER_MINUTES,
        "trust_tickets_warn": settings.OPS_TRUST_TICKETS_WARN,
    }

    alerts: list[dict] = []

    def add_alert(code: str, severity: str, message: str, value, threshold, action: str, href: str | None) -> None:
        alerts.append(
            {
                "code": code,
                "severity": severity,
                "message": message,
                "value": value,
                "threshold": threshold,
                "action": action,
                "href": href,
            }
        )

    if stuck_runs:
        add_alert("pipeline_stuck", "critical", "Há execuções presas além do limite.", len(stuck_runs), 0, "Abrir Logs e reconciliar as execuções presas.", "/dashboard/logs")
    if divergent_snapshots:
        add_alert("count_divergence", "critical", "Há snapshots com contagens incompatíveis.", len(divergent_snapshots), 0, "Bloquear a leitura afetada e revisar o funil de contagens.", "#ops-reference-details")
    if zero_valid_runs:
        add_alert("zero_valid_analyses", "critical", "Há execuções que coletaram comentários e produziram zero análises válidas.", len(zero_valid_runs), 0, "Revisar o provedor de análise e manter as superfícies em indisponível.", "/dashboard/logs")
    if drilldown_count:
        add_alert("drilldown_404", "warning", "Usuários encontraram drill-downs sem recurso correspondente.", drilldown_count, 0, "Reproduzir as rotas listadas e corrigir vínculo ou isolamento.", "#ops-drilldown-details")
    if partial_rate is not None and partial_rate > settings.OPS_PARTIAL_RATE_MAX:
        add_alert("partial_rate_high", "warning", "A proporção de execuções parciais ultrapassou o limite.", partial_rate, settings.OPS_PARTIAL_RATE_MAX, "Revisar os erros das execuções parciais por plataforma.", "/dashboard/logs")
    if duration["p95"] is not None and duration["p95"] > settings.OPS_DURATION_P95_MAX_SECONDS:
        add_alert("duration_p95_high", "warning", "A duração p95 do pipeline ultrapassou o limite.", duration["p95"], settings.OPS_DURATION_P95_MAX_SECONDS, "Inspecionar fila, provedor e lotes mais lentos.", "/dashboard/logs")
    if trust_tickets >= settings.OPS_TRUST_TICKETS_WARN:
        add_alert("trust_tickets_high", "warning", "Tickets ligados à confiança ultrapassaram o limite da janela.", trust_tickets, settings.OPS_TRUST_TICKETS_WARN, "Agrupar os tickets por causa e abrir uma investigação de produto.", "#ops-ticket-details")

    max_age_seconds = settings.OPS_DATA_MAX_AGE_HOURS * 3600
    for metric in platform_metrics:
        platform = metric["platform"]
        success_rate = metric["operational_success_rate"]
        if metric["terminal_runs"] and success_rate is not None and success_rate < settings.OPS_SUCCESS_RATE_MIN:
            add_alert(
                f"platform_success_rate_low:{platform}",
                "warning",
                f"A taxa de sucesso de {platform} está abaixo do limite.",
                success_rate,
                settings.OPS_SUCCESS_RATE_MIN,
                "Revisar as falhas e execuções parciais desta plataforma.",
                "/dashboard/logs",
            )
        if metric["active_connections"] and metric["terminal_runs"] == 0:
            add_alert(
                f"platform_no_recent_runs:{platform}",
                "warning",
                f"{platform} possui conexões ativas sem execução terminal na janela.",
                0,
                1,
                "Confirmar agenda, worker e fila desta plataforma.",
                "/dashboard/connect",
            )
        valid_age = metric["valid_data_age_seconds"]
        if metric["active_connections"] and (valid_age is None or valid_age > max_age_seconds):
            add_alert(
                f"valid_data_stale:{platform}",
                "warning",
                f"{platform} não possui dado válido dentro do limite de frescor.",
                valid_age,
                max_age_seconds,
                "Revisar a última coleta válida e o estado da análise.",
                "/dashboard/connect",
            )

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda alert: (severity_order.get(alert["severity"], 9), alert["code"]))
    status_value = "critical" if any(alert["severity"] == "critical" for alert in alerts) else "degraded" if alerts else "ok"

    return {
        "status": status_value,
        "generated_at": now_utc.isoformat(),
        "window": {
            "hours": hours,
            "start": window_start.isoformat(),
            "end": now_utc.isoformat(),
        },
        "thresholds": thresholds,
        "metrics": {
            "pipeline": {
                "terminal_runs": len(terminal_runs),
                "completed_runs": len(completed_runs),
                "partial_runs": len(partial_runs),
                "failed_runs": len(failed_runs),
                "running_runs": len(running_runs),
                "stuck_runs": len(stuck_runs),
                "stuck_run_refs": [str(run.id)[:8] for run in stuck_runs[:10]],
                "operational_success_rate": _rate(len(completed_runs), len(terminal_runs)),
                "partial_rate": partial_rate,
                "zero_valid_analyses": len(zero_valid_runs),
                "zero_valid_run_refs": [str(run.id)[:8] for run in zero_valid_runs[:10]],
                "duration_seconds": duration,
            },
            "platforms": platform_metrics,
            "count_reconciliation": {
                "snapshots_evaluated": len(snapshots),
                "divergences": len(divergent_snapshots),
                "sample_snapshot_refs": [str(snapshot.id)[:8] for snapshot in divergent_snapshots[:10]],
            },
            "drilldown_404": {
                "count": drilldown_count,
                "by_route": drilldown_by_route,
            },
            "support_tickets": {
                "total": total_tickets,
                "trust_related": trust_tickets,
                "by_category": tickets_by_category,
            },
        },
        "alerts": alerts,
        "instrumentation": {
            "success_rate_by_platform": "instrumented",
            "last_data_age": "instrumented_from_immutable_snapshots",
            "duration_p50_p95": "instrumented",
            "stuck_runs": "instrumented",
            "partial_percentage": "instrumented",
            "zero_valid_analyses": "instrumented",
            "count_divergences": "instrumented",
            "drilldown_404": "instrumented",
            "trust_tickets": "instrumented",
        },
    }
