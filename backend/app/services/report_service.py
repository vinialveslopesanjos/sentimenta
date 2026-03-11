"""
AI Health Report service.

Uses OpenRouter (Gemini 2.5 Flash) to generate a narrative reputational
health summary based on aggregated sentiment data.
"""

import logging
import json

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HEALTH_REPORT_MODEL = "google/gemini-2.5-flash"

DEFAULT_HEALTH_PROMPT = """Você é a voz analítica avançada da Sentimenta.

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

**IMPORTANTE:** Nos dados você receberá "sample_comments" com 5 comentários reais de cada sentimento (positivo, neutro, negativo). USE esses comentários para dar exemplos concretos do que a audiência está dizendo. Cite trechos reais entre aspas para enriquecer a análise e dar credibilidade.

Siga EXATAMENTE a estrutura visual pedida com os emojis e títulos fornecidos."""


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
