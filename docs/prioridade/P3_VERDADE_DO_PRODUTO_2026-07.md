# P3 — A verdade do produto (teste em produção, 07/07/2026)

Origem: teste T0–T2 executado em produção (conta admin) após deploy dos PRs #66/#68.
Evidências: logs do worker, banco de produção, console Apify, navegação real.

## Resultados do teste

| Item | Resultado |
|---|---|
| Guard-rails Apify | ✅ `maxTotalChargeUsd=2` confirmado na URL da chamada real |
| `apify_cost_usd` por run | ✅ $0.1702 persistido na run T2 |
| Débito por post | ✅ transações caindo certinhas (P0) |
| Pílula/stage | ✅ durante a run; ❌ stage final fica "report" (bug de ordem no finalize) |
| Beat reconciliação | ✅ limpou 6 runs presas na 1ª execução |
| ETA do preflight | ❌ "2–6 min" → T1 levou **2h53** |
| Estimativa de créditos | ❌ "~50" → debitou **442** (67 análise + 375 demographics invisível) |
| Contador de análise | ❌ "1718/617" (>100%, mistura backlog) |
| Custo LLM por run | ❌ **$0.0000** com 1718 análises — quebrado NA FONTE (analysis_service) |
| Velocidade de análise | ❌ ~12 comentários/min (Vision por post + batches 2min + API LLM instável) |
| Cliques silenciosos | ❌ sync às vezes não responde nada (2 ocorrências) |
| A11y | ❌ botões de ação sem aria-label (até IA confunde toggle com botão) |
| Segurança | 🚩 token Apify logado em claro nas URLs do worker |

## INCIDENTE RESOLVIDO: worker fantasma

Havia **dois Celery workers na mesma fila**: o do Docker (main, com guard-rails) e um
via Supervisor (`sentimenta-celery`) rodando `/opt/sentimenta` = **branch ADR-013 de
abril, sem nenhum teto**. Explica: transações reserve/release misteriosas, 6 runs presas
(não 3), e risco de o daily_sync noturno repetir o incidente dos $40 com código velho.
**Ação tomada: `supervisorctl stop sentimenta-celery`** (reversível). Pendente: remover
config do supervisor + arquivar /opt/sentimenta antigo (decisão do Vinicius).

## Diagnóstico de produto (por que "não parece um produto bom")

O problema não é visual — é que **o produto quebra o contrato com o usuário em cada
análise**: promete 50 créditos/5 min e entrega 442 créditos/3 horas com status "parcial"
e contador >100%. Conceitos internos (backlog, demographics automático, run partial,
incremental) vazam sem tradução. Um trial de 1.000 créditos morre em 1 sync sem o
usuário entender. O motor é lento demais para a promessa da landing ("primeira leitura
<2min") e para o caso de uso de crise.

## Plano P3 (ordem)

### P3.0 — Honestidade e correções (1–2 dias)
1. Preflight honesto: incluir demographics no custo (ou torná-lo **opt-in** com checkbox
   "+N créditos"), mostrar backlog pendente separado de novos, avisar quando sync
   incremental não trará nada novo.
2. Contadores: "novos analisados" vs "backlog processado" separados; nunca >100%.
3. Fix stage final ("done" após report) + investigar custo LLM=0 no analysis_service
   (calcular por tokens×tabela de preço) — sem isso a margem por cliente segue cega.
4. Token fora dos logs (httpx event hook ou logger filter).
5. Falha silenciosa de clique: toast de erro em qualquer exceção do preflight/sync.
6. Infra: remover supervisor sentimenta-* de vez; arquivar /opt/sentimenta.

### P3.1 — Motor (semana)
7. Performance da análise: meta 500 comentários < 5 min (batches maiores, paralelizar
   posts, Vision async fora do caminho quente, revisar sleeps/retries).
8. Notificação "análise pronta" (e-mail já existe pro daily; estender ao manual) com
   resumo do que mudou + o que foi cobrado.
9. ETA baseado no ritmo real medido (runs anteriores), não constante otimista.

### Norte de produto
O produto bom aqui é UM loop confiável: conectar → estimativa honesta → rodar rápido →
avisar quando pronto → mostrar o que foi cobrado e o que mudou. Tudo o mais é acessório
até esse loop ser impecável.
