# Plano de Faturamento — Julho/2026

Data: 2026-07-06
Status: em execução
Objetivo: **primeira receita relevante até 31/07/2026**, com meta principal de 1 venda B2B (R$10–30k) e meta secundária de 1–2 assinaturas de agência.
Responsáveis: Vinicius (vendas/decisões) + Claude (código, drafts, pesquisa, automação de browser).

Relacionados: `PRICING_2026-07.md` · `AUDITORIA_GOOGLE_ADS_2026-07-02.md` · `OUTREACH_POLITICO_E_AGENCIAS_2026-07.md` · `first-10-outreach-prospects.md`

---

## 1. Diagnóstico (fatos verificados em 06/07)

Dados do banco de produção (fonte da verdade):

| Métrica | Valor |
|---|---|
| Usuários totais | 21 (6 admin, 13 free, 1 pro, 1 enterprise) |
| Cadastros últimos 7 dias | 1 |
| Clientes pagantes orgânicos | **0** |
| Leads reais em /diagnostico | **0** (4 registros, todos testes internos) |
| Receita real do projeto | R$30k + 20% rev share (venda B2B pbarbosa, via networking) |

Estado do funil:

- Repricing de 04/07 no ar: Starter R$197 / Pro R$497 / Enterprise sob consulta, trial 14d **com cartão** (decisão aprovada em `PRICING_2026-07.md` — este plano NÃO propõe reverter).
- Google Ads PMax: ~2.8k impressões, 229 cliques, R$33, **0 conversões medidas** — e a conversão "Cadastro completo" nunca foi validada (auditoria 02/07).
- `/diagnostico` (oferta de entrada de baixa fricção) **não é linkada de lugar nenhum da landing** e não é a URL final dos anúncios.
- PostHog first-party entrou em produção em 06/07 (PR #62). Consent Mode v2 ainda pendente.
- ~35 agências mapeadas com mensagens prontas desde junho — **nunca enviadas**.

### A leitura honesta

O único canal que já gerou dinheiro foi **venda consultiva founder-led**. O marqueteiro do
pbarbosa fechou 4 clientes somando R$130k usando a plataforma como diferencial — isso é
prova de PMF num nicho, não um acaso. Self-serve SaaS sem prova social leva 12–18 meses
para dar receita relevante; venda direta pode dar receita em 3 semanas.

### O timing que não volta

**Outubro/2026 é eleição geral no Brasil.** Campanha oficial começa em agosto. Julho é o
mês em que marqueteiros e candidatos fecham fornecedores de tecnologia. A janela para
vender "inteligência eleitoral de sentimento" com o case pbarbosa na mão é AGORA e dura
~6 semanas.

---

## 2. As 4 trilhas

Prioridade de esforço do Vinicius: **T1 (50%) > T2 (30%) > T4 (15%) > T3 (5% — o resto é do Claude)**.

### Trilha 1 — Replicar a venda pbarbosa (ticket R$10–30k) 🥇

**Por quê**: único modelo com receita provada; ticket que cumpre a meta sozinho; demanda
sazonal no pico; case real com números (R$130k em contratos fechados pelo parceiro).

| # | Ação | Quem | Quando |
|---|---|---|---|
| 1.1 | Ligar para o marqueteiro do pbarbosa: pedir 2–3 indicações de outros marqueteiros + autorização para usar o case (com ou sem nome). Oferecer 10–15% de comissão por venda indicada. | **Vinicius** | 07/07 |
| 1.2 | Redigir case one-pager (draft pronto no kit de outreach — personalizar com números autorizados) | Claude (draft) → Vinicius (validação) | 07/07 |
| 1.3 | Montar lista de 30–50 marqueteiros políticos e consultores eleitorais (LinkedIn, Instagram, sites da ABCOP — Associação Brasileira de Consultores Políticos) | Claude (via Chrome/pesquisa) + Vinicius (filtro) | 08/07 |
| 1.4 | Enviar DMs/WhatsApp (mensagens prontas no kit) — 10/dia | **Vinicius** (envio manual = mais resposta) | 08–18/07 |
| 1.5 | Calls de demo com interessados — mostrar o dashboard pbarbosa (anonimizado) ao vivo | **Vinicius** | contínuo |
| 1.6 | Proposta padrão: setup white-label R$15–30k + R$1,5–3k/mês por candidato monitorado. Alternativa de entrada: "relatório de sentimento pré-campanha" avulso R$2–5k por candidato | Claude (template) → Vinicius (negociação) | 09/07 |

**Meta: 20+ contatos/semana → 3–5 calls → 1 fechamento até 31/07.**

### Trilha 2 — Agências (ticket R$500–2k/mês) 🥈

**Por quê**: lista de 35 prospects já existe com mensagens escritas; agência compra
ferramenta que vira entregável para o cliente dela (relatório); ciclo de venda mais curto
que marca final.

| # | Ação | Quem | Quando |
|---|---|---|---|
| 2.1 | Upgrade das mensagens: antes de contatar cada agência, rodar análise real de 1 post de um cliente dela (créditos admin) e abrir a conversa com 2–3 insights concretos | Claude (roda análises + adapta mensagem) | 08–09/07 |
| 2.2 | Enviar 10 contatos/dia (e-mail + Instagram DM) | **Vinicius** | 09–25/07 |
| 2.3 | Oferta dupla: (a) trial 14d do plano Pro; (b) **relatório done-for-you R$297–497/perfil** para quem não quer assinar — dinheiro imediato, sem fricção | Vinicius | contínuo |
| 2.4 | Follow-up D+3 e D+7 (mensagens prontas no kit) | Vinicius | contínuo |

**Meta: 3–5 diagnósticos entregues → 1–2 agências pagando até 31/07.**

### Trilha 3 — Funil digital (consertar, não escalar) 🔧

**Por quê**: o tráfego pago atual otimiza às cegas e a única oferta de baixa fricção está
invisível. Não é o canal que vai pagar julho, mas cada visita desperdiçada hoje é lead de
agosto perdido. Mantém as decisões de pricing de 04/07 intactas.

| # | Ação | Quem | Status |
|---|---|---|---|
| 3.1 | Linkar `/diagnostico` na landing (nav + hero + pricing) como CTA secundário | **Claude** | ✅ feito nesta sessão (PR) |
| 3.2 | Consent Mode v2 no frontend (conversões modeladas mesmo sem aceite de cookie) — pendência da auditoria de Ads | **Claude** | ✅ feito nesta sessão (PR) |
| 3.3 | Revisar + mergear o PR e deployar | **Vinicius** | pendente |
| 3.4 | Teste E2E da conversão: janela anônima → aceitar cookies → criar conta teste → conferir em ~3h se "Cadastro completo" ativa no Google Ads | **Vinicius** (15 min) | pendente — bloqueia qualquer decisão sobre Ads |
| 3.5 | Trocar URL final do PMax para `/diagnostico?utm_source=google&utm_medium=cpc&utm_campaign=pmax_sentimenta` | Vinicius ou **Claude via plugin Chrome** (com você logado no Google Ads) | após 3.4 |
| 3.6 | Criar campanha Search R$10/dia com keywords de intenção (draft em `ads-campaign-drafts.json`) + keywords eleitorais ("monitoramento redes sociais campanha eleitoral", "análise de sentimento candidato") e pausar/reduzir PMax | Vinicius ou **Claude via plugin Chrome** | após 3.4 |
| 3.7 | Conferir fatura Apify (fixo vs variável) — obrigatório antes de escalar Ads (ver `PRICING_2026-07.md` §3) | **Vinicius** (10 min no console Apify) ou Claude via Chrome | até 11/07 |

### Trilha 4 — Distribuição a custo zero 📣

**Por quê**: o produto gera o próprio conteúdo (análises de eventos quentes); LinkedIn é
onde estão agências e marqueteiros — não o Instagram com 10 seguidores. Semeia agosto.

| # | Ação | Quem | Quando |
|---|---|---|---|
| 4.1 | Post LinkedIn de fundador contando o case pbarbosa (draft pronto no kit) | Claude (draft) → **Vinicius** (publica no perfil pessoal) | 08/07 |
| 4.2 | 2x/semana: análise de evento quente ("analisamos N comentários sobre X — eis o que a audiência sentiu"). Claude roda a análise e escreve o post; Vinicius publica | Claude + Vinicius | ter/qui até 31/07 |
| 4.3 | Entrar em 5+ grupos (WhatsApp/Telegram/Facebook) de social media e marketing político; contribuir com análises grátis, sem pitch nos primeiros dias | **Vinicius** | 08–12/07 |
| 4.4 | Registrar tudo que funcionar/não funcionar para decidir o canal de agosto | Vinicius + Claude | contínuo |

---

## 3. O que o Claude consegue fazer (mapa de delegação)

**Sem precisar de você (já feito ou faz sozinho quando pedir):**
- Código: landing, tracking, qualquer fix do produto (via PR para você revisar).
- Drafts: mensagens de outreach, case one-pager, propostas, posts LinkedIn, e-mails.
- Pesquisa: listas de prospects (marqueteiros, agências), pricing de concorrentes, keywords.
- Rodar análises de perfis/posts públicos pelo próprio Sentimenta (créditos admin) para
  municiar outreach e conteúdo.
- Consultas ao banco de produção (leitura) para acompanhar métricas reais.

**Com o plugin do Chrome (você logado, Claude opera, você supervisiona):**
- Google Ads: validar conversões, trocar URL final, criar campanha Search, keywords negativas.
- Apify console: abrir fatura e separar custo fixo vs variável.
- LinkedIn/Instagram: preparar DMs em rascunho para você só revisar e apertar enviar
  (envio automatizado em massa = risco de bloqueio da conta; não recomendo).
- Preencher planilha/CRM de acompanhamento de outreach.

**Só você (não delegável):**
- Ligação para o marqueteiro do pbarbosa (relação pessoal — é o ativo mais valioso do plano).
- Calls de venda e negociação.
- Aceitar/mergear PRs e autorizar deploys.
- Publicar posts no seu perfil pessoal (voz de fundador).
- Decisões de pricing e proposta final.

---

## 4. Cronograma resumido

| Semana | Foco | Marco de sucesso |
|---|---|---|
| **07–13/07** | Ligação pbarbosa + kit no ar + funil consertado + primeiros 30 contatos (T1+T2) | Case autorizado; PR mergeado; conversão Ads validada; 3+ respostas |
| **14–20/07** | Volume de outreach + calls de demo + 2 posts LinkedIn | 3–5 calls agendadas; 1 proposta enviada |
| **21–27/07** | Fechamento T1 + entrega de diagnósticos T2 | 1 contrato B2B assinado ou em assinatura; 1–2 agências em trial pago |
| **28–31/07** | Cobrança/fechamento + retro | **R$10k+ faturado**; decisão de canal para agosto |

## 5. Metas e como medir

- **Meta A (principal)**: 1 venda white-label/consultiva política — R$10–30k.
- **Meta B**: 1–2 assinaturas Starter/Pro de agência + 2–3 relatórios avulsos — R$1–3k.
- **Meta C (higiene)**: conversão Ads validada + `/diagnostico` recebendo tráfego + ≥5 leads reais no banco.
- Fonte da verdade: **banco de produção** (`users`, `diagnostic_leads`, Stripe), nunca o painel do Ads.
- Check-in semanal: Claude consulta o banco e compara com as metas (pedir "status do plano de julho").

## 6. O que NÃO fazer em julho

- ❌ Escalar orçamento de Ads antes da conversão validada e da fatura Apify entendida.
- ❌ Reabrir discussão de pricing (decisão de 04/07 vale até ter dado novo — reavaliar em agosto com leads reais).
- ❌ Construir feature nova. Nenhuma. O produto já vende — o gargalo é distribuição.
- ❌ Automatizar envio de DM em massa (risco de ban; volume manual de 10/dia é suficiente).
- ❌ Perseguir criadores/influencers individuais (ticket baixo, ciclo longo) — só atender se vierem inbound.
