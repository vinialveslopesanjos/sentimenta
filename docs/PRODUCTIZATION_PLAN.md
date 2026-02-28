# Sentimenta - Plano de Produtização e Testes Em Voo (V2)

Este documento mapeia os passos necessários para validar a aplicação no estágio atual, remover os últimos gargalos de *mock data* no ambiente Mobile, e consolidar o projeto para deploy contínuo em servidor VPS.

## Fase 1: Finalização da Migração Mobile e Testes End-to-End

O novo aplicativo assumiu o formato Web APP (Vite + React) permitindo que seja testado pelo próprio navegador do iPhone, com acesso aos mesmos estilos do design unificado (`Tailwind V4` e `DreamCard`).

1.  **Substituir dados Mock Restantes no Mobile**:
    - **`PostDetailScreen.tsx`**: Puxar dados conectando no endpoint de detalhes do comentário (`api.comments.list()`).
    - **`LogsScreen.tsx`**: Integrar endpoint `/pipeline/runs` para histórico de ingestão.
    - **`AlertsScreen.tsx` / `CompareScreen.tsx`**: Usar as APIs `/dashboard/alerts` e `/dashboard/compare`.
    - Atualmente essas páginas utilizam a importação de `mockData` para facilitar o render. O painel principal (`DashboardScreen`) e o `LoginScreen` já estão operando com **dados reais** do `@sentimenta/api-client`.

2.  **Validação de Ingestão e Pipeline Backend**:
    - Certifique-se que o Redis (`localhost:6379`) e o Celery backend estão funcionando.
    - Autentique-se com uma conta real via Mobile.
    - Solicite a adição de um canal e realize o processo de **Sync**.
    - Acompanhe os workers e logs (`npx start.ps1` no PowerShell) para ver a resposta do Gemini e do XPoz. Se necessário, ajuste o rate limit no `.env`.

3.  **Ajuste de CORS (Se necessário)**:
    - O backend (FastAPI) deve ter o IP de deploy e o domínio de PWA permitido na lista de `CORSMiddleware`.
    - Para o modo de teste (Vite com porta 5173 e em IP local 192.168.15.6), certifique-se que as origens corretas estão expostas e liberadas no FastAPI (em `backend/app/main.py`).

---

## Fase 2: Configuração e Pré-Deploy na VPS Ubuntu

Queremos subir apenas o estritamente necessário na VPS e escalar conforme demanda. O plano engloba o Backend e Frontends.

1.  **Serviço de Banco de Dados**:
    - Usar o Docker (`docker-compose.yml`) na VPS para servir Postgres e Redis de forma isolada e em *restart: always*.
    - **Atenção:** Como o banco conterá dados de LLM analíticos do Gemini, garantir rotinas de backup da pasta de volumes do Postgres na configuração de script do servidor (`scripts/setup_vps.sh`).

2.  **Configuração de Redes (Nginx + SSL)**:
    - Instalar Nginx e configurar as zonas:
      - `api.sentimenta.meu-dominio.com` → Reverse proxy apontando para o serviço FastAPI em `127.0.0.1:8000`.
      - `app.sentimenta.meu-dominio.com` → Servir estáticos otimizados do Web Dashboard (Next.js).
      - `m.sentimenta.meu-dominio.com` → Servir os estáticos gerados na build do Apps Mobile (Vite PWA).
    - Gerar certificados SSL usando o Certbot (Let's Encrypt).

3.  **Processos em Segundo Plano (Supervisor / Systemd)**:
    - Evitar rodar backend apenas com `nohup`.
    - Configurar um arquivo `.service` para o Gunicorn (FastAPI).
    - Configurar arquivos multiplos (ex: `celery_worker_1.service`) para escalar processamento de background jobs caso vários usuários sincronizem comentários.

---

## Fase 3: Iteração Final para o Lançamento

1.  **Fluxo de Autenticação OAuth (Google e Instagram/Youtube)**:
    - Testar login social completo. Ao apontar APIs de produção nas chaves (`GOOGLE_CLIENT_ID` / `INSTAGRAM_APP_ID`), será necessário aprovar e testar na Sandbox de cada provedor.

2.  **Otimização do PWA (Mobile)**:
    - Adicionar configurações extras no `manifest.json` para suportar ícones corretos em dispositivos iOS que rodem via "Adicionar à Tela de Início".
    - Isso garantirá a sensação nativa e tela cheia (Display: standalone) requerida pelo design moderno.

3.  **Monitoramento de Custos Gemini**:
    - Acompanhar via dashboard da Google Cloud o teto de gastos (`GEMINI_API_KEY`).
    - Limitar no Sentimenta em produção o número de comentários / post de contas *Free* até o primeiro *upgrade de plano* do sistema monetizado.

**Status atual do repasse**: Branch atual (`claude/mobile-testing-setup-8RCk1`) está estavél e sincronizada. Os pacotes TypeScript universais (`types` e `api-client`) funcionaram nativamente no novo web app mobile sem exigir alterações complexas.
