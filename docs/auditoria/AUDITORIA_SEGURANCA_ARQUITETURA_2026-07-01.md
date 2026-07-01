# Auditoria de seguranca e arquitetura - Sentimenta

Data: 2026-07-01
Escopo: repositorio local `D:\vscode\github_repositories\sentimenta`, artefatos de deploy, documentacao, dependencias, Docker Compose, CI/CD e leitura operacional da VPS autorizada pelo usuario.
Limites: nao houve exploracao ofensiva, acesso a dados de negocio, dump de banco, chamadas reais a provedores externos ou alteracao em producao.

Nota de atualizacao: varios achados deste relatorio foram tratados no hardening de 2026-07-01. Consulte `docs/auditoria/HARDENING_IMPLEMENTADO_2026-07-01.md` e `docs/arquitetura/HARDENING_IMPLEMENTADO_2026-07-01.html` para o estado pos-correcao.

## Panorama executivo

O Sentimenta tem uma base tecnica coerente para um SaaS de reputacao digital: backend FastAPI, frontend Next.js, PWA Vite, PostgreSQL, Redis, Celery worker/beat, integracoes com Stripe, Resend, Google OAuth, Instagram, TikTok, YouTube, Apify e LLM via OpenRouter/Gemini. A arquitetura principal esta bem alinhada ao dominio de ingestao, analise assincrona e dashboards.

Os fundamentos de seguranca tambem existem: autenticacao JWT com refresh, blacklist em Redis, versao de token por usuario, verificacao de email, rate limit em endpoints criticos de auth, criptografia de tokens sociais com Fernet, assinatura de webhook Stripe, containers nao-root, CORS restrito, API/web expostos apenas via localhost no Compose e Nginx na borda.

O risco atual esta menos em um bug isolado e mais em maturidade operacional e governanca: VPS unica e compartilhada com outros projetos, workers sem healthcheck, CSP ainda em modo Report-Only com `unsafe-inline`/`unsafe-eval`, tokens no `localStorage`, privilegio admin atrelado a emails hardcoded, observabilidade incompleta para pipeline assincrono, ausencia de limites fortes de recursos/container hardening e falta de evidencias de restore drill/HA.

## Scores

| Area | Score | Leitura |
|---|---:|---|
| Seguranca | 6.8/10 | Bons controles basicos e varios pontos sensiveis tratados, mas ainda ha riscos relevantes em XSS/token storage, admin governance, hardening operacional, supply chain e observabilidade de falhas. |
| Arquitetura | 7.1/10 | Stack e separacao de responsabilidades sao adequadas ao produto. A nota cai por deploy single-host compartilhado, dependencia forte de Redis unico, workers sem saude declarativa, pouca IaC/HA e documentacao com sinais de drift. |
| Prontidao operacional | 5.9/10 | A aplicacao esta de pe e saudavel no basico, mas falta maturidade de SRE: alertas, metricas de fila, healthchecks de worker/beat, limites de recurso, restore drill e isolamento de workloads. |

## Tabela de achados, do critico ao leve

| Sev. | Achado | Evidencia observada | Impacto | Recomendacao |
|---|---|---|---|---|
| Critico | Nenhuma vulnerabilidade critica confirmada nesta auditoria | Nao foi encontrado P0 validado como auth bypass, RCE, segredo impresso, banco publico ou webhook sem assinatura | Sem acao emergencial confirmada | Manter validacao com scan formal, SAST/DAST, secret scanning e pentest antes de aumentar exposicao comercial |
| Alta | VPS unica e compartilhada com outros stacks | VPS roda `sentimenta`, `agent`, `chatwoot`, `evolution`, `nutri_evolution`; memoria com swap quase cheio; Sentimenta em `/opt/sentimenta-main-deploy` | Contencao fraca de recursos, maior blast radius se outro projeto falhar/for comprometido, risco de indisponibilidade do SaaS | Isolar Sentimenta em VPS dedicada ou cluster; aplicar limites de CPU/memoria por container; separar rede; monitorar swap; definir plano de migracao para ambiente gerenciado |
| Alta | Worker e beat sem healthcheck operacional | Containers `sentimenta-worker-1` e `sentimenta-beat-1` aparecem running, mas sem health status; Compose nao define healthcheck para eles | Pipeline pode parar ou degradar silenciosamente, afetando a promessa de dados reais e rastreaveis | Adicionar healthchecks Celery/beat, metricas de fila, idade do ultimo job, alertas para fila crescente e tarefas sem heartbeat |
| Alta | CSP nao esta em modo enforcement e permite flexibilidades perigosas | `frontend/next.config.js` define CSP Report-Only e inclui `unsafe-inline`/`unsafe-eval` | XSS fica menos mitigado; combinado com tokens em `localStorage`, aumenta impacto de injecao | Migrar CSP para enforcement por fases; remover `unsafe-eval` em producao; adotar nonce/hash para scripts; manter report endpoint |
| Alta | Tokens de sessao persistem em `localStorage` | Web/PWA armazenam access/refresh tokens em `localStorage` | XSS pode roubar refresh token e manter sessao; impacto maior para contas admin/enterprise | Preferir cookies `HttpOnly`, `Secure`, `SameSite`; se mantiver bearer token, reduzir TTL, usar refresh rotation, device binding e CSP forte |
| Alta | Privilegio admin definido por emails hardcoded no codigo | `backend/app/services/auth_service.py` contem lista `ADMIN_EMAILS`; admin representado como plano/privilegio | Governanca fraca, dificil auditar concessao/revogacao, risco se email/admin flow for abusado | Separar RBAC de plano comercial; mover admins para tabela/seed controlado; exigir 2FA para admin; auditar mudancas de papel |
| Media-alta | Observabilidade assincrona parcial | Sentry/config existe no codigo, mas nao foi validado ativo em runtime; nao foram encontrados dashboards/alertas de Celery, Redis, creditos, webhooks ou pipeline | Falhas de ingestao/LLM podem virar dado ausente ou atrasado sem alerta rapido | Criar SLIs: sucesso/falha de pipeline, latencia por provider, fila Celery, dead tasks, credit burn, webhook failures, erros por tenant |
| Media-alta | Hardening de containers e host incompleto | `compose.prod.yml` usa containers nao-root e binds locais, mas nao ha `read_only`, `cap_drop`, `security_opt`, limites de recurso ou politica de restart/health em todos | Aumenta impacto de comprometimento de app e risco de exaustao de recursos | Aplicar baseline Docker CIS/OWASP: `cap_drop: [ALL]`, `no-new-privileges`, FS read-only quando possivel, limites de memoria/CPU, redes segregadas |
| Media | Supply chain JS com vulnerabilidades moderadas | `npm audit:prod` retornou 4 moderadas, incluindo cadeia envolvendo Next/PostCSS e `next-auth`/`uuid` | Risco depende de explorabilidade e uso real, mas deve ser reduzido em SaaS publico | Atualizar Next/deps; remover `next-auth` se nao usado; adicionar Dependabot/Renovate com politica de SLA |
| Media | Auditoria de dependencias Python nao validada | Ambiente local nao permitiu executar toda a suite; nao ha evidencia de `pip-audit`/Safety no CI | Vulnerabilidades em libs backend podem passar despercebidas | Adicionar `pip-audit` ou equivalente no CI; pinning/lock de deps; revisar base images periodicamente |
| Media | Endpoint publico de leads com anti-spam fraco | `backend/app/routers/leads.py` usa honeypot, mas nao ha evidencia de rate limit robusto | Spam, abuso de email/DB e ruido comercial | Adicionar rate limit por IP/email, captcha adaptativo, validacao de dominio e alertas de volume |
| Media | Proxy/cache de thumbnails publico pode consumir banda/disco | Endpoint `/posts/thumbnail` e servico de cache validam SSRF e tipo de imagem, mas seguem publico e aceitam URLs permitidas | Abuso de trafego/disco contra hosts allowlistados; potencial custo operacional | Exigir auth ou rate limit; quotas de cache; limpeza por TTL; metricas de hit/miss e tamanho de cache |
| Media | Redis centraliza cache, rate limit, blacklist e broker | `REDIS_URL`, Celery broker/result e caches compartilham Redis; Compose usa senha unica/default user | Falha ou saturacao do Redis afeta auth, filas, cache e pipeline de uma vez | Separar Redis por funcao ou DB/instancia; usar ACLs por papel; monitorar memoria, evictions, conexoes e latencia |
| Media | Backups existem, mas restore/RPO/RTO nao foram evidenciados | Ha script de backup Postgres em `scripts/ops`, mas auditoria nao validou destino, criptografia, retencao ou restore | Backups podem nao ser recuperaveis quando necessario | Documentar RPO/RTO; automatizar backup criptografado offsite; executar restore drill mensal; alertar falhas de backup |
| Media | CI/CD nao demonstra controles de imagem, segredos e IaC | Workflows existem, mas nao foi encontrada evidencia suficiente de Trivy/Grype, secret scanning dedicado, Docker benchmark ou SBOM | Risco de imagem vulneravel, segredo acidental ou drift operacional | Adicionar secret scanning, container scan, SBOM, dependency review, branch protection e gates para high/critical |
| Media | Multi-tenancy depende de disciplina por endpoint | Muitos endpoints filtram por `current_user.id`, e ha testes pontuais, mas nao foi visto teste matricial completo por recurso | IDOR regressivo pode surgir em novas rotas ou filtros esquecidos | Criar suite de testes de autorizacao cross-tenant para todos os recursos: conexoes, posts, comentarios, dashboards, billing, blog/admin |
| Media-baixa | Token em query string ainda suportado para SSE | `get_current_user_token_or_query` aceita token via query; frontend atual parece evitar SSE/fallback, mas suporte permanece | Query tokens podem aparecer em logs, historico ou referer se usados | Remover query token quando possivel; usar cookie HttpOnly ou header em transporte compatavel; mascarar logs |
| Media-baixa | Variaveis de ambiente legadas/nao usadas ampliam superficie | VPS contem chaves como Supabase, sem uso runtime encontrado na analise atual | Secret sprawl dificulta rotacao e aumenta impacto de vazamento | Inventariar envs; remover chaves nao usadas; rotacionar tokens antigos; documentar dono e uso de cada segredo |
| Media-baixa | Emails HTML interpolam valores sem escape explicito | `email_service.py` monta HTML com valores como nome/usuario/URLs | Possivel HTML injection em email, spoofing visual ou quebra de template | Escapar valores dinamicos; renderizar templates com autoescape; validar URLs de destino |
| Baixa | Tokens de reset/verificacao ficam em claro no banco | Tokens UUID com expiracao sao armazenados diretamente | Se banco vazar, tokens ativos podem ser usados ate expirar | Armazenar hash dos tokens; TTL curto; invalidar todos os tokens anteriores por usuario |
| Baixa | Documentacao arquitetural tem sinais de drift | Documentos antigos citam tecnologias/versoes diferentes das atuais; diagramas recentes corrigem parte disso | Time pode tomar decisao operacional com base em informacao antiga | Manter ADRs e C4 atualizados; gerar docs a partir de evidencias de codigo/deploy; versionar diagrama renderizado |
| Baixa | PostHog aparece configurado no codigo, mas dependencia/uso efetivo nao ficou claro | Configuracao e referencias existem, mas nao foi confirmado pacote/runtime ativo | Telemetria pode estar ausente ou dar falsa sensacao de monitoramento | Confirmar estrategia de product analytics; remover codigo morto ou instalar/configurar conscientemente |

## Componentes e controles confirmados

| Categoria | Confirmado |
|---|---|
| Frontend | Next.js web app, PWA Vite, pacote compartilhado de tipos/API client |
| Backend | FastAPI modular com routers de auth, connections, posts, dashboard, pipeline, comments, billing, support, demographics, leads e blog |
| Assincrono | Celery worker e beat usando Redis como broker/result backend |
| Banco | PostgreSQL em container, volume persistente `postgres_data` |
| Cache/fila | Redis com senha, volume `redis_data`, usado por Celery, blacklist, cache e rate limit |
| Integracoes | Stripe, Resend, Google OAuth, Instagram, TikTok, YouTube, Apify, OpenRouter/Gemini, Clarity/Google Tag, Sentry configuravel |
| Deploy | Docker Compose em VPS Ubuntu, Nginx reverse proxy, API e web expostos localmente por `127.0.0.1`, TLS/hosts via Nginx |
| Seguranca positiva | CORS restrito, containers nao-root, Stripe webhook com assinatura, tokens sociais criptografados, email verification, rate limit em auth, filtros por usuario em varias rotas |

## Pendencias de validacao

- Executar scan formal de seguranca com fases completas e relatorio de findings validado.
- Rodar `python -m pytest`, `npm run type-check`, `npm run build:web`, `npm run test:e2e:smoke` em ambiente com dependencias consistentes.
- Rodar auditoria Python (`pip-audit` ou equivalente).
- Validar Sentry/alertas em producao sem imprimir DSN.
- Validar backups: destino, criptografia, retencao e restore drill.
- Validar RBAC/admin no banco real sem expor dados sensiveis.
- Validar regras Nginx completas, headers finais via `curl -I` externo e CSP reports reais.
- Medir Redis/Celery: tamanho de filas, latencia, tarefas falhadas, retries e dead letters.

## Skills e ferramentas pesquisadas

Skills locais usadas ou lidas:

- `c4-model`: usada anteriormente para documentar arquitetura C4 baseada em evidencias.
- `find-skills`: usada para pesquisar skills externas.
- `codex-security:security-scan`: lida para orientar metodologia de auditoria.
- `codex-security:deep-security-scan`: lida, mas nao executada formalmente porque o fluxo completo requer delegacao por subagentes e artefatos especificos.
- `codex-security:threat-model`: lida para enquadrar ameacas, ativos, trust boundaries e abuso.

Skills externas encontradas via `npx skills find`:

- `openai/skills@security-threat-model`
- `aradotso/security-skills@esaa-security-audit`
- `peterbamuhigire/skills-web-dev@multi-tenant-saas-architecture`
- `affaan-m/everything-claude-code@agent-architecture-audit`
- `helderberto/skills@architecture-audit`
- `josiahsiegel/claude-plugin-marketplace@docker-security-guide`
- `mukul975/anthropic-cybersecurity-skills@hardening-docker-containers-for-production`
- `thebushidocollective/han@docker-compose-production`

Observacao: skills de terceiros devem ser tratadas como dependencias de supply chain. A recomendacao e revisar o conteudo antes de instalar/executar, principalmente quando uma skill pode induzir comandos shell ou leitura de arquivos sensiveis.

## Roadmap recomendado

### 0 a 7 dias

| Prioridade | Acao | Resultado esperado |
|---|---|---|
| P0 | Adicionar healthcheck/alerta para Celery worker e beat | Falhas assincronas deixam de ser silenciosas |
| P0 | Criar alertas basicos: API down, web down, fila Celery, Redis memoria, Postgres storage, swap | Reduzir MTTR e risco de indisponibilidade |
| P0 | Remover ou proteger admin hardcoded | Governanca de privilegio administravel e auditavel |
| P1 | Ativar rate limit nos endpoints publicos de lead e thumbnail | Reduzir abuso trivial de recursos |
| P1 | Atualizar/remover dependencias JS com vulnerabilidades moderadas | Reduzir superficie de supply chain |

### 7 a 30 dias

| Prioridade | Acao | Resultado esperado |
|---|---|---|
| P1 | Migrar CSP de Report-Only para enforcement por etapas | Mitigacao real contra XSS |
| P1 | Planejar migracao de tokens do `localStorage` para cookie `HttpOnly` | Reduzir impacto de XSS |
| P1 | Criar suite IDOR cross-tenant para todos os recursos | Prevenir regressao de isolamento entre contas |
| P1 | Adicionar container hardening no Compose | Menor blast radius por container comprometido |
| P2 | Separar Redis por funcao ou aplicar ACLs | Reduzir impacto de falha/saturacao/credencial unica |
| P2 | Introduzir auditoria Python e container scan no CI | Melhor postura de supply chain |

### 30 a 90 dias

| Prioridade | Acao | Resultado esperado |
|---|---|---|
| P1 | Isolar Sentimenta em infraestrutura dedicada ou gerenciada | Menor risco de contencao e comprometimento lateral |
| P1 | Backup offsite criptografado com restore drill | Recuperacao realista de desastre |
| P2 | IaC para VPS/rede/Nginx/Compose | Menos drift e deploy reproduzivel |
| P2 | Observabilidade de negocio: pipeline success rate, provider errors, credit burn, stale data | Produto mais confiavel e rastreavel |
| P2 | Definir threat model e ASVS target level | Criterios objetivos para releases futuros |

## Referencias externas usadas para calibragem

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP SAMM: https://owasp.org/www-project-samm/
- OWASP Top 10 - Broken Access Control: https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/
- OWASP Docker Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
- Docker security docs: https://docs.docker.com/security/
- CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker
- Next.js CSP docs: https://nextjs.org/docs/app/guides/content-security-policy
- FastAPI OAuth2/JWT docs: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- Celery security docs: https://docs.celeryq.dev/en/latest/userguide/security.html
- Redis ACL docs: https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/
- OpenAI Security Threat Model skill listing: https://officialskills.sh/openai/skills/security-threat-model
- OWASP Agentic Skills Top 10: https://owasp.org/www-project-agentic-skills-top-10/
- SafeDep Agent Skills threat model: https://safedep.io/agent-skills-threat-model
- Snyk analysis of Skill.md shell-access risks: https://snyk.io/articles/skill-md-shell-access/
