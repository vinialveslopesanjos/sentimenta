# Guia de configuracao: Google Ads e Meta Ads

Data: 2026-06-29

Objetivo: colocar no ar um teste pequeno, rastreavel e limitado a R$ 50 no total.

Nao publicar campanha sem conferir:

- URL correta.
- Orçamento diário.
- Forma de cobrança.
- Limite total do teste.
- Tracking/Clarity funcionando.

## Limite financeiro

- Limite total autorizado: R$ 50.
- Recomendacao: dividir em 2 dias.
- Google Ads: R$ 25 total.
- Meta Ads: R$ 25 total.

Se qualquer plataforma exigir orçamento minimo maior que isso, nao publique. Deixe em rascunho.

## URL principal do teste

Use esta URL se o anuncio for generico:

```text
https://sentimenta.com.br/diagnostico?utm_source={{SOURCE}}&utm_medium={{MEDIUM}}&utm_campaign=first_100_paid_test
```

Google:

```text
https://sentimenta.com.br/campanhas/agencias?utm_source=google&utm_medium=cpc&utm_campaign=search_agencias_relatorio_sentimento
```

Meta:

```text
https://sentimenta.com.br/campanhas/social-media?utm_source=meta&utm_medium=paid_social&utm_campaign=meta_social_media_comentarios
```

## Google Ads - Search

### Configuracao recomendada

- Objetivo: visitas ao site ou leads.
- Tipo: Search.
- Rede: somente Pesquisa Google. Desmarcar Display se aparecer.
- Local: Brasil.
- Idioma: Portugues.
- Lance: maximizar cliques, se permitir limite de CPC.
- Orçamento: R$ 12,50/dia por 2 dias, ou o menor valor permitido abaixo de R$ 25 total.

### Keywords

Use correspondencia de frase:

```text
"analise de sentimento instagram"
"analisar comentarios instagram"
"monitoramento de reputacao digital"
"relatorio social media cliente"
"ferramenta social listening brasil"
```

Negativas:

```text
gratis download
curso
vaga
emprego
pdf pronto
bot
seguidores
comprar comentarios
```

### Anuncios

Headlines:

```text
Relatorio alem de curtidas
Analise comentarios com IA
Sentimento para agencias
Mostre percepcao do cliente
Diagnostico gratuito
```

Descriptions:

```text
Transforme comentarios de Instagram e YouTube em score, emocoes e temas para relatorios de cliente.
Veja como a audiencia reagiu de verdade. Teste um diagnostico gratuito com perfil ou post publico.
Uma camada de reputacao e sentimento para agencias que ja entregam social media e trafego pago.
```

## Meta Ads

### Configuracao recomendada

- Objetivo: trafego.
- Destino: site.
- Local: Brasil.
- Posicionamentos: automaticos para o primeiro teste.
- Orçamento: R$ 12,50/dia por 2 dias, ou o menor valor permitido abaixo de R$ 25 total.
- Otimizacao: cliques no link ou visitas a pagina de destino.

### Publico inicial

Interesses/sinais:

```text
marketing digital
social media
agencias de marketing
trafego pago
Meta Business Suite
Canva
marketing de conteudo
criadores de conteudo
```

### Texto principal

Opcao 1:

```text
Ler comentario por comentario nao escala. Veja sentimento, emocoes e temas em poucos minutos.
```

Opcao 2:

```text
Um post pode performar bem e ainda esconder critica recorrente. O Sentimenta mostra o clima real dos comentarios.
```

Opcao 3:

```text
Seu relatorio mostra alcance e curtidas. Mas mostra como a audiencia reagiu nos comentarios?
```

Headline:

```text
Entenda seus comentarios
```

Descricao:

```text
Diagnostico gratuito com perfil ou post publico.
```

CTA:

```text
Saiba mais
```

## Criativo

Usar uma das imagens ja geradas no projeto:

```text
frontend/public/blog/risco-comentarios-instagram.png
frontend/public/blog/relatorio-cliente-sentimento.png
frontend/public/blog/aquisicao-google-meta-saas.png
```

Para Meta, preferir:

```text
frontend/public/blog/risco-comentarios-instagram.png
```

## Depois de publicar

Olhar depois de 12 a 24 horas:

- Cliques.
- Custo por clique.
- Sessoes no Clarity.
- Cliques em CTA.
- Pedidos no `/diagnostico`.

Pausar se:

- Gastou R$ 25 em um canal sem visita qualificada.
- Cliques vieram com menos de 5 segundos de sessao.
- Nenhum clique em CTA depois de 30+ visitas.
- Plataforma sugeriu aumentar orçamento acima do combinado.

Continuar se:

- Teve pedido de diagnostico.
- Teve resposta manual de agencia/social media.
- Teve tempo de pagina razoavel e clique em CTA.
