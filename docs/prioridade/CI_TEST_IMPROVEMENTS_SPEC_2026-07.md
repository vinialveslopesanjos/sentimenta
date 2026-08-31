# Spec: Melhorias no CI de testes — instruções executáveis

Data: 2026-07-07
Público: **uma IA (ou dev) sem contexto prévio do projeto** — siga literalmente.
Objetivo: fechar os 3 pontos cegos do CI encontrados na auditoria de 07/07:
(1) testes rodam em SQLite e não exercitam Postgres real (índices parciais, locks);
(2) migrações Alembic nunca rodam no CI;
(3) dependência vulnerável `ecdsa` só está silenciada, não removida.

## Regras gerais (leia antes de começar)

- Repo: `vinialveslopesanjos/sentimenta`. Criar branch a partir de `origin/main`:
  `git checkout -b ci/postgres-and-pyjwt origin/main`
- Uma tarefa = um commit. Abrir UM PR com as tarefas concluídas, base `main`.
- **PROIBIDO**: deletar/pular testes, adicionar `|| true`, `continue-on-error`,
  `-k` filtros no pytest, ou afrouxar o pip-audit além do ignore já existente.
- Validação local: backend tem venv de testes — criar um novo se preciso:
  `python -m venv .venv && .venv/Scripts/pip install -r backend/requirements.txt`
  Rodar: `cd backend && python -m pytest -q` (deve terminar `XX passed`, hoje 91).
- Arquivo do workflow: `.github/workflows/ci.yml`. Job alvo: `backend` (nome
  "Backend tests"). Fixtures de teste: `backend/tests/conftest.py`.

---

## Tarefa 1 — Migrações Alembic rodando no CI (menor esforço, maior ganho)

**Problema**: o schema de teste vem de `Base.metadata.create_all`; uma migração
quebrada (sintaxe, heads divergentes, coluna duplicada) só explode no deploy.

**O que fazer** em `.github/workflows/ci.yml`, no job `backend`:

1. Adicionar um service container Postgres 16 ao job:

```yaml
  backend:
    name: Backend tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: sentimenta_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U ci" --health-interval 5s
          --health-timeout 5s --health-retries 10
```

2. Adicionar um step DEPOIS de "Install Python dependencies" e ANTES de "Run tests":

```yaml
      - name: Alembic migrations (upgrade + downgrade sanity)
        env:
          DATABASE_URL: postgresql://ci:ci@localhost:5432/sentimenta_ci
          SECRET_KEY: ci-secret
          TOKEN_ENCRYPTION_KEY: ci-token-key
        run: |
          alembic upgrade head
          alembic downgrade -1
          alembic upgrade head
```

Nota: se `alembic upgrade head` falhar por variável de ambiente obrigatória
faltando, olhe `backend/app/core/config.py` (classe Settings) e adicione a
variável no bloco `env:` do step com um valor dummy `ci-...`. Não altere o
config.py para isso.

**Critério de aceite**: job verde com o novo step executando as 3 linhas; quebrar
uma migração de propósito localmente deve fazer o step falhar (não commitar isso).

## Tarefa 2 — pytest contra Postgres real

**Problema**: `backend/tests/conftest.py` fixa `os.environ["DATABASE_URL"] = "sqlite://"`
e cria engine SQLite. Com isso, o unique index parcial de `pipeline_runs`
(migração `b7c9d1e3f5a7`, só existe em Postgres) e o `SELECT ... FOR UPDATE` do
débito de créditos são no-ops nos testes.

**O que fazer** em `backend/tests/conftest.py`:

1. Trocar o hardcode por env com fallback (manter SQLite como default local):

```python
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
```

2. Criar o engine condicionalmente: se a URL começar com `sqlite`, manter
   exatamente o bloco atual (StaticPool, check_same_thread, compiles JSONB).
   Senão, `create_engine(TEST_DATABASE_URL)` simples.
3. No fixture `setup_db`, o `drop_all/create_all` continua igual (funciona nos dois).
4. No CI, alterar o step "Run tests" para apontar pro service container:

```yaml
      - name: Run tests
        env:
          TEST_DATABASE_URL: postgresql://ci:ci@localhost:5432/sentimenta_ci
        run: python -m pytest
```

5. Provável ajuste: instalar driver `psycopg2-binary` se não estiver em
   requirements.txt (verificar; se faltar, adicionar em requirements.txt).

**Critérios de aceite**:
- CI roda a suite inteira contra Postgres e passa.
- Localmente `python -m pytest` SEM a env continua passando em SQLite (rápido).
- Novo teste (adicionar em `backend/tests/test_credit_debits.py`): criar duas
  `PipelineRun` com `status="running"` e o MESMO `connection_id` deve levantar
  `IntegrityError` — marcar com
  `@pytest.mark.skipif(os.getenv("TEST_DATABASE_URL", "").startswith("postgresql") is False, reason="unique parcial só existe em Postgres")`.
  ATENÇÃO: para o índice existir, o `setup_db` do teste precisa do schema via
  Alembic OU criar o índice manualmente no teste com
  `CREATE UNIQUE INDEX ... WHERE status = 'running'` (mais simples: executar o
  SQL do índice no próprio teste antes do cenário).

## Tarefa 3 — Migrar python-jose → PyJWT (remove a CVE ignorada)

**Problema**: `pip-audit` ignora `PYSEC-2026-1325` (ecdsa, transitiva de
python-jose, sem fix upstream). A solução definitiva é trocar a lib de JWT.

**O que fazer**:
1. `backend/requirements.txt`: remover `python-jose[cryptography]>=3.3.0`,
   adicionar `PyJWT>=2.10`.
2. `backend/app/core/security.py` (único arquivo que importa jose):
   - `from jose import jwt, JWTError` → `import jwt` e usar
     `jwt.exceptions.InvalidTokenError` onde era `JWTError`.
   - `jwt.encode(...)` — mesma assinatura no PyJWT.
   - `jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])` —
     mesma assinatura. PyJWT valida `exp` por padrão (jose também) — manter.
   - Diferença importante: PyJWT retorna claims com tipos nativos; conferir se
     algum código depende de `sub` etc. Rodar a suite: `test_auth.py` cobre
     login/refresh/verify — ela é o critério.
3. Buscar outros usos: `grep -rn "from jose\|import jose" backend/` deve
   retornar vazio ao final.
4. `.github/workflows/ci.yml`: remover `--ignore-vuln PYSEC-2026-1325` e o
   comentário de justificativa do step "Python dependency audit".

**Critério de aceite**: suite completa verde + `pip-audit -r requirements.txt`
sem findings + login manual funciona no smoke pós-deploy (tokens antigos
continuam válidos porque o algoritmo HS256 e a SECRET_KEY não mudam).

## Tarefa 4 — Esclarecer/ativar o job "E2E smoke"

**Problema**: o check "E2E smoke" aparece como `skipping` em PRs — ninguém sabe
quando roda.

**O que fazer**:
1. Ler o job no(s) workflow(s) (`grep -n "E2E smoke" .github/workflows/*.yml`) e
   documentar no topo do job, em comentário YAML, QUANDO ele roda e por quê.
2. Se ele depende de secrets/ambiente que não existem, deixar isso explícito no
   comentário e reportar no PR (não tentar consertar secrets — é ação do dono).
3. NÃO fazer o job rodar em todo PR (é lento/caro); o alvo é rodar no
   `deploy-production.yml` após o deploy (ver
   `docs/prioridade/SMOKE_TEST_PLAYBOOK_2026-07.md` §Automação). Se conseguir
   fazer isso só com o que existe no repo, fazer; senão, documentar o que falta.

## Ordem recomendada e entrega

1 → 3 → 2 → 4 (a Tarefa 2 é a mais delicada; se travar nela, entregar o PR com
1+3 e reportar o bloqueio). No corpo do PR, incluir: o que foi feito por tarefa,
saída final do pytest local e link dos checks verdes.
