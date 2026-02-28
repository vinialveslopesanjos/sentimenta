# Sentimenta

**Análise de sentimento e reputação digital para criadores de conteúdo e figuras públicas.**

Sentimenta é uma plataforma SaaS que conecta perfis do Instagram e YouTube, coleta comentários automaticamente e usa **Gemini 2.5 Flash** para analisar sentimento, emoções, tópicos e sarcasmo — tudo num dashboard em tempo real.

---

## Status do Projeto

### Concluído (em produção na VPS)

**Backend:**
- API FastAPI com autenticação JWT + Google OAuth
- Pipeline de ingestão Instagram via XPoz MCP (posts + comentários com polling assíncrono)
- Parser LLM (Gemini 2.5 Flash) para estruturar dados do XPoz
- Análise de sentimento por lote: score 0–10, polaridade, intensidade, emoções, tópicos, sarcasmo
- Dashboard com KPIs, tendências temporais, alertas de reputação e comparativo entre plataformas
- Celery + Redis para processamento assíncrono em background
- SSE (Server-Sent Events) para progresso em tempo real no frontend
- Rate limiter, middleware de auth, cache
- Planos (Free / Pro / Business) com limites de conexões, posts e comentários

**Frontend (Next.js 14):**
- Dashboard principal com gráficos de sentimento, score de reputação e KPIs
- Página de conexão de perfis (Instagram, YouTube, Twitter)
- Tela de análise por perfil com histórico de tendências
- Tela de alertas de reputação
- Tela de comentários com filtros por sentimento, busca e ordenação
- SyncButton com barra de progresso em tempo real (SSE + fallback polling)
- Autenticação completa (login, registro, Google OAuth, logout)
- Layout responsivo com sidebar, header e navegação mobile

**Infra / VPS:**
- Ubuntu 24.04 LTS em produção (147.93.13.49)
- Supervisor gerenciando sentimenta-api, sentimenta-celery, sentimenta-web
- Nginx como proxy reverso (portas 80, 443, 8080)
- PostgreSQL 16 + Redis em localhost
- Swap de 2GB configurado (evita OOM killer)
- SSH keepalive configurado para sessões estáveis

**Bugs corrigidos recentemente:**
- Pipeline de comentários (erro `google-genai` não instalado no venv do Celery)
- XPoz async: implementado polling de `operationId` para comentários
- Frontend não comunicava com backend (faltava rewrites no `next.config.js`)
- CORS: IPs da VPS adicionados ao allowlist
- FastAPI 307 redirect em rotas sem trailing slash corrigido (`redirect_slashes=False`)

---

### Pendente (Roadmap)

**P0 — Crítico para abrir a clientes:**
- DNS + HTTPS para sentimenta.com.br (Nginx + Let's Encrypt)
- Stripe: checkout, webhooks, atualização de plano
- LGPD: deletar conta, exportar dados
- Onboarding / empty states para novos usuários

**P1 — Importante:**
- Emails transacionais (Resend) — serviço existe, falta `RESEND_API_KEY`
- PWA: service worker + manifest para instalação mobile
- Skeleton loaders em todas as telas
- Backup automático PostgreSQL (cron + pg_dump)
- Sentry para monitoramento de erros
- Ingestão YouTube (yt-dlp integrado, falta testes end-to-end)
- Ingestão Twitter via XPoz

**P2 — Melhorias:**
- TikTok integration
- API pública + webhooks para clientes
- App React Native (Expo) usando `@sentimenta/api-client` e `@sentimenta/types`
- Responsividade mobile completa

---

## Estrutura do Monorepo

```
sentimenta/
├── backend/              # API FastAPI + Celery (Python 3.12)
│   ├── app/
│   │   ├── routers/      # auth, connections, dashboard, pipeline, comments, billing
│   │   ├── models/       # SQLAlchemy ORM
│   │   ├── schemas/      # Pydantic v2 schemas
│   │   ├── services/     # Instagram (XPoz), YouTube, análise LLM, planos
│   │   ├── tasks/        # Celery: task_ingest, task_analyze, task_full_pipeline
│   │   └── middleware/   # Rate limiter, auth, cache
│   └── alembic/          # Migrations do banco
├── frontend/             # Web App Next.js 14 (TypeScript)
│   ├── app/              # App Router: dashboard, connect, alerts, login, register
│   └── components/       # SyncButton, KpiCard, charts, hooks (useSSE)
├── packages/
│   ├── types/            # @sentimenta/types — tipos TypeScript compartilhados
│   └── api-client/       # @sentimenta/api-client — cliente HTTP universal (web + mobile)
├── scripts/
│   ├── xpoz_full_ingest.py   # Script de ingestão completa via XPoz
│   └── setup_vps.sh          # Setup automatizado Ubuntu/VPS
├── docs/                 # Documentação técnica
├── docker-compose.yml    # PostgreSQL + Redis (dev local)
└── package.json          # Monorepo root (npm workspaces)
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Web Frontend** | Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion, Recharts |
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2 |
| **Filas assíncronas** | Celery + Redis 7 |
| **Banco de dados** | PostgreSQL 16 |
| **IA / LLM** | Google Gemini 2.5 Flash (análise de sentimento + parser de dados) |
| **Extração Instagram** | XPoz MCP (API JSON-RPC com polling assíncrono) |
| **Autenticação** | JWT (access 1h / refresh 30d), Google OAuth 2.0 |
| **Monorepo** | npm Workspaces + Turborepo |
| **Infra/Deploy** | VPS Ubuntu 24.04 + Supervisor + Nginx |

---

## Infra de Produção (VPS)

```
sentimenta-api     → uvicorn FastAPI  → porta 8000 (supervisor)
sentimenta-celery  → Celery worker    → 2 workers (supervisor)
sentimenta-web     → Next.js          → porta 3000 (supervisor)
nginx              → proxy reverso    → portas 80, 443, 8080
postgresql 16      → localhost:5432
redis              → localhost:6379
```

**Comandos úteis na VPS:**
```bash
supervisorctl status                    # ver status dos serviços
supervisorctl restart sentimenta-api   # reiniciar API
supervisorctl restart sentimenta-web   # reiniciar frontend
tail -f /var/log/sentimenta-api.log    # logs da API
tail -f /var/log/sentimenta-celery-error.log  # logs do Celery (pipelines)
```

---

## Como Funciona o Pipeline de Análise

```
Usuário clica "Analisar"
        │
        ▼
POST /api/v1/connections/{id}/sync
        │
        ▼
Celery Task enfileirada (Redis)
        │
        ▼
[Instagram] XPoz MCP
  → getInstagramPostsByUser (lista de posts)
  → Gemini parser estrutura resposta
  → para cada post: getInstagramCommentsByPostId (async + polling)
  → Gemini parser estrutura comentários
  → salva posts + comentários no PostgreSQL
        │
        ▼
Batches de 30 comentários + contexto (persona + legenda)
        │
        ▼
Gemini 2.5 Flash → score, polarity, intensity, emotions, topics, sarcasm
        │
        ▼
Salva em comment_analysis + agrega em post_analysis_summary
        │
        ▼
SSE stream atualiza progresso no frontend em tempo real
```

---

## Modelo de Dados Principal

| Tabela | Descrição |
|---|---|
| `users` | Usuários (bcrypt + JWT) |
| `social_connections` | Perfis conectados. Campos: `persona`, `ignore_author_comments`, `followers_count`, `media_count` |
| `posts` | Publicações coletadas. Campos: `content_text`, `image_context`, `thumbnail_url`, `hashtags` |
| `comments` | Comentários raw. Campos: `text_clean`, `author_username`, `like_count`, `published_at` |
| `comment_analysis` | Resultado Gemini: `score_0_10`, `polarity`, `intensity`, `emotions[]`, `topics[]`, `sarcasm` |
| `post_analysis_summary` | Agregado pré-calculado por post |
| `pipeline_runs` | Log de execução: status, contadores (posts/comments/analyzed), erros, duração |

---

## Endpoints Principais da API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login JWT |
| `POST` | `/api/v1/auth/register` | Registro |
| `GET` | `/api/v1/auth/me` | Dados do usuário logado |
| `GET` | `/api/v1/connections` | Lista perfis conectados |
| `GET` | `/api/v1/connections/check-profile` | Verifica perfil Instagram via XPoz |
| `POST` | `/api/v1/connections/instagram` | Conecta perfil Instagram |
| `POST` | `/api/v1/connections/youtube` | Conecta canal YouTube |
| `POST` | `/api/v1/connections/{id}/sync` | Dispara pipeline de análise |
| `GET` | `/api/v1/pipeline/runs/{id}/stream` | SSE — progresso em tempo real |
| `GET` | `/api/v1/dashboard/summary` | Resumo geral |
| `GET` | `/api/v1/dashboard/connection/{id}` | Dashboard por perfil |
| `GET` | `/api/v1/dashboard/trends` | Tendência temporal |
| `GET` | `/api/v1/dashboard/alerts` | Alertas de reputação |
| `GET` | `/api/v1/comments` | Lista comentários com filtros |

---

## Planos

| Plano | Conexões | Posts/Sync | Comentários/Post |
|---|---|---|---|
| **Free** | 1 | 10 | 100 |
| **Pro** | 5 | 50 | 500 |
| **Business** | 20 | 200 | 1000 |

*Implementação Stripe pendente (P0 do roadmap).*

---

## Como Rodar Localmente

### Pré-requisitos
- PostgreSQL 16 na porta `5432`
- Redis na porta `6379`
- Python 3.12+ com `.venv` em `backend/.venv`
- Node.js 20+

### Setup

```bash
# 1. Variáveis de ambiente
cp .env.example .env
# Preencher: DATABASE_URL, REDIS_URL, SECRET_KEY, GEMINI_API_KEY, XPOZ_TOKEN

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend + pacotes
cd ..
npm install

# 4. Iniciar
# Terminal 1 — API
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery
cd backend && celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Acesse: `http://localhost:3000` | API Docs: `http://localhost:8000/docs`

---

## Branches

| Branch | Uso |
|---|---|
| `main` | Estável, produção |
| `claude/review-branch-updates-jWLB6` | Branch de desenvolvimento atual |
