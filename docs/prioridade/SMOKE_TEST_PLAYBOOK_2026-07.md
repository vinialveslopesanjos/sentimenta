# Smoke Test Playbook — Sentimenta

Data: 2026-07-07
Uso: executado por humano OU por IA com browser (plugin Claude-in-Chrome, Playwright, etc.)
Quando: após TODO deploy em produção; versão automatizada roda no CI.

## O que é smoke test (contexto)

Verificação rápida (3–10 min) do caminho crítico após um deploy: "o essencial funciona?".
Não substitui a suite de testes — pega o que ela não pega: env vars faltando, migração
não aplicada, CDN/nginx quebrado, integração externa fora do ar.

Camadas (da mais barata pra mais completa):
1. **Healthcheck HTTP** — `GET /api/v1/health` e `GET /` retornam 200 (segundos, roda a cada 30min via cron).
2. **Smoke E2E automatizado** — 3–6 specs Playwright no fim do deploy (minutos).
3. **Smoke exploratório por IA/humano** — este playbook (usado em mudanças grandes de UX).

---

## Regras para o executor (IA ou humano)

- **Conta de teste dedicada**: `smoke@sentimenta.com.br` (criar; plano starter com poucos créditos).
  NUNCA usar a conta admin do fundador para smoke — os limites/planos diferem do cliente real.
- **NUNCA confirmar ações que gastem dinheiro** (modal de preflight → sempre "Cancelar",
  exceto se o roteiro disser explicitamente para confirmar com teto conhecido).
- Tirar **print de cada tela numerada** e anotar: ✅ ok / ⚠️ estranho / ❌ quebrado.
- Tempo alvo: 10 min. Se algo bloquear >2 min, registrar e seguir.
- Relatório final: tabela passo → status → evidência (print) → observação.

## Roteiro A — Conta existente (rotina) ~6 min

| # | Ação | Verificar |
|---|---|---|
| A1 | Login em sentimenta.com.br/login (conta smoke) | Redireciona pro dashboard sem erro |
| A2 | Dashboard | KPIs carregam (<10s); score e cards sem "NaN"/placeholder eterno; sidebar sem itens duplicados |
| A3 | Header | Se houver run ativa: pílula de progresso visível e clicável → vai para Atividade |
| A4 | Conectar Perfis | Tabela de conexões carrega; box de plano/créditos coerente (sem "ilimitados (N restantes)") |
| A5 | Clicar "Analisar" numa conexão | **Modal de preflight abre** com estimativa (posts, comentários, créditos vs saldo, tempo) → **CANCELAR** |
| A6 | Página Atividade | Histórico carrega; nenhuma run RODANDO com mais de 4h30; custos/contadores não-zerados em runs concluídas |
| A7 | Análise (insights) | Gráficos renderizam com dados |
| A8 | Conta/Settings | Página abre; plano exibido correto |
| A9 | Trocar tema (dark/light) e idioma (PT/EN) | Sem texto vazado/quebrado |
| A10 | Logout | Volta pra landing/login |

## Roteiro B — Usuário novo (onboarding) ~4 min

| # | Ação | Verificar |
|---|---|---|
| B1 | Janela anônima → sentimenta.com.br | Landing carrega; preços atuais; link Diagnóstico grátis presente |
| B2 | Aceitar cookies → Criar conta (e-mail descartável próprio, ex. smoke+YYYYMMDD@...) | Cadastro completa; pede verificação de e-mail |
| B3 | Verificar e-mail (caixa da conta smoke) | Link funciona → dashboard |
| B4 | Estado vazio do dashboard | Empty state claro (não tela quebrada); CTA para conectar perfil |
| B5 | Conectar um perfil público pequeno (ex. YouTube de teste) | Verificação de perfil funciona |
| B6 | Clicar Analisar | Preflight abre; usuário sem assinatura → bloqueio claro com CTA de trial (não erro técnico) → CANCELAR |
| B7 | /diagnostico | Formulário envia e confirma (usar e-mail de teste; marcar lead como teste depois) |

## Pós-deploy com migração de banco (extra)

- Conferir no VPS: `docker exec sentimenta-api-1 alembic current` == head esperado.
- 1 query de sanidade (ex.: `SELECT count(*) FROM pipeline_runs WHERE status='running' AND started_at < now() - interval '5 hours'` → deve ser 0 depois do beat de reconciliação).

## Automação (estado e plano)

- **Hoje**: Playwright configurado na raiz (`e2e/`, `playwright.config.ts`); specs de smoke
  existem no branch antigo `origin/feat/security-fixes` (login, créditos, preflight,
  health) — resgatar e adaptar.
- **Alvo**: job `smoke` no fim do `deploy-production.yml` rodando `npx playwright test
  --grep @smoke` contra produção com a conta smoke (secrets no GitHub). Deploy falha se
  o smoke falhar. + GitHub Actions cron (30 min) para healthcheck com alerta.
- **IA como executor**: este playbook é o prompt. Sessão Claude com plugin Chrome executa
  A1–A10/B1–B7, tira prints e devolve a tabela. Replicável porque: passos numerados,
  conta dedicada, critérios objetivos de ✅/❌, e proibições explícitas (não confirmar
  gasto). Pode ser agendado (rotina semanal) ou disparado pós-deploy.

## Histórico de execuções

| Data | Executor | Roteiro | Resultado | Notas |
|---|---|---|---|---|
| _preencher_ | | | | |
