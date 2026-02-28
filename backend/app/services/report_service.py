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
    prompt = f"""Você é a voz analítica avançada da Sentimenta.

Com base nos dados abaixo, escreva a análise de sentimento da audiência de forma intimista e cirúrgica, em português brasileiro.

**Tom esperado:** Próximo, humano, no detalhe. Fale sobre o AGORA. Prove seus pontos usando os números extraídos nos dados para convencer, e não apenas números aleatórios soltos (ex: "com 142 menções positivas", "gerou pico de alegria (72%)", "0% de sarcasmo percebido", etc).

**Formato OBRIGATÓRIO (Markdown limpo sem usar blocos de código):**

✨ **O resumo da vez**
[1 ou 2 frases resumindo o clima geral, sentimentos em alta e como a audiência está reagindo agora]

✅ **O que funcionou**
[Destaque para o tópico de maior sucesso ou atitude que deu certo baseada em % de sentimentos positivos/emoções. Use os números reais dos dados com criatividade]

⚠️ **Pontos de atenção**
[Alerte sobre volume de dúvidas, ironias, comentários negativos ou reclamações usando os dados. Se for baixo, indique um pequeno ajuste]

🚀 **Próximo passo sugerido**
[Dê uma sugestão prática de ação para o criador de conteúdo hoje. Ex: um novo post, um story, melhoria no link, baseado no que o público engajou ou criticou na análise]

**Dados extraídos (Use-os para construir a resposta):**
{json.dumps(data_summary, ensure_ascii=False, indent=2)}

Siga EXATAMENTE a estrutura visual pedida com os emojis e títulos fornecidos."""

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
