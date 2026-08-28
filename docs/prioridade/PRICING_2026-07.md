# Precificação Sentimenta — Julho/2026

Data: 2026-07-03
Status: aprovado pelo fundador (substitui a tabela de `docs/historico/pricing-analysis.html` de março/2026)
Contexto de decisão: 2 meses no ar, 0 vendas self-serve (Google Ads: ~3k impressões, 280 cliques, 0 conversões). Única receita foi projeto B2B custom de R$50k+, provando demanda e willingness-to-pay muito acima da tabela antiga.

## 1. Decisões

| Decisão | Racional |
|---|---|
| **Fim do plano gratuito** | 0 conversões em 2 meses; free atrai curiosos com custo Apify real; o estudo de março já recomendava trial em vez de freemium. |
| **Trial 14 dias com cartão obrigatório** | Converte automático no fim do trial via Stripe; filtra leads sérios; teto de 1.000 comentários no trial limita o custo de aquisição a ~R$10-40. |
| **Starter R$197/mês** (antes R$97) | Posiciona acima de ferramentas de agendamento (mLabs R$70, Reportei R$150) — Sentimenta entrega análise de sentimento, não agendamento. |
| **Pro R$497/mês** (antes R$247; absorve o antigo Business) | Herda demographics + API do antigo Business (R$597). Vira o plano "sério" para agências/marcas. |
| **Enterprise "sob consulta"** (sem preço público) | O projeto de R$50k+ mostrou que o teto é negociação, não tabela. Âncora interna de negociação: partir de R$1.500/mês (piso Buzzmonitor) e subir conforme volume/escopo. |
| **Business (R$597) sai de linha** | Assinantes existentes mantêm o plano (legado, como já ocorre com creator/agency). Não aparece mais no site nem no checkout. |

## 2. Tabela nova

| | Trial (14d) | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Preço mensal | R$0 (cartão obrigatório) | **R$197** | **R$497** | sob consulta |
| Preço anual (equiv./mês) | — | R$157 | R$397 | negociado |
| Créditos/mês (1 crédito = 1 comentário) | 1.000 (total do trial) | 10.000 | 40.000 | custom |
| Conexões | do plano escolhido | 3 | 10 | custom |
| Sync | do plano escolhido | semanal | diária | custom |
| Demographics | ✔ (degustação) | ✖ | ✔ | ✔ |
| API | ✖ | ✖ | ✔ | ✔ |
| Excedente por comentário | bloqueado | R$0,05 | R$0,04 | negociado |
| Histórico | — | 90 dias | 365 dias | ilimitado |

**Pacotes de créditos avulsos** (não expiram): 2.500 → R$99 · 5.000 → R$179 · 10.000 → R$299. Reprecificados para nunca sair mais barato que o excedente do plano superior (antes: R$49/89/159, abaixo do custo real — ver §3).

**Plano `free` no sistema**: vira estado "sem assinatura" — 0 créditos, 0 syncs, dados já coletados continuam visíveis. Não é vendido nem exibido.

## 3. Unit economics com dado real (junho/2026)

Fato: fatura Apify de junho = **R$350** para **~10.474 comentários** coletados (janela 29/05–28/06, auditoria `docs/produto/AUDITORIA_CONFIABILIDADE_PIPELINE_2026-06-28.md`).

Custo aparente: **R$0,0334/comentário** — ~3x o R$0,0115 usado no estudo de março. Dois cenários, porque a fatura provavelmente inclui mensalidade fixa da plataforma Apify:

| | Cenário A: tudo variável | Cenário B: fatura inclui ~US$49 fixo (~R$270) |
|---|---|---|
| Apify variável/comentário | R$0,0334 | R$0,0076 |
| LLM (Gemini Flash)/comentário | R$0,0006 | R$0,0006 |
| **Custo marginal/comentário** | **~R$0,034** | **~R$0,008** |

Margens no pior caso (cliente consome 100% da cota) e no caso típico (50%):

| Plano | Receita | Custo A 100% | Margem A | Custo B 100% | Margem B | Margem B @50% uso |
|---|---|---|---|---|---|---|
| Starter (10k) | R$197 | R$340 | **-73%** | R$82 | 58% | 79% |
| Pro (40k) | R$497 | R$1.360 | **-174%** | R$328 | 34% | 67% |

**Leitura**: se o Cenário A for verdadeiro, os planos são deficitários em uso pleno — mas o Cenário A é quase certamente inflado: o custo fixo da Apify estava diluído em volume baixo (10k comentários/mês no total). Com mais clientes, o custo converge para o marginal (Cenário B). Ainda assim:

**Ações obrigatórias antes de escalar Ads:**
1. Confirmar na fatura detalhada da Apify quanto é assinatura fixa vs uso (console da Apify → Billing → Invoices).
2. Corrigir a telemetria de custo interna — a auditoria encontrou 3 fontes divergentes (`pipeline_runs.total_cost_usd` US$2,20 vs `usage_log` US$2,04 vs `comment_analysis` US$0,21). Sem custo por cliente confiável, não dá para saber a margem real.
3. Se o custo marginal real ficar acima de ~R$0,015/comentário, reduzir créditos do Starter para 5.000 antes de qualquer campanha grande.

Custo do trial (1.000 comentários): R$8 (B) a R$34 (A) por lead com cartão — aceitável como CAC mesmo no pior cenário.

## 4. Benchmark (inalterado desde março, para referência)

Etus R$19 · mLabs R$70 · Reportei R$150 · **Sentimenta Starter R$197** · **Sentimenta Pro R$497** · Buzzmonitor R$1.590 · Zeeng R$1.500 · Stilingue R$3.000. Só Sentimenta e os players de R$1.500+ fazem análise de sentimento — o novo posicionamento cobra por isso em vez de competir com agendadores.

## 5. Checklist manual — Stripe Dashboard (fundador executa)

O código só referencia price IDs via env; a troca é atômica no deploy.

- [ ] Criar price **Starter mensal R$197** e **Starter anual R$1.884** (equiv. R$157/mês) no produto Starter.
- [ ] Criar price **Pro mensal R$497** e **Pro anual R$4.764** (equiv. R$397/mês) no produto Pro.
- [ ] Atualizar env na VPS: `STRIPE_PRICE_STARTER` e `STRIPE_PRICE_PRO` com os novos IDs. **Não** remover o price antigo do Business: `STRIPE_PRICE_BUSINESS` continua apontando para o price legado (assinantes existentes seguem cobrados normalmente).
- [ ] (Habilita compra de pacotes no app) Criar prices one-time R$99/R$179/R$299 e setar `STRIPE_PRICE_PACK_2500`, `STRIPE_PRICE_PACK_5000`, `STRIPE_PRICE_PACK_10000`.
- [ ] Conferir no Stripe que **trial sem pagamento no fim = cancelamento automático** (Settings → Subscriptions and emails → Manage failed payments for trials) — o webhook já derruba o usuário para `free` no cancelamento.
- [ ] Depois do deploy: rodar um checkout em test mode e confirmar status `trialing` + 1.000 créditos concedidos.

## 6. Backlog registrado (fora deste ciclo)

- P1/P2 da auditoria de 28/06: endpoint agregado de runs, padronização de semântica de custo, UX da pausa de automação, tela "saúde das fontes", relatório exportável.
- Twitter/X: decidir entre concluir (código já existe, pipeline desligado) ou remover de vez.
- Alertas: persistir configuração + entrega por e-mail (hoje só exibição derivada). É argumento de venda para Pro/Enterprise quando existir de verdade.
- Reavaliar preços após 10 assinantes pagantes ou 90 dias, o que vier primeiro.
