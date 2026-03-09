# Sentimenta Pipeline — Status e Problemas (2026-03-09)

## Estado Atual

### O que funciona
- **Ingestao de dados:** Pipeline Apify-first funcionando. Posts e comentarios sao buscados e salvos no DB corretamente.
- **Botao "Analisar":** Frontend chama `POST /connections/{id}/analyze` que dispara `task_analyze_connection` — analise-only, sem re-ingestao.
- **Token refresh:** `apiFetch` no frontend faz auto-refresh do JWT quando recebe 401.
- **Desacoplamento save/step:** Comentarios sao commitados separadamente do step logging — nunca mais rollback silencioso.

### O que foi corrigido nesta sessao

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | 1349 comments buscados, 0 salvos no DB | `_append_step` fazia `db.commit()/rollback()` enquanto comments estavam pending na sessao SQLAlchemy | Desacoplado save de step: commit unico para comments, step logging so depois |
| 2 | Botao "Analisar" rodava pipeline completo (ingestao + analise) | `handleSync()` chamava `connectionsApi.sync()` que dispara `task_full_pipeline` | Criado `task_analyze_connection` + endpoint `POST /{id}/analyze` + frontend chama `connectionsApi.analyze()` |
| 3 | Token JWT expirava apos 60min sem refresh | Frontend nao tinha auto-refresh de token | Adicionado `tryRefreshToken()` em `apiFetch` — intercepta 401, renova via `/auth/refresh` |
| 4 | `_append_step` fazia rollback silencioso | `except Exception: db.rollback()` sem logging | Adicionado `logger.error()` no except |

### Problema atual: Gemini 429 (Too Many Requests)

**Sintoma:** 608 comentarios analisados pelo LLM retornam com `confidence=0.0`, `score_0_10=None`, `summary_pt="Erro na analise: 429 Client Error: Too Many Requests"`. O pipeline reporta status `PARCIAL` com 608 erros.

**Cadeia de falha:**

```
Gemini Free Tier: ~15 RPM (requests por minuto)

Para 608 comments em batches de 50:
  - 13 chamadas de batch (analyze_comments)
  - 10 chamadas de analyze_image (uma por post, ANTES dos comments)
  - Total: ~23 API calls

Timing (ANTES do fix):
  - Inter-batch delay: 3 segundos
  - LLM retry: 3 tentativas, delay 2s/4s/6s
  - Todas as 23 calls acontecem em ~1 minuto
  - Resultado: 429 em cascata

O que o LLM client fazia:
  1. Tenta 3x com delays de 2s, 4s, 6s
  2. Apos 3 falhas: yield {confidence: 0.0, score_0_10: None, summary: "Erro..."}
  3. NAO levanta excecao — retorna resultado de "erro" normalmente

O que o analysis_service fazia:
  1. is_error = confidence in (None, 0) — detecta o resultado como erro
  2. comment.status = "error"
  3. stats["errors"] += 1
  4. MAS stats["analyzed"] tambem += 1 (parece ter processado)
```

**Resultado:** 608 CommentAnalysis records com dados invalidos salvos no DB. Pipeline reporta "608 analisados, 608 erros".

### Fixes aplicados (2026-03-09)

#### 1. LLM Client — Exponential backoff + deteccao de 429

**Arquivo:** `backend/app/services/llm_client.py`

- `MAX_RETRIES`: 3 → 5
- `RETRY_DELAY`: 2s → 5s base
- Novo: `RATE_LIMIT_DELAY = 30s` — delay especifico para 429
- Backoff exponencial: `RETRY_DELAY * 2^attempt + jitter(1-3s)`
- Para 429: `RATE_LIMIT_DELAY + jitter(5-15s)` = ~35-45s por retry
- `analyze_image()` tambem ganhou retry com backoff em 429

#### 2. Analysis Service — Delays e deteccao de erro

**Arquivo:** `backend/app/services/analysis_service.py`

- Inter-batch delay: 3s → 8s (garante < 15 RPM)
- `is_error`: `confidence in (None, 0)` → `score_0_10 is None` (mais preciso)
- Delay de 5s apos `analyze_image()` bem-sucedido (respeita RPM)

#### 3. Cleanup de dados corrompidos

```sql
-- 608 analyses com dados invalidos deletadas
DELETE FROM comment_analysis WHERE score_0_10 IS NULL AND confidence = 0 AND summary_pt LIKE 'Erro na%';
-- 608 comments resetados para re-analise
UPDATE comments SET status = 'pending', last_error = NULL WHERE status = 'error';
```

### Numeros pos-cleanup

| Metrica | Valor |
|---------|-------|
| Analyses boas | 2254 |
| Analyses de erro (deletadas) | 0 |
| Comments pendentes | 2776 (608 resetados + 2168 que ja estavam pending) |
| Comments processados | 2254 |

### Proximos passos

1. **Reiniciar servicos** (`supervisorctl restart sentimenta-api sentimenta-celery`)
2. **Re-rodar analise** via botao "Analisar" no frontend
3. **Monitorar logs:** `tail -f /var/log/sentimenta-celery.log`
   - Esperar ver: "Rate limit (429) hit, waiting Xs before retry"
   - Nao deve mais ver: "_append_step commit failed"
4. **Tempo estimado:** 2776 comments / 50 por batch = ~56 batches × 8s delay = ~7-8 minutos (sem 429)
   - Se houver 429s com retry: adicionar ~45s por retry
   - Pior caso (vários 429s): ~15-20 minutos

### Arquitetura do Pipeline

```
Frontend (SyncButton.tsx)
  └─ POST /connections/{id}/analyze
       └─ task_analyze_connection (Celery)
            ├─ Reset error comments → pending
            ├─ For each post:
            │   ├─ analyze_post_comments(db, post.id)
            │   │   ├─ analyze_image() [se nao tem image_context]  → Gemini API
            │   │   │   └─ 5s delay apos sucesso
            │   │   └─ For each batch (50 comments):
            │   │       ├─ LLMClient.analyze_comments() → Gemini API
            │   │       │   └─ On 429: wait 30-45s, retry (up to 5x)
            │   │       └─ 8s delay antes do proximo batch
            │   └─ generate_post_summary(db, post.id)
            └─ Update pipeline_run status
```
