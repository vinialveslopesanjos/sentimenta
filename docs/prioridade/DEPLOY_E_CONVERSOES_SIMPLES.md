# Deploy e conversões, versão simples

Este documento explica o que estava ficando complexo, como reduzir o trabalho manual e como medir cadastro completo no Google Ads.

## O que estava acontecendo

Antes, colocar algo em produção dependia de uma pessoa entrando na VPS por SSH e fazendo várias etapas na mão:

1. Atualizar o código no diretório certo.
2. Conferir se a VPS estava usando aquele diretório.
3. Fazer backup do banco.
4. Buildar as imagens Docker.
5. Rodar migrations.
6. Subir containers.
7. Validar API, site e dados.

Isso é muita coisa para fazer manualmente. O problema não é o Docker em si. O problema é que cada deploy misturava várias responsabilidades numa sessão SSH.

## Por que deu trabalho no último deploy

Os principais motivos:

- Existiam vários diretórios na VPS (`/opt/sentimenta`, `/opt/sentimenta-main-deploy`, staging etc.). Foi preciso descobrir qual estava realmente servindo produção.
- O script de backup tentava conectar no Postgres via `localhost:5432`, mas o Postgres real está dentro do Docker Compose.
- Dois deploys puderam rodar ao mesmo tempo, porque não havia lock. Isso deixou processos de backup presos.
- A imagem Docker usa tag por commit. Se a tag não é passada, comandos isolados podem usar imagem antiga.
- Variáveis `NEXT_PUBLIC_*` do Next.js entram no build. Então tracking de Google Ads precisa estar disponível antes de buildar a imagem web.

## Como deve ser daqui para frente

O fluxo correto deve ser:

1. Abrir PR.
2. CI roda testes/build.
3. Fazer merge na `main`.
4. No GitHub, rodar o workflow **Deploy production**.
5. O workflow entra na VPS, atualiza o checkout limpo, faz backup, builda, roda migrations, sobe containers e valida endpoints.

Você não deveria precisar chamar Codex para SSH manual em deploy normal.

## O que foi automatizado

- `scripts/ops/deploy_compose.sh` agora:
  - impede deploy duplo com lock;
  - faz backup pelo Postgres do Docker Compose;
  - builda as imagens;
  - roda `alembic upgrade head`;
  - sobe containers com `--remove-orphans`;
  - valida `/health` da API e `/blog` do web.

- `.github/workflows/deploy-production.yml` permite deploy manual pelo GitHub Actions.

## Secrets necessários no GitHub

Em GitHub repo > Settings > Secrets and variables > Actions > Secrets:

- `VPS_HOST`: IP ou host da VPS.
- `VPS_PORT`: porta SSH, exemplo `2222`.
- `VPS_USER`: usuário SSH, exemplo `root`.
- `VPS_SSH_PRIVATE_KEY`: chave privada SSH que acessa a VPS.
- `PROD_APP_DIR`: diretório do app na VPS. Hoje: `/opt/sentimenta-main-deploy`.

Em Variables, opcional:

- `SITE_URL`: `https://sentimenta.com.br`.

## Como fazer deploy

1. Entre no GitHub.
2. Abra **Actions**.
3. Escolha **Deploy production**.
4. Clique **Run workflow**.
5. Aguarde terminar verde.

Se falhar, leia o log do workflow. O log deve mostrar em qual etapa falhou: backup, build, migration, subida dos containers ou validação.

## Rollback simples

Se um deploy quebrar produção:

1. Descubra o commit anterior bom.
2. Entre na VPS.
3. Rode:

```bash
cd /opt/sentimenta-main-deploy
git checkout <commit_bom>
SENTIMENTA_IMAGE_TAG=<commit_bom_curto> bash scripts/ops/deploy_compose.sh
```

Rollback com migration destrutiva exige mais cuidado. Nesse caso, restaurar backup pode ser necessário.

## Conversão correta no Google Ads

O sucesso principal da Sentimenta agora deve ser:

> Cadastro completo.

Isso significa: o usuário enviou o formulário de cadastro, a API criou a conta e o frontend recebeu sucesso. Não é clique no botão. Clique pode falhar; cadastro completo não.

## Como o tracking foi implementado

O frontend já tinha o evento interno `register_success`. Agora, quando o cadastro é concluído, ele também pode disparar uma conversão do Google Ads:

```ts
gtag("event", "conversion", {
  send_to: "AW-XXXXXXX/YYYYYYY"
});
```

O Google recomenda usar a Google tag em todas as páginas e um evento de conversão quando a ação real acontece. Referências:

- https://support.google.com/google-ads/answer/7548399
- https://developers.google.com/tag-platform/devguides/conversions

Hoje o Sentimenta só carrega analytics depois do aceite no banner de cookies. Então, para testar no Tag Assistant, aceite os cookies antes de criar a conta de teste.

## Variáveis para ativar Google Ads

Na `.env` da VPS:

```env
NEXT_PUBLIC_GOOGLE_TAG_ID=AW-123456789
NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL=AbCdEfGhIjK
```

Esses valores vêm do Google Ads:

- `NEXT_PUBLIC_GOOGLE_TAG_ID`: Conversion ID, começa com `AW-`.
- `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL`: Conversion label da ação de conversão.

Depois de preencher, precisa rodar deploy de novo, porque `NEXT_PUBLIC_*` entra no build do Next.js.

## Como configurar no Google Ads

1. Vá em **Metas > Resumo > Nova ação de conversão**.
2. Escolha **Site**.
3. Crie uma ação com nome: `Cadastro completo`.
4. Categoria: `Inscrição` ou `Lead`.
5. Marque como **Principal**.
6. Pegue o `Conversion ID` e `Conversion label`.
7. Coloque os valores na `.env` da VPS.
8. Rode **Deploy production** no GitHub.
9. Use o Tag Assistant para testar criando uma conta real de teste.

## O que fazer com a conversão antiga quebrada

A conversão automática de **Visualização de página** não deve ser principal.

No Google Ads:

- deixe `Cadastro completo` como principal;
- rebaixe `Visualização de página` para secundária ou remova;
- a campanha pode continuar em **Maximizar conversões**, mas só depois que o cadastro completo estiver validado.

## Regra prática

Para operação normal:

- mudança de código: PR + merge + Deploy production;
- mudança de texto do blog: painel admin, sem deploy;
- mudança de env: editar `.env` da VPS uma vez + Deploy production;
- problema em deploy: olhar Actions primeiro, SSH só em exceção.
