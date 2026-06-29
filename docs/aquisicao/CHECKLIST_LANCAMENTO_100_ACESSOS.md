# Checklist de lancamento para buscar 100 acessos

Data: 2026-06-29

Use este checklist na ordem. A meta e gerar trafego rastreavel, nao "fazer marketing bonito".

## Links prontos

- Agencias: `/campanhas/agencias`
- Social media: `/campanhas/social-media`
- Diagnostico gratuito: `/diagnostico`
- Blog: `/blog`

Links com UTM:

```text
https://sentimenta.com.br/campanhas/agencias?utm_source=instagram&utm_medium=bio&utm_campaign=first_100_agencias
https://sentimenta.com.br/campanhas/social-media?utm_source=instagram&utm_medium=bio&utm_campaign=first_100_social_media
https://sentimenta.com.br/diagnostico?utm_source=instagram&utm_medium=bio&utm_campaign=first_100_diagnostico
https://sentimenta.com.br/blog/como-saber-se-os-comentarios-do-instagram-estao-virando-risco?utm_source=instagram&utm_medium=organic&utm_campaign=first_100_blog
```

Textos prontos para bio, stories, carrossel, LinkedIn e mensagens:

```text
docs/aquisicao/DISTRIBUTION_KIT_FIRST_100.md
```

Rascunhos de anuncios:

```text
docs/aquisicao/ads-campaign-drafts.json
docs/aquisicao/ADS_SETUP_GUIDE_GOOGLE_META.md
output/ads/google-search-drafts.csv
output/ads/meta-ads-drafts.csv
```

## Antes de divulgar

- Confirmar deploy com as rotas `/campanhas/agencias`, `/campanhas/social-media`, `/blog`, `/sitemap.xml`.
- Confirmar que `/diagnostico` envia o formulario para o email de suporte.
- Confirmar `NEXT_PUBLIC_SITE_URL=https://sentimenta.com.br`.
- Confirmar `NEXT_PUBLIC_CLARITY_ID`.
- Entrar no site, aceitar cookies e clicar em um CTA.
- Enviar um teste no formulario `/diagnostico` com assunto "TESTE - ignorar".
- Conferir no Clarity se a sessao apareceu.

## Dia 1

- Colocar o link de agencias ou social media na bio do Instagram.
- Postar story curto:
  - "Estou abrindo diagnosticos gratuitos de comentarios de Instagram/YouTube."
  - "Mostro sentimento, emocoes, temas de critica e pontos de resposta."
  - "Manda um @ publico ou entra pelo link da bio."
- Enviar 10 mensagens para agencias da lista existente.

## Dia 2

- Publicar carrossel:
  - Slide 1: "Curtida nao conta como a audiencia se sentiu."
  - Slide 2: "Comentario mostra percepcao."
  - Slide 3: "O problema e ler tudo manualmente."
  - Slide 4: "O Sentimenta resume sentimento, emocoes e temas."
  - Slide 5: "Quer uma amostra? Link na bio."
- Enviar mais 10 mensagens manuais.

## Dia 3

- Se Clarity estiver medindo, ligar Google Search com rascunho de:
  - `docs/aquisicao/ads-campaign-drafts.json`
- Verba maxima: R$ 30/dia por campanha.
- Pausar se houver clique caro sem tempo de pagina ou CTA.

## Dia 4

- Criar 2 criativos para Meta com base nos prompts do JSON.
- Verba maxima: R$ 25 a R$ 30/dia por conjunto.
- Objetivo inicial: trafego qualificado para landing.

## Dia 5

- Ler dados:
  - visitas por UTM
  - tempo nas paginas
  - cliques no CTA
  - cadastros
  - respostas manuais
- Cortar o canal que trouxe clique vazio.
- Reforcar o canal que trouxe resposta ou cadastro.

## Dia 6

- Publicar mais um story com prova de processo:
  - print sem dados sensiveis do dashboard
  - "isso aqui mostra o clima dos comentarios"
- Responder manualmente todos os leads.

## Dia 7

- Fechar aprendizado:
  - canal que mais trouxe visita
  - oferta que mais gerou clique
  - persona que respondeu melhor
  - proxima pauta de blog
  - proximo criativo de Ads

## Regra de decisao

- Se outreach trouxe respostas: priorizar diagnostico manual e conversa.
- Se Google trouxe cliques com CTA: aumentar verba aos poucos.
- Se Meta trouxe visita barata sem clique: trocar criativo/oferta.
- Se ninguem clicou: a promessa da landing precisa mudar antes de gastar mais.

## Observacao sobre copy

A skill chamada "humanizador" nao esta instalada neste ambiente. A regra aplicada nos textos foi equivalente: frases curtas, portugues natural, promessa concreta, sem jargao de IA e sem inventar resultado.
