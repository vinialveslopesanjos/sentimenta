# 🚀 Sentimenta — Guia Completo de Produtização

> Este documento é o guia passo a passo para subir a Sentimenta como produto SaaS.
> Criado em: Fevereiro 2026

---

## Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Estrutura do Monorepo](#estrutura-do-monorepo)
3. [VPS Hostinger — Setup de Produção](#vps-hostinger--setup-de-produção)
4. [Como Rodar Localmente](#como-rodar-localmente)
5. [Testar o App Mobile no iPhone](#testar-o-app-mobile-no-iphone)
6. [Integração Stripe (Pagamentos)](#integração-stripe-pagamentos)
7. [Planos & Precificação](#planos--precificação)
8. [Controle de Custos Apify](#controle-de-custos-apify)
9. [Deploy em Produção](#deploy-em-produção)
10. [Checklist da Beta](#checklist-da-beta)
11. [Contas Para Criar](#contas-para-criar)

---

## Visão Geral da Arquitetura

```
┌─────────────────────────┐  ┌─────────────────────────┐
│   apps/web (Next.js)    │  │  apps/mobile (Expo/RN)  │
│   Vercel / VPS          │  │  App Store / TestFlight  │
└────────────┬────────────┘  └────────────┬────────────┘
             │                            │
             │  ┌──────────────────────┐  │
             └──┤ @sentimenta/types    ├──┘   ← TypeScript compartilhado
                │ @sentimenta/api-client│
                └──────────┬───────────┘
                           │ HTTPS (REST API)
             ┌─────────────▼─────────────────────┐
             │   backend/ (FastAPI)               │
             │   VPS Hostinger: 147.93.13.49      │
             └───┬──────────────┬────────────────┘
                 │              │
     ┌───────────▼───┐  ┌──────▼──────────┐
     │ PostgreSQL 16  │  │ Redis 7         │
     │ (VPS)          │  │ (VPS)           │
     └───────────────┘  └──────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Celery Workers (VPS)│
                    └──────────┬─────────┘
                               │
          ┌────────────────────┼──────────────┐
          │                    │              │
    ┌─────▼─────┐    ┌───────▼──────┐  ┌───▼──────────┐
    │ Apify     │    │ Instaloader  │  │ Gemini API   │
    │ (scraping)│    │ (fallback)   │  │ (análise IA) │
    └───────────┘    └──────────────┘  └──────────────┘
```

**Por que usar sua VPS Hostinger ao invés de Supabase?**

✅ Você já paga a VPS (KVM 2 — 2 vCPU, 8GB RAM, 100GB disco)
✅ Servidor em São Paulo = baixa latência para usuários brasileiros
✅ 100% controle sobre banco, Redis, e workers
✅ Sem limites de free tier (Supabase free = 500MB DB, 50k requests)
✅ Economiza ~R$30–150/mês que pagaria em Supabase/Railway/Neon

A VPS aguenta tranquilamente a carga de uma beta e até ~500 usuários ativos.

---

## Estrutura do Monorepo

```
sentimenta/
├── turbo.json                     ← Turborepo pipeline config
├── package.json                   ← npm workspaces root
│
├── frontend/                      ← @sentimenta/web (Next.js 14)
│   ├── app/                       ← Pages e rotas
│   ├── components/                ← Componentes React
│   ├── lib/                       ← API client, utils, auth
│   └── package.json
│
├── packages/
│   ├── types/                     ← @sentimenta/types
│   │   └── src/
│   │       ├── user.ts            ← User, AuthTokens, UserUsage
│   │       ├── connection.ts      ← Connection, Platform
│   │       ├── post.ts            ← PostSummary
│   │       ├── comment.ts         ← CommentWithAnalysis
│   │       ├── dashboard.ts       ← DashboardSummary, Trends, HealthReport
│   │       ├── pipeline.ts        ← PipelineRun, PipelineStatus
│   │       ├── billing.ts         ← PLAN_CONFIG, PLAN_PRICING, PlanLimits
│   │       └── index.ts           ← barrel export
│   │
│   └── api-client/                ← @sentimenta/api-client
│       └── src/
│           ├── client.ts          ← createApiClient() factory
│           ├── errors.ts          ← SentimentaApiError
│           └── index.ts
│
├── backend/                       ← FastAPI (Python)
│   ├── app/
│   │   ├── routers/
│   │   │   ├── billing.py         ← NEW: /billing/plans, /billing/usage
│   │   │   └── ...
│   │   └── services/
│   │       ├── plan_service.py    ← NEW: PLAN_LIMITS, enforce_sync_limits()
│   │       └── ...
│   └── requirements.txt
│
├── docs/
│   └── PRODUCTION_GUIDE.md        ← ESTE ARQUIVO
│
└── docker-compose.yml
```

### Como o App Mobile se integra

Quando você trouxer o código do app (repo `Sentimentaapp`):

```bash
# 1. Adicionar ao workspace
# No package.json raiz, adicionar "apps/mobile" na lista de workspaces

# 2. O app importa tipos e API client assim:
import { DashboardSummary, Connection } from "@sentimenta/types";
import { createApiClient } from "@sentimenta/api-client";

# 3. Criar o API client para mobile:
const api = createApiClient({
  baseUrl: "https://api.sentimenta.com.br/api/v1",
  getToken: async () => await AsyncStorage.getItem("auth_token"),
  onUnauthorized: () => navigation.navigate("Login"),
});

# 4. Usar:
const summary = await api.dashboard.summary();
```

---

## VPS Hostinger — Setup de Produção

### Step 1: Acessar a VPS

```bash
ssh root@147.93.13.49
```

### Step 2: Instalar dependências do sistema

```bash
# Atualizar
apt update && apt upgrade -y

# PostgreSQL 16
apt install -y postgresql-16 postgresql-client-16

# Redis
apt install -y redis-server

# Python 3.12
apt install -y python3.12 python3.12-venv python3-pip

# Node.js 20 (para o frontend, se quiser hospedar na VPS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Nginx (reverse proxy)
apt install -y nginx certbot python3-certbot-nginx

# Supervisor (gerenciar processos)
apt install -y supervisor

# Git
apt install -y git
```

### Step 3: Configurar PostgreSQL

```bash
# Acessar como postgres
sudo -u postgres psql

# Criar database e user
CREATE USER sentimenta WITH PASSWORD 'SUA_SENHA_FORTE_AQUI';
CREATE DATABASE sentimenta_db OWNER sentimenta;
GRANT ALL PRIVILEGES ON DATABASE sentimenta_db TO sentimenta;
\q

# Configurar acesso remoto (se precisar conectar do seu PC)
# Editar /etc/postgresql/16/main/postgresql.conf
# listen_addresses = '*'

# Editar /etc/postgresql/16/main/pg_hba.conf
# Adicionar: host all sentimenta 0.0.0.0/0 md5

# Reiniciar
systemctl restart postgresql
```

### Step 4: Configurar Redis

```bash
# Editar /etc/redis/redis.conf
# Configurar senha:
# requirepass SUA_REDIS_PASSWORD

systemctl enable redis-server
systemctl restart redis-server
```

### Step 5: Configurar Firewall

```bash
# Criar regras no painel Hostinger OU via ufw:
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 5432/tcp    # PostgreSQL (se precisar acesso externo)
ufw enable
```

### Step 6: Clonar e configurar o backend

```bash
# Clonar repo
cd /opt
git clone https://github.com/vinialveslopesanjos/sentimenta.git
cd sentimenta

# Checkout da branch
git checkout sentimenta_turbo

# Criar virtualenv
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Criar .env
cat > /opt/sentimenta/.env << 'EOF'
DATABASE_URL=postgresql://sentimenta:SUA_SENHA@localhost:5432/sentimenta_db
REDIS_URL=redis://:SUA_REDIS_PASSWORD@localhost:6379/0
SECRET_KEY=GERAR_UMA_CHAVE_SEGURA_AQUI
GEMINI_API_KEY=SUA_GEMINI_KEY
GEMINI_MODEL=gemini-2.0-flash
APIFY_API_TOKEN=SEU_TOKEN_APIFY
CELERY_BROKER_URL=redis://:SUA_REDIS_PASSWORD@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:SUA_REDIS_PASSWORD@localhost:6379/1
DEBUG=false
EOF

# Rodar migrations
cd backend
alembic upgrade head
```

### Step 7: Configurar Supervisor (processos persistentes)

```ini
# /etc/supervisor/conf.d/sentimenta.conf

[program:sentimenta-api]
command=/opt/sentimenta/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
directory=/opt/sentimenta/backend
environment=PATH="/opt/sentimenta/backend/.venv/bin"
autostart=true
autorestart=true
stdout_logfile=/var/log/sentimenta-api.log
stderr_logfile=/var/log/sentimenta-api-error.log
user=root

[program:sentimenta-celery]
command=/opt/sentimenta/backend/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
directory=/opt/sentimenta/backend
environment=PATH="/opt/sentimenta/backend/.venv/bin"
autostart=true
autorestart=true
stdout_logfile=/var/log/sentimenta-celery.log
stderr_logfile=/var/log/sentimenta-celery-error.log
user=root
```

```bash
supervisorctl reread
supervisorctl update
supervisorctl start all
```

### Step 8: Configurar Nginx + SSL

```nginx
# /etc/nginx/sites-available/sentimenta

server {
    listen 80;
    server_name api.sentimenta.com.br;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/sentimenta /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL com Let's Encrypt (gratuito — requer domínio apontando para o IP)
certbot --nginx -d api.sentimenta.com.br
```

---

## Como Rodar Localmente

### Pré-requisitos

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 (local ou Docker)
- Redis (local ou Docker)

### Setup do Monorepo

```powershell
# 1. Clone o repo (se ainda não tem)
cd d:\vscode\Projetos\social_media_sentiment

# 2. Instalar dependências (workspaces npm)
npm install

# 3. Build dos pacotes compartilhados
npm run build:packages

# 4. Rodar o frontend
npm run dev:web
# → http://localhost:3000
```

### Backend (separadamente)

```powershell
# Terminal separado
cd d:\vscode\Projetos\social_media_sentiment\backend

# Ativar virtualenv
.\.venv\Scripts\activate

# Rodar API
uvicorn app.main:app --reload --port 8000

# Em outro terminal: Celery worker
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

---

## Testar o App Mobile no iPhone

### Opção 1: Expo Go (RECOMENDADO para desenvolvimento)

Expo Go permite rodar o app no seu iPhone sem precisar de Apple Developer Account.

```bash
# 1. Criar o app Expo no monorepo
# (quando integrar o repo Sentimentaapp)
cd apps/mobile  # ou onde ficar seu app

# 2. Instalar Expo CLI
npm install -g expo-cli

# 3. Instalar dependências
npm install

# 4. Configurar API URL
# No seu .env ou app.config.js:
# API_URL=http://SEU_IP_LOCAL:8000/api/v1
# (Use o IP da sua máquina na rede Wi-Fi, não localhost)

# Para descobrir seu IP local:
ipconfig  # Procure por "IPv4 Address" no adaptador Wi-Fi

# 5. Rodar
npx expo start

# 6. No iPhone:
# - Baixar "Expo Go" na App Store (gratuito)
# - Escanear o QR Code que aparece no terminal
# - O app abre direto no seu iPhone! 🎉
```

**⚠️ IMPORTANTE:** Seu iPhone e PC precisam estar na **mesma rede Wi-Fi**.

### Opção 2: Build de Desenvolvimento (EAS Build)

Para testar mais próximo da versão de produção:

```bash
# 1. Criar conta em expo.dev (gratuito)
# 2. Instalar EAS CLI
npm install -g eas-cli

# 3. Login
eas login

# 4. Configurar build
eas build:configure

# 5. Build para iOS (dev)
eas build --platform ios --profile development

# 6. O build gera um link para instalar o app via TestFlight ou ad-hoc
```

**Custos:**
- Expo Go: **Grátis** ← use isso na beta
- EAS Build (free tier): 30 builds/mês **grátis**
- Apple Developer Account: **$99/ano** (só precisa para publicar na App Store)

---

## Integração Stripe (Pagamentos)

### Passo a Passo

#### 1. Criar conta Stripe
- Acesse [stripe.com](https://stripe.com)
- Registre-se com seus dados de empresa/CPF
- Brasileiros podem receber em reais (BRL)

#### 2. Criar Produtos no Stripe Dashboard

No Stripe Dashboard → Products:

| Produto | Preço | Recorrência |
|---|---|---|
| Sentimenta Creator | R$67/mês | Mensal |
| Sentimenta Pro | R$97/mês | Mensal |
| Sentimenta Agency | R$397/mês | Mensal |

#### 3. Implementar no Backend

```python
# Adicionar ao requirements.txt:
# stripe>=8.0.0

# Novo endpoint: /api/v1/billing/checkout
# → Cria uma Stripe Checkout Session
# → Redireciona o user para a página de pagamento do Stripe
# → Stripe cuida de toda a UI de pagamento

# Novo endpoint: /api/v1/billing/webhook
# → Recebe eventos do Stripe (payment_succeeded, subscription_cancelled)
# → Atualiza o campo user.plan no banco

# Novo endpoint: /api/v1/billing/portal
# → Gera link para o Stripe Customer Portal
# → User gerencia seu plano sem você precisar de UI
```

#### 4. Chaves necessárias (.env)

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CREATOR=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
```

---

## Planos & Precificação

### Custos por Análise (base: seu Instagram — 58 posts, 400 comentários = R$7)

| Componente | Custo por análise |
|---|---|
| Apify (R$0.0115/comentário) | ~R$4.60 (400 comentários) |
| Gemini Flash | ~R$0.20–0.50 |
| Infra (VPS rateada) | ~R$0.50 |
| **Total** | **~R$5.50** |

### Estrutura com Margem Saudável (~40%)

| Plano | Preço | Conexões | Análises/mês | Custo estimado | Margem |
|---|---|---|---|---|---|
| **Grátis** | R$0 | 1 | 1 | R$5.50 | (aquisição) |
| **Creator** | R$67 | 3 | 10 | R$40 | ~40% |
| **Pro** | R$167 | 10 | 30 | R$100 | ~40% |
| **Agency** | R$397 | 30 | 100 | R$250 | ~37% |

### Regras de Limite por Plano (implementadas em `plan_service.py`)

```
Free:    5 posts/sync,  50 comentários/post,  1 sync/mês
Creator: 20 posts/sync, 300 comentários/post, 10 syncs/mês
Pro:     50 posts/sync, 500 comentários/post, 30 syncs/mês
Agency:  100 posts/sync, 1000 comentários/post, 100 syncs/mês
```

---

## Controle de Custos Apify

O `plan_service.py` implementa:

1. **Budget por plano** — cada plano tem um orçamento máximo em BRL para Apify
2. **Tracking via pipeline_runs** — `comments_fetched × R$0.0115` = custo estimado
3. **Bloqueio automático** — se o user atingir o budget, `enforce_sync_limits()` retorna 403
4. **Cap de parâmetros** — `max_posts` e `max_comments` são capados pelo plano, mesmo se o user pedir mais

### Novo endpoint: `GET /api/v1/billing/usage`

Retorna:
```json
{
  "plan": "creator",
  "usage": {
    "syncs_used_this_month": 4,
    "syncs_limit": 10,
    "connections_used": 2,
    "connections_limit": 3,
    "apify_credits_used_brl": 18.40,
    "apify_credits_limit_brl": 80.00,
    "billing_period_start": "2026-02-01T00:00:00+00:00",
    "billing_period_end": "2026-03-01T00:00:00+00:00"
  }
}
```

---

## Deploy em Produção

### Frontend (Web)

**Opção A: Vercel (recomendado)**
- Importa o repo do GitHub
- Configura root directory = `frontend`
- Env vars: `NEXT_PUBLIC_API_URL=https://api.sentimenta.com.br/api/v1`
- Deploy automático em cada push
- **Custo: GRÁTIS**

**Opção B: VPS Hostinger**
- Build: `cd frontend && npm run build`
- Servir com Nginx como site estático
- **Custo: já incluído na VPS**

### Backend

- Já configurado na VPS (Step 7 acima)
- Supervisor mantém API + Celery rodando
- Nginx faz reverse proxy com SSL

### Mobile

- Expo Go para testes
- EAS Build para TestFlight/beta
- **Custo inicial: GRÁTIS**

---

## Checklist da Beta

### 🔴 CRÍTICO — Não sobe sem

- [ ] PostgreSQL configurado na VPS com senha forte
- [ ] Redis configurado na VPS com senha
- [ ] Nginx com SSL (HTTPS) via Let's Encrypt
- [ ] `SECRET_KEY` gerada com `python -c "import secrets; print(secrets.token_hex(32))"`
- [ ] `PLAN_LIMITS` implementado e testado (arquivo `plan_service.py`)
- [ ] Rate limiting na API (`slowapi` ou o `rate_limiter` existente)
- [ ] CORS configurado para domínio de produção
- [ ] `.env` NUNCA comitado no git (verificar `.gitignore`)
- [ ] Error handling no frontend (não mostrar stacktraces)
- [ ] Fallback Apify → Instaloader funcionando

### 🟡 IMPORTANTE — Resolver na primeira semana

- [ ] Configurar domínio (api.sentimenta.com.br)
- [ ] Apontar DNS para IP da VPS (147.93.13.49)
- [ ] Email transacional configurado (Resend.com — grátis até 3k/mês)
- [ ] Stripe em modo test configurado
- [ ] Política de Privacidade (LGPD)
- [ ] Termos de Uso
- [ ] Sentry para monitorar erros (grátis)
- [ ] Backup automático do PostgreSQL (pg_dump schedule)

### 🟢 NICE TO HAVE

- [ ] Google OAuth
- [ ] Push notifications (Expo)
- [ ] Dashboard de uso (usage analytics)
- [ ] PDF export
- [ ] Webhook Slack para alertas críticos

---

## Contas Para Criar

| Serviço | Para quê | Custo | Criar em |
|---|---|---|---|
| **Stripe** | Pagamentos | 2.9% + R$0.39/transação | [stripe.com](https://stripe.com) |
| **Expo** | Build do app mobile | Grátis (30 builds/mês) | [expo.dev](https://expo.dev) |
| **Resend** | Email transacional | Grátis (3k/mês) | [resend.com](https://resend.com) |
| **Sentry** | Monitoramento de erros | Grátis (10k events/mês) | [sentry.io](https://sentry.io) |
| **Vercel** | Deploy do frontend web | Grátis | [vercel.com](https://vercel.com) |
| **Let's Encrypt** | SSL (HTTPS) | Grátis | Automatizado via Certbot |
| **Apple Developer** | Publicar na App Store | $99/ano | [developer.apple.com](https://developer.apple.com) |

**Nota:** Apple Developer Account só precisa quando for publicar de verdade. Para testar no seu iPhone via Expo Go, não precisa.

---

## Custo Total Estimado para Beta

| Item | Custo/mês |
|---|---|
| VPS Hostinger (já paga) | R$0 (incluso) |
| Domínio .com.br | ~R$40/ano = ~R$3/mês |
| Apify (para os primeiros users) | ~R$30–50 |
| Gemini API | ~R$5–10 |
| Stripe fees | só quando receber pagamentos |
| **Total** | **~R$40–65/mês** |

Considerando que um só cliente Creator (R$67/mês) já cobre tudo, o breakeven é **1 cliente pagante**. 🚀

---

*Última atualização: Fevereiro 2026*
