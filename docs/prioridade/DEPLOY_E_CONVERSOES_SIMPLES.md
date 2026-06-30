# Deploy e conversões, versão simples

Este documento explica, de forma direta, como o código sai do GitHub e chega na VPS, o que ainda pode dar errado e como medir cadastro completo no Google Ads.

## A ideia principal

Pense em três lugares diferentes:

1. **GitHub**: é a pasta oficial do projeto na nuvem. É onde ficam PRs, histórico, revisão e testes.
2. **GitHub Actions**: é o robô do GitHub. Ele baixa o código, roda testes e, se estiver tudo certo, pode mandar a VPS atualizar.
3. **VPS**: é o computador que realmente serve o site `sentimenta.com.br`.

O GitHub sozinho não muda a VPS. O que faz a ponte entre os dois é o **GitHub Actions**.

## Fluxo profissional

O fluxo normal deve ser:

1. Criar uma branch.
2. Abrir PR.
3. O GitHub Actions roda testes.
4. Fazer merge na `main`.
5. O CI roda de novo na `main`.
6. Se o CI passar, o workflow **Deploy production** entra na VPS automaticamente.
7. A VPS puxa o commit aprovado, faz backup, build, migrations, sobe containers e valida o site.

Na operação normal, você não precisa entrar na VPS.

## O que ficou automatizado

O workflow `.github/workflows/deploy-production.yml` roda de duas formas:

- automaticamente, quando o workflow **CI** termina com sucesso em um push na `main`;
- manualmente, pelo botão **Run workflow**, para emergência ou reprocessamento.

Ele não deploya PR. Ele também não deploya se o CI falhar.

## O que acontece dentro da VPS

O script `scripts/ops/deploy_compose.sh` faz:

1. trava de deploy para evitar dois deploys ao mesmo tempo;
2. backup do Postgres pelo Docker Compose;
3. build das imagens Docker;
4. `alembic upgrade head`;
5. `docker compose up -d --remove-orphans`;
6. validação local da API e do web.

Depois disso, o GitHub Actions valida endpoints públicos do site.

## Auditoria dos testes atuais

Resposta curta: **não, os testes não garantem que nunca vai dar problema**.

Nenhum projeto sério consegue prometer isso. O que testes fazem é reduzir bastante a chance de quebrar produção e impedir erros óbvios antes do deploy.

Hoje o CI cobre:

- build e type-check do frontend;
- build dos pacotes compartilhados;
- build do mobile quando existir;
- testes do backend com `pytest`;
- validação do `compose.prod.yml`;
- smoke E2E de API, login, dashboard protegido e blog público.

Isso é suficiente para bloquear muita coisa ruim, mas ainda não é uma garantia total.

## Falhas e riscos que ainda existem

- Os testes de backend rodam com SQLite em vários cenários, enquanto produção usa Postgres.
- O CI valida o Compose, mas não sobe o stack inteiro de produção com Postgres real antes do deploy.
- Não existe teste automático de rollback.
- Não existe teste completo de integrações externas como Google Ads, Google Tag, Apify, Stripe, Instagram, TikTok e YouTube.
- Migrations destrutivas ainda exigem cuidado humano.
- Mudança de variável de ambiente `NEXT_PUBLIC_*` exige novo build da imagem web.

Então a regra correta é: deploy automático sim, mas sempre atrás de CI verde, backup e validação.

## Por que o último CI falhou

O backend, web e compose passaram. O que falhou foi o smoke E2E do blog.

O teste antigo procurava o texto sem acento `Reputacao digital`. Depois que os textos foram corrigidos, o site passou a exibir `Reputação digital`. O teste estava desatualizado, não necessariamente o produto quebrado.

O teste foi ajustado para aceitar o português correto com acentos.

## Secrets necessários no GitHub

Em GitHub repo > Settings > Secrets and variables > Actions > Secrets:

- `VPS_HOST`: IP ou host da VPS.
- `VPS_PORT`: porta SSH, exemplo `2222`.
- `VPS_USER`: usuário SSH, exemplo `root`.
- `VPS_SSH_PRIVATE_KEY`: chave privada SSH que acessa a VPS.
- `PROD_APP_DIR`: diretório do app na VPS. Hoje: `/opt/sentimenta-main-deploy`.

Em Variables, opcional:

- `SITE_URL`: `https://sentimenta.com.br`.

## Como saber se foi para produção

Depois de fazer merge:

1. Abra **GitHub > Actions**.
2. Veja o workflow **CI** da `main`.
3. Se ele passar, veja o workflow **Deploy production**.
4. Se o deploy ficar verde, abra:
   - `https://sentimenta.com.br/blog`
   - `https://sentimenta.com.br/api/v1/blog/settings`

Se o CI falhar, nada deve ser deployado automaticamente.

## Rollback simples

Se um deploy quebrar produção:

1. Descubra o commit anterior bom.
2. Rode o deploy manual para aquele commit ou entre na VPS em emergência.
3. Se migration destrutiva tiver rodado, talvez seja necessário restaurar backup.

O ideal, no futuro, é criar um workflow manual de rollback para evitar SSH até nesses casos.

## Conversão correta no Google Ads

O sucesso principal da Sentimenta deve ser:

> Cadastro completo.

Isso significa que o usuário enviou o formulário, a API criou a conta e o frontend recebeu sucesso. Não é clique no botão.

## Como o tracking foi implementado

Quando o cadastro é concluído, o frontend pode disparar:

```ts
gtag("event", "conversion", {
  send_to: "AW-XXXXXXX/YYYYYYY",
  value: 1.0,
  currency: "BRL"
});
```

O evento só dispara se as variáveis estiverem configuradas e se o usuário aceitar os cookies.

## Variáveis para ativar Google Ads

Na `.env` da VPS:

```env
NEXT_PUBLIC_GOOGLE_TAG_ID=AW-123456789
NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL=AbCdEfGhIjK
```

Esses valores vêm do Google Ads:

- `NEXT_PUBLIC_GOOGLE_TAG_ID`: Conversion ID, começa com `AW-`.
- `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL`: Conversion label da ação de conversão.

Depois de preencher, precisa de novo deploy, porque `NEXT_PUBLIC_*` entra no build do Next.js.

## O que fazer com a conversão antiga quebrada

A conversão automática de **Visualização de página** não deve ser principal.

No Google Ads:

- deixar `Cadastro completo` como principal;
- rebaixar `Visualização de página` para secundária ou remover;
- manter a campanha em **Maximizar conversões** somente quando `Cadastro completo` estiver validado.

## Regra prática

- Mudança de código: PR + merge + CI verde + deploy automático.
- Mudança de texto do blog: painel admin, sem deploy.
- Mudança de env: editar `.env` da VPS uma vez + novo deploy.
- Problema em deploy: olhar GitHub Actions primeiro; SSH só em exceção.
