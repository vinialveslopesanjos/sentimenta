# Kit do Meta App Review — Instagram Login público

Data: 2026-07-09 · App: sentimenta (FB app 1732826841014909 / IG app 842048182189177)
Objetivo: Acesso Avançado a `instagram_business_basic`, `instagram_business_manage_comments`
(e opcionalmente `manage_messages` — ver nota) para QUALQUER conta Business/Creator logar
e o Sentimenta puxar comentários pela API oficial (Apify $0).

## Estado
- [x] Redirect URIs de produção no console (corrigido 09/07)
- [x] Endpoint de Data Deletion Callback + Deauthorize (`/api/v1/meta/data-deletion`, `/api/v1/meta/deauthorize`) — este PR
- [x] Página pública de instruções `/exclusao-de-dados` — este PR
- [x] Política de privacidade `/privacidade`
- [ ] URLs registradas no modal "Configurações do login da empresa" (Claude faz após deploy)
- [ ] Vinicius aceita convite de tester (@vini_alveees) e valida o login ponta a ponta
- [ ] **Screencast (Vinicius grava — roteiro abaixo)**
- [ ] Submissão no console (Claude preenche com os textos abaixo)

## Justificativas por permissão (colar na submissão, em inglês)

**instagram_business_basic**
> Sentimenta is a social listening tool where Instagram professional account owners
> connect THEIR OWN account to monitor audience sentiment. We use instagram_business_basic
> to read the connected account's profile (username, id) and media list, so the user can
> see their own posts inside our dashboard and select which ones to analyze. Data is only
> read for the authenticated account, is deletable by the user at any time (in-app account
> deletion, data deletion callback, or email), and is never sold or shared.

**instagram_business_manage_comments**
> Our core feature is AI sentiment analysis of comments on the user's own posts. We use
> this permission to READ comments of the authenticated account's media in order to
> compute sentiment scores, emotions and topic insights shown back to the account owner.
> We do not post, hide or delete comments on behalf of users in this use case; reading
> the comment text is essential to provide the analytics the user signs up for.

**Nota `manage_messages`**: o caso de uso atual NÃO usa mensagens. Recomendo **remover
essa permissão da submissão** (menos escopo = review mais fácil). Se um dia fizer inbox,
submete depois.

## Roteiro do screencast (2–3 min, celular na vertical ou desktop — SUA PARTE)
Gravar tela SEM cortes, com a conta tester (@vini_alveees já aceito):
1. (0:00) Abrir `sentimenta.com.br` — mostrar a landing por 2s.
2. (0:10) Ir em Entrar → clicar **"Continuar com Instagram"**.
3. (0:20) Tela de autorização do Instagram → mostrar as permissões pedidas → **Permitir**.
4. (0:35) De volta ao Sentimenta: dashboard carrega com o perfil conectado.
5. (0:50) Abrir o perfil conectado → mostrar posts com **análises de sentimento dos
   comentários** (scores, emoções). Falar/legenda: "the app analyzes comments of the
   authenticated user's own posts".
6. (1:30) Mostrar Conta → Zona de Perigo → botão de excluir conta (só mostrar, não clicar).
7. (1:45) Mostrar a página `sentimenta.com.br/exclusao-de-dados` (instruções de exclusão).
8. Fim. Exportar MP4 e me mandar / subir na submissão.

## URLs para o console (Claude registra no modal "Configurações do login da empresa")
- Desautorização: `https://api.sentimenta.com.br/api/v1/meta/deauthorize`
- Exclusão de dados: `https://api.sentimenta.com.br/api/v1/meta/data-deletion`

## Depois da aprovação
- Publicar o app (Publicar → Live) no painel.
- Testar login com uma conta Business que NÃO é tester.
- Aí sim: onboarding "Continuar com Instagram" aberto ao público + ingest via Graph API.
