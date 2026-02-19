# Sentimenta

> *"O que as pessoas falam sobre você importa. A gente ajuda você a ouvir."*

Plataforma SaaS de análise de sentimento para criadores e marcas. Conecte seu Instagram ou YouTube e entenda, em minutos, o que o seu público realmente sente — com scores, emoções, tópicos e relatórios gerados por IA.

→ Documento de fundação completo (cultura, valores, filosofia de produto): [SENTIMENTA_FOUNDATION.md](SENTIMENTA_FOUNDATION.md)

---

## O que faz

- **Coleta automática** de posts e comentários públicos (Instagram via Apify + instaloader, YouTube via yt-dlp)
- **Análise por IA** (Gemini): score 0–10, polaridade −1/+1, emoções, tópicos, detecção de sarcasmo
- **Dashboard interativo**: tendência de score ao longo do tempo, distribuição de sentimento, top emoções/tópicos
- **Health Report** gerado por Gemini com tom humano e estruturado em Markdown
- **Parâmetros de scraping configuráveis**: número de posts, comentários por post, filtro por data
- **Multi-plataforma**: Instagram e YouTube (TikTok em breve)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Componentes | SVG puro (charts), `react-markdown`, `@tailwindcss/typography` |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Auth | JWT (access + refresh) + Google OAuth |
| Database | PostgreSQL 16 |
| Cache + Filas | Redis 7 + Celery |
| Scraping Instagram | Apify `instagram-comment-scraper` + instaloader (fallback) |
| Scraping YouTube | yt-dlp |
| LLM | Google Gemini (configurável via `GEMINI_MODEL`) |
| Infra | Docker Compose |

---

## Estrutura do projeto

```
sentimenta/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app + CORS + lifespan
│   │   ├── core/
│   │   │   ├── config.py              # Settings (env vars, Pydantic)
│   │   │   ├── security.py            # JWT, bcrypt, Fernet (AES-256)
│   │   │   ├── cache.py               # Redis cache helpers
│   │   │   └── deps.py                # get_current_user, get_db
│   │   ├── models/                    # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── social_connection.py
│   │   │   ├── post.py
│   │   │   ├── comment.py
│   │   │   ├── analysis.py            # CommentAnalysis + PostSummary
│   │   │   └── pipeline_run.py
│   │   ├── routers/
│   │   │   ├── auth.py                # /register /login /google /me
│   │   │   ├── connections.py         # CRUD + sync (com SyncRequest params)
│   │   │   ├── posts.py
│   │   │   ├── comments.py            # Busca + filtro + paginação
│   │   │   └── dashboard.py           # summary, trends, health-report, alerts
│   │   ├── services/
│   │   │   ├── instagram_scrape_service.py   # Apify + instaloader
│   │   │   ├── instagram_ingest_service.py   # Orquestra ingestão Instagram
│   │   │   ├── youtube_service.py
│   │   │   ├── analysis_service.py           # Pipeline LLM (batch 30 comentários)
│   │   │   └── report_service.py             # Health report via Gemini
│   │   ├── tasks/
│   │   │   ├── celery_app.py
│   │   │   └── pipeline_tasks.py      # task_ingest, task_analyze, task_full_pipeline
│   │   └── db/session.py
│   ├── alembic/                       # Migrações PostgreSQL
│   ├── tests/                         # pytest (38+ testes)
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx                   # Landing page
│   │   ├── (auth)/login/              # Login + registro
│   │   └── (dashboard)/
│   │       ├── dashboard/             # Visão geral + connection/[id]
│   │       ├── connect/               # Gerenciar perfis + params de scraping
│   │       ├── posts/[id]/            # Detalhe de post
│   │       ├── alerts/                # Alertas de crise
│   │       ├── compare/               # Comparativo entre plataformas
│   │       ├── settings/              # Configurações
│   │       └── logs/                  # Histórico de pipeline
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Logo.tsx
│   │   └── ui/                        # tooltip, etc.
│   ├── lib/
│   │   ├── api.ts                     # Cliente HTTP tipado
│   │   ├── auth.ts                    # Token management
│   │   └── types.ts                   # Tipos compartilhados
│   └── tailwind.config.ts
├── docker-compose.yml
├── start.ps1                          # Script de startup local (Windows)
├── SENTIMENTA_FOUNDATION.md           # Cultura, valores e documentação técnica
└── README.md
```

---

## Setup rápido

### Docker Compose

```bash
# 1. Configure o ambiente
cp .env.example .env
# Edite .env com suas chaves (Gemini, Apify, PostgreSQL, etc.)

# 2. Suba tudo
docker-compose up --build

# 3. Acesse
# Frontend:  http://localhost:3000
# API:       http://localhost:8000
# Swagger:   http://localhost:8000/docs
```

### Desenvolvimento local (sem Docker)

Requer PostgreSQL 16 e Redis 7 rodando localmente.

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Celery worker (terminal separado)
celery -A app.tasks.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run dev
```

**Windows:** use `start.ps1` na raiz para abrir os 3 processos de uma vez.

### Variáveis de ambiente necessárias

```env
DATABASE_URL=postgresql://sentimenta:sentimenta@localhost:5432/sentimenta
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=sua-chave-secreta
GEMINI_API_KEY=sua-chave-gemini
GEMINI_MODEL=gemini-1.5-flash
APIFY_API_TOKEN=sua-chave-apify   # opcional — fallback para instaloader
```

---

## Pipeline de análise

```
POST /{connection_id}/sync  (SyncRequest: max_posts, max_comments_per_post, since_date)
        │
        ▼
task_full_pipeline (Celery)
        │
        ├── task_ingest
        │       ├── fetch_recent_posts (instaloader) → filtra por max_posts + since_date
        │       └── fetch_post_comments (Apify → fallback instaloader)
        │
        └── analyze_post_comments (para cada post, batch de 30 comentários)
                │
                └── Gemini → score_0_10, polarity, emotions[], topics[], sarcasm, summary_pt
                        └── generate_post_summary → avg_score, weighted_avg_score, distribuição
```

---

## API — Endpoints principais

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastro |
| POST | `/auth/login` | Login → JWT |
| GET | `/auth/me` | Perfil do usuário |
| GET | `/connections` | Listar conexões |
| POST | `/connections/instagram` | Conectar Instagram (scraping público) |
| POST | `/connections/youtube` | Conectar YouTube |
| POST | `/connections/{id}/sync` | Disparar pipeline (aceita body com params) |
| DELETE | `/connections/{id}` | Remover conexão |
| GET | `/dashboard/summary` | KPIs gerais |
| GET | `/dashboard/connection/{id}` | Dashboard de uma conexão |
| GET | `/dashboard/trends` | Tendência de score ao longo do tempo |
| GET | `/dashboard/health-report` | Relatório de saúde gerado por IA |
| GET | `/dashboard/alerts` | Alertas de sentimento negativo |
| GET | `/dashboard/compare` | Comparativo entre plataformas |
| GET | `/comments` | Comentários com filtro, busca e paginação |
| GET | `/pipeline/runs` | Histórico de execuções |

---

## Testes

```bash
cd backend
pytest
```

- `test_auth.py` — Registro, login, JWT
- `test_connections.py` — CRUD, OAuth
- `test_posts.py` — Listagem, dashboard
- `test_security.py` — Bcrypt, JWT, Fernet
- `test_models.py` — Relacionamentos, cascade delete

---

## Roadmap

### Concluído
- [x] Backend FastAPI + Auth JWT + Google OAuth
- [x] PostgreSQL schema + SQLAlchemy + Alembic migrations
- [x] Instagram via Apify + instaloader (sem OAuth obrigatório)
- [x] YouTube via yt-dlp
- [x] Pipeline assíncrono com Celery + Redis
- [x] Análise de sentimento com Gemini (score, polaridade, emoções, tópicos, sarcasmo)
- [x] Dashboard completo (trends, distribuição, KPIs, health report)
- [x] Design system Sentimenta (lilás + ciano, tipografia Outfit/Inter)
- [x] Parâmetros de scraping configuráveis (posts, comentários, since_date)
- [x] Tooltips explicativos nas métricas
- [x] Ordenação e limite de posts no dashboard
- [x] Health report humanizado com Markdown renderizado
- [x] Páginas: alerts, compare, settings, logs
- [x] Docker Compose

### Próximos
- [ ] TikTok integration
- [ ] Webhooks (Slack, Email) para alertas em tempo real
- [ ] Exportação de relatórios em PDF
- [ ] Multi-conta por usuário (agências)
- [ ] API pública
- [ ] Deploy produção

---

*Feito com Python + Next.js + Gemini — com empatia pelos dados e pelos humanos que os geram.*
