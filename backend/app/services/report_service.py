"""
AI Health Report service.

Uses Gemini to generate a narrative reputational health summary
based on aggregated sentiment data.
"""

import logging
import json

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def generate_health_report(data_summary: dict) -> str:
    """Generate a markdown health report via Gemini.

    Args:
        data_summary: Aggregated data dict with keys like
            platforms, avg_scores, sentiment_distributions, top_emotions, top_topics

    Returns:
        Markdown string with the report.
    """
    prompt = f"""Você é um analista de reputação digital. Com base nos dados abaixo,
escreva um relatório conciso (3-5 parágrafos) em português brasileiro sobre a
saúde reputacional do usuário nas redes sociais.

Inclua:
- Avaliação geral do sentimento (positivo, neutro, negativo)
- Destaques positivos e pontos de atenção
- Emoções predominantes e o que significam
- Tópicos mais discutidos pelo público
- Recomendações práticas para melhorar o engajamento

Dados:
{json.dumps(data_summary, ensure_ascii=False, indent=2)}

Responda APENAS com o relatório em markdown, sem explicações adicionais."""

    url = f"{GEMINI_BASE_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1500,
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        return text.strip()
    except Exception as e:
        logger.error("Failed to generate health report: %s", e)
        return (
            "**Relatório indisponível no momento.**\n\n"
            "Não foi possível gerar o relatório de saúde reputacional. "
            "Tente novamente mais tarde."
        )
