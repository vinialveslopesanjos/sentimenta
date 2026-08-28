# Conta-semente e fixtures locais de QA

Este ambiente reproduz os oito estados que bloqueiam a Fase 1 sem usar conta
real, PII, PostgreSQL, Redis ou qualquer fornecedor externo. Ele existe para
desenvolvimento e QA local; não deve ser apontado para produção.

## Contrato de segurança

- O reset aceita somente um arquivo SQLite dentro de
  `artifacts/product-audit-2026-08-26/qa/`.
- O reset remove e recria apenas o arquivo explicitamente validado nessa pasta.
- O servidor fixa `127.0.0.1`, ativa `READ_ONLY_MODE=true` e permite como escrita
  somente login/refresh, conforme o middleware existente.
- `QA_LOCAL_MODE=true` eleva o limite de login somente quando o processo também
  está em debug e somente leitura, permitindo percorrer as oito contas sem
  relaxar o limite normal do produto.
- Credenciais de Apify, LLM, Stripe, Google, Instagram, TikTok, YouTube, Resend,
  PostHog e Sentry são removidas antes da importação da aplicação.
- Os e-mails usam `example.com`, domínio reservado para exemplos e aceito pelo
  mesmo `EmailStr` usado no login real. Nenhum envio de e-mail é realizado.
- A senha abaixo é uma credencial pública de fixture, nunca um segredo:
  `QaSeed123!`.

## Reset e verificação

Na raiz do repositório:

```powershell
.\.venv\Scripts\python.exe scripts\dev\qa_seed.py --anchor now
.\.venv\Scripts\python.exe scripts\dev\qa_seed.py --anchor now --verify-only
```

Para gerar apenas cenários específicos:

```powershell
.\.venv\Scripts\python.exe scripts\dev\qa_seed.py `
  --scenario healthy_recent `
  --scenario partial_run
```

O anchor padrão é `2026-08-26T12:00:00+00:00`. Use `--anchor now` para QA de
produto em tempo real, pois saúde, frescor e a janela operacional de 24 horas
dependem do relógio atual. Testes comparativos e reprodução de evidências devem
usar um timestamp ISO fixo e repetir exatamente o mesmo valor.

Determinismo aqui significa:

- mesmos UUIDs, timestamps, conteúdo, snapshots, contagens e manifesto para a
  mesma seleção e anchor;
- verificação do hash imutável de cada snapshot e dos contratos de saúde,
  linguagem, próxima ação e login;
- reconstrução limpa a cada reset.

Os bytes brutos do arquivo SQLite não fazem parte do contrato, pois metadados
internos do banco podem variar sem alterar seu estado lógico.

## Subir o produto local isolado

Primeiro faça o reset. Depois:

```powershell
.\.venv\Scripts\python.exe scripts\dev\qa_server.py --port 8000
```

Com o frontend local em `http://127.0.0.1:3000`, entre pela tela `/login` com
uma das contas abaixo e a senha pública de fixture. Pare o servidor antes de
resetar o mesmo arquivo no Windows.

## Cenários disponíveis

| Cenário | Conta | Saúde | Linguagem | Próxima ação | Válidos/salvos |
|---|---|---|---|---|---:|
| Saudável recente | `qa.healthy_recent@example.com` | `healthy` | `current` | `keep_monitoring` | 24/24 |
| Snapshot stale há 49 dias | `qa.stale_snapshot@example.com` | `stale` | `historical` | `sync_now` | 24/24 |
| Falha com histórico | `qa.failed_with_history@example.com` | `degraded` | `historical` | `retry_sync` | 24/24 |
| Execução parcial | `qa.partial_run@example.com` | `degraded` | `historical` | `review_partial_run` | 12/24 |
| Zero análises válidas | `qa.zero_valid_analyses@example.com` | `failed` | `unavailable` | `retry_sync` | 0/53 |
| Sem dados na janela de alertas | `qa.no_alert_window_data@example.com` | `healthy` | `unavailable` | `run_analysis` | 0/0 |
| Nunca sincronizado | `qa.never_synced@example.com` | `never_synced` | `unavailable` | `start_first_sync` | 0/0 |
| Recuperado após falha | `qa.recovered_after_failure@example.com` | `healthy` | `current` | `keep_monitoring` | 24/24 |

O manifesto gerado em
`artifacts/product-audit-2026-08-26/qa/sentimenta-qa.manifest.json` é a fonte
serializável para automação. O SQLite e o manifesto gerados são artefatos locais
ignorados pelo Git; os scripts e este runbook são versionados.

## Testes de regressão

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests\test_qa_seed.py -q
cd ..
npx playwright test e2e/product/qa-seed-account.spec.ts --project=chromium
```

O teste backend executa dois resets, compara os manifestos, valida os oito
estados e prova que um caminho fora da pasta dedicada é recusado. O teste de
produto entra pela interface em três cenários representativos e verifica o
snapshot congelado exibido no Dashboard sem interceptar a API.
