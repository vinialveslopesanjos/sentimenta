# Sentimenta 🧠

**Análise de sentimento e reputação digital para criadores de conteúdo e figuras públicas.**

Sentimenta é uma plataforma SaaS que conecta perfis do Instagram e YouTube, coleta comentários automaticamente e usa **Gemini 2.0 Flash** para analisar sentimento, emoções, tópicos e sarcasmo — tudo num dashboard elegante e em tempo real.

---

## 📦 Estrutura do Monorepo

```
sentimenta/
├── backend/              # API FastAPI + Celery (Python)
│   ├── app/
│   │   ├── routers/      # Endpoints: auth, connections, dashboard, pipeline, comments, billing
│   │   ├── models/       # SQLAlchemy ORM
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Lógica de negócio (Instagram, YouTube, XPoz, LLM, Planos)
│   │   ├── tasks/        # Celery tasks (pipeline de ingestão + análise)
│   │   └── middleware/   # Rate limiter, auth, cache
│   └── alembic/          # Migrations do banco
├── frontend/             # Web App Next.js 14 (TypeScript)
│   ├── app/              # App Router (dashboard, connect, alerts, login, register)
│   └── components/       # SyncButton, KpiCard, charts, hooks...
├── packages/
│   ├── types/            # @sentimenta/types — tipos TypeScript compartilhados (web + mobile)
│   └── api-client/       # @sentimenta/api-client — cliente HTTP universal (web + mobile)
├── scripts/
│   ├── xpoz_full_ingest.py   # Script de ingestão completa via XPoz MCP
│   ├── reset_instagram_data.py
│   └── setup_vps.sh          # Setup automatizado Ubuntu/VPS
├── docs/                 # Documentação técnica e de produto
├── design/               # Sistema de design, tokens e SVGs
├── db/                   # Migrations SQL avulsas
├── docker-compose.yml    # PostgreSQL + Redis
├── package.json          # Monorepo root (npm workspaces)
├── turbo.json            # Turborepo config
└── start.ps1             # Script de dev local (Windows)
```

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Web Frontend** | Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion, Recharts |
| **Backend API** | Python 3.11, FastAPI, SQLAlchemy 2, Pydantic v2 |
| **Filas assíncronas** | Celery + Redis 7 |
| **Banco de dados** | PostgreSQL 16 |
| **IA / LLM** | Google Gemini 2.0 Flash (NLP + Vision) |
| **Extração de dados** | XPoz MCP (Instagram), yt-dlp (YouTube) |
| **Autenticação** | JWT (access 30min / refresh 7d), Google OAuth |
| **Monorepo** | npm Workspaces + Turborepo |
| **Infra/Deploy** | Docker Compose (local), VPS Ubuntu (prod) |

---

## 🚀 Como Rodar Localmente (Windows)

### Pré-requisitos

- **PostgreSQL 16** rodando na porta `5432`
- **Redis** rodando na porta `6379`
- **Python 3.11+** com `.venv` em `backend/.venv`
- **Node.js 20+** instalado

### 1. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/sentimenta
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=sua-chave-secreta-aqui
GEMINI_API_KEY=sua-chave-gemini
XPOZ_TOKEN=seu-token-xpoz
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Instalar dependências

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Frontend + pacotes do monorepo
cd ..
npm install
npm run build:packages
```

### 3. Rodar as migrations

```bash
cd backend
.venv\Scripts\alembic upgrade head
```

### 4. Iniciar tudo

```powershell
.\start.ps1
```

Isso abre 3 janelas PowerShell:
- **Backend** → `http://localhost:8000` (API Docs em `/docs`)
- **Celery Worker** → processa as análises em background
- **Frontend** → `http://localhost:3000`

---

## 🧠 Como Funciona o Pipeline de Análise

```
Usuário clica "Analisar"
        │
        ▼
POST /connections/{id}/sync
        │
        ▼
Celery Task enfileirada (Redis)
        │
        ├──► [Instagram] XPoz MCP → posts + comentários → salva no PostgreSQL
        │       ou
        └──► [YouTube] yt-dlp → vídeos + comentários → salva no PostgreSQL
                │
                ▼
        Verificação de image_context por post
        (se ausente → Gemini Vision analisa thumbnail → salva)
                │
                ▼
        Batches de 30 comentários + contexto completo (persona + legenda + image_context)
                │
                ▼
        Gemini 2.0 Flash → JSON com: score, polarity, intensity, emotions, topics, sarcasm
                │
                ▼
        Salva em comment_analysis + agrega em post_analysis_summary
                │
                ▼
        SSE stream atualiza progresso no frontend em tempo real
```

---

## 🗄 Modelo de Dados Principal

| Tabela | Descrição |
|---|---|
| `users` | Usuários (bcrypt + JWT) |
| `social_connections` | Perfis conectados (Instagram / YouTube). Campos: `persona`, `ignore_author_comments`, `followers_count`, `following_count`, `media_count`, `ingest_source` |
| `posts` | Publicações coletadas. Campos: `content_text`, `image_context` (gerado por IA), `thumbnail_url`, `hashtags`, `ingest_source` |
| `comments` | Comentários raw. Campos: `text_clean`, `author_username`, `like_count`, `published_at`, `ingest_source` |
| `comment_analysis` | Resultado do Gemini por comentário: `score_0_10`, `polarity`, `intensity`, `emotions[]`, `topics[]`, `sarcasm`, `summary_pt` |
| `post_analysis_summary` | Agregado pré-calculado por post |
| `pipeline_runs` | Log de cada execução: status, contadores, erros, duração |

---

## 🔌 Endpoints Principais da API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login JWT |
| `POST` | `/api/v1/auth/register` | Registro |
| `GET` | `/api/v1/connections/check-profile` | Verifica perfil Instagram via XPoz (antes de conectar) |
| `POST` | `/api/v1/connections/instagram` | Conecta perfil Instagram |
| `POST` | `/api/v1/connections/youtube` | Conecta canal YouTube |
| `POST` | `/api/v1/connections/{id}/sync` | Dispara pipeline de análise |
| `GET` | `/api/v1/pipeline/runs/{id}/stream` | SSE — progresso em tempo real |
| `GET` | `/api/v1/dashboard/summary` | Resumo geral |
| `GET` | `/api/v1/dashboard/connection/{id}` | Dashboard por perfil |
| `GET` | `/api/v1/dashboard/trends` | Tendência temporal |
| `GET` | `/api/v1/dashboard/alerts` | Alertas de reputação |

---

## 📱 App Mobile (planejado)

O pacote `@sentimenta/api-client` é universal — funciona tanto no Next.js quanto no React Native (Expo). O monorepo já está estruturado para suportar um app mobile usando a mesma API e tipos compartilhados.

Ver `docs/MOBILE_INTEGRATION.md` para detalhes.

---

## 💳 Planos

| Plano | Conexões | Posts/Sync | Comentários/Post |
|---|---|---|---|
| **Free** | 1 | 10 | 100 |
| **Pro** | 5 | 50 | 500 |
| **Business** | 20 | 200 | 1000 |

---

## 🛠 Scripts Úteis

```bash
# Ingestão completa via XPoz (Instagram)
python scripts/xpoz_full_ingest.py

# Setup de VPS em produção (Ubuntu)
bash scripts/setup_vps.sh

# Build dos pacotes compartilhados
npm run build:packages

# Type-check em todos os workspaces
npm run type-check
```

---

## 📚 Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/PRODUCTION_GUIDE.md` | Setup em produção (VPS, Docker, SSL) |
| `docs/MOBILE_INTEGRATION.md` | Integração do app mobile |
| `docs/ARCHITECTURE.md` | Diagramas de fluxo e banco de dados (Mermaid) |
| `docs/PRD.md` | Product Requirements Document |
| `docs/ROADMAP.md` | Roadmap de features |
| `design/DESIGN_SYSTEM.md` | Sistema de design e tokens |

---

## 🌿 Branches

| Branch | Uso |
|---|---|
| `main` | Estável, produção |
| `sentimenta_turbo` | Monorepo + app mobile (base de desenvolvimento atual) |
| `canvas_design` | Experimentos de UI/UX |
| `vanta_design` | Design anterior (referência) |
