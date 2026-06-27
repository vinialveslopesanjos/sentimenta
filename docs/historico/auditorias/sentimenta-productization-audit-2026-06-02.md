# Sentimenta - Auditoria de Produtização

Data: 2026-06-02  
Escopo: repo local, VPS Hostinger, Nginx, Supervisor, PostgreSQL, Redis, Celery, frontend, backend, dependências, onboarding e QA ponta a ponta.  
Branch de trabalho: `codex/productization-audit-hardening`

## Veredito executivo

O Sentimenta está funcional e tem base técnica real de SaaS, mas ainda não está pronto para receber clientes em escala aberta nem para ser apresentado como operação madura sem uma rodada de hardening final. Depois desta intervenção, a superfície pública ficou melhor: firewall ativo, headers HTTP fortes, token do remote Git removido, permissões de backup corrigidas, CI criado, vulnerabilidade crítica de produção removida e problemas relevantes de UX/backend foram corrigidos no branch local.

Mesmo assim, existem pendências que eu considero bloqueadoras para investimento/produtização: rotação de segredos, correção do LLM em produção, correção da verificação/conexão de Instagram, deploy limpo a partir de branch protegida, execução da aplicação sem `root`, endurecimento final do PostgreSQL e backup offsite com teste de restore.

Minha recomendação: liberar somente beta controlado depois de corrigir os P0 abaixo. Para cliente pagante amplo, ainda não.

## Scorecard

| Área | Estado atual | Nota | Diagnóstico |
|---|---:|---:|---|
| Segurança de segredos | Pendente | 3/10 | `.env` de produção contém segredos reais; devem ser rotacionados. |
| Rede e VPS | Parcial | 6/10 | UFW e headers corrigidos; PostgreSQL ainda escuta em `0.0.0.0:5432`. |
| Git e deploy | Parcial | 5/10 | Branch local limpa para hardening; produção está em outro branch e worktree sujo. |
| Backend/pipeline | Parcial | 6/10 | Run tracking e deleção LGPD corrigidos localmente; LLM 404 em produção bloqueia análise real. |
| Banco e backups | Parcial | 6/10 | Backups diários existem e permissões foram corrigidas; falta offsite e teste de restore. |
| Dependências/CI | Bom com ressalvas | 8/10 | Crítico removido; CI criado; restam advisories moderados. |
| UX/onboarding | Parcial | 6/10 | Cadastro/onboarding funcionam; Instagram falha; empty state/logs melhorados localmente. |
| Observabilidade | Parcial | 6/10 | Logs de pipeline existem; falta alerta operacional e reconciliação de erros/LLM. |

## P0 e P1

| ID | Severidade | Item | Status | Evidência |
|---|---|---|---|---|
| P0-01 | Crítica | Rotacionar segredos reais de produção | Pendente | Chaves reais estavam no `.env` da VPS. Valores não foram reproduzidos neste relatório. |
| P0-02 | Crítica | Remover GitHub token do remote da produção | Corrigido na VPS | `git remote get-url origin` agora é `https://github.com/vinialveslopesanjos/sentimenta.git`. |
| P0-03 | Crítica | Fechar exposição pública do PostgreSQL | Parcial | UFW bloqueia público e permite `5432` apenas de `100.64.0.0/10`; Postgres ainda escuta em `0.0.0.0` e `[::]`. |
| P0-04 | Crítica | Corrigir LLM/OpenRouter em produção | Pendente | QA real terminou `partial` com 10 erros de análise e worker indicou 404 em LLM. |
| P0-05 | Crítica | Corrigir conexão/verificação de Instagram | Pendente | Perfis públicos conhecidos falharam como "Perfil não encontrado ou é privado". |
| P0-06 | Crítica | Deploy limpo e branch protegida | Pendente | VPS está em `feat/security-fixes`, worktree com 23 linhas de alterações locais. |
| P0-07 | Alta | Aplicação rodando como usuário não-root | Pendente | Serviços do Sentimenta ainda rodam como root/supervisor atual. |
| P1-01 | Alta | Headers HTTP e remoção de `X-Powered-By` | Corrigido | `sentimenta.com.br` responde com HSTS, CSP Report-Only, frame deny e sem `X-Powered-By`. |
| P1-02 | Alta | Vulnerabilidades de produção | Corrigido/Parcial | `npm audit --omit=dev --audit-level=high` passou; restam 4 moderadas. |
| P1-03 | Alta | Deleção de conta quebra com créditos/usage | Corrigido local | Backend agora remove `CreditTransaction`, `CreditBalance` e `UsageLog` antes do usuário; testes adicionados. |
| P1-04 | Alta | Sync/análise retorna task errada para logs | Corrigido local | Analyze cria `PipelineRun`, retorna `run_id` e persiste `celery_task_id`; teste adicionado. |
| P1-05 | Média | Logs parciais parecem sucesso | Corrigido local | Pipeline agora escreve "concluído com erros" e não gera diagnóstico sem comentários analisados. |
| P1-06 | Média | Conta nova parece "reputação crítica" sem dados | Corrigido local | Dashboard agora usa estado neutro "Sem dados ainda". |
| P1-07 | Média | Sync mínimo não disponível na UI | Corrigido local | UI agora oferece 1 post e 10 comentários para teste. |
| P1-08 | Média | Backups com permissões e retenção | Parcial | Diretório `700`, dumps `600`; falta offsite, monitoramento e teste de restore. |

## O que foi corrigido

### VPS e infraestrutura

- UFW ativado com política de entrada bloqueada.
- Portas públicas preservadas apenas onde necessário: `22`, `2222`, `80`, `443`, `3081`, `8080`, `18080`; `5432` permitido somente para `100.64.0.0/10`.
- Regras públicas antigas para `5432/tcp` e `3005/tcp` removidas.
- Token GitHub embutido no remote da produção removido.
- Headers Nginx adicionados nos blocos HTTPS: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP em Report-Only e ocultação de `X-Powered-By`.
- Permissões de backup corrigidas: `/opt/sentimenta/backups` em `700`, dumps em `600`.

### Backend

- `/connections/{id}/sync` e `/connections/{id}/analyze` passam a trabalhar com `PipelineRun` real.
- Analyze retorna `run_id` rastreável e salva `celery_task_id`, o que melhora logs e polling.
- Filtro de run ativo corrigido para comparar UUID corretamente.
- Rate limiter global limpo entre testes para remover vazamento de estado.
- Deleção LGPD de conta corrigida para remover crédito/usage antes do usuário.
- Logs de pipeline parcial ajustados para não vender erro como sucesso.
- Diagnóstico automático não é gerado quando nenhum comentário foi analisado.

### Frontend/UX

- `next.config.js` agora desativa `X-Powered-By` e define headers de segurança.
- Next atualizado para 15.5.19; Recharts atualizado no web.
- Removido `posthog-js`, que puxava a cadeia crítica de `protobufjs`.
- Erros de API com `detail` objeto/lista agora são normalizados; acabou o risco de `[object Object]` para usuário.
- Dashboard com zero comentários analisados agora fica neutro, não crítico.
- Tela de conexão permite sync mínimo: `1 post` e `10 comentários`.
- Compatibilidade Next 15 ajustada em `cookies()`.

### CI e testes

- Criado `.github/workflows/ci.yml` com jobs para web e backend.
- Adicionado `npm run audit:prod`.
- Testes novos para `run_id` do analyze e deleção de conta com créditos/usage.
- `pytest.ini` ajustado para evitar cache problemático em ambiente local.

## Evidências de validação

### Local

| Comando | Resultado |
|---|---|
| `npm run type-check` | Passou |
| `npm run build:web` | Passou com Next 15.5.19; aviso de lockfile duplicado |
| `npm run build --workspace=@sentimenta/mobile` | Passou; aviso de chunk JS com 913.62 kB |
| `npm run audit:prod` | Passou para nível high/critical; restam 4 moderadas |
| `python -m pytest -q` no backend | 46 testes passaram; 1 warning Pydantic |

### Produção/VPS

| Checagem | Resultado |
|---|---|
| `nginx -t` | Configuração válida |
| `api.sentimenta.com.br/health` | `{"status":"ok"}` |
| Serviços | `nginx`, `postgresql`, `redis-server`, `ufw`, `fail2ban`, `unattended-upgrades` ativos |
| Supervisor | `sentimenta-api`, `sentimenta-web`, `sentimenta-celery`, `sentimenta-beat`, `sentimenta-panel` rodando |
| Headers HTTPS | HSTS, CSP Report-Only, frame deny, referrer e permissions policy presentes |
| Remote Git produção | Sem token embutido |
| Firewall | UFW ativo; PostgreSQL não deve ficar público fora da rede permitida |
| Backups | Arquivos diários locais existem; permissões restritas aplicadas |

## QA ponta a ponta

Fluxo testado com conta descartável em produção:

1. Cadastro de usuário novo.
2. Verificação de email por token no banco.
3. Onboarding inicial.
4. Tentativa de conexão Instagram.
5. Conexão YouTube como alternativa.
6. Sync mínimo via API.
7. Acompanhamento da execução em logs.
8. Limpeza da conta descartável e dados relacionados.

Resultado:

- Cadastro, login, verificação de email e onboarding funcionam.
- A experiência de conta nova era confusa porque o dashboard mostrava reputação crítica sem dados; corrigido localmente.
- Instagram público falhou para perfis conhecidos; isso bloqueia o principal fluxo comercial pedido.
- YouTube conectou e permitiu iniciar sync.
- A tela de logs mostra progresso, contadores, custo, duração e detalhes de etapas.
- A execução terminou `partial`: comentários foram coletados, mas a análise LLM teve erros. Isso precisa ser P0.
- A limpeza manual/por API confirmou que a conta descartável foi removida; a correção local elimina o 500 observado na deleção com créditos/usage.

## Resposta direta às perguntas do objetivo

### Está profissional e organizado suficiente?

Parcialmente. A base é promissora, mas a operação de produção ainda parece artesanal: app como root, branch de produção não consolidado, worktree sujo, segredos em `.env`, banco ainda escutando em todas as interfaces e deploy sem trilha limpa. Para investimento, isso precisa ser corrigido antes de diligence técnica.

### Está pronto para novos clientes e escalar?

Não para escala aberta. Está perto de beta controlado, desde que LLM e Instagram sejam corrigidos primeiro. O risco não é só performance; é confiabilidade do fluxo central.

### Segurança pronta para escalar?

Ainda não. O firewall e headers melhoraram muito, mas segredos expostos, Postgres escutando publicamente por configuração, serviço como root e falta de rotação/documentação de recovery ainda impedem afirmar maturidade.

### Uma pessoa nova consegue criar conta e rodar?

Quase. Cadastro, verificação e onboarding funcionam, mas o principal fluxo de Instagram falhou no QA. A pessoa também precisava de mais clareza de "comece pequeno" e "acompanhe em logs"; isso foi melhorado localmente.

### Ela entende tempo, logs e processamento?

A página de logs é uma boa base e mostrou progresso real. Faltava permitir sync pequeno pela UI e corrigir mensagens contraditórias em execução parcial; ambos foram corrigidos localmente. Ainda falta deploy.

## Pendências urgentes para produtização

1. Rotacionar todos os segredos de produção: LLM/OpenRouter/Gemini, Apify, Stripe live, Resend, Supabase, OAuth, DB/Redis e qualquer token GitHub já exposto.
2. Corrigir LLM em produção e rodar QA com análise 100% concluída.
3. Corrigir verificação/conexão Instagram para perfis públicos.
4. Fazer deploy limpo deste branch depois de reconciliar o worktree sujo da VPS.
5. Criar usuário de serviço (`sentimenta`), mover Supervisor/systemd para não rodar app como root.
6. Ajustar PostgreSQL `listen_addresses` e `pg_hba.conf`; UFW ajuda, mas não substitui configuração correta.
7. Criar backup offsite, política de retenção e teste de restore documentado.
8. Resolver DNS de `app.sentimenta.com.br` ou remover da matriz se não for usado.
9. Remover lockfile duplicado ou configurar `outputFileTracingRoot` para silenciar o aviso do Next.
10. Adicionar alerta operacional para runs `partial/failed`, erro LLM, queda Celery e backup ausente.

## Plano recomendado de 7 dias

### Dia 1

- Rotacionar segredos e revogar token GitHub antigo.
- Corrigir variáveis/modelo LLM em produção.
- Reexecutar QA mínimo com 1 post/10 comentários e exigir status `completed`.

### Dia 2

- Corrigir Instagram public profile/OAuth.
- Criar teste de integração para `check-profile` e sync Instagram com mock controlado.

### Dia 3

- Reconciliar `/opt/sentimenta`, fazer deploy limpo do branch de hardening.
- Proteger `main`/branch de produção com CI obrigatório.

### Dia 4

- Migrar execução para usuário de serviço.
- Apertar PostgreSQL `listen_addresses` e `pg_hba.conf`.

### Dia 5

- Backups offsite + restore drill documentado.
- Alertas de Celery, Nginx, Postgres, disk, backup e pipeline partial/failed.

### Dia 6

- QA completo com usuário externo: cadastro, email, onboarding, Instagram, sync, logs, dashboard, billing/credits, deleção.

### Dia 7

- Revisão final de security posture, runbook de incidentes, checklist de investidor e beta com 3 a 5 clientes controlados.

## Conclusão

O produto tem substância: fluxo SaaS, dashboard, billing/créditos, pipeline, logs e infraestrutura rodando. O que impede produtização não é falta de produto, é maturidade operacional e confiabilidade do caminho principal. A boa notícia é que os problemas são concretos e atacáveis. Depois de rotação de segredos, correção de LLM/Instagram e deploy limpo com usuário não-root, o Sentimenta pode entrar em beta controlado com muito mais segurança.
