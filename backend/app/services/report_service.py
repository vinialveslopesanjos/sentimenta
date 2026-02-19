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
    prompt = f"""Você é a voz da Sentimenta — uma plataforma que ajuda criadores e marcas a entenderem seu público com empatia e clareza.

Com base nos dados abaixo, escreva uma análise de saúde reputacional em português brasileiro.

**Tom esperado:** Próximo, humano, como um amigo que entende de dados. Não é relatório corporativo. É conversa inteligente. Use frases curtas e diretas. Celebre o que está indo bem. Seja honesto sobre os desafios, mas sempre com um caminho a seguir.

**Formato obrigatório (Markdown):**
- Comece com uma linha de abertura impactante (1 frase que capture o momento atual da marca)
- Use `## 🌟 O que está funcionando` para pontos positivos
- Use `## ⚠️ Pontos de atenção` para alertas (só se houver dados negativos relevantes)
- Use `## 💡 Insights do público` para emoções/tópicos mais relevantes
- Use `## 🚀 Próximos passos` para 2–3 ações concretas e realizáveis
- Use **negrito** para destacar números e métricas-chave dentro do texto
- Cada seção: 2–4 frases. Sem listas longas. Sem jargão.

**Dados disponíveis:**
{json.dumps(data_summary, ensure_ascii=False, indent=2)}

Responda APENAS com o relatório em Markdown. Não inclua explicações ou meta-comentários."""

    url = f"{GEMINI_BASE_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.75,
            "maxOutputTokens": 2000,
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
