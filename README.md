# Sentimenta

Plataforma SaaS de analise de sentimento para redes sociais. Conecte suas contas (Instagram, YouTube) e entenda o que seu publico pensa sobre voce atraves de analise inteligente de comentarios com IA.

## Conceito de Negocio

Sentimenta resolve um problema real: **pessoas publicas nao tem visibilidade sobre o sentimento do seu publico**. Politicos, influenciadores e profissionais liberais recebem centenas de comentarios por dia, mas nao conseguem extrair insights acionaveis desse volume de dados.

Diferente de ferramentas enterprise de social listening (Brandwatch, Sprinklr), o Sentimenta e focado em **pessoa fisica** — o dono do perfil conecta suas proprias contas via OAuth e recebe analises personalizadas da sua reputacao digital.

> Para o plano de negocio completo (personas, mercado, pricing, projecoes), veja [PLANO_DE_NEGOCIO.md](PLANO_DE_NEGOCIO.md).

## Arquitetura

```
                        ┌──────────────────────────────┐
                        │     Frontend (Next.js 14)     │
                        │   TailwindCSS + Dark Theme    │
                        └──────────────┬───────────────┘
                                       │ REST API
                        ┌──────────────┴───────────────┐
                        │      Backend (FastAPI)        │
                        │  Auth + Routers + Services    │
                        └──┬──────────┬──────────┬─────┘
                           │          │          │
                    ┌──────┴──┐  ┌────┴────┐  ┌──┴──────────┐
                    │PostgreSQL│  │  Redis  │  │Celery Worker│
                    │  (data)  │  │ (queue) │  │ (pipeline)  │
                    └──────────┘  └─────────┘  └─────────────┘
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14, TailwindCSS, Recharts |
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Auth | JWT (email+senha) + Google OAuth |
| Database | PostgreSQL 16 |
| Queue | Celery + Redis 7 |
| Instagram | Graph API oficial (OAuth 2.0) |
| YouTube | yt-dlp (scraping, sem API key) |
| LLM | Google Gemini 2.0 Flash |
| Infra | Docker Compose |

## Estrutura do Projeto

```
social_media_sentiment/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + CORS + lifespan
│   │   ├── core/
│   │   │   ├── config.py           # Settings (env vars, Pydantic)
│   │   │   ├── security.py         # JWT, bcrypt, Fernet (AES-256)
│   │   │   └── deps.py             # get_current_user, get_db
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── user.py             # User (email, plan, google_id)
│   │   │   ├── social_connection.py# Conexoes com redes sociais
│   │   │   ├── post.py             # Posts/videos
│   │   │   ├── comment.py          # Comentarios
│   │   │   ├── analysis.py         # CommentAnalysis + PostSummary
│   │   │   └── pipeline_run.py     # Execucoes do pipeline
│   │   ├── schemas/                # Pydantic DTOs
│   │   ├── routers/                # Endpoints REST
│   │   │   ├── auth.py             # /register, /login, /google, /me
│   │   │   ├── connections.py      # CRUD + OAuth + sync
│   │   │   ├── posts.py            # Listagem + detalhe
│   │   │   └── dashboard.py        # Resumo agregado
│   │   ├── services/               # Logica de negocio
│   │   │   ├── auth_service.py     # Register, login, Google auth
│   │   │   ├── instagram_service.py# OAuth + Graph API
│   │   │   ├── youtube_service.py  # Wrapper do yt-dlp
│   │   │   └── analysis_service.py # Pipeline LLM + summaries
│   │   ├── tasks/                  # Celery async
│   │   │   ├── celery_app.py       # Config Celery + Redis
│   │   │   └── pipeline_tasks.py   # ingest, analyze, full_pipeline
│   │   └── db/
│   │       └── session.py          # Engine, SessionLocal, Base
│   ├── tests/                      # pytest (38+ testes)
│   ├── alembic/                    # Migracoes PostgreSQL
│   ├── requirements.txt
│   ├── pytest.ini
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── (auth)/login/           # Login + registro
│   │   └── (dashboard)/            # Dashboard, conexoes, posts
│   ├── components/ui/              # Button, Input, Card
│   ├── lib/
│   │   ├── api.ts                  # Client HTTP tipado
│   │   ├── auth.ts                 # Token management
│   │   └── utils.ts                # Helpers
│   ├── package.json
│   └── Dockerfile
├── src/                            # Modulos reutilizados do v0
│   ├── sources/youtube_scrape.py   # YouTubeScrapeSource (yt-dlp)
│   ├── sources/base.py             # CommentSource ABC
│   ├── analysis/llm_client.py      # LLMClient (Gemini)
│   └── config.py
├── docker-compose.yml              # postgres + redis + api + worker + frontend
├── .env                            # Variaveis de ambiente
├── PLANO_DE_NEGOCIO.md
└── README.md
```

## Setup Rapido (Docker Compose)

### Pre-requisitos

- Docker e Docker Compose
- Conta no [Meta for Developers](https://developers.facebook.com/) (para Instagram OAuth)
- API key do [Google Gemini](https://aistudio.google.com/app/apikey)

### 1. Configure as variaveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# Database
DATABASE_URL=postgresql://sentimenta:sentimenta@postgres:5432/sentimenta

# Auth
SECRET_KEY=sua-chave-secreta-aqui
TOKEN_ENCRYPTION_KEY=    # base64 Fernet key (python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Instagram OAuth
INSTAGRAM_APP_ID=seu_app_id
INSTAGRAM_APP_SECRET=seu_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:8000/api/v1/connections/instagram/callback

# LLM
GEMINI_API_KEY=sua_chave_gemini

# Redis
REDIS_URL=redis://redis:6379/0
```

### 2. Suba os containers

```bash
docker-compose up --build
```

### 3. Acesse

| Servico | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

## API Endpoints

Todos os endpoints ficam sob `/api/v1/`.

### Auth

| Metodo | Endpoint | Descricao |
|--------|---------|-----------|
| POST | `/auth/register` | Cadastro (email + senha) |
| POST | `/auth/login` | Login (retorna JWT) |
| POST | `/auth/google` | Login com Google OAuth |
| POST | `/auth/refresh` | Renovar access token |
| GET | `/auth/me` | Perfil do usuario logado |

### Conexoes

| Metodo | Endpoint | Descricao |
|--------|---------|-----------|
| GET | `/connections` | Listar conexoes do usuario |
| GET | `/connections/{id}` | Detalhe de uma conexao |
| DELETE | `/connections/{id}` | Remover conexao |
| POST | `/connections/youtube` | Conectar canal YouTube |
| GET | `/connections/instagram/auth-url` | Gerar URL OAuth Instagram |
| GET | `/connections/instagram/callback` | Callback OAuth Instagram |
| POST | `/connections/{id}/sync` | Disparar sincronizacao |

### Posts e Dashboard

| Metodo | Endpoint | Descricao |
|--------|---------|-----------|
| GET | `/posts` | Listar posts (filtro por conexao) |
| GET | `/posts/{id}` | Detalhe + comentarios + analise |
| GET | `/dashboard/summary` | Resumo geral do usuario |

## Testes

```bash
cd backend
pip install -r requirements.txt
pytest
```

Os testes usam SQLite in-memory (nao precisam de PostgreSQL):

- `test_auth.py` — Registro, login, refresh, JWT
- `test_connections.py` — CRUD de conexoes, OAuth URL
- `test_posts.py` — Listagem, detalhe, dashboard
- `test_security.py` — Hash de senha, JWT, criptografia Fernet
- `test_models.py` — Relacionamentos, cascade delete, unique constraints

## Como Funciona

### Fluxo do Usuario

1. **Cadastro/Login** — Email+senha ou Google OAuth
2. **Conectar rede social** — Instagram via OAuth ou YouTube via nome do canal
3. **Coleta automatica** — Celery worker busca posts e comentarios em background
4. **Analise com IA** — Gemini 2.0 Flash analisa cada comentario (score 0-10, polaridade, emocoes, topicos, sarcasmo)
5. **Dashboard** — Visualiza score medio, distribuicao de sentimento, tendencias

### Pipeline de Analise

```
Comentario bruto
    │
    ▼
Gemini 2.0 Flash (LLM)
    │
    ├── score_0_10: 7.5
    ├── polarity: 0.6
    ├── intensity: 0.4
    ├── emotions: ["alegria", "surpresa"]
    ├── topics: ["produto", "preco"]
    ├── sarcasm: false
    ├── summary_pt: "Comentario positivo sobre o produto"
    └── confidence: 0.92
```

### Seguranca

- Senhas com bcrypt (salt automatico)
- JWT access token (30min) + refresh token (7 dias)
- Tokens de redes sociais criptografados com Fernet (AES-256) antes de salvar no banco
- CORS configuravel
- LGPD compliant — usuario e dono dos seus dados, pode deletar a qualquer momento

## Database Schema

7 tabelas principais:

| Tabela | Descricao |
|--------|-----------|
| `users` | Usuarios (email, plan, google_id) |
| `social_connections` | Conexoes OAuth (tokens criptografados) |
| `posts` | Posts/videos coletados |
| `comments` | Comentarios com dedup (SHA-256 hash) |
| `comment_analysis` | Analise individual por comentario |
| `post_analysis_summary` | Resumo agregado por post |
| `pipeline_runs` | Historico de execucoes do pipeline |

## Desenvolvimento Local (sem Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Celery Worker

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

Requer PostgreSQL e Redis rodando localmente.

## Roadmap

- [x] Backend FastAPI + Auth JWT
- [x] PostgreSQL schema + SQLAlchemy models
- [x] Instagram OAuth + Graph API
- [x] YouTube scraping (yt-dlp)
- [x] Pipeline de analise com Gemini
- [x] Celery tasks assincrono
- [x] Frontend Next.js (dark theme)
- [x] Testes pytest
- [x] Docker Compose
- [ ] Alembic migrations
- [ ] Deploy producao
- [ ] Twitter/X integration
- [ ] TikTok integration
- [ ] Alertas de crise em tempo real
- [ ] Analise temporal (historico)
- [ ] Mobile app

---

Feito com Python + Next.js + Gemini
