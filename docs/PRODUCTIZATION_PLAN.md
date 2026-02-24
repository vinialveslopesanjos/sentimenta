# 🎯 Sentimenta — Plano de Produtização Completo
> Criado: Fevereiro 2026 | Estado: Web (main) ✅ | App (Figma→código) 🔄 | VPS 🔲

---

## Estado atual (o que já existe)

| Componente | Status | Onde |
|---|---|---|
| **Web frontend** (Next.js 14) | ✅ Completo e polido | `frontend/` → branch `main` |
| **Backend API** (FastAPI) | ✅ Funcionando local | `backend/` |
| **Banco de dados** (PostgreSQL) | ✅ Modelado, rodando local | `backend/alembic/` |
| **Pipeline Apify/Gemini** | ✅ Funcionando | `backend/app/tasks/` |
| **Planos + limites** | ✅ Implementado | `plan_service.py` + `billing.py` |
| **Shared types** | ✅ Criado | `packages/types/` |
| **API client universal** | ✅ Criado | `packages/api-client/` |
| **App mobile** (Expo/RN) | 🔄 Frontend Figma feito | repo `Sentimentaapp` |
| **VPS configurada** | 🔲 Instalada, não configurada | `147.93.13.49` |
| **Domínio/DNS** | 🔲 Não configurado | — |
| **Deploy produção** | 🔲 Pendente | — |
| **Stripe** | 🔲 Não integrado | — |

---

## FASE 1 — VPS + Backend em Produção
> **Objetivo:** Backend e banco rodando na VPS, acessível via HTTPS.
> **Tempo estimado:** 2–3 horas (pode ser feito hoje à noite)

### 1.1 — Configurar DNS do domínio

**O que você precisa ter:** Um domínio. Se não tem, registre `sentimenta.com.br` na Registro.br (~R$40/ano).

**O que fazer:**
1. No painel do seu provedor de domínio, criar registro DNS:
   ```
   Tipo: A
   Nome: api
   Valor: 147.93.13.49
   TTL: 300
   ```
2. Aguardar propagação (~5–30 minutos)
3. Verificar: `nslookup api.sentimenta.com.br`

---

### 1.2 — Rodar o script de setup da VPS

O script `scripts/setup_vps.sh` faz **tudo automaticamente**. Siga:

```bash
# 1. Conectar na VPS
ssh root@147.93.13.49

# 2. Baixar o script diretamente do GitHub
curl -O https://raw.githubusercontent.com/vinialveslopesanjos/sentimenta/main/scripts/setup_vps.sh

# 3. EDITAR as senhas e chaves antes de rodar:
nano setup_vps.sh
# Alterar:
#   DB_PASSWORD="senha_forte_aqui"
#   REDIS_PASSWORD="outra_senha_aqui"
#   GEMINI_API_KEY="sua_chave_gemini"
#   APIFY_API_TOKEN="seu_token_apify"
#   DOMAIN_API="api.sentimenta.com.br"

# 4. Rodar
bash setup_vps.sh
```

**O que o script faz:**
- Instala PostgreSQL 16, Redis, Python 3.12, Nginx, Supervisor
- Clona o repo (branch `main`)
- Cria o `.env` com as credenciais
- Roda as migrations do Alembic
- Configura Supervisor para manter API + Celery rodando
- Configura Nginx como reverse proxy

---

### 1.3 — Habilitar HTTPS (Let's Encrypt)

Só rodar após o DNS estar propagado:
```bash
certbot --nginx -d api.sentimenta.com.br
# Seguir as instruções interativas
# Renovação automática já vem configurada
```

---

### 1.4 — Verificar que está funcionando

```bash
# Da sua máquina local:
curl https://api.sentimenta.com.br/health
# Esperado: {"status":"ok"}

curl https://api.sentimenta.com.br/docs
# Abrir no browser → ver documentação interativa da API
```

✅ **Critério de sucesso:** HTTPS funcionando, `/health` respondendo.

---

## FASE 2 — Web Frontend em Produção (Vercel)
> **Objetivo:** Web app acessível em `app.sentimenta.com.br` (ou `sentimenta.com.br`)
> **Tempo estimado:** 30 minutos

### 2.1 — Deploy na Vercel

1. Acessar [vercel.com](https://vercel.com) → Sign in with GitHub
2. Clicar em **"Add New Project"**
3. Importar o repo `vinialveslopesanjos/sentimenta`
4. Configurar:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
5. Variáveis de ambiente:
   ```
   NEXT_PUBLIC_API_URL=https://api.sentimenta.com.br/api/v1
   NEXTAUTH_SECRET=gerar_chave_aqui
   NEXTAUTH_URL=https://app.sentimenta.com.br
   ```
6. Clicar em **Deploy**

### 2.2 — Configurar domínio custom na Vercel

1. Vercel → Settings → Domains → Add `app.sentimenta.com.br`
2. No DNS do domínio:
   ```
   Tipo: CNAME
   Nome: app
   Valor: cname.vercel-dns.com
   ```

### 2.3 — Atualizar CORS no backend

Adicionar o domínio de produção no `backend/app/core/config.py`:
```python
CORS_ORIGINS: list[str] = [
    "http://localhost:3000",
    "https://app.sentimenta.com.br",
    "https://sentimenta.com.br",
]
```

Fazer commit e deploy:
```bash
git add . && git commit -m "config: add production domain to CORS"
git push origin main
# Na VPS: /opt/sentimenta/scripts/deploy.sh
```

✅ **Critério de sucesso:** `https://app.sentimenta.com.br` abre o dashboard.

---

## FASE 3 — Integrar App Mobile ao Monorepo
> **Objetivo:** Código do Sentimentaapp dentro do monorepo, consumindo a API
> **Tempo estimado:** 3–5 horas

### 3.1 — Trazer o código do app para o monorepo

```powershell
# Na raiz do monorepo (local):
cd d:\vscode\Projetos\social_media_sentiment

# Criar pasta apps/
mkdir apps

# Clonar o repo do app
git clone https://github.com/vinialveslopesanjos/Sentimentaapp.git apps/mobile
# (Se for privado, usar autenticação GitHub)

# Remover o .git do app clonado
Remove-Item -Path "apps\mobile\.git" -Recurse -Force
```

### 3.2 — Atualizar package.json raiz

```json
// package.json (raiz)
{
  "name": "sentimenta",
  "workspaces": [
    "packages/*",
    "frontend",
    "apps/mobile"
  ]
}
```

### 3.3 — Atualizar package.json do mobile

No arquivo `apps/mobile/package.json`, adicionar:
```json
{
  "name": "@sentimenta/mobile",
  "dependencies": {
    "@sentimenta/types": "*",
    "@sentimenta/api-client": "*"
  }
}
```

### 3.4 — Criar o API client no mobile

Criar `apps/mobile/src/lib/api.ts`:
```typescript
import { createApiClient } from "@sentimenta/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL 
  ?? "https://api.sentimenta.com.br/api/v1";

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => AsyncStorage.getItem("sentimenta_access_token"),
  onUnauthorized: () => {
    AsyncStorage.multiRemove([
      "sentimenta_access_token",
      "sentimenta_refresh_token",
    ]);
    // Navegar para login — depende da sua nav setup
  },
});
```

### 3.5 — Configurar variáveis de ambiente Expo

Criar `apps/mobile/.env`:
```env
# Desenvolvimento (IP local da sua máquina)
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api/v1

# Produção
# EXPO_PUBLIC_API_URL=https://api.sentimenta.com.br/api/v1
```

> ⚠️ Para descobrir seu IP: no PowerShell, `ipconfig` → procurar IPv4 do Wi-Fi adapter.

### 3.6 — Atualizar telas que ainda usam dados mock

Identificar telas no Figma/app que ainda usam dados hardcoded e substituir por chamadas da API:

```typescript
// ANTES (mock)
const data = { score: 7.8, connections: [...mockData] };

// DEPOIS (API real)
const { data, loading, error } = useApiData(() => api.dashboard.summary());
```

### 3.7 — Instalar dependências e testar

```powershell
# Na raiz do monorepo:
npm install
npm run build:packages

# Rodar o app
cd apps/mobile
npx expo start
# → Escanear QR code com Expo Go no iPhone
```

✅ **Critério de sucesso:** App abre no iPhone e mostra dados reais do seu Instagram.

---

## FASE 4 — Pagamentos com Stripe
> **Objetivo:** Usuário consegue assinar um plano e ter limites liberados
> **Tempo estimado:** 4–8 horas

### 4.1 — Criar conta Stripe

1. Acessar [stripe.com](https://stripe.com/br) → Criar conta
2. Completar verificação de identidade (CPF + dados bancários)
3. Criar os **Produtos** no Dashboard:
   - Creator: R$67/mês (recorrente mensal)
   - Pro: R$167/mês (recorrente mensal)
   - Agency: R$397/mês (recorrente mensal)
4. Copiar os **Price IDs** (começam com `price_...`)

### 4.2 — Instalar Stripe no backend

```bash
# No backend/ local:
pip install stripe
echo "stripe>=8.0.0" >> requirements.txt
```

### 4.3 — Adicionar variáveis de ambiente

No `.env` (local e VPS):
```env
STRIPE_SECRET_KEY=sk_test_...   # test em dev, sk_live_ em prod
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CREATOR=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
STRIPE_SUCCESS_URL=https://app.sentimenta.com.br/settings?payment=success
STRIPE_CANCEL_URL=https://app.sentimenta.com.br/pricing
```

### 4.4 — Implementar endpoints no backend

**Arquivo:** `backend/app/routers/billing.py` (adicionar aos que já existem):

```python
import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/checkout")
def create_checkout_session(
    plan: str,  # "creator" | "pro" | "agency"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria uma Stripe Checkout Session e redireciona para pagamento."""
    price_map = {
        "creator": settings.STRIPE_PRICE_CREATOR,
        "pro": settings.STRIPE_PRICE_PRO,
        "agency": settings.STRIPE_PRICE_AGENCY,
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise HTTPException(400, "Plano inválido")

    session = stripe.checkout.Session.create(
        customer_email=current_user.email,
        metadata={"user_id": str(current_user.id), "plan": plan},
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=settings.STRIPE_SUCCESS_URL,
        cancel_url=settings.STRIPE_CANCEL_URL,
    )
    return {"checkout_url": session.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Recebe eventos do Stripe e atualiza planos no banco."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(400, "Webhook signature invalid")

    if event["type"] == "checkout.session.completed":
        meta = event["data"]["object"]["metadata"]
        user_id = meta.get("user_id")
        plan = meta.get("plan")
        if user_id and plan:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.plan = plan
                db.commit()

    elif event["type"] in ("customer.subscription.deleted", "invoice.payment_failed"):
        # Downgrade para free em caso de cancelamento ou falha
        customer_email = event["data"]["object"].get("customer_email")
        if customer_email:
            user = db.query(User).filter(User.email == customer_email).first()
            if user:
                user.plan = "free"
                db.commit()

    return {"received": True}


@router.post("/portal")
def customer_portal(
    current_user: User = Depends(get_current_user),
):
    """Gera link para o Stripe Customer Portal (gerenciar assinatura)."""
    # Precisa ter o stripe_customer_id salvo no user
    if not current_user.stripe_customer_id:
        raise HTTPException(400, "Sem assinatura ativa")
    
    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url="https://app.sentimenta.com.br/settings",
    )
    return {"portal_url": session.url}
```

### 4.5 — Adicionar stripe_customer_id ao modelo User

```python
# backend/app/models/user.py — adicionar campo:
stripe_customer_id: Mapped[str | None] = mapped_column(
    String(255), unique=True, nullable=True
)
```

Gerar migration:
```bash
cd backend
alembic revision --autogenerate -m "add stripe_customer_id to users"
alembic upgrade head
```

### 4.6 — Configurar Stripe Webhook

No Stripe Dashboard → Webhooks → Add endpoint:
```
URL: https://api.sentimenta.com.br/api/v1/billing/webhook
Eventos: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed
```

✅ **Critério de sucesso:** Clicar em "Assinar Creator" → página Stripe → pagar → plano ativado.

---

## FASE 5 — Emails Transacionais (Resend)
> **Objetivo:** Email de boas-vindas + aviso "análise pronta"
> **Tempo estimado:** 2 horas

### 5.1 — Criar conta Resend

1. Acessar [resend.com](https://resend.com) → Criar conta gratuita
2. Verificar domínio `sentimenta.com.br` (adicionar DNS TXT)
3. Criar API Key

### 5.2 — Instalar no backend

```bash
pip install resend
echo "resend>=2.0.0" >> requirements.txt
```

### 5.3 — Adicionar variável de ambiente

```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@sentimenta.com.br
```

### 5.4 — Criar email service

**Arquivo:** `backend/app/services/email_service.py`

```python
import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

def send_welcome_email(email: str, name: str):
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": email,
        "subject": "Bem-vindo à Sentimenta 👋",
        "html": f"""
        <h1>Olá, {name or 'criador'}!</h1>
        <p>Sua conta está pronta. Conecte seu Instagram e veja o que seu público realmente pensa.</p>
        <a href="https://app.sentimenta.com.br/connect">Conectar agora →</a>
        """,
    })

def send_analysis_ready_email(email: str, name: str, username: str):
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": email,
        "subject": f"Análise do @{username} está pronta! 📊",
        "html": f"""
        <h1>Sua análise ficou pronta!</h1>
        <p>A análise do perfil @{username} foi concluída. Confira os insights agora.</p>
        <a href="https://app.sentimenta.com.br/dashboard">Ver análise →</a>
        """,
    })
```

### 5.5 — Integrar nos pontos certos

```python
# Em auth_service.py → após register_user():
from app.services.email_service import send_welcome_email
send_welcome_email(user.email, user.name or "")

# Em pipeline_tasks.py → após task_full_pipeline terminar:
from app.services.email_service import send_analysis_ready_email
send_analysis_ready_email(user.email, user.name or "", connection.username)
```

---

## FASE 6 — Monitoramento e Segurança
> **Objetivo:** Ter visibilidade de erros e proteger a API
> **Tempo estimado:** 1–2 horas

### 6.1 — Sentry (monitoramento de erros)

```bash
pip install sentry-sdk[fastapi]
```

```python
# backend/app/main.py — adicionar no início:
import sentry_sdk
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN", ""),
    traces_sample_rate=0.1,
    environment="production" if not settings.DEBUG else "development",
)
```

Criar conta grátis em [sentry.io](https://sentry.io) → criar projeto Python → copiar DSN.

### 6.2 — Backups do banco

```bash
# Na VPS — adicionar ao crontab:
crontab -e

# Backup todo dia às 3h da manhã
0 3 * * * /usr/bin/pg_dump -U sentimenta sentimenta_db | gzip > /backups/sentimenta_$(date +%Y%m%d).sql.gz

# Manter só os últimos 7 dias
0 4 * * * find /backups -name "*.sql.gz" -mtime +7 -delete

# Criar a pasta de backups
mkdir -p /backups
chown root:root /backups
```

### 6.3 — Rate Limiting na API

Já existe `rate_limiter.py` no middleware. Garantir que está ativo:

```python
# Verificar backend/app/middleware/rate_limiter.py
# Deve bloquear IPs que fazem muitas requisições
```

---

## FASE 7 — Push Notifications no App (futuro)

Quando o app estiver em produção na App Store/Play:

```bash
# Instalar Expo Notifications
npx expo install expo-notifications

# No backend, quando análise terminar, enviar push via Expo:
# POST https://exp.host/--/api/v2/push/send
# {
#   "to": "ExponentPushToken[xxx]",
#   "title": "Análise pronta!",
#   "body": "@username - Score 7.8"
# }
```

---

## Checklist Executivo — O que fazer em que ordem

### Esta semana (urgente)
- [ ] **Comprar domínio** se não tiver (`sentimenta.com.br` na Registro.br)
- [ ] **Configurar DNS** — `api.sentimenta.com.br` → `147.93.13.49`
- [ ] **Rodar `setup_vps.sh`** na VPS
- [ ] **Habilitar HTTPS** com certbot
- [ ] **Deploy web** na Vercel
- [ ] **Testar ponta a ponta:** login → conectar Instagram → análise → resultado

### Próxima semana
- [ ] **Trazer Sentimentaapp para o monorepo** (Fase 3 completa)
- [ ] **Conectar app ao backend real** (substituir mocks)
- [ ] **Testar no iPhone via Expo Go** (mesma rede Wi-Fi)
- [ ] **Criar conta Resend** e configurar emails
- [ ] **Criar conta Sentry** e configurar monitoramento

### Semana 3
- [ ] **Criar conta Stripe** e produtos
- [ ] **Implementar checkout** (Fase 4)
- [ ] **Testar pagamento completo** em modo test
- [ ] **Criar Política de Privacidade + Termos de Uso**
- [ ] **Beta fechada:** convidar 5–10 pessoas para testar

### Semana 4 (beta pública)
- [ ] **Stripe em modo live** (produção)
- [ ] **App no TestFlight** para usuários beta iOS
- [ ] **Criar Apple Developer Account** ($99/ano)
- [ ] **Board de feedback** (Notion ou similar)

---

## Custo total mensal estimado (beta)

| Item | Custo |
|---|---|
| VPS Hostinger (já pago) | R$0 extra |
| Domínio .com.br | ~R$3/mês (R$40/ano) |
| Vercel (web) | Grátis |
| Expo (builds) | Grátis (30 builds/mês) |
| Resend (emails) | Grátis até 3k/mês |
| Sentry (erros) | Grátis até 10k events |
| Apple Developer | R$550/ano (~R$46/mês) |
| Apify (primeiros users) | ~R$30–50 |
| Gemini API | ~R$5–10 |
| **Total** | **~R$90–110/mês** |

**Breakeven:** ~2 assinantes Creator (R$67 × 2 = R$134) 🎯

---

## Arquitetura final quando tudo estiver pronto

```
[iPhone/Android]      [Browser]
    Expo RN               Next.js
   @sentimenta/mobile    @sentimenta/web
        │                    │
        └────────┬───────────┘
                 │
    @sentimenta/api-client
         (JWT auth)
                 │
         HTTPS :443
                 │
    [VPS Hostinger — São Paulo]
    ┌────────────────────────┐
    │  Nginx (reverse proxy) │
    │  FastAPI :8000         │
    │  Celery worker         │
    │  PostgreSQL 16         │
    │  Redis 7               │
    └────────────────────────┘
                 │
         APIs externas:
         Apify ← coleta
         Gemini ← análise
         Stripe ← pagamentos
         Resend ← emails
```

---

*Plano criado por Antigravity Agent | Fevereiro 2026*
*Ver também: `docs/PRODUCTION_GUIDE.md` e `docs/MOBILE_INTEGRATION.md`*
