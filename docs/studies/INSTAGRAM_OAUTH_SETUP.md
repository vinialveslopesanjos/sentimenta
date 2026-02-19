# Instagram OAuth — Guia de Setup

## Problema: "Page não está disponível"

Esse erro acontece quando o Meta App não está configurado corretamente. Siga este checklist:

---

## Checklist de Configuração

### 1. **Meta for Developers** (https://developers.facebook.com/apps/)

- [ ] App criado com tipo "Consumer" ou "Business"
- [ ] Produto "Instagram" adicionado ao app
- [ ] Status do app: **Live Mode** (não Development)
  - Ir em **App Settings > Basic**
  - Se estiver "Development", clicar em "Switch to Live Mode"

### 2. **Instagram Business Account**

- [ ] Conta Instagram é **Business** ou **Creator** (não Personal)
  - Para converter: Instagram App > Settings > Account > Switch to Professional Account
- [ ] Conta Instagram está **vinculada a uma Facebook Page**
  - Ir em Settings > Account > Linked Accounts > Facebook

### 3. **Redirect URI**

- [ ] URI adicionada na lista de "Valid OAuth Redirect URIs"
  - Ir em **Instagram > Basic Display** ou **Instagram Graph API**
  - Adicionar: `http://localhost:8000/api/v1/connections/instagram/callback`
  - Adicionar: `https://seu-dominio.com/api/v1/connections/instagram/callback` (produção)

### 4. **Permissões (Scopes)**

Para Instagram **Basic Display**:
- `instagram_basic`
- `instagram_manage_comments`
- `pages_show_list` (se usar Business Account)

Para Instagram **Graph API** (Business/Creator):
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_comments`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`

### 5. **App Review**

- [ ] Se o app está em Development Mode, só funciona com **Test Users**
  - Ir em **Roles > Testers** e adicionar suas contas Instagram/Facebook
- [ ] Para funcionar com qualquer conta, precisa:
  - App em **Live Mode**
  - Permissões aprovadas via **App Review** (pode demorar dias)

---

## Como Testar

### Opção 1: Modo Development (sem App Review)

1. Adicione sua conta Instagram como **Tester**:
   - Meta App > **Roles** > **Testers**
   - Adicionar Instagram Account (precisa estar logado no Instagram Business)

2. Use essa conta para testar o OAuth

### Opção 2: Modo Live (funciona para qualquer conta)

1. Submeta o app para **App Review**:
   - Meta App > **App Review** > **Permissions and Features**
   - Request permissions: `instagram_basic`, `instagram_manage_comments`, etc.
   - Preencher uso do app, screenshots, vídeo demo

2. Aguardar aprovação (1-7 dias)

---

## Verificar Configuração Atual

```bash
# No .env do projeto
cat .env | grep INSTAGRAM
```

Deve ter:
```env
INSTAGRAM_APP_ID=seu_app_id_aqui
INSTAGRAM_APP_SECRET=seu_app_secret_aqui
INSTAGRAM_REDIRECT_URI=http://localhost:8000/api/v1/connections/instagram/callback
```

---

## Debug no Backend

Quando o usuário clicar em "Conectar Instagram", a URL gerada será algo como:

```
https://www.instagram.com/oauth/authorize?
  client_id=SEU_APP_ID
  &redirect_uri=http://localhost:8000/api/v1/connections/instagram/callback
  &scope=instagram_basic,instagram_manage_comments,pages_show_list
  &response_type=code
  &state=USER_ID
```

**Se aparecer "Page não está disponível"**, verifique:

1. `client_id` é o App ID correto
2. `redirect_uri` está exatamente igual ao configurado no Meta App (incluindo http/https, porta, caminho)
3. App está em Live Mode (ou a conta é Tester)
4. Conta Instagram é Business/Creator

---

## Alternativa Temporária

Enquanto aguarda App Review, você pode:

1. **Usar YouTube** (não precisa OAuth, usa scraping)
2. **Usar Test Users** do Meta App
3. **Usar API simulada** (mock) para desenvolvimento

---

## Links Úteis

- Meta App Dashboard: https://developers.facebook.com/apps/
- Instagram Graph API Docs: https://developers.facebook.com/docs/instagram-api
- Instagram Basic Display Docs: https://developers.facebook.com/docs/instagram-basic-display-api

---

**Última atualização**: Fevereiro 2026
