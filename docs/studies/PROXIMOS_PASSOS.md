# Sentimenta - Proximos Passos

## Como rodar o projeto (1 comando)

```powershell
.\start.ps1
```

Isso abre 3 janelas PowerShell automaticamente:
- **API FastAPI** (porta 8000) - backend com auto-reload
- **Celery Worker** - processamento assíncrono (ingestão + análise IA)
- **Frontend Next.js** (porta 3000) - interface

Acesse: http://localhost:3000 (aguarde ~10 segundos para o Next.js compilar)

> **Pre-requisito:** PostgreSQL e Redis precisam estar rodando como servico Windows.
> Ambos ja estao instalados e configurados na sua maquina.
> Se parados: `Start-Service postgresql-x64-16` e `Start-Service Redis`

---

## Alternativa com Docker (quando instalar Docker Desktop)

```bash
docker compose up --build
```

---

## Configuracao obrigatoria antes de rodar

### 1. Apify Token (para pegar comentários do Instagram)

1. Crie uma conta gratuita em https://apify.com
2. Vá em https://console.apify.com/account/integrations
3. Copie seu API Token
4. Cole no arquivo `.env`:

```env
APIFY_API_TOKEN=apify_api_XXXXXXXXXXXXX
```

O Apify usa o actor `apify/instagram-comment-scraper` que pega comentários abertos de qualquer post público do Instagram. Funciona sem login, sem OAuth, sem Graph API.

**Custo:** O plano gratuito do Apify inclui $5/mês de créditos, suficiente para ~10.000 comentários. Planos pagos a partir de $49/mês.

### 2. Gemini API Key (já configurada)

A chave do Gemini já está no `.env`. Se precisar trocar:
- https://aistudio.google.com/app/apikey

---

## Fluxo completo do usuario

1. Abre http://localhost:3000
2. Cria conta (email + senha)
3. Conecta perfil Instagram (ex: `vini_alveees`)
4. Sistema busca posts recentes via instaloader
5. Para cada post, busca comentários via Apify
6. Gemini analisa cada comentário (sentimento, emoções, tópicos, sarcasmo)
7. Dashboard mostra métricas consolidadas

---

## Arquitetura de scraping Instagram

```
Perfil/Posts  →  instaloader (gratuito, sem login)
Comentários   →  Apify instagram-comment-scraper (confiável, sem login)
                  ↓ fallback
                  instaloader (pode dar rate limit)
```

**Por que Apify para comentários?**
- instaloader é bloqueado frequentemente pelo Instagram ao tentar pegar comentários
- Apify lida com proxies, rate limits e captchas internamente
- Sem necessidade de OAuth ou Graph API da Meta

---

## Proximos passos por prioridade

### P0 - Critico (fazer agora)

- [ ] **Configurar APIFY_API_TOKEN** no `.env` e testar com @vini_alveees
- [ ] **Testar fluxo completo** local: registro → conexão → ingestão → análise → dashboard
- [ ] **Alembic migrations** - trocar `create_all()` por migrations versionadas
  ```bash
  cd backend
  alembic init alembic
  alembic revision --autogenerate -m "initial"
  alembic upgrade head
  ```

### P1 - Antes do lançamento

- [ ] **Deploy em produção** - opções recomendadas:
  - Railway.app (mais fácil, ~$10/mês)
  - Render.com (tem free tier)
  - DigitalOcean App Platform (~$20/mês)
  - VPS com Docker Compose (mais controle)
- [ ] **Domínio personalizado** - ex: sentimenta.com.br
- [ ] **HTTPS/SSL** - automático com Railway/Render, ou Let's Encrypt na VPS
- [ ] **Trocar SECRET_KEY** por uma chave segura de produção
- [ ] **Trocar TOKEN_ENCRYPTION_KEY** por uma chave nova de produção
- [ ] **Configurar Google OAuth** para login com Google funcionar
- [ ] **Rate limiting** por IP na API (já tem por conexão no sync)

### P2 - Crescimento

- [ ] **YouTube completo** - ingestão de comentários já funciona via yt-dlp
- [ ] **Landing page** melhorada com demonstração ao vivo
- [ ] **Planos pagos** (Stripe/Mercado Pago):
  - Free: 1 perfil, 50 comentários/mês
  - Pro: 5 perfis, 5.000 comentários/mês - R$49/mês
  - Business: 20 perfis, 50.000 comentários/mês - R$199/mês
- [ ] **Relatórios PDF** exportáveis
- [ ] **Alertas por email** quando sentimento negativo aumenta
- [ ] **Dashboard comparativo** entre perfis

### P3 - Expansão de plataformas

- [ ] **TikTok** via Apify (actor: `apify/tiktok-scraper`)
- [ ] **Twitter/X** via Apify (actor: `apify/twitter-scraper`)
- [ ] **LinkedIn** (scraping mais restrito, avaliar viabilidade)
- [ ] **Facebook Pages** via Graph API

### P4 - Funcionalidades avançadas

- [ ] **Análise temporal** - detectar mudanças de sentimento ao longo do tempo
- [ ] **Detecção de crises** - alertas automáticos de picos negativos
- [ ] **Análise de concorrentes** - comparar sentimento entre perfis
- [ ] **API pública** para integrações de terceiros
- [ ] **Mobile app** (React Native ou PWA)
- [ ] **Webhooks** para notificações em tempo real
- [ ] **Multi-idioma** na análise (já funciona com Gemini, mas melhorar prompts)

---

## Estimativa de custos operacionais (MVP)

| Serviço | Custo mensal |
|---------|-------------|
| Apify (5k comentários) | $5 (free tier) |
| Gemini API (5k análises) | $0 (free tier generoso) |
| Hosting (Railway) | $5-10 |
| PostgreSQL (Railway) | incluso |
| Redis (Railway) | incluso |
| Domínio .com.br | ~R$40/ano |
| **Total MVP** | **~$10-15/mês** |

---

## Viabilidade do SaaS

### Pontos fortes
- **Problema real**: criadores de conteúdo e figuras públicas precisam entender seu público
- **Custo baixo**: infraestrutura barata, Gemini e Apify têm free tiers generosos
- **Diferencial**: foco em pessoa física (vs Brandwatch/Sprout Social que são enterprise)
- **Moat técnico**: pipeline Apify + Gemini é difícil de replicar para quem não é dev
- **Mercado BR**: poucos competidores focados em português

### Riscos
- **Dependência do Apify**: se mudar API ou aumentar preço, precisa de alternativa
- **Instagram pode bloquear**: Apify lida com isso, mas é risco constante
- **LGPD**: comentários são públicos, mas análise pode esbarrar em regulamentação
- **Churn**: se não mostrar valor rapidamente, usuário cancela

### Recomendação
O plano é **viável**. Comece com MVP, valide com 10-20 usuários beta (criadores de conteúdo que você conhece), itere baseado em feedback antes de investir em features avançadas.
