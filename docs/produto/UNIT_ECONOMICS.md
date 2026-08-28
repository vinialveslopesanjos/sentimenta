# Economia unitária por 1.000 comentários

Status: **modelo operacional versionado, não tabela de cobrança**

Versão revisada: **2026-08-28**

Implementação da previsão: `backend/app/services/collection_preview_service.py`

## O que este documento responde

Este é o ponto canônico para estimar o custo variável de coletar e analisar
comentários no Sentimenta. A faixa existe porque rede, origem, volume devolvido,
tamanho dos textos, retries e deduplicação mudam a cada execução.

O número exibido antes da coleta é uma previsão interna e não uma cobrança ao
cliente. O consumo comercial continua sendo expresso em créditos.

## Premissas atuais

- Câmbio de planejamento: **R$ 6,00 por US$ 1,00**. É uma premissa conservadora
  fixa desta versão, não cotação ao vivo.
- LLM padrão no código: `google/gemini-2.5-flash` via OpenRouter.
- OpenRouter lista Gemini 2.5 Flash a **US$ 0,30/M tokens de entrada** e
  **US$ 2,50/M tokens de saída**:
  <https://openrouter.ai/google/gemini-2.5-flash>.
- O modelo de previsão reserva **R$ 0,50–R$ 2,00 por 1.000 comentários** para
  sentimento em texto. A faixa pressupõe batches de 30 e aproximadamente
  50–100 tokens de entrada e 20–100 de saída por comentário. Uso real deve ser
  reconciliado pelos tokens retornados pelo OpenRouter.
- O Actor padrão de comentários públicos do Instagram está marcado como
  **under maintenance** e lista **US$ 0,50/1.000 comentários**:
  <https://apify.com/apidojo/instagram-comments-scraper>.
- O Actor mantido pela Apify lista preço a partir de **US$ 1,90/1.000** em
  planos pagos e documenta **US$ 2,30/1.000** no plano gratuito:
  <https://apify.com/apify/instagram-comment-scraper>.
- O Actor usado no TikTok lista preço a partir de **US$ 0,50/1.000**:
  <https://apify.com/clockworks/tiktok-comments-scraper>.
- O plano Starter da Apify custa **US$ 29/mês**, com US$ 29 de uso incluído:
  <https://apify.com/pricing>.

## Faixa variável usada no produto

| Caminho | Coleta por 1.000 | LLM por 1.000 | Faixa operacional adotada |
| --- | ---: | ---: | ---: |
| Instagram OAuth / Graph API | sem preço por resultado | R$ 0,50–2,00 | **R$ 0,50–2,00** |
| YouTube Data API | quota, sem preço por comentário | R$ 0,50–2,00 | **R$ 0,50–2,00** |
| Instagram público / Apify | R$ 3,00–13,80 | R$ 0,50–2,00 | **R$ 3,50–15,80** |
| TikTok / Apify | a partir de R$ 3,00 | R$ 0,50–2,00 | **R$ 3,50–10,00** |
| X / Twitter | indisponível no produto | — | **não estimar** |

O código arredonda essas premissas por comentário e acrescenta uma pequena
reserva por post nos caminhos Apify. O limite superior é orçamento de segurança,
não promessa de que a execução custará esse valor.

## Custos fixos fora da faixa

- plano Apify, atualmente US$ 29/mês no Starter;
- VPS, banco PostgreSQL, Redis, Celery, armazenamento, backup e observabilidade;
- Stripe, e-mail e ferramentas de aquisição;
- visão computacional de posts e relatório de saúde por LLM;
- enriquecimento demográfico, que tem coleta e inferência próprias;
- suporte humano e custo de operação.

Esses custos devem ser rateados por cliente ativo e adicionados à margem, mas
não pertencem à previsão de uma execução individual.

## O multiplicador escondido que precisa de instrumentação

Em sincronizações incrementais, um provedor pode devolver comentários já vistos.
A Apify cobra pelos resultados devolvidos, enquanto o banco salva apenas os
novos após deduplicação. Portanto:

`custo do provedor = itens devolvidos`, não `comentários novos salvos`.

Hoje a previsão mantém o teto de candidatos mesmo no modo de priorização por
engajamento. A priorização reduz análise e créditos, mas **não promete reduzir a
coleta**, porque é necessário obter candidatos antes de ordená-los por curtidas.

## Como atualizar sem voltar a números contraditórios

1. Revisar links e preços acima.
2. Atualizar `FORECAST_MODEL_VERSION` e as faixas do serviço de previsão.
3. Atualizar a tabela deste documento na mesma mudança.
4. Rodar os testes de custo e previsão.
5. Comparar a previsão com pelo menos 30 execuções reais por origem, usando
   itens cobrados, tokens reais e custo registrado.
6. Só estreitar a faixa quando p50/p90 forem reproduzíveis.

## Dívida conhecida

`backend/app/services/plan_service.py` ainda contém uma estimativa histórica
misturada de R$ 0,02 por comentário usada como guardrail de orçamento. Ela não é
a fonte da nova previsão e não deve ser apresentada ao usuário como custo real.
O próximo passo financeiro é substituir esse proxy por componentes separados:
coleta cobrada, LLM, demografia, custo fixo rateado e total interno.
