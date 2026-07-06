# Sentimenta

Sentimenta e uma plataforma SaaS para leitura de reputacao digital. Ela conecta perfis sociais, coleta comentarios, roda analise de sentimento/emocao com LLM e apresenta sinais acionaveis em um dashboard em tempo real.

O foco do produto e transformar conversa publica em decisao: detectar mudancas de tom, entender temas recorrentes, acompanhar risco reputacional e permitir que criadores, figuras publicas e equipes de marca reajam antes que um sinal vire crise.

## Status

O projeto esta em fase de hardening para producao/beta controlado.

Ja existe base funcional de produto:

- API FastAPI com autenticacao JWT, Google OAuth e rate limiting.
- Pipeline assíncrono com Celery + Redis para ingestao e analise.
- Persistencia em PostgreSQL via SQLAlchemy/Alembic.
- Dashboard Next.js com KPIs, tendencias, alertas, comentarios e detalhe por perfil.
- SSE para acompanhar progresso de pipeline em tempo real.
- Planos e limites operacionais por usuario.
- CI no GitHub Actions para type-check, build, audit de dependencias e testes backend.

Este branch concentra correcoes de produtizacao e estabilidade: tracking confiavel de `PipelineRun`, delecao LGPD mais completa, UX neutra para contas sem dados, headers de seguranca no frontend, atualizacao de dependencias criticas e cobertura de testes para os fluxos corrigidos.

## Monorepo

```text
sentimenta/
├── backend/              # FastAPI, SQLAlchemy, Celery, Redis, Alembic
├── frontend/             # Web app Next.js 15, React 18, TypeScript
├── apps/mobile/          # Mobile/PWA Vite React
├── packages/types/       # Tipos TypeScript compartilhados
├── packages/api-client/  # Cliente HTTP compartilhado
├── scripts/              # Scripts operacionais e utilitarios
├── docs/                 # Documentacao tecnica e produto
├── .github/workflows/    # CI
└── package.json          # npm workspaces
```

## Stack

| Area | Tecnologia |
| --- | --- |
| Web | Next.js 15, React 18, TypeScript, TailwindCSS, Recharts 3 |
| Mobile/PWA | Vite, React 18, React Router 7 |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Jobs | Celery + Redis |
| Banco | PostgreSQL 16 |
| IA | Gemini para analise de sentimento, emocao, topicos e sarcasmo |
| Auth | JWT, refresh token, Google OAuth |
| Monorepo | npm workspaces, Turborepo |
| Infra | VPS Ubuntu, Nginx, Supervisor |

## Fluxo de Analise

```text
Usuario dispara sync/analyze
        |
        v
Backend cria PipelineRun rastreavel
        |
        v
Celery executa ingestao e/ou analise
        |
        v
Comentarios sao normalizados e analisados em lote
        |
        v
Resultados sao salvos em comment_analysis e agregados por post/perfil
        |
        v
Frontend acompanha progresso por SSE e atualiza dashboard
```

O endpoint de sync/analyze retorna `run_id`, que tambem e usado pelo frontend para consultar status e abrir stream SSE em `/api/v1/pipeline/runs/{run_id}/stream`.

## Hardening Recente

### Backend

- `analyze` agora cria um `PipelineRun` real antes de enfileirar o job.
- `task_analyze_connection` aceita `run_id` para evitar runs duplicados.
- Filtro de execucao ativa compara UUID corretamente.
- Logs finais distinguem sucesso total de conclusao parcial com erros.
- Diagnostico automatico nao e gerado quando nenhum comentario foi analisado.
- Delecao de conta remove tambem creditos, transacoes e usage logs.
- Testes cobrem `run_id` do analyze e delecao LGPD com registros financeiros/uso.

### Frontend

- Next atualizado para 15.5.x.
- Recharts atualizado para 3.x no web.
- Dashboard mostra estado neutro quando ainda nao ha comentarios analisados.
- Tela de conexao permite sync minimo de teste: 1 post e 10 comentarios.
- Erros de API com `detail` estruturado sao convertidos em mensagens legiveis.
- `posthog-js` segue fora do frontend para reduzir superficie de dependencia vulneravel.
- Views, cliques e eventos de funil web sao enviados por uma rota first-party
  (`/api/v1/analytics/web`) para o PostHog server-side, inclusive sem cookie.
- Tracking de terceiros usa Microsoft Clarity e Google Tag somente quando houver consentimento.
- CSP agora e aplicada pelo `middleware.ts` com nonce por request em producao.
- Tokens do web e da PWA passam a usar cookies HttpOnly com fallback legado em memoria/localStorage antigo.

### CI e Dependencias

- Workflow CI roda em PRs e pushes relevantes.
- Web: `npm ci`, `npm run build:packages`, `npm run type-check`, `npm run build:web`, `npm run audit:prod`.
- Backend: instala `backend/requirements.txt`, roda `python -m pytest` e `pip-audit`.
- Security job: Gitleaks, Trivy high/critical e SBOM CycloneDX.
- Dependabot semanal para npm, pip e GitHub Actions.
- `react-router` do mobile foi atualizado para remover advisory high de producao.
- `output/` e tratado como artefato local/gerado e nao deve ser versionado.

## Seguranca

O frontend define headers estaticos de seguranca no `next.config.js`:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

A CSP dinamica fica no `frontend/middleware.ts`: em producao usa `Content-Security-Policy` com `script-src` baseado em nonce; em desenvolvimento fica em `Content-Security-Policy-Report-Only` e permite `unsafe-eval` apenas para tooling local. `style-src` ainda permite `unsafe-inline` porque o frontend atual usa muitos estilos inline.

## Como Rodar Localmente

### Pre-requisitos

- Node.js 22 recomendado para alinhar com o CI.
- Python 3.12.
- PostgreSQL 16.
- Redis.

### Variaveis

```bash
cp .env.example .env
```

Preencha pelo menos:

- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `GEMINI_API_KEY`
- tokens das fontes sociais usadas no ambiente

### Instalar dependencias

```bash
npm install

cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Rodar em desenvolvimento

Terminal 1:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

Terminal 3:

```bash
npm run dev:web
```

Web: `http://localhost:3000`

API docs: `http://localhost:8000/docs`

## Validacao Local

Use estes comandos antes de abrir PR:

```bash
npm run build:packages
npm run type-check
npm run build:web
npm run build --workspace=@sentimenta/mobile --if-present
npm run audit:prod
```

Backend:

```bash
cd backend
python -m pytest
```

Resultado esperado no escopo atual:

- Pacotes compartilhados buildam com `npm run build:packages`.
- TypeScript passa em todos os workspaces com `type-check`.
- Build web Next.js passa.
- Build mobile passa, podendo avisar sobre chunk grande.
- Audit de producao passa para nivel high; advisories moderados podem permanecer em dependencias upstream.
- Testes backend passam no diretorio `backend`.

## Deploy

O deploy atual parte da raiz do monorepo:

```bash
npm install
npm run build:packages
cd frontend && npm run build
cd ..
npm run build --workspace=@sentimenta/mobile
```

Na VPS, os processos principais sao:

| Processo | Funcao |
| --- | --- |
| `sentimenta-api` | API FastAPI/Uvicorn |
| `sentimenta-celery` | Worker Celery |
| `sentimenta-web` | Next.js em modo production |
| `nginx` | Proxy reverso HTTPS |
| `postgresql` | Banco de dados |
| `redis` | Broker/cache |

Comandos uteis:

```bash
supervisorctl status
supervisorctl restart sentimenta-api
supervisorctl restart sentimenta-celery
supervisorctl restart sentimenta-web
tail -f /var/log/sentimenta-api.log
tail -f /var/log/sentimenta-celery-error.log
```

## PRs e Escopo

Para manter `main` revisavel, separe os tipos de mudanca:

- PR de produto/producao: backend, frontend, CI, dependencias e README.
- PR de documentacao: auditorias, materiais de produto e guias.
- PR de marketing/criativo: Remotion, carrosseis, imagens e scripts de renderizacao.

Nao versionar `output/`, caches de navegador, videos renderizados ou artefatos temporarios.

## Pendencias Conhecidas

- Reduzir estilos inline para remover `unsafe-inline` de `style-src`.
- Revisar advisory moderado de `next/postcss` quando houver caminho de upgrade sem downgrade/breaking change.
- Reparar ambientes locais antigos de `.venv` quando apontarem para caminhos de outro usuario/maquina.
