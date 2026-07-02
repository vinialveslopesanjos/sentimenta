# Local Real Data Workflow

Este documento define como evoluir frontend, UX e funcionalidades com dados reais,
sem escrever nada em producao e sem usar mocks quando a validacao precisar de
comportamento real.

## Objetivo

Rodar o Sentimenta na maquina local com:

- frontend local em `http://127.0.0.1:3000`;
- backend local em `http://127.0.0.1:8000`;
- banco PostgreSQL local restaurado a partir de snapshot da producao;
- `READ_ONLY_MODE=true` no backend local;
- zero deploy automatico para a VPS.

Fluxo:

```txt
VPS/producao -> snapshot pg_dump -> .local/snapshots -> Postgres local
Postgres local -> FastAPI local read-only -> Next.js local -> navegador
```

## Regras De Seguranca

1. Nunca testar melhoria de frontend apontando direto para o banco principal da VPS.
2. O caminho padrao e snapshot restaurado em Postgres local.
3. O backend local deve rodar com `READ_ONLY_MODE=true`.
4. Operacoes `POST`, `PATCH`, `PUT` e `DELETE` ficam bloqueadas, exceto login e refresh.
5. Apify, LLM, Stripe, email, OAuth externo e workers nao devem rodar nesse modo.
6. Arquivos `.env`, dumps, snapshots e bancos locais nunca entram no Git.
7. Deploy so acontece depois de branch revisada, checks passando e backup confirmado.

## Estrutura Local

```txt
.local/
  snapshots/
    sentimenta_prod_YYYY-MM-DD_HHMMSS.sql.gz

.env.realdata.local
.env.realdata.local.example

scripts/dev/
  pull-prod-snapshot.mjs
  restore-snapshot.mjs
  start-local-realdata.mjs
```

`.local/` e `.env.realdata.local` sao ignorados pelo Git.

## Setup Inicial

1. Instale PostgreSQL local ou rode um container local.
2. Crie um banco local para snapshots:

```bash
createdb sentimenta_realdata_local
```

3. Copie o arquivo de exemplo:

```bash
cp .env.realdata.local.example .env.realdata.local
```

4. Ajuste `DATABASE_URL` em `.env.realdata.local` para seu Postgres local.

## Gerar Snapshot Na VPS

O snapshot deve ser gerado por uma rotina operacional controlada na VPS, usando
o script existente:

```bash
BACKUP_DIR=/opt/sentimenta/snapshots bash scripts/ops/backup_postgres.sh
```

Preferencia: gerar o dump com usuario read-only ou em janela de manutencao leve.
Nao editar servicos, nao reiniciar producao, nao rodar migrations durante essa etapa.

## Baixar Snapshot Para Local

Depois que o arquivo existir na VPS:

```bash
I_UNDERSTAND_PROD_SNAPSHOT=1 \
SENTIMENTA_REMOTE_SNAPSHOT=user@host:/opt/sentimenta/snapshots/sentimenta_db_YYYY-MM-DD_HHMMSS.sql.gz \
npm run dev:snapshot:pull
```

O arquivo sera copiado para `.local/snapshots/`.

## Restaurar Snapshot Local

Restaurar sobrescreve o schema local quando `RESET_SCHEMA=1`.
O script se recusa a rodar contra host que nao seja `localhost`, `127.0.0.1`
ou `::1`, salvo override explicito para uma replica realmente read-only.

```bash
I_UNDERSTAND_LOCAL_RESTORE=1 \
RESET_SCHEMA=1 \
SNAPSHOT_FILE=.local/snapshots/sentimenta_db_YYYY-MM-DD_HHMMSS.sql.gz \
npm run dev:snapshot:restore
```

## Rodar Backend Local Com Dados Reais

```bash
npm run dev:realdata
```

Em outro terminal:

```bash
npm run dev:web
```

Validar:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:3000
```

## Login De Teste

Para dado real restaurado, o ideal e usar um modo de impersonacao local
controlado, por exemplo `DEV_IMPERSONATE_USER_EMAIL`, sem senha real de usuario.
Esse modo deve existir apenas com `DEBUG=true`, `READ_ONLY_MODE=true` e localhost.

Enquanto essa impersonacao nao existir, use apenas contas de teste ou snapshots
sanitizados com senha conhecida de desenvolvimento.

## Ciclo De Melhoria

1. Atualizar snapshot local quando precisar de dado real recente.
2. Criar branch local para a melhoria.
3. Rodar backend local read-only e frontend local.
4. Implementar a melhoria.
5. Auditar cliques no localhost, incluindo fluxo logado.
6. Rodar checks relevantes:

```bash
npm run build:packages
npm run type-check
npm run build:web
npm run test:e2e:smoke
```

7. Se mexer em backend:

```bash
cd backend
python -m pytest
```

8. Revisar diff e abrir PR ou preparar deploy.

## Promocao Para Producao

Nada sobe direto do experimento local. O caminho seguro e:

1. Branch limpa com escopo pequeno.
2. Checks locais passando ou limitacoes documentadas.
3. CI verde no GitHub.
4. Backup da VPS confirmado antes de deploy.
5. Deploy por script/runbook, nao por edicao manual em producao.
6. Verificacao pos-deploy:

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:3000/health
docker compose -f compose.prod.yml ps
```

7. Se algo quebrar, rollback para o commit anterior e restaurar backup apenas se
   uma migration tiver alterado dados.

## Checklist Antes De Deploy

- [ ] Diff revisado.
- [ ] Nenhum segredo ou snapshot no Git.
- [ ] `READ_ONLY_MODE` nao esta habilitado por engano em producao.
- [ ] Nao existem chamadas reais indesejadas a Apify, LLM, Stripe ou OAuth em teste.
- [ ] Build web passou.
- [ ] Type-check passou.
- [ ] Teste logado passou no localhost com snapshot.
- [ ] Backup de producao existe e foi validado.
- [ ] Plano de rollback esta claro.

## O Que Ainda Falta Implementar

- Endpoint ou fluxo de impersonacao local para entrar como um usuario do snapshot
  sem saber senha real.
- Snapshot sanitizado opcional para remover PII que nao seja necessaria no teste.
- Teste automatizado garantindo que `READ_ONLY_MODE=true` bloqueia rotas de escrita.
