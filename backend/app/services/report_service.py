"""
AI Health Report service.

Uses OpenRouter (Gemini 2.5 Flash) to generate a narrative reputational
health summary based on aggregated sentiment data.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Mapping

import requests

from app.core.config import settings
from app.services.trust_language_policy import find_forbidden_claims

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HEALTH_REPORT_MODEL = "google/gemini-2.5-flash"
HEALTH_REPORT_CONTRACT_VERSION = 1

DEFAULT_HEALTH_PROMPT = """Você é a voz analítica avançada da Sentimenta.

Com base nos dados abaixo, escreva a análise de sentimento da audiência de forma intimista e cirúrgica, em português brasileiro.

**Tom esperado:** Próximo, humano e preciso. Descreva somente o período e a cobertura declarados em `report_context`. Prove seus pontos usando apenas números presentes no snapshot; não complete lacunas nem invente exemplos.

**Regras de formatação:**
- Use quebras de linha generosas entre parágrafos para facilitar a leitura em tela mobile.
- Coloque em **negrito** números, porcentagens, nomes de emoções e conclusões-chave.
- Não escreva blocos de texto corrido. Separe ideias em parágrafos curtos de 2-3 frases.

**Formato OBRIGATÓRIO (Markdown limpo sem usar blocos de código):**

✨ **O resumo da vez**

[1 ou 2 frases resumindo os sinais observados no período declarado]

👍🏽 **O que funcionou**

[Destaque para o tópico de maior sucesso ou atitude que deu certo baseada em % de sentimentos positivos/emoções. Use os números reais dos dados com criatividade]

⚠️ **Pontos de atenção**

[Alerte sobre volume de dúvidas, ironias, comentários negativos ou reclamações usando os dados. Se for baixo, indique um pequeno ajuste]

🚀 **Próximo passo sugerido**

[Se `recommendation_mode` for `current`, dê uma sugestão prática baseada no recorte. Em qualquer outro modo, não recomende ação de conteúdo no presente.]

**IMPORTANTE:** O payload vem de um snapshot imutável. Se `sample_comments` estiver vazio, não crie citações ou falas. A data de geração do texto nunca substitui o período dos dados.

Siga EXATAMENTE a estrutura visual pedida com os emojis e títulos fornecidos."""


def _iso_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return aware.astimezone(timezone.utc).isoformat()
    return str(value)


def build_health_report_basis(
    snapshot: Mapping[str, Any] | None,
    *,
    generated_at: datetime | str | None,
) -> dict[str, Any]:
    """Describe the immutable evidence and whether a current recommendation is allowed."""
    generated_iso = _iso_value(generated_at)
    if not snapshot:
        return {
            "contract_version": HEALTH_REPORT_CONTRACT_VERSION,
            "snapshot_id": None,
            "period_start": None,
            "period_end": None,
            "coverage_status": "unknown",
            "coverage_ratio": None,
            "health": "never_synced",
            "language_mode": "unavailable",
            "recommendation_mode": "blocked",
            "reason_code": "no_snapshot",
            "generated_at": generated_iso,
            "source": "none",
        }

    policy = dict(snapshot.get("language_policy") or {})
    coverage = dict(snapshot.get("coverage") or {})
    language_mode = str(policy.get("mode") or "unavailable")
    valid_count = int(snapshot.get("valid_count") or 0)
    if language_mode == "current" and valid_count > 0:
        recommendation_mode = "current"
    elif language_mode in {"qualified", "historical"} and valid_count > 0:
        recommendation_mode = "historical_only"
    else:
        recommendation_mode = "blocked"

    return {
        "contract_version": HEALTH_REPORT_CONTRACT_VERSION,
        "snapshot_id": str(snapshot.get("id")) if snapshot.get("id") else None,
        "period_start": _iso_value(snapshot.get("period_start")),
        "period_end": _iso_value(snapshot.get("period_end")),
        "coverage_status": str(coverage.get("status") or "unknown"),
        "coverage_ratio": coverage.get("ratio"),
        "health": str(snapshot.get("health") or "never_synced"),
        "language_mode": language_mode,
        "recommendation_mode": recommendation_mode,
        "reason_code": str(snapshot.get("reason_code") or "unknown"),
        "generated_at": generated_iso,
        "source": "none",
    }


def build_snapshot_report_data(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    """Build LLM input solely from metrics frozen inside one snapshot."""
    metrics = dict(snapshot.get("metrics") or {})
    global_metrics = dict(metrics.get("global") or {})
    profile_metrics = metrics.get("by_profile") or []
    profiles = snapshot.get("profiles") or []
    profile_metadata = {
        str(profile.get("connection_id")): profile
        for profile in profiles
        if profile.get("connection_id")
    }

    platforms = []
    for raw in profile_metrics if isinstance(profile_metrics, list) else []:
        metric = dict(raw or {})
        connection_id = str(metric.get("connection_id") or "")
        metadata = dict(profile_metadata.get(connection_id) or {})
        platforms.append({
            "connection_id": connection_id or None,
            "platform": metric.get("platform") or metadata.get("platform"),
            "username": metric.get("username") or metadata.get("username"),
            "total_analyzed": int(metric.get("valid_count") or 0),
            "avg_score": metric.get("avg_score"),
            "sentiment_distribution": metric.get("sentiment_distribution") or {},
        })

    if not platforms and len(profiles) == 1:
        profile = dict(profiles[0])
        platforms.append({
            "connection_id": str(profile.get("connection_id")) if profile.get("connection_id") else None,
            "platform": profile.get("platform"),
            "username": profile.get("username"),
            "total_analyzed": int(global_metrics.get("valid_count") or snapshot.get("valid_count") or 0),
            "avg_score": global_metrics.get("avg_score"),
            "sentiment_distribution": global_metrics.get("sentiment_distribution") or {},
        })

    basis = build_health_report_basis(snapshot, generated_at=None)
    return {
        "report_context": {
            "snapshot_id": basis["snapshot_id"],
            "period_start": basis["period_start"],
            "period_end": basis["period_end"],
            "coverage_status": basis["coverage_status"],
            "coverage_ratio": basis["coverage_ratio"],
            "health": basis["health"],
            "language_mode": basis["language_mode"],
            "recommendation_mode": basis["recommendation_mode"],
        },
        "overall": global_metrics,
        "platforms": platforms,
        "sample_comments": {"positive": [], "neutral": [], "negative": []},
        "evidence_limit": "immutable_snapshot_metrics_only",
    }


def _display_period(basis: Mapping[str, Any]) -> str:
    def display(value: Any) -> str:
        raw = str(value or "")[:10]
        parts = raw.split("-")
        return f"{parts[2]}/{parts[1]}/{parts[0]}" if len(parts) == 3 else "não comprovado"

    start = display(basis.get("period_start"))
    end = display(basis.get("period_end"))
    return start if start == end else f"{start} a {end}"


def _remove_recommendation_section(text: str) -> str:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        normalized = re.sub(r"[*#_]+", "", line).casefold()
        if "próximo passo" in normalized or "proximo passo" in normalized or "next step" in normalized:
            return "\n".join(lines[:index]).strip()
    return text.strip()


def _snapshot_fallback_text(snapshot: Mapping[str, Any], basis: Mapping[str, Any]) -> str:
    global_metrics = dict((snapshot.get("metrics") or {}).get("global") or {})
    valid_count = int(global_metrics.get("valid_count") or snapshot.get("valid_count") or 0)
    avg_score = global_metrics.get("avg_score")
    period = _display_period(basis)
    mode_title = "Leitura histórica do snapshot" if basis.get("language_mode") == "historical" else "Leitura com cobertura limitada"
    score_sentence = (
        f" O score médio registrado foi **{float(avg_score):.1f}/10**."
        if isinstance(avg_score, (int, float))
        else ""
    )
    return (
        f"🕰️ **{mode_title}**\n\n"
        f"Este diagnóstico se limita a **{valid_count} análises válidas** do período **{period}**."
        f"{score_sentence}\n\n"
        "⏸ **Recomendação atual suspensa**\n\n"
        "Atualize ou complete a cobertura antes de transformar esta leitura em uma ação para o presente."
    )


def enforce_health_report_policy(
    report_text: str,
    snapshot: Mapping[str, Any],
    basis: Mapping[str, Any],
) -> tuple[str, str]:
    """Qualify non-current reports and deterministically remove unsafe recommendations."""
    if basis.get("recommendation_mode") == "current":
        return report_text.strip(), "llm"

    body = _remove_recommendation_section(report_text)
    period = _display_period(basis)
    qualifier = (
        "🕰️ **Leitura histórica**"
        if basis.get("language_mode") == "historical"
        else "🔎 **Leitura com cobertura limitada**"
    )
    candidate = (
        f"{qualifier}\n\n"
        f"Os dados observados cobrem **{period}**.\n\n"
        f"{body}\n\n"
        "⏸ **Recomendação atual suspensa**\n\n"
        "Atualize ou complete a cobertura antes de transformar esta leitura em uma ação para o presente."
    ).strip()
    policy = dict(snapshot.get("language_policy") or {})
    if not body or find_forbidden_claims(candidate, policy):
        return _snapshot_fallback_text(snapshot, basis), "snapshot_fallback"
    return candidate, "llm_qualified"


def generate_health_report(data_summary: dict, custom_prompt: str | None = None) -> str:
    """Generate a markdown health report via OpenRouter (Gemini 2.5 Flash).

    Args:
        data_summary: Aggregated data dict with keys like
            platforms, avg_scores, sentiment_distributions, top_emotions, top_topics
        custom_prompt: Optional custom prompt to use instead of the default.

    Returns:
        Markdown string with the report.
    """
    base_prompt = custom_prompt if custom_prompt else DEFAULT_HEALTH_PROMPT

    user_message = f"""{base_prompt}

**Dados extraídos:**
{json.dumps(data_summary, ensure_ascii=False, indent=2)}"""

    payload = {
        "model": HEALTH_REPORT_MODEL,
        "messages": [
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.75,
        "max_tokens": 2000,
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        text = result["choices"][0]["message"]["content"]
        return text.strip()
    except Exception as e:
        logger.error("Failed to generate health report: %s", e)
        return (
            "**Relatório indisponível no momento.**\n\n"
            "Não foi possível gerar o relatório de saúde reputacional. "
            "Tente novamente mais tarde."
        )
