# Plano de aquisicao: 100 acessos em 7 dias

Data: 2026-06-28

Objetivo operacional: gerar os primeiros 100 acessos qualificados para o Sentimenta em ate 7 dias, medindo de onde vieram e qual acao fizeram.

Importante: 100 acessos nao garante clientes. A meta correta da semana e aprender quais dores geram clique, cadastro e primeiro uso.

## Decisao principal

Comecar com um funil simples:

```text
Conteudo/ads/outreach
  -> landing ou artigo
  -> cadastro
  -> conectar perfil
  -> rodar diagnostico
```

O Sentimenta nao deve vender "IA para social media" de forma generica. A promessa mais clara e:

> Descubra como a audiencia reagiu nos comentarios, alem de curtidas e alcance.

## Publicos

1. Agencias pequenas e medias
   - Dor: entregar relatorio melhor para cliente.
   - Oferta: diagnostico gratuito de 1 perfil/post publico.
   - Canal inicial: outreach manual + LinkedIn/Instagram + Google Search.

2. Social medias
   - Dor: perder horas lendo comentarios e justificar decisao com achismo.
   - Oferta: score, emocoes, temas e comentarios que merecem resposta.
   - Canal inicial: Instagram/Meta Ads + conteudo curto.

3. Criadores
   - Dor: entender audiencia sem se afogar em comentario negativo.
   - Oferta: resumo emocional dos comentarios.
   - Canal inicial: Instagram organico e Reels curtos.

## Plano de 7 dias

### Dia 1 - Base de medicao

- Definir `NEXT_PUBLIC_SITE_URL=https://sentimenta.com.br`.
- Definir `NEXT_PUBLIC_CLARITY_ID` se ainda nao estiver em producao.
- Confirmar se o banner de cookies permite carregar Clarity.
- Abrir Microsoft Clarity e criar um dashboard para:
  - visitas em `/`
  - visitas em `/blog`
  - cliques em CTA
  - sessoes que chegam em `/login`

### Dia 2 - Conteudo e oferta

- Publicar 3 artigos iniciais no blog:
  - risco nos comentarios do Instagram
  - relatorio para cliente alem de curtidas
  - Google Ads, Meta Ads e conteudo para SaaS pequeno
- Compartilhar cada artigo com UTM:
  - `utm_source=instagram`
  - `utm_medium=organic`
  - `utm_campaign=blog_risco_comentarios`

### Dia 3 - Outreach manual

- Enviar 15 mensagens personalizadas para agencias do arquivo:
  - `docs/historico/marketing/first-10-outreach-prospects.md`
- CTA unico:
  - "Posso fazer um diagnostico gratuito de 1 perfil/post publico e mandar 3 insights?"
- Meta: 3 respostas.

### Dia 4 - Instagram organico

- Postar 1 carrossel:
  - Slide 1: "Seu post teve comentarios. Mas eles foram bons?"
  - Slide 2: "Curtida mede alcance. Comentario mede percepcao."
  - Slide 3: "Procure raiva, medo, ironia e repeticao de critica."
  - Slide 4: "Isso vira relatorio para cliente."
  - Slide 5: "Quer uma amostra? Me mande um @ publico."
- Link da bio para:
  - `/blog/como-saber-se-os-comentarios-do-instagram-estao-virando-risco?utm_source=instagram&utm_medium=bio&utm_campaign=first_100`

### Dia 5 - Google Ads pequeno

Rodar apenas se a medicao estiver funcionando.

- Campanha Search.
- Orcamento inicial: R$ 20 a R$ 40/dia por 3 dias.
- Termos iniciais:
  - analise de sentimento instagram
  - analisar comentarios instagram
  - monitoramento de reputacao digital
  - relatorio social media cliente
  - ferramenta social listening brasil
- Landing:
  - artigo ou home com UTM.
- Conversao primaria:
  - clique em cadastro/login.
- Conversao secundaria:
  - visita em artigo.

### Dia 6 - Meta Ads pequeno

Rodar apenas se houver pelo menos 2 criativos bons.

- Objetivo inicial: trafego ou leads simples, nao venda direta.
- Publico:
  - interesses em marketing digital, social media, agencias, Meta Business Suite, Canva.
- Criativos:
  - carrossel "alem de curtidas e alcance"
  - imagem estatica "comentarios virando risco"
  - video curto mostrando dashboard/mockup
- Orcamento inicial: R$ 20 a R$ 40/dia por 3 dias.

### Dia 7 - Leitura

Avaliar:

- Quantas visitas vieram por canal.
- Quais paginas seguraram mais tempo.
- Quantos clicaram em CTA.
- Quantos chegaram em cadastro.
- Se alguem conectou perfil ou pediu diagnostico.

Decisao:

- Se Google trouxe clique qualificado, duplicar keywords vencedoras.
- Se Meta trouxe visita barata sem acao, ajustar promessa/criativo.
- Se outreach trouxe resposta, priorizar diagnostico manual antes de aumentar Ads.

## O que eu preciso de voce

1. Confirmar dominio final usado em producao.
2. Criar ou confirmar acesso ao Microsoft Clarity.
3. Criar Google Search Console para `sentimenta.com.br`.
4. Criar Google Ads e Meta Business Manager quando formos ligar campanhas.
5. Definir orcamento teste: recomendado R$ 150 a R$ 300 na primeira semana.

## O que Codex consegue fazer

- Criar novas paginas e artigos.
- Criar UTMs e links de campanha.
- Criar roteiros de posts e carrosseis.
- Gerar prompts para imagens de blog.
- Criar scripts de rascunho de conteudo.
- Preparar eventos de tracking no frontend.
- Preparar arquivos para importacao/manual review em Google Ads e Meta Ads.

## O que Codex nao deve fazer sozinho no inicio

- Publicar campanha paga sem revisao humana.
- Gastar verba sem limite.
- Inventar metricas ou cases.
- Prometer conversao sem dados.
