# Hardening implementado - Sentimenta

Data: 2026-07-01

Este documento registra os ajustes implementados a partir da auditoria de seguranca e arquitetura. O foco foi reduzir risco sem quebrar o produto: healthchecks/observabilidade, CSP com nonce, cookies HttpOnly, rate limits, hardening de Compose, CI de seguranca, testes de isolamento multi-tenant e documentacao atualizada.

## Status por pedido

| Pedido | Status | Como foi tratado |
|---|---|---|
| Worker e beat sem healthcheck | Implementado | `compose.prod.yml` ganhou healthchecks para worker/beat usando `python -m app.ops.healthchecks`; API passou a ter `/health/ready`. |
| Observabilidade assincrona parcial | Implementado fase 1 | Novo endpoint admin `/api/v1/ops/health` mostra Redis, Celery, fila, workers e runs stale/failed/partial. |
| CSP Report-Only permissiva | Implementado | CSP dinamica no `frontend/middleware.ts`; em producao usa enforcement com nonce por request e sem `unsafe-eval`. |
| Tokens em localStorage | Implementado fase 1 | Backend seta cookies HttpOnly/Secure/SameSite; web e PWA usam cookie com fallback legado em memoria/localStorage antigo. |
| Hardening Docker | Implementado fase 1 | API/worker/beat/web com `no-new-privileges`, `cap_drop: ALL`, limites de CPU/memoria/PIDs; API/worker/beat com `read_only` e tmpfs. |
| Supply chain JS | Implementado parcialmente | `next-auth` removido; lockfile duplicado do frontend removido; `npm audit fix` aplicado sem breaking changes; restam 2 moderadas Next/PostCSS. |
| Auditoria Python no CI | Implementado | CI instala e roda `pip-audit -r backend/requirements.txt`. |
| Leads anti-spam | Implementado | `/leads/diagnostic` com rate limit por IP e email. |
| Thumbnail proxy abuso | Implementado | `/posts/thumbnail` com rate limit por IP e alvo hash/post_id. |
| Redis centralizado | Implementado fase 1 | Config passou a aceitar `CACHE_REDIS_URL` e `RATE_LIMIT_REDIS_URL`; Compose separa DBs Redis por funcao. |
| CI/CD seguranca/SBOM | Implementado | Job `security` com Gitleaks, Trivy high/critical e SBOM CycloneDX. |
| Multi-tenancy/IDOR | Implementado fase 1 | Nova suite `test_multi_tenant_isolation.py` cobre connections, posts, comments, dashboard, pipeline e billing/credits. |
| Tokens reset/verificacao em claro | Implementado | Tokens novos sao `secrets.token_urlsafe` + HMAC-SHA256; fallback temporario aceita tokens legados ate expirarem. |
| Documentacao drift | Implementado | README atualizado; este relatorio e HTML de hardening criados. |

## Checks executados

| Check | Resultado |
|---|---|
| `python -m compileall backend\app` | Passou |
| `.venv\Scripts\python.exe -m pytest -q backend\tests` | Passou: 71 testes |
| `npm run build:packages` | Passou |
| `npm run type-check` | Passou |
| `npm run build:web` | Passou |
| `npm run build --workspace=@sentimenta/mobile --if-present` | Passou |
| `npm run audit:prod` | Passou no gate high/critical; restam 2 moderadas Next/PostCSS |
| YAML parse de `compose.prod.yml`, CI e Dependabot | Passou |
| `docker compose -f compose.prod.yml config --quiet` | Passou com Docker Compose standalone v5.2.0 em diretorio temporario sem usar `.env` real |

## Diagrama de arquitetura das atualizacoes - Mermaid

```mermaid
flowchart LR
  User[Usuario autenticado] --> Web[Next.js Web]
  Web --> MW[Middleware CSP nonce]
  MW --> API[FastAPI API]
  API --> PG[(PostgreSQL)]
  API --> RCache[(Redis DB2\ncache + blacklist + OAuth code)]
  API --> RRate[(Redis DB3\nrate limit)]
  API --> RBroker[(Redis DB0/1\nCelery broker/result)]
  RBroker --> Worker[Celery worker\nhealthcheck]
  RBroker --> Beat[Celery beat\nhealthcheck]
  API --> Ops[/Ops health admin/]
  Ops --> RBroker
  Ops --> RCache
  Ops --> RRate
  Ops --> PG
  CI[GitHub Actions] --> Tests[pytest + build + type-check]
  CI --> Scans[Gitleaks + Trivy + SBOM + pip-audit]
```

## Fluxo de login endurecido - Mermaid

```mermaid
sequenceDiagram
  participant U as Usuario
  participant W as Next.js Web
  participant A as FastAPI Auth
  participant R as Redis
  participant DB as PostgreSQL

  U->>W: login/register
  W->>A: POST /auth/login ou /auth/register
  A->>DB: valida usuario e token_version
  A-->>W: JSON legado + Set-Cookie HttpOnly access/refresh
  W->>W: guarda apenas token em memoria, limpa localStorage
  W->>A: chamadas API com credentials include
  A->>A: autentica por cookie ou Authorization legado
  A-->>W: dados do usuario
  W->>A: POST /auth/refresh sem token no body
  A->>DB: valida refresh cookie
  A-->>W: rotaciona cookies
  W->>A: POST /auth/logout
  A->>R: blacklist access/refresh
  A-->>W: limpa cookies
```

## Diagrama de arquitetura das atualizacoes - PlantUML

```plantuml
@startuml
left to right direction
skinparam componentStyle rectangle

actor "Usuario autenticado" as User

rectangle "Sentimenta SaaS" {
  component "Next.js Web\nCSP nonce middleware" as Web
  component "FastAPI API\ncookie/header auth" as API
  component "Celery worker\nhealthcheck" as Worker
  component "Celery beat\nhealthcheck" as Beat
  component "Ops health admin\n/api/v1/ops/health" as Ops

  database "PostgreSQL" as PG
  database "Redis DB0/1\nbroker/result" as RBroker
  database "Redis DB2\ncache, blacklist, OAuth code" as RCache
  database "Redis DB3\nrate limits" as RRate
}

cloud "GitHub Actions\npytest, builds, pip-audit,\nGitleaks, Trivy, SBOM" as CI

User --> Web : HTTPS
Web --> API : /api/v1 + cookies HttpOnly
API --> PG : ORM
API --> RCache : cache/session blacklist
API --> RRate : public endpoint limits
API --> RBroker : enqueue jobs
RBroker --> Worker : tasks
RBroker --> Beat : schedules
Ops --> PG
Ops --> RBroker
Ops --> RCache
Ops --> RRate
CI --> Web
CI --> API
@enduml
```

## Fluxo de login endurecido - PlantUML

```plantuml
@startuml
actor Usuario as U
participant "Next.js Web" as W
participant "FastAPI Auth" as A
database "PostgreSQL" as DB
database "Redis" as R

U -> W: login/register
W -> A: POST /auth/login ou /auth/register
A -> DB: valida credenciais e token_version
A --> W: Set-Cookie HttpOnly + JSON legado
W -> W: limpa localStorage e usa cookie/memoria
W -> A: API request com credentials include
A -> A: resolve cookie ou Authorization legado
A --> W: resposta autenticada
W -> A: POST /auth/refresh
A -> DB: valida refresh cookie
A --> W: novos cookies
W -> A: POST /auth/logout
A -> R: blacklist access/refresh
A --> W: delete cookies
@enduml
```

## Melhorias que ficam para a proxima etapa

- Remover `unsafe-inline` de `style-src` exige reduzir estilos inline no frontend.
- Remover fallback legado de bearer/localStorage depois que as sessoes antigas expirarem e os clientes estiverem atualizados.
- Separar Redis em instancias fisicas/servicos gerenciados ainda e melhor que apenas DBs separados.
- Validar Trivy/Gitleaks/SBOM no GitHub Actions em PR/push; o Compose ja validou localmente com binario standalone.
- Fazer deploy assistido em janela controlada e observar `/api/v1/ops/health`, Sentry e logs do worker/beat.
