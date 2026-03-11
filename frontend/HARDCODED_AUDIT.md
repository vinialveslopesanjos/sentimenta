# Hardcoded / Mock / Placeholder Data Audit

**Data:** 2026-03-03
**Escopo:** `/opt/sentimenta/frontend/app/` e `/opt/sentimenta/frontend/components/`

---

## 1. Landing Page (`app/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 129-157 | Array `plans` com nomes "Starter" (R$79), "Pro" (R$199), "Enterprise" (R$599) | Dados do backend billing | API já existe: `GET /api/v1/billing/plans` retorna planos reais (free/R$0, creator/R$67, pro/R$167, agency/R$397). **Os preços e nomes estão errados vs backend.** Fetch na landing ou servir via SSR. |
| 159-181 | Array `testimonials` com pessoas fictícias: "Ana Clara", "Ricardo Mendes", "Fernanda Costa" | Depoimentos reais ou removidos | Substituir por depoimentos reais quando houver, ou marcar claramente como ilustrativos. Sem API necessária — conteúdo editorial. |
| 183-204 | Array `faqs` com 5 perguntas/respostas | Conteúdo editorial (OK ser estático) | Aceitável como conteúdo estático. Pode virar CMS no futuro. |
| 322-333 | Social proof: "2.000+ perfis analisados", "8,4M comentários este mês", "14 dias grátis" | Métricas reais do sistema | Criar endpoint `GET /api/v1/public/stats` que retorna totais reais, ou remover se não houver volume real ainda. |
| 353 | Dashboard mockup: "Bom dia, Julia." | Conteúdo ilustrativo (OK) | Aceitável — é mockup visual da landing. |
| 361-365 | KPIs do mockup: "3 Conexões", "47 Posts", "10.812 comentários/mês", score de `landingLatestTotals` | Conteúdo ilustrativo (OK) | Aceitável — é mockup visual. |
| 379 | "01/2023 a 01/2026" range estático | Se mockup, OK | Aceitável como ilustração. |
| 400 | "Perfil: @julia_brand \| Período: Últimas 24h" | Mockup ilustrativo | Aceitável. |
| 406-434 | Relatório de IA mockado: "72% alegria", "142 menções positivas", "15 comentários pedem link do frete", etc. | Mockup ilustrativo | Aceitável — demonstração visual para a landing. |
| 482-504 | Array de comentários fake: "@fa_clube" score 8.4, "@analitico_user" score 4.8, "@curioso_br" score 6.2 | Mockup ilustrativo | Aceitável — exemplos visuais. |
| 515 | "mais de 2.000 marcas" | Métrica real | Mesmo problema da linha 322. |

## 2. Landing Mock Data (`lib/landingMockData.ts`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 13-45 | `landingMonthlySentiment` — array gerado algoritmicamente com 37 meses de dados fake | Dados reais ou remoção | Se a landing precisa de um gráfico demo, OK. Se quiser dados reais, criar `GET /api/v1/public/demo-trends`. |
| 47-56 | `landingLatestTotals` com `score: 8.5` hardcoded | Score real ou calculado | Substituir por dado real via API pública ou manter como demo. |

## 3. Settings Page (`app/(dashboard)/settings/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 83-89 | `PLAN_DISPLAY` com preços: free="Grátis", creator="R$49/mês", pro="R$199/mês", agency="R$599/mês", admin="Ilimitado" | Dados do backend billing | **Preços incorretos vs backend** (backend: creator=R$67, pro=R$167, agency=R$397). Usar `GET /api/v1/billing/plans` para obter nomes e preços corretos. |
| 43-45 | `useState` para notificações: `notifEmail=true`, `notifWeekly=true`, `notifMarketing=false` | Preferências do usuário no banco | Criar endpoint `GET/PATCH /api/v1/auth/me/notifications` para persistir preferências. Atualmente as toggles não salvam nada. |
| 122-130 | `handleChangePassword` faz `setTimeout` fake de 800ms e mostra "Senha alterada com sucesso!" sem chamar API | Endpoint real de troca de senha | Criar endpoint `POST /api/v1/auth/change-password` no backend. A função é 100% fake — simula sucesso sem fazer nada. |
| 292 | "Seu plano renova no dia 1 de cada mês." | Data real de renovação do plano | Necessita integração com billing (Stripe ou equivalente). Por ora, OK como placeholder. |
| 303-308 | Botões "Fazer Upgrade" e "Histórico de Cobrança" sem `onClick`/`href` | Páginas/modais reais de billing | Criar fluxo de upgrade (checkout Stripe) e página de histórico de faturas. |
| 553-558 | Botão "Deletar Permanentemente" sem handler — não chama API | Endpoint de deleção de conta | Criar `DELETE /api/v1/auth/me` no backend e conectar o botão. |

## 4. Alerts Page (`app/(dashboard)/alerts/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 28-29 | `MOCK_UNREAD_IDS = new Set<string>()` com comentário "Mock unread state... in production this would come from the API" | Estado de leitura persistido no backend | Criar campo `read_at` ou tabela `alert_reads` no backend. Adicionar `PATCH /api/v1/dashboard/alerts/{id}/read`. Atualmente read/unread é apenas estado local (perdido ao recarregar). |
| 44 | `dismissedIds` e `readIds` como `useState` — estado local apenas | Persistido no backend | Mesmo fix acima — persistir dismissal/read no banco. |

## 5. Logs Page (`app/(dashboard)/logs/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 9 | `USD_TO_BRL = Number(process.env.NEXT_PUBLIC_USD_BRL ?? "5.00")` | Câmbio real | Aceitável como fallback. Poderia buscar câmbio real de API externa ou do backend. Baixa prioridade. |
| 10 | `USD_PER_COMMENT_FALLBACK = 0.03 / 14` (~$0.002/comment) | Custo real por comentário | O backend já retorna `total_cost_usd` quando disponível. Fallback é razoável. |

## 6. Login Page (`app/(auth)/login/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 201 | "Em breve" tooltip no botão Google Login (botão desabilitado) | Google OAuth funcional | Backend já tem `POST /api/v1/auth/google`. Implementar fluxo OAuth no frontend — provavelmente precisa configurar Google OAuth client no frontend. |

## 7. Connection Detail Page (`app/(dashboard)/dashboard/connection/[id]/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| — | **Nenhum dado hardcoded encontrado.** | — | Tudo vem de APIs. Page limpa. |

## 8. Dashboard Page (`app/(dashboard)/dashboard/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| — | **Nenhum dado hardcoded encontrado.** | — | Tudo vem de APIs (`dashboardApi.summary`, `dashboardApi.trends`, `dashboardApi.healthReport`). Page limpa. |

## 9. Compare Page (`app/(dashboard)/compare/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| 97 | `days` inicializado com `3650` (10 anos como "Tudo") | Aceitável | Valor arbitrário grande para "mostrar tudo". OK. |

## 10. Connect Page (`app/(dashboard)/connect/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| — | **Nenhum dado hardcoded encontrado.** | — | Tudo vem de APIs. Page limpa. |

## 11. Post Detail Page (`app/(dashboard)/posts/[id]/page.tsx`)

| Linha | O que está hardcoded | O que deveria ser | Como corrigir |
|-------|---------------------|-------------------|---------------|
| — | **Nenhum dado hardcoded encontrado.** | — | Tudo vem de APIs. Page limpa. |

---

## Resumo por Prioridade

### ALTA (dados incorretos ou funcionalidade fake)

| # | Arquivo | Problema | Impacto |
|---|---------|---------|---------|
| 1 | `settings/page.tsx:83-89` | Preços dos planos errados (R$49/R$199/R$599 vs backend R$67/R$167/R$397) | Usuário vê preços falsos |
| 2 | `settings/page.tsx:122-130` | Troca de senha é 100% fake (setTimeout + mensagem de sucesso) | Falha de segurança — usuário acha que trocou a senha |
| 3 | `settings/page.tsx:553-558` | Botão "Deletar Conta" não faz nada | Funcionalidade prometida mas inexistente |
| 4 | `settings/page.tsx:43-45` | Toggles de notificação não persistem | Configurações perdidas ao recarregar |
| 5 | `settings/page.tsx:303-308` | Botões "Fazer Upgrade" e "Histórico de Cobrança" sem ação | Funcionalidades de billing inexistentes |

### MEDIA (dados inconsistentes ou estado efêmero)

| # | Arquivo | Problema | Impacto |
|---|---------|---------|---------|
| 6 | `alerts/page.tsx:28-44` | Read/dismiss de alertas é estado local apenas | Alertas voltam como "não lidos" ao recarregar |
| 7 | `page.tsx:129-157` | Planos da landing (Starter/Pro/Enterprise) diferem dos do backend (free/creator/pro/agency) | Confusão de branding e preços |
| 8 | `page.tsx:322-333` | Social proof "2.000+ perfis" e "8,4M comentários" são números inventados | Credibilidade |
| 9 | `login/page.tsx:201` | Google Login marcado "Em breve" mas backend suporta | Feature pronta no backend não exposta |

### BAIXA (mockups aceitáveis ou fallbacks razoáveis)

| # | Arquivo | Problema | Impacto |
|---|---------|---------|---------|
| 10 | `lib/landingMockData.ts` | Dados de gráfico demo gerados algoritmicamente | Aceitável para landing page |
| 11 | `page.tsx:159-181` | Testimonials fictícios | Conteúdo editorial — substituir quando houver reais |
| 12 | `logs/page.tsx:9-10` | Câmbio USD/BRL e custo/comment como fallback | Valores razoáveis com fallback |
