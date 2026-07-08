# Setup do "Entrar com Google" — passo a passo (Vinicius executa)

Data: 2026-07-08
Tempo estimado: ~15 minutos. **Sem revisão da Google** para login básico (escopos
`email`/`profile`). O código já está pronto e no ar — falta só a credencial.

## Por que isso importa
Login com Google **pula o muro de verificação de e-mail** (o Google já entrega o e-mail
verificado). É o caminho de menor atrito do onboarding "influencer": um toque, sem senha,
sem link de e-mail. O código já trata tudo (`authenticate_google` em
`backend/app/services/auth_service.py:55`, botão em `frontend/components/SocialLogin.tsx`);
só precisa das duas variáveis abaixo.

## Passo a passo (Google Cloud Console)

1. Acesse https://console.cloud.google.com → crie um projeto (ou use um existente),
   ex.: "Sentimenta".
2. Menu → **APIs e serviços → Tela de permissão OAuth** (OAuth consent screen):
   - Tipo de usuário: **Externo** → Criar.
   - Nome do app: **Sentimenta**. E-mail de suporte: o seu. Logo: opcional.
   - Domínios autorizados: `sentimenta.com.br`.
   - Escopos: adicione apenas `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `openid` (são os básicos, **não** exigem verificação/revisão).
   - Salvar. Publique o app em **Produção** (botão "Publicar app") — com só esses escopos
     básicos, publica sem revisão. (Enquanto em "Testing", só e-mails de teste conseguem
     entrar — dá pra testar assim primeiro.)
3. Menu → **APIs e serviços → Credenciais** → **Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - Nome: "Sentimenta Web".
   - **Origens JavaScript autorizadas**:
     - `https://sentimenta.com.br`
     - `http://localhost:3000` (para testar local, opcional)
   - **URIs de redirecionamento**: pode deixar vazio — o fluxo usa Google Identity Services
     (token no front, verificado no back), não redirect clássico.
   - Criar. Copie o **Client ID** (termina em `.apps.googleusercontent.com`) e o
     **Client Secret**.

## Onde colar as credenciais

**Backend (VPS)** — arquivo `.env` em `/opt/sentimenta-main-deploy/.env` (o deploy real):
```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```

**Frontend** — o Client ID precisa estar disponível no build do Next. Duas opções:
- Se o frontend é buildado na VPS (Docker): adicionar no `.env` que alimenta o build:
  ```
  NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
  ```
- Se o frontend é o deploy da Vercel: adicionar `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nas
  Environment Variables do projeto na Vercel e refazer o deploy.

> Só o **Client ID** vai pro frontend (`NEXT_PUBLIC_`, é público por natureza).
> O **Client Secret** fica SÓ no backend. Nunca commitar nenhum dos dois.

## Como testar (depois de setar)
1. Rebuild/deploy do frontend (pra pegar o `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) e restart do
   backend (pra pegar as duas vars).
2. Janela anônima → `sentimenta.com.br/login`. Deve aparecer o botão **"Continuar com
   Google"** acima do formulário (ele só renderiza quando o Client ID está setado).
3. Clicar → escolher a conta Google → deve cair direto no **dashboard**, **sem** passar
   pela tela de verificação de e-mail.
4. Conferir no banco: `SELECT email, email_verified, google_id FROM users WHERE email='seu@gmail.com'`
   → `email_verified = true`, `google_id` preenchido.

## Estado das outras plataformas
- **Instagram**: credencial **já configurada** na VPS — o botão "Continuar com Instagram"
  já funciona (verificar no Meta for Developers se o app está em modo Live e o
  `INSTAGRAM_REDIRECT_URI` bate com o console).
- **TikTok**: `TIKTOK_CLIENT_KEY/SECRET` vazios; criar app no TikTok for Developers → Login
  Kit quando quiser habilitar (tem review, prazo de dias). Não bloqueia o vídeo.

## Referência de código (para debugar)
- Verificação do token Google: `backend/app/services/auth_service.py:55` (`authenticate_google`)
  → seta `email_verified=True` tanto na criação quanto em conta existente não-verificada.
- Endpoint: `POST /auth/google` (`backend/app/routers/auth.py:191`).
- Botão + carregamento do SDK: `frontend/components/SocialLogin.tsx` (renderiza só com
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` presente; carrega `accounts.google.com/gsi/client`).
