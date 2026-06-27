# Sentimenta — Design Brief para o Stitch (Google)

**Produto:** SaaS de análise de sentimento para redes sociais
**Público:** Agencias de Marketing e Social Media, Criadores de conteúdo, políticos, profissionais liberais que querem entender o que o público diz sobre eles
**Tom:** Profissional, confiável, inteligente. Mais próximo de uma ferramenta analítica séria do que de uma rede social divertida. Dark mode.
**Paleta base atual:** Background `#0d1117`, surface `#161b22`, accent roxo `#7c3aed`, positivo verde `#3fb950`, negativo vermelho `#f85149`, neutro âmbar `#d29922`

---

## Contexto rápido

O usuário conecta seus perfis (Instagram, Twitter e YouTube) e o sistema coleta os comentários automaticamente. Uma IA analisa cada comentário e classifica: sentimento (0-10), emoções, tópicos, sarcasmo. O dashboard mostra tudo isso de forma visual para que o dono do perfil entenda sua reputação digital.

---

## Telas a projetar

---

### TELA 1 — Landing Page (já existe, melhorar)

**O que é:** Página pública de apresentação do produto.

**O que temos hoje:**
- Header com logo + link de login
- Hero com headline "Entenda o que dizem sobre você"
- 3 blocos de features (Conecte → Analise → Entenda)
- Badges das plataformas suportadas

**O que queremos no ideal:**
- Hero mais impactante com mockup real do dashboard ao fundo (screenshot ou mockup ilustrativo)
- Social proof: "Mais de X perfis analisados", "X comentários processados este mês"
- Seção de pricing clara (Starter R$79/mês · Pro R$199/mês · Enterprise R$599/mês)
- Seção de depoimentos de usuários beta
- FAQ compacto (3-5 perguntas)
- CTA duplo no final: "Comece grátis 14 dias" + "Ver demonstração"
- Footer com links úteis

**Dados que aparecem:** Estáticos / marketing

---

### TELA 2 — Login / Cadastro (já existe, ajustar)

**O que é:** Tela de autenticação.

**O que temos hoje:**
- Toggle login/cadastro
- Google OAuth
- Formulário email + senha

**O que queremos no ideal:**
- Layout split: lado esquerdo com identidade visual / benefício curto, lado direito com form
- No mobile: só o form com logo no topo
- Campos: Nome (só no cadastro), E-mail, Senha
- Botão Google Sign-In no topo (mais visível)
- Link "Esqueci minha senha" (ainda não implementado, mas precisa aparecer no design)
- Termos de uso e privacidade no rodapé do form

---

### TELA 3 — Dashboard Principal (já existe, refinar)

**O que é:** Tela inicial pós-login. Visão geral de todos os perfis conectados.

**O que temos hoje:**
- 4 KPI cards (Conexões, Posts, Comentários, Score médio)
- Gráfico de rosca (distribuição positivo/neutro/negativo)
- Relatório de saúde gerado por IA
- Gráfico de tendência de sentimento (área empilhada)
- Cards das conexões ativas com botão de sincronizar
- Lista dos 5 posts mais recentes

**O que queremos no ideal:**

Layout sugerido (desktop, 2 colunas):
```
┌─────────────────────────────────────────────────────────┐
│  Bom dia, Vini 👋   [Score geral: 7.4] [+ Conectar]    │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Conexões: 3  │ Posts: 47    │ Comentários  │ Score: 7.4 │
│              │              │ 8.420        │ ▲ +0.3     │
├──────────────┴──────────────┴──────────────┴────────────┤
│ TENDÊNCIA DE SENTIMENTO (30 dias)           [Dia/Sem/Mês]│
│ [gráfico de área empilhada: verde/âmbar/vermelho]        │
├─────────────────────────┬───────────────────────────────┤
│ DISTRIBUIÇÃO             │ SAÚDE DA REPUTAÇÃO (IA)       │
│ [rosca + legenda]        │ Texto gerado pelo Gemini      │
│ Positivo 62%             │ [Atualizar]                   │
│ Neutro 28%               │                               │
│ Negativo 10%             │                               │
├─────────────────────────┴───────────────────────────────┤
│ SEUS PERFIS                                              │
│ [card Instagram] [card YouTube] [+ Adicionar perfil]     │
├──────────────────────────────────────────────────────────┤
│ POSTS RECENTES                                           │
│ [lista com preview, comentários, score]                  │
└──────────────────────────────────────────────────────────┘
```

**Estado vazio (primeiro acesso):**
- Ilustração central + mensagem "Conecte seu primeiro perfil para começar"
- Botão grande "Conectar Instagram" e "Conectar YouTube"

---

### TELA 4 — Conectar Perfis (já existe, ajustar)

**O que é:** Tela para adicionar e gerenciar contas de redes sociais.

**O que temos hoje:**
- Cards para Instagram, YouTube, Twitter (desativado)
- Input de username
- Lista de contas conectadas com opção de sync e remoção

**O que queremos no ideal:**

**Área superior — Adicionar plataforma:**
```
┌──────────────────────────────────────────────────────────┐
│ Adicionar perfil                                         │
│                                                          │
│ [Card Instagram]  [Card YouTube]  [Card TikTok*]         │
│ @username         @channel        *em breve              │
│ [Conectar]        [Conectar]                             │
└──────────────────────────────────────────────────────────┘
```

Cada card de plataforma deve ter:
- Ícone + cor da plataforma
- Instrução curta ("Perfil público funciona sem login")
- Campo de input + botão

**Área inferior — Perfis conectados:**
- Tabela/lista com: avatar, nome, plataforma, seguidores, último sync, status (ativo/erro), ações (Analisar / Remover)
- Badge de status animado quando sincronizando

---

### TELA 5 — Detalhe do Perfil Conectado (já existe, refinar)

**O que é:** Analytics detalhados de um único perfil (Instagram ou YouTube).

**O que temos hoje:**
- Header com info do perfil + botão sync
- 6 KPI cards (Score, Score ponderado, Polaridade, Comentários, Views, Likes)
- Gráfico de tendência
- Gráfico de emoções (barras horizontais)
- Gráfico de tópicos (barras horizontais)
- Rosca de distribuição
- Gráfico de engajamento
- Lista de posts
- Tabela de comentários com filtros

**O que queremos no ideal:**

Layout sugerido:
```
← Voltar    [Avatar] @vini_alveees · Instagram · 45K seguidores · Sync: ontem   [Analisar]

┌──────┬──────┬──────┬──────┬──────┬──────┐
│Score │Pond. │Polar.│Coment│Views │Likes │
│ 7.4  │ 7.1  │+0.42 │8.420 │1.2M  │89K   │
└──────┴──────┴──────┴──────┴──────┴──────┘

TENDÊNCIA (30 dias)                              [Dia | Semana | Mês]
[gráfico de área empilhada]

┌─────────────────────┬──────────────────────┐
│ EMOÇÕES TOP 7       │ TÓPICOS TOP 10       │
│ [barras horizontais]│ [barras horizontais] │
└─────────────────────┴──────────────────────┘

┌─────────────────────┬──────────────────────┐
│ DISTRIBUIÇÃO         │ ENGAJAMENTO          │
│ [rosca]             │ [linhas: coment/likes]│
└─────────────────────┴──────────────────────┘

POSTS ANALISADOS
[lista clicável]

TODOS OS COMENTÁRIOS
[tabela com filtros: busca / sentimento / ordenação]
```

---

### TELA 6 — Detalhe do Post (já existe, refinar)

**O que é:** Análise profunda de um único post e seus comentários.

**O que temos hoje:**
- Header com texto do post, tipo, likes/comentários/views, link original
- 4 KPIs do post (Score, Score pond., Analisados, Polaridade)
- Barra horizontal de distribuição (positivo/neutro/negativo em proporção)
- Emoções e tópicos como badges
- Lista completa de comentários com análise inline

**O que queremos no ideal:**

```
← Voltar ao perfil

┌─────────────────────────────────────────────┐
│ [Thumbnail] Texto do post...                │
│ Instagram · Imagem · 2 dias atrás           │
│ ❤ 3.2K  💬 847  👁 45K  [Ver no Instagram ↗] │
└─────────────────────────────────────────────┘

┌──────┬──────┬──────┬──────┐
│ 7.4  │ 7.1  │ 836  │ +0.42│
│Score │Pond. │Anal. │Polar.│
└──────┴──────┴──────┴──────┘

DISTRIBUIÇÃO ████████████████░░░░░░▓▓▓
              62% positivo   28% neutro  10% negativo

┌─────────────────────┬──────────────────────┐
│ EMOÇÕES             │ TÓPICOS DETECTADOS   │
│ [badges por freq.]  │ [badges por freq.]   │
└─────────────────────┴──────────────────────┘

COMENTÁRIOS (847)
[busca] [filtro sentimento] [ordenar por]

┌─────────────────────────────────────────────┐
│ [7.8] João Silva · ❤ 12                    │
│ "Amei o conteúdo, muito útil!"             │
│ ✨ alegria · 💡 dica útil · [resumo IA]    │
├─────────────────────────────────────────────┤
│ [2.1] anon_user · ❤ 0  · 🎭 sarcasmo      │
│ "Claro que é verdade né..."                │
│ 😤 ironia · ceticismo · [resumo IA]        │
└─────────────────────────────────────────────┘
```

**Destaque importante:** Comentários com sarcasmo detectado ganham badge especial (ex: 🎭 ícone).

---

### TELA 7 — Logs de Pipeline (já existe, refinar)

**O que é:** Histórico de todas as sincronizações e análises executadas.

**O que temos hoje:**
- Lista de pipeline runs com status (rodando/concluído/falhou)
- Métricas: posts, comentários, analisados, erros, duração
- Barra de progresso para runs ativos
- Auto-atualização enquanto há runs em andamento

**O que queremos no ideal:**
```
Logs de Pipeline

[Card em execução — animado]
● RODANDO  @vini_alveees · Análise completa
Posts: 8 | Comentários: 423 | Analisados: 201
[████████░░░░░░░░░░] 47%
Analisando post 4 de 8...

[Card concluído]
✓ CONCLUÍDO  @vini_alveees · 23/02/2026 14:32
Posts: 8 | Comentários: 423 | Analisados: 423 | Duração: 4m 12s

[Card com erro]
✕ FALHOU  @meu_youtube · 22/02/2026 09:15
Erros: 1 | Canal não encontrado
```

---

### TELA 8 — Configurações / Conta (NOVA — não existe ainda)

**O que é:** Tela de gerenciamento da conta do usuário.

**Seções:**

**Perfil:**
- Nome de exibição (editável)
- E-mail (exibição apenas)
- Foto de perfil (futuramente)

**Plano atual:**
- Nome do plano (Starter / Pro / Enterprise)
- Comentários usados este mês (ex: 847 / 1.000)
- Data de renovação
- Botão "Fazer upgrade"

**Notificações (futura):**
- Toggle: Alertas de sentimento negativo por e-mail
- Toggle: Relatório semanal
- Limiar de alerta (ex: score abaixo de 4.0)

**Segurança:**
- Trocar senha
- Sessões ativas

**Perigo:**
- Deletar conta (com confirmação)

---

### TELA 9 — Alerta de Crise (NOVA — não existe ainda)

**O que é:** Modal/overlay que aparece quando o score de sentimento cai drasticamente.

**Trigger:** Score médio caiu mais de X pontos em 24h, ou pico de comentários negativos.

**Design:**
```
┌─────────────────────────────────┐
│  ⚠️  ALERTA DE REPUTAÇÃO        │
│                                 │
│  @vini_alveees detectou um      │
│  pico de comentários negativos  │
│                                 │
│  Score: 7.4 → 3.2  ↓ 57%       │
│  Comentários negativos: +184    │
│  Período: últimas 6 horas       │
│                                 │
│  Tópicos mais mencionados:      │
│  • polêmica · preço · erro      │
│                                 │
│  [Ver análise completa]  [OK]   │
└─────────────────────────────────┘
```

---

### TELA 10 — Comparativo entre Perfis (NOVA — não existe ainda)

**O que é:** Tela para comparar o desempenho de sentimento entre dois ou mais perfis conectados. Útil para quem tem conta no Instagram E YouTube.

**Layout:**
```
COMPARATIVO DE PERFIS

Selecionar perfis: [Instagram ✓] [YouTube ✓]

┌─────────────────┬──────────────────┐
│ @instagram      │ @youtube         │
│ Score: 7.4      │ Score: 6.8       │
│ 8.420 coment.   │ 2.103 coment.    │
│ +62% positivos  │ +51% positivos   │
└─────────────────┴──────────────────┘

TENDÊNCIA COMPARATIVA (30 dias)
[linhas sobrepostas: azul=IG, vermelho=YT]

DISTRIBUIÇÃO COMPARATIVA
[barras lado a lado por plataforma]
```

---

## Fluxos principais para animar/prototipar

### Fluxo 1 — Onboarding (primeiro acesso)
```
Landing → Cadastro → Dashboard vazio → Conectar perfil →
Digita @username → Confirmação → Dashboard com dados zerados →
Clica "Analisar" → Progresso em tempo real → Dashboard com dados
```

### Fluxo 2 — Análise diária (uso recorrente)
```
Login → Dashboard (vê score geral) → Clica no perfil Instagram →
Vê tendência da semana → Clica no post com mais comentários →
Filtra por "negativo" → Lê o que estão falando → Sai informado
```

### Fluxo 3 — Crise de reputação
```
Notificação push/email → Acessa dashboard → Alerta de crise visível →
Clica "Ver análise" → Post problemático em destaque →
Filtra comentários negativos → Exporta relatório (futuro)
```

---

## Notas de comportamento e interação

| Elemento | Comportamento |
|---|---|
| Score de sentimento | Sempre com cor: verde ≥7, âmbar 4-6.9, vermelho <4 |
| Botão "Analisar" | Desativa durante sync, mostra % de progresso em tempo real |
| Cards de KPI | Aparecem com stagger animation (0.08s entre cada um) |
| Navegação | Sidebar compacta (ícone + tooltip) no desktop; bottom nav no mobile |
| Gráficos | Tooltip ao hover com valor exato e data |
| Comentários com sarcasmo | Badge especial (distinto dos outros) |
| Estado vazio | Ilustração + CTA claro, nunca tabela vazia sem contexto |
| Loading | Skeleton loaders (não spinner global) |
| Erros de API | Toast notification no canto inferior direito |

---

## Navegação estrutural

```
/ (landing)
├── /login
│
└── (autenticado)
    ├── /dashboard                    ← visão geral
    ├── /dashboard/connection/[id]    ← detalhe de um perfil
    ├── /posts/[id]                   ← detalhe de um post
    ├── /connect                      ← adicionar/gerenciar perfis
    ├── /logs                         ← histórico de execuções
    └── /settings                     ← conta e configurações (nova)
```

---

## Prioridade de telas para o design

| Prioridade | Tela | Status |
|---|---|---|
| 🔴 P0 | Dashboard Principal | Existe, refinar |
| 🔴 P0 | Detalhe do Perfil | Existe, refinar |
| 🔴 P0 | Detalhe do Post | Existe, refinar |
| 🔴 P0 | Conectar Perfis | Existe, ajustar |
| 🟡 P1 | Landing Page | Existe, melhorar muito |
| 🟡 P1 | Login/Cadastro | Existe, ajustar layout |
| 🟡 P1 | Configurações / Conta | Nova — criar do zero |
| 🟢 P2 | Logs de Pipeline | Existe, refinar |
| 🟢 P2 | Alerta de Crise | Nova — criar do zero |
| 🟢 P3 | Comparativo entre Perfis | Nova — criar do zero |
