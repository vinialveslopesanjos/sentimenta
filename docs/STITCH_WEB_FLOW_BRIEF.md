# Sentimenta - Mapa do Fluxo Web (Briefing para Stitch)

Este documento descreve o produto web atual da Sentimenta para facilitar a criação das telas mobile no Stitch/Figma.

## Objetivo do produto

Transformar comentários de redes sociais em:
- Métricas de sentimento
- Tendências temporais
- Insights acionáveis em linguagem humana (Relatório IA)

## Estilo visual (base para manter no app)

- Visual: leve, clean, cards arredondados (`dream-card`)
- Cores principais:
  - Lilás: destaque/ações principais
  - Ciano: apoio/tecnologia
  - Verde/Amarelo/Vermelho: positivo/neutro/negativo
- Tipografia: amigável, legível, sem aparência “enterprise pesada”

## Mapa de rotas (web atual)

- Landing: `/`
- Login/Cadastro: `/login`
- Dashboard geral: `/dashboard`
- Conectar perfis: `/connect`
- Dashboard de conexão: `/dashboard/connection/[id]`
- Post individual: `/posts/[id]`
- Logs de execução: `/logs`
- Alertas: `/alerts`
- Comparativo: `/compare`
- Configurações: `/settings`

---

## 1) Landing (`/`)

### Objetivo
Explicar proposta de valor e converter para teste/login.

### Blocos atuais
- Hero com headline + subtítulo + CTA
- Prova social (números)
- Mock visual em duas colunas:
  - Esquerda: dashboard resumido + gráfico de distribuição temporal 100% empilhado (mensal)
  - Direita: mock de “Saúde da Reputação (IA)” com resumo, pontos fortes, atenção e próximos passos
- Seção “Conecte / Analise / Entenda”
- Bloco de capacidades da IA
- Depoimentos
- Preços
- FAQ

### Ações do usuário
- CTA primário para login/teste
- Navegação por âncoras da página

---

## 2) Login/Cadastro (`/login`)

### Objetivo
Autenticar usuário.

### Blocos atuais
- Alternância entre login e criação de conta
- Formulário email/senha
- Mensagens de sucesso/erro
- CTA Google (ainda não operacional completo)

### Ações do usuário
- Entrar
- Criar conta

---

## 3) Dashboard Geral (`/dashboard`)

### Objetivo
Visão consolidada de todas as redes conectadas.

### Blocos atuais
- Header com saudação dinâmica (bom dia/tarde/noite + primeiro nome)
- Cards de perfis conectados (“Seus Perfis”) com CTA “Ver análise detalhada”
- KPIs gerais
- Gráfico temporal resumido (distribuição por sentimento)
- Card “Saúde da Reputação (IA)” com atualização manual e cache da última versão
- Lista “Posts Recentes” com CTA para análise individual

### Ações do usuário
- Ir para conexão específica
- Sincronizar conexão
- Atualizar relatório IA
- Abrir post individual

### Estados importantes
- Empty state sem conexões
- Loading de cards/gráficos
- Sem dados

---

## 4) Conectar Perfis (`/connect`)

### Objetivo
Adicionar perfis e configurar coleta/análise.

### Blocos atuais
- Formulário de conexão por plataforma (Instagram ativo, YouTube em evolução)
- Lista de perfis conectados
- Bloco “Configurações de Análise”
  - Posts a analisar
  - Comentários por post
  - Data inicial (since)
- Ações por perfil (analisar/sincronizar/remover/ver análise)

### Ações do usuário
- Conectar novo perfil
- Ajustar parâmetros de ingest
- Rodar nova análise incremental

---

## 5) Dashboard de Conexão (`/dashboard/connection/[id]`)

### Objetivo
Análise profunda de uma rede/perfil específico.

### Blocos atuais
- Header com perfil, status, seguidores e último sync
- Botão “Analisar” + botão de parâmetros de coleta
- KPIs:
  - Score médio
  - Taxa negativa
  - Polaridade
  - Comentários coletados
  - Engajamento
  - Posts analisados
- Volume de comentários por mês (linha/área)
- Tendência de score (dia/semana/mês)
- Análise temporal (sentimento/em emoções/tópicos):
  - Intensidade absoluta
  - Distribuição 100%
- Emoções (ranking)
- Tópicos (ranking)
- Distribuição de sentimento
- Lista de posts com ordenação/filtros
- Tabela de comentários com busca/filtro/paginação

### Ações do usuário
- Rodar ingest incremental
- Trocar granularidade temporal
- Trocar visão (sentimento/em emoções/tópicos)
- Abrir post individual
- Filtrar comentários

### Estados importantes
- “Aguardando comentários”
- “Análise em andamento”
- Sem dados por período

---

## 6) Post Individual (`/posts/[id]`)

### Objetivo
Análise detalhada de um único post.

### Blocos atuais
- Header do post (origem, data, contexto)
- KPIs e distribuição do post
- Emoções/tópicos do post
- Tabela/lista de comentários desse post com análise

### Ações do usuário
- Ler comentários com score/labels
- Voltar para conexão

---

## 7) Logs (`/logs`)

### Objetivo
Dar transparência operacional do pipeline.

### Blocos atuais
- Cards por execução com:
  - Status (running/completed/failed/partial)
  - Duração
  - Posts e comentários coletados/analisados
  - Erros
  - Custo estimado em BRL (quando não há custo explícito, usa proporcional por comentário)
- Resumo total no topo

### Ações do usuário
- Inspecionar performance/custo das execuções

---

## 8) Alertas (`/alerts`)

### Objetivo
Mostrar sinais de risco reputacional.

### Estado atual
- Tela existente com estrutura base.
- Ainda em evolução para alertas mais robustos.

---

## 9) Comparativo (`/compare`)

### Objetivo
Comparar desempenho entre perfis/períodos.

### Estado atual
- Tela existente com estrutura comparativa e export.
- Ainda em evolução para análises mais profundas.

---

## 10) Configurações (`/settings`)

### Objetivo
Gerenciar conta, plano, notificações e segurança.

### Blocos atuais
- Informações do perfil
- Plano e uso
- Notificações
- Segurança
- Zona de risco

---

## Fluxo principal do usuário (resumo)

1. Entrar em `/login`
2. Ir para `/connect` e conectar perfil
3. Ajustar parâmetros e iniciar análise
4. Acompanhar visão geral em `/dashboard`
5. Entrar em `/dashboard/connection/[id]` para profundidade
6. Abrir `/posts/[id]` quando quiser detalhe por conteúdo
7. Consultar `/logs` para custo/performance

---

## Prompt base para Stitch (copiar e usar)

### Contexto que vou anexar

- Vou anexar este arquivo (`STITCH_WEB_FLOW_BRIEF.md`) como especificação do fluxo e conteúdo.
- Vou anexar prints do produto web (e, se possível, um vídeo curto navegando o fluxo em 30-60s).
- Quero que você use esses anexos como “fonte de verdade” e não invente seções novas que não existam.

### Sua missão

Crie um app **iOS** para a Sentimenta, full-fidelity (não wireframe), com o fluxo completo e telas completas.  
Você pode inovar sem dó na experiência mobile (fluidez, transições, hierarquia), mas **sem mudar o design system** que já existe no web.

### Regras de identidade (não negociar)

- Manter **as mesmas cores, gradientes, sombras e linguagem visual** do web (cards arredondados, leve e delicado).
- Manter a **mesma fonte do web** (não trocar por SF/Inter por padrão).
- Manter o mesmo tom de voz: português brasileiro, humano, claro, acionável.

### Direção iOS (pode ousar aqui)

- Use padrões avançados de iOS/HIG sem perder a marca:
  - `Tab Bar` para áreas principais + navegação `Stack` para detalhamento.
  - `Large Titles` quando fizer sentido.
  - Sheets e bottom sheets para filtros e ações rápidas.
  - Cards com sensação “liquid / glass / dream” (transparências e blur sutis) desde que continue no estilo atual.
  - Haptics sugeridos em ações principais (Analisar, Atualizar, Sync).
  - Skeleton loading e estados vazios bem desenhados.
- Priorize interação com uma mão: CTAs visíveis, áreas clicáveis grandes, leitura rápida.

### Fluxo obrigatório (telas do web, adaptadas para mobile)

Crie o fluxo completo com estas telas:
1. Login/Cadastro (`/login`)
2. Conectar Perfis (`/connect`)
3. Dashboard Geral consolidado (`/dashboard`)
4. Dashboard da Conexão detalhado (`/dashboard/connection/[id]`)
5. Post Individual (`/posts/[id]`)
6. Logs (`/logs`)
7. Alertas (`/alerts`)
8. Comparativo (`/compare`)
9. Configurações (`/settings`)

### Must-have (não pode sumir)

- Dashboard Geral:
  - Saudação dinâmica
  - Cards de perfis conectados com CTA “Ver análise detalhada”
  - KPIs
  - Gráfico temporal resumido (distribuição por sentimento)
  - Card “Saúde da Reputação (IA)” com botão “Atualizar”
  - Posts recentes clicáveis (deixar óbvio que abre análise individual)
- Dashboard da Conexão:
  - Botão principal “Analisar” (sempre evidente)
  - KPIs (score médio, taxa negativa, polaridade, comentários, engajamento, posts)
  - Volume mensal de comentários (linha/área)
  - Tendência de score (dia/semana/mês)
  - Análise temporal com 2 gráficos lado a lado:
    - Intensidade absoluta
    - Distribuição 100%
    - Para: sentimento, emoções, tópicos
  - Emoções (ranking)
  - Tópicos (ranking)
  - Distribuição de sentimento
  - Lista de posts com ordenação/filtros
  - Comentários com busca, filtro e paginação
- Logs:
  - Lista de runs com status + custo estimado em BRL

### Gráficos (qualidade e acabamento)

- Recrie os gráficos do web em versão mobile, mais bonitos e legíveis:
  - tipografia pequena com bom contraste
  - grid leve
  - tooltips/insights ao tocar (tap / long-press)
  - legendas limpas e sem poluição
- Considere:
  - trend lines com área sutil
  - barras empilhadas 100% com boa leitura
  - estados “sem dados” elegantes

### O que eu espero como saída

- Frames iPhone (ex.: iPhone 15 / 390px) com safe areas respeitadas.
- Telas completas e “long scroll” quando necessário (sem medo de altura).
- Componentes reutilizáveis (cards, headers, tabs, list items, filtros, badges).
- Protótipo navegável (Dashboard -> Conexão -> Post, e Tab Bar entre áreas).
  