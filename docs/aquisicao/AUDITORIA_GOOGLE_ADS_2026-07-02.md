# Auditoria Google Ads — 2026-07-02

Auditoria ponta a ponta (Google Ads → site → VPS → banco) da campanha Performance Max do Sentimenta.

## Números (28/06 a 02/07)

| Métrica | Valor |
|---|---|
| Impressões | 2.848 |
| Cliques | 229 |
| CTR | 8,04% |
| CPC médio | R$ 0,15 |
| Custo | R$ 33,34 |
| Conversões medidas | **0** |
| Cadastros reais no banco | **1** (30/06, provavelmente teste interno) |

Leitura: o tráfego chega barato e com CTR alto — padrão de PMax distribuindo em display/apps de baixa intenção —, mas **não converte em cadastro**. O problema não é volume; é intenção do clique + funil + medição nunca validada.

## O que estava quebrado (e o que já foi corrigido hoje)

1. ✅ **"Visualização de página" era conversão Principal** e apontava para URL malformada
   (`sentimenta.com.br/sentimenta.com.br/blog` — nunca dispararia). **Rebaixada para Ação
   secundária.** "Cadastro completo" agora é a única principal.
2. ✅ **Expansão de URL final estava ATIVADA** — Google podia mandar cliques para qualquer
   página do site (blog etc.). **Desativada**: todo clique vai para a URL final definida.
3. ⚠️ **Conversão "Cadastro completo" nunca validada** (status: Inativa/Configuração
   incorreta). A cadeia técnica está OK até onde dá pra verificar sem um cadastro real:
   - VPS `.env`: `NEXT_PUBLIC_GOOGLE_TAG_ID=AW-18282402342` e label `K5tjCJGKocgcEKak3Y1E` ✓
   - Bundle do site (`layout-*.js`) contém o AW-ID e o loader do gtag ✓
   - A tag só dispara **após aceite de cookies** (consent gate) — nunca houve cadastro
     com cookies aceitos vindo de anúncio, então o Google nunca recebeu o ping.

## Validação pendente (exige ação humana)

Teste end-to-end: janela anônima → sentimenta.com.br → **aceitar cookies** → criar uma
conta de teste. Em até ~3h a ação "Cadastro completo" deve sair de "Inativa" no Google Ads
(Metas → Conversões). Sem isso, o PMax segue otimizando às cegas.

## Riscos/observações

- Gasto atual R$ 33,34 — o guia original limitava o teste do Google a R$ 25. Orçamento
  segue em R$ 10/dia sem data de término; decidir se mantém.
- PMax com R$ 10/dia e zero conversões não aprende. Duas rotas:
  a) manter PMax **após** validar conversão; b) migrar verba para **Search** com as
  keywords de intenção do `ADS_SETUP_GUIDE_GOOGLE_META.md` (mais controle, melhor pra
  orçamento pequeno).
- Landing atual = home. Alternativas de menor fricção já existem e não são usadas:
  `/diagnostico`, `/campanhas/agencias`, `/campanhas/social-media`. Experimento sugerido:
  URL final → `/diagnostico` com UTM.
- Consent gate mata a medição de quem não aceita cookies. Melhoria de código futura:
  **Consent Mode v2** (pings anônimos sem cookies) — recupera parte da medição perdida.

## Plano recomendado (ordem)

1. **Hoje**: cadastro de teste (validar conversão) — humano.
2. **Após validar**: trocar URL final para `/diagnostico?utm_source=google&utm_medium=cpc&utm_campaign=pmax_sentimenta`.
3. **Semana 1**: criar campanha Search (R$ 10/dia) com keywords de frase do guia +
   negativas; pausar PMax ou reduzir para R$ 5/dia até Search dar sinal.
4. **Semana 2**: Consent Mode v2 no frontend; considerar conversões aprimoradas.
5. **Contínuo**: olhar cadastros no banco vs. conversões no Ads (fonte da verdade = banco).
