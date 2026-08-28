# P1 — Experiência premium de rodar análise (Julho/2026)

Data: 2026-07-07
Status: **EM EXECUÇÃO** (checklist §3)
Branch: `feat/run-experience-p1` (criado de `fix/credit-leaks-p0`; **rebasar para `origin/main` após merge do PR #64** antes de abrir o PR: `git rebase --onto origin/main fix/credit-leaks-p0 feat/run-experience-p1`)
Worktree: `D:\vscode\Projetos\sentimenta-funnel`
Pré-requisito: PR #64 (P0 créditos) mergeado — este P1 constrói sobre `consume_up_to`/`get_available_credits`.
Contexto completo: `docs/prioridade/P0_CREDIT_LEAKS_PLAN_2026-07.md` §6 e conversa de 06-07/07.

## 1. Objetivo

O usuário logado hoje dispara análise às cegas (sem saber custo em créditos), o feedback
some ao navegar, e o histórico está escondido numa página chamada "Logs do Pipeline".
O P1 entrega: **preflight com estimativa → progresso persistente com etapa real →
histórico legível com créditos consumidos**.

Decisão de escopo: **reserva/hold de créditos NÃO entra** — o débito por post do P0 já
protege a receita; o valor de UX do hold (saber custo antes) é entregue pelo preflight.

## 2. Design

### Backend
1. **Coluna `stage`** em `pipeline_runs` (VARCHAR(30) nullable, migração nova com
   down_revision = `b7c9d1e3f5a7`). Valores: `queued|ingesting|analyzing|demographics|report|done`.
   Helper `_set_stage(db, run, stage)` em `pipeline_tasks.py`; transições nas 3 tasks.
2. **`stage` exposto** em `PipelineRunResponse` (schemas/pipeline.py), nos 2 builders do
   router pipeline.py, no endpoint de status e no payload SSE.
3. **Endpoint preflight**: `POST /connections/{id}/preflight?mode=sync|analyze`, body =
   `SyncRequest` (mesmo do sync). Response:
   `{mode, estimated_posts, estimated_comments, estimated_credits, available_credits,
   fits, missing_credits, estimated_minutes_min, estimated_minutes_max,
   pending_comments (mode analyze), avg_comments_per_post}`.
   - mode=analyze: `estimated_credits = comentários pending/error da conexão`.
   - mode=sync: posts/comentários efetivos capados pelo plano (mesma lógica do
     trigger_sync); média histórica de comment_count dos posts da conexão (fallback 50)
     para estimativa realista + teto máximo.
   - Sem side effects (não cria run, não debita).
4. **Testes**: preflight sync/analyze, caps de plano, fits=false com saldo baixo.

### Frontend
5. **`lib/api.ts`**: `connectionsApi.preflight(token, id, params, mode)` + tipos.
6. **`PreflightModal`**: mostra estimativa (posts, comentários, créditos vs saldo, tempo)
   com confirm/cancelar. Sem saldo suficiente → CTA "Comprar créditos"/"Ver planos".
   Estilo: componentes ds/ existentes (GlassCard, Button), tema via CSS vars.
7. **Fluxo**: connect page `handleSync`/`handleSyncAll` e profile page `analyze` passam
   pelo modal antes de disparar. 402 do backend → toast com CTA de upgrade.
8. **`ActiveRunsProvider`** (context + polling de `pipelineApi.listRuns` a cada 5s
   enquanto houver run `running`; para quando não houver): pílula persistente no header
   do dashboard "Analisando @user · etapa · N%" → linka pra página de análises. Botões
   de sync ficam disabled para conexão com run ativa.
9. **Rename**: "Logs do Pipeline" → "Análises" (sidebar + título da página, pt-BR/en).
10. **Deletar `SyncButton.tsx`** (código morto — ninguém importa; tem bug de "Concluído"
    falso).

## 3. Checklist (ATUALIZAR)

- [x] Migração `c8d0e2f4a6b8` (stage) + model + schema + router + SSE
- [x] `_set_stage` + transições nas 3 tasks (ingesting→analyzing→demographics→report→done)
- [x] Endpoint `POST /connections/{id}/preflight?mode=sync|analyze` + 5 testes (`tests/test_preflight.py`)
- [x] api client (`connectionsApi.preflight`) + tipos (`PreflightEstimate`, `PipelineRun.stage`)
- [x] `PreflightModal.tsx` + integração connect page (sync único via `requestSync` e sync all via `requestSyncAll` com agregação)
- [x] Integração profile page (analyze com preflight; modal bloqueia sem saldo com CTA "Obter créditos" — cobre o caso 402)
- [x] `ActiveRunsContext.tsx` (provider com polling 5s condicionado a run ativa) + pílula no header do dashboard; botão de sync desabilitado para conexão com run ativa
- [x] Rename "Logs do Pipeline"→"Análises" (nav + título, pt-BR/en). Créditos por run na tabela ficou de fora (precisa join com transactions — anotado como melhoria)
- [x] SyncButton.tsx deletado (era código morto com bug)
- [x] `tsc --noEmit` verde + suite backend **88 passed**
- [ ] Rebase sobre main pós-merge do #64 + PR aberto

## 4. Notas para quem retomar

- Venv de testes backend já existe: `scratchpad/venv-backend/Scripts/python.exe`
  (caminho completo no doc do P0). Rodar: `cd D:\vscode\Projetos\sentimenta-funnel\backend && <venv>/python -m pytest tests/ -q`.
- Testes frontend: só `tsc` (`npm run type-check` em frontend/, junction de node_modules já criada).
- O SSE existente exige JWT em query string e o frontend NÃO usa (polling). Não investir
  no SSE agora — o ActiveRunsProvider usa polling do listRuns mesmo.
- `.gitignore` já corrigido no P0 para aceitar testes novos do backend.
