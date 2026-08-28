# P0 — Estancar vazamento de créditos no pipeline (Julho/2026)

Data: 2026-07-06
Status: **EM EXECUÇÃO** (ver checklist §4 — atualizar conforme avança)
Branch: `fix/credit-leaks-p0` (criado de `origin/main` @ `eb34047`)
Worktree local: `D:\vscode\Projetos\sentimenta-funnel` (git worktree do repo principal; tem junctions de `node_modules` apontando para o checkout principal)
PR alvo: base `main`, título "P0: estancar vazamento de créditos no pipeline"

> Este doc existe para que **qualquer sessão/IA consiga retomar o trabalho do zero**.
> Contexto de negócio: `docs/aquisicao/PLANO_FATURAMENTO_JULHO_2026.md`.
> Origem dos achados: auditoria de arquitetura feita em 06/07 (sessão Claude) sobre o commit `eb34047`.

---

## 1. Contexto — o que está vazando e por quê importa

O produto cobra por créditos (1 crédito = 1 comentário analisado; pricing jul/2026 em
`docs/prioridade/PRICING_2026-07.md`: Starter R$197/10k, Pro R$497/40k, trial 14d = 1.000 créditos).
O pipeline atual analisa primeiro e tenta debitar depois — e em vários caminhos nem debita.
Com o tráfego de Ads começando, cada trial pode consumir análise ilimitada de graça.

### Achados (commit eb34047)

| # | Problema | Onde (arquivo:linha no eb34047) |
|---|---|---|
| 1 | `task_analyze_connection` (endpoint `/analyze`) roda o LLM em todos os pendentes e **nunca debita créditos** | `backend/app/tasks/pipeline_tasks.py:162-296` |
| 2 | `task_full_pipeline` e `task_daily_sync` debitam **depois** da análise, em lump-sum, e **engolem `InsufficientCreditsError`** — usuário sem saldo recebe o trabalho de graça | `pipeline_tasks.py:470-473` e `:727-730` |
| 3 | `task_daily_sync` (beat) **não checa saldo antes de ingerir via Apify** — gasta dinheiro real de scraping para usuário com 0 créditos | `pipeline_tasks.py:560-655` |
| 4 | Lock anti-run-concorrente é check-then-insert (TOCTOU): `trigger_sync`/`trigger_analyze` consultam `status=='running'` e depois inserem — 2 cliques quase simultâneos criam 2 runs | `backend/app/routers/connections.py:591` e `:678` |
| 5 | `trigger_analyze` não valida crédito nenhum na entrada (nem `enforce_sync_limits`) | `connections.py:664-720` |

## 2. Design das correções

**Princípio: débito incremental por post + interrupção quando o saldo zera.**
Nada de reserva/hold nesta fase (isso é P1 — ver §6). Overshoot máximo aceito = 1 post
(limitado por `max_comments_per_post`), documentado no PR.

1. **`credit_service.consume_up_to(db, user_id, amount, ...) -> int`** *(novo)*: igual ao
   `consume()` (lock `with_for_update`, drena plan→pack, grava transação), mas nunca
   lança — consome `min(disponível, amount)` e retorna o consumido. Caller compara com
   `amount` pra detectar esgotamento. Também novo: `get_available_credits(db, user_id)`.
2. **Loop de análise credit-aware** nas 3 tasks (`task_analyze_connection`,
   `task_full_pipeline`, `task_daily_sync`): antes de cada post, se
   `get_available_credits() <= 0` → break com `skipped_reasons.add("créditos esgotados")`
   (o `_finalize_run_status` já transforma isso em run `partial` com nota).
   Depois de cada post analisado: `consumed = consume_up_to(analyzed)`; se
   `consumed < analyzed` → break também. **Remover os blocos lump-sum de consume no
   final** de `task_full_pipeline` (linhas ~458-473) e `task_daily_sync` (~715-730).
   Demographics continua debitando como está (5 créd/perfil).
3. **Beat**: em `task_daily_sync`, logo após os checks de plano e antes de criar a run/
   `_do_ingest`: `if get_available_credits(db, conn.user_id) <= 0: results[...] =
   {"skipped": "no_credits"}; continue`.
4. **Migração Alembic** (head atual: `e5f6a7b8c9d0`): (a) dedup — para conexões com >1
   run `running`, manter a mais recente e marcar as demais `failed` com nota; (b)
   `CREATE UNIQUE INDEX uq_pipeline_runs_one_running_per_connection ON pipeline_runs
   (connection_id) WHERE status = 'running'`. Downgrade: drop index.
5. **Routers** (`connections.py`): envolver o `db.commit()` da criação do `PipelineRun`
   em try/except `IntegrityError` → rollback + HTTP 409 "já em andamento". Nas tasks que
   criam run internamente (analyze sem run_id, full sem run_id, daily_sync), capturar
   `IntegrityError` → skip/erro gracioso. Em `trigger_analyze`, adicionar guard:
   `get_available_credits() <= 0` → HTTP 402 com mensagem de upgrade/pacote.
6. **Testes** (`backend/tests/`): usar pytest existente. Casos mínimos:
   - analyze task debita créditos (novo — era o vazamento #1)
   - análise para quando créditos esgotam no meio (run vira `partial`, transação bate)
   - `consume_up_to` consome parcial e retorna o consumido; 0 quando sem saldo
   - daily_sync pula usuário sem créditos (não chama `_do_ingest`)
   - segunda run concorrente → 409 no router / IntegrityError tratada
   - `trigger_analyze` com saldo 0 → 402

## 3. Estado do ambiente (para retomar)

- Worktree: `D:\vscode\Projetos\sentimenta-funnel` no branch `fix/credit-leaks-p0`.
  Se não existir: `cd D:\vscode\Projetos\sentimenta && git worktree add ../sentimenta-funnel -b fix/credit-leaks-p0 origin/main`.
- Backend Python: rodar testes com o venv/python do sistema — checar
  `backend/requirements.txt`; testes em `backend/tests/` (pytest). Pode ser preciso
  `pip install -r backend/requirements.txt` num venv novo.
- Frontend não é tocado neste P0.
- Produção: VPS 147.93.13.49:2222 (chave `C:\Users\Vinicius\.ssh\pbarbosa_vps_ed25519`),
  deploy em `/opt/sentimenta-main-deploy` via docker compose; migração roda no deploy
  (verificar workflow `deploy-production.yml`). **Não deployar sem o Vinicius aprovar o PR.**

## 4. Checklist de execução (ATUALIZAR AQUI)

- [x] Branch `fix/credit-leaks-p0` criado de `origin/main` (eb34047)
- [x] `credit_service.py`: `consume_up_to()` + `get_available_credits()` adicionados
- [x] `pipeline_tasks.py`: débito por post + break em esgotamento nas 3 tasks; lump-sums removidos; demographics pulado sem saldo e usando `consume_up_to`
- [x] `pipeline_tasks.py`: check de saldo no `task_daily_sync` antes do ingest (`skipped: no_credits`)
- [x] Migração Alembic `b7c9d1e3f5a7_unique_running_run_per_connection.py` (dedup + partial unique index)
- [x] `connections.py`: IntegrityError→409 nos dois endpoints + guard 402 no `trigger_analyze`
- [x] Tasks: IntegrityError tratada na criação interna de runs (analyze, full, daily_sync)
- [x] Testes novos: `backend/tests/test_credit_debits.py` (+ ajuste em `test_connections.py` que agora precisa de créditos)
- [x] Suite completa verde: **83 passed, 0 failed** (venv em scratchpad/venv-backend). Ajustes: campos reais dos models no helper de teste; `_finalize_run_status` agora força `partial` quando a run é cortada por saldo com backlog pendente
- [x] Bônus: `.gitignore` corrigido — a regra `tests/` global impedia QUALQUER teste novo do backend de entrar no git (agora `/tests/` só na raiz + `!backend/tests/`)
- [ ] Commit + push + PR aberto (base main) com descrição dos 5 achados
- [ ] (pós-merge, Vinicius) deploy + rodar migração + smoke test de sync

## 5. Riscos/observações para quem retomar

- `consume()` original continua existindo (usado por demographics e outros) — não remover.
- O check `get_available_credits` usa `get_or_create_balance` (pode CRIAR balance com
  créditos do plano se não existir — comportamento herdado; ok).
- Runs `running` com `connection_id IS NULL` não são afetadas pelo unique parcial (NULLs
  são distintos no Postgres) — comportamento desejado.
- `_mark_stale_running_runs` (6h) continua sendo a válvula de escape para runs presas;
  o index não impede nova run após a antiga ser marcada `failed`.
- Admin/enterprise têm 999.999 créditos/mês — débitos funcionam normalmente, sem
  isenção especial (o próprio Vinicius consome do saldo admin ao rodar análises).
- CUIDADO: há um branch antigo `origin/feat/security-fixes` (ADR-013, abril/2026) com
  preflight/pré-autorização — NÃO mergear; é referência de design para o P1.

## 6. O que fica para o P1 (não fazer agora)

Reserva (hold) de créditos na criação da run + liquidação/estorno; endpoint de preflight
com estimativa real; campo `stage` no PipelineRun; RunContext global no frontend;
consolidação de custo por run (popular `apify_cost_usd` órfã). Ver análise completa na
conversa de 06/07 e no ADR-013.
