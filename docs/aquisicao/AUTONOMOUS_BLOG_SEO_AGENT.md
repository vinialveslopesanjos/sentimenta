# Agente autonomo de blog para SEO, GEO e AEO

Data: 2026-06-30

Objetivo: criar um fluxo diario que encontre pautas com demanda real, escreva
materias uteis para o publico do Sentimenta, gere imagem de capa no padrao do
blog, rode QA e publique ou deixe rascunhos prontos no admin sem precisar dar
commit.

Este documento e um plano de arquitetura. Ele nao deve conter senhas, tokens ou
cookies. Credenciais ficam em GitHub Actions Secrets, variaveis da VPS ou em um
cofre de secrets.

## Resposta curta

O melhor caminho nao e um robo abrindo o Chrome todo dia para postar. Isso e
fragil.

O fluxo profissional deve ser:

1. GitHub Actions roda todo dia em horario fixo.
2. Um script pesquisa tendencias e palavras-chave usando APIs confiaveis.
3. O agente escolhe pautas com uma regra de pontuacao.
4. O agente escreve o artigo com fontes citadas e checagens anti-alucinacao.
5. A imagem e gerada por API, salva em storage publico e vinculada ao post.
6. O post e criado como rascunho via API admin do Sentimenta.
7. Um teste Playwright abre o admin e a pagina publica para validar que tudo renderiza.
8. No inicio, um humano aprova. Depois, temas evergreen podem ser publicados automaticamente.

Computer Use ou Playwright entram como fallback para testar a tela e cobrir
fluxos que ainda nao tenham API. Para publicar, a API admin e mais estavel.

## Por que isso importa

SEO e o Google encontrar o blog.

GEO e o conteudo ser facil de ser citado por respostas de IA, como AI Overviews,
ChatGPT, Perplexity e outros mecanismos generativos.

AEO e o conteudo responder perguntas diretamente, de um jeito que possa virar
snippet, FAQ ou resposta curta.

Para o Sentimenta, o ganho esperado e criar uma biblioteca de paginas que
respondem duvidas reais de social medias, agencias, founders e times de marca:

- como analisar comentarios do Instagram;
- como detectar crise de reputacao;
- como transformar comentario em relatorio para cliente;
- como medir sentimento alem de curtidas;
- como priorizar resposta quando um post viraliza mal;
- como provar se uma campanha foi bem recebida.

## Arquitetura recomendada

```text
GitHub Actions cron
  -> scripts/research-blog-topics.mjs
  -> scripts/generate-blog-article.mjs
  -> scripts/generate-blog-cover.mjs
  -> scripts/qa-blog-draft.mjs
  -> POST /api/v1/admin/blog/posts
  -> opcional: POST /api/v1/admin/blog/posts/{id}/publish
  -> Playwright smoke em /dashboard/admin/blog e /blog/{slug}
  -> relatorio como artifact + comentario em issue
```

Componentes:

- GitHub Actions: agenda diaria, logs, artifacts e secrets.
- APIs de pesquisa: Google Search Console, Google Trends/SerpAPI/DataForSEO,
  Google Ads Keyword Planner quando disponivel, Reddit API, YouTube Data API e
  fontes editoriais confiaveis.
- LLM de texto: gera pauta, outline, artigo e metadados.
- OpenRouter/GPT Image 2: gera a capa no estilo visual do blog.
- API admin do Sentimenta: cria, edita, publica e despublica posts.
- Playwright: testa login/admin/blog/renderizacao.

## Onde rodar

Preferencia: GitHub Actions.

Motivo: nao precisa entrar na VPS, tem historico de execucoes, secrets
centralizados, logs, artifacts e permissao controlada.

Cron sugerido:

```yaml
schedule:
  - cron: "0 10 * * *"
```

Isso roda as 10:00 UTC, que corresponde a 07:00 no horario de Sao Paulo.

## Secrets necessarios

Nunca colocar estes valores em arquivo `.md`, commit ou log:

- `SENTIMENTA_API_URL`
- `SENTIMENTA_ADMIN_EMAIL`
- `SENTIMENTA_ADMIN_PASSWORD`
- `SENTIMENTA_ADMIN_TOKEN`, se adotarmos token de servico
- `OPENROUTER_API_KEY`
- `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`
- `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`
- `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN`
- `SERPAPI_API_KEY` ou `DATAFORSEO_*`, se usarmos uma dessas opcoes
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `YOUTUBE_API_KEY`, se usarmos YouTube como fonte
- credenciais de storage para imagens, se nao forem servidas pelo proprio backend

## Fontes de pesquisa

Prioridade 1: fontes proprias e de intencao real.

- Google Search Console do `sentimenta.com.br`.
- Consultas do Google Ads que trouxeram cliques ou impressoes.
- Termos pesquisados no site/blog, se houver analytics interno.
- Posts e comentarios reais analisados pelo Sentimenta, agregados e sem expor PII.

Prioridade 2: demanda externa.

- Google Trends.
- Keyword Planner do Google Ads.
- SerpAPI/DataForSEO para SERP, People Also Ask e autocomplete.
- Reddit, usando comunidades relevantes e sem copiar conteudo.
- YouTube, para perguntas recorrentes sobre social media, reputacao e analytics.

Prioridade 3: fontes de autoridade.

- Google Search Central.
- Meta Business Help Center.
- Think with Google.
- HubSpot, Sprout Social, Hootsuite, Buffer e similares quando o assunto for
  marketing/social media.
- Artigos academicos ou relatorios publicos quando falar de sentimento, NLP ou
  reputacao.

Evitar:

- copiar conteudo de concorrente;
- publicar dado sem fonte;
- citar estatistica sem link;
- usar Reddit como verdade absoluta;
- transformar rumor em fato.

## Como escolher pauta

Cada pauta recebe uma nota de 0 a 100.

Formula inicial:

```text
nota =
  25% intencao de busca
  20% encaixe com o produto
  15% volume ou crescimento recente
  15% facilidade de ranquear
  10% potencial de conversao
  10% confiabilidade das fontes
   5% novidade ou urgencia
```

Regra pratica:

- 80 a 100: pode virar artigo.
- 60 a 79: vira rascunho ou entra no backlog.
- abaixo de 60: descartar.

Temas que provavelmente convertem melhor:

- dor operacional: "como analisar muitos comentarios";
- dor de agencia: "como provar resultado para cliente";
- dor de risco: "como saber se um post virou crise";
- dor de decisao: "o que fazer quando comentarios negativos aumentam";
- comparativos: "analise de sentimento vs social listening";
- guias: "como montar relatorio de reputacao digital".

## Formato do artigo

Todo artigo deve sair com:

- `title`
- `slug`
- `excerpt`
- `seo_title`
- `seo_description`
- `category`
- `persona`
- `tags`
- `cover_image_url`
- `cover_image_alt`
- `cta_label`
- `cta_href`
- `read_time_minutes`
- `body_markdown`

Estrutura recomendada do Markdown:

```markdown
# Titulo claro com a dor principal

Resposta curta em 2 ou 3 frases.

## Por que isso importa

Contexto pratico.

## Como identificar o problema

Lista ou tabela simples.

## O que fazer na pratica

Passo a passo.

## Como o Sentimenta ajuda

Conexao com o produto sem parecer propaganda vazia.

## Perguntas frequentes

### Pergunta real pesquisada

Resposta direta.

## Proximo passo

CTA unico.
```

Regras de escrita:

- escrever em portugues brasileiro correto;
- usar linguagem simples, mas nao infantil;
- abrir com resposta direta;
- explicar termos tecnicos;
- incluir exemplos praticos;
- nao inventar numeros;
- nao fazer promessa que o produto ainda nao cumpre;
- usar negrito em trechos-chave, mas sem exagero;
- preferir frases curtas;
- sempre terminar com um CTA unico.

## SEO, GEO e AEO na pratica

SEO:

- palavra-chave principal no titulo, slug, primeiro paragrafo e meta description;
- links internos para `/`, `/login`, `/blog` e artigos relacionados;
- imagem com alt text descritivo;
- headings claros;
- sitemap atualizado pela pagina publicada;
- schema `BlogPosting` quando suportado pela pagina.

GEO:

- resumo inicial com resposta direta;
- definicoes claras de entidades como "analise de sentimento" e "reputacao digital";
- listas e tabelas que modelos de IA conseguem resumir;
- fontes citadas;
- exemplos concretos;
- evitar texto generico que poderia ser de qualquer SaaS.

AEO:

- secoes em formato pergunta/resposta;
- FAQ no final;
- respostas curtas antes de explicacoes longas;
- perguntas baseadas em People Also Ask, Search Console, Reddit e comentarios reais.

## Imagens de capa

O objetivo e manter consistencia com as capas existentes, nao criar imagem solta
com cara de banco de imagem.

Prompt base:

```text
Clean editorial SaaS blog cover for Sentimenta, a digital reputation analytics
product. Show [visual metaphor] with subtle dashboard elements, comment bubbles,
sentiment signals, and calm strategic decision-making. Use a refined palette with
teal, soft rose, warm amber, off-white, and dark text accents. Modern B2B SaaS
style, premium, minimal, no readable text, no fake logos, no brand names.
```

Variações por tema:

- crise: alertas discretos, comentarios agrupados, painel de risco;
- agencia: relatorio, dashboard e apresentacao para cliente;
- social media: feed, comentarios e priorizacao;
- marca: reputacao, tendencia e sentimento ao longo do tempo.

Saidas esperadas:

- 16:9 para capa do artigo;
- 1:1 opcional para social;
- alt text gerado junto com a imagem;
- nome de arquivo baseado no slug;
- imagem salva em storage publico ou endpoint de midia do backend.

Observacao: antes da implementacao, confirmar o `model id` exato do GPT Image 2
no OpenRouter. O documento nao deve assumir nome de modelo sem verificar a
documentacao atual.

## Publicacao

O Sentimenta ja tem API admin de blog:

```text
POST /api/v1/admin/blog/posts
PATCH /api/v1/admin/blog/posts/{id}
POST /api/v1/admin/blog/posts/{id}/publish
POST /api/v1/admin/blog/posts/{id}/unpublish
GET /api/v1/admin/blog/posts
```

Fluxo recomendado:

1. Criar rascunho via API.
2. Rodar QA de conteudo.
3. Rodar QA visual com Playwright.
4. Se o modo for `draft`, parar.
5. Se o modo for `publish_with_approval`, abrir issue/PR/checklist para humano aprovar.
6. Se o modo for `auto_publish`, publicar apenas se todos os criterios passarem.

Nao usar browser automation para publicar como primeira opcao. Browser automation
deve ser fallback quando a API nao cobre alguma acao.

## QA obrigatorio

QA de conteudo:

- pelo menos 3 fontes confiaveis quando o artigo fizer afirmacoes externas;
- nenhuma estatistica sem fonte;
- nenhum paragrafo copiado de uma fonte;
- sem assunto desalinhado ao Sentimenta;
- slug unico;
- titulo com acentos corretos;
- CTA funcionando;
- sem materia sobre Meta Ads/Google Ads quando nao houver conexao clara com Sentimenta;
- sem promessa de resultado garantido.

QA tecnico:

- criar rascunho com sucesso;
- listar rascunho no admin;
- validar Markdown renderizado;
- validar que imagem carrega;
- validar que links internos retornam 200;
- se publicar, abrir `/blog/{slug}`;
- checar title/meta description;
- rodar screenshot desktop e mobile;
- falhar se houver erro de console relevante.

QA com Playwright:

```text
login -> dashboard/admin/blog -> localizar post -> abrir preview/publicado
```

Computer Use:

- usar apenas quando Playwright nao conseguir lidar com uma tela externa;
- nunca depender de sessao manual do Chrome como unica forma de publicacao diaria;
- registrar screenshot e acao executada.

## Modos de operacao

Modo 1: `research_only`

- pesquisa pautas;
- gera relatorio;
- nao cria post.

Uso: primeira semana, para validar qualidade das pautas.

Modo 2: `draft_only`

- pesquisa;
- escreve;
- gera imagem;
- cria rascunho no admin;
- nao publica.

Uso recomendado no inicio.

Modo 3: `publish_with_approval`

- cria rascunho;
- abre issue com resumo, fontes, imagem e link do admin;
- publica somente depois de aprovacao manual.

Uso recomendado quando o fluxo ja estiver bom.

Modo 4: `auto_publish`

- publica automaticamente apenas temas evergreen e de baixo risco.

Uso somente depois de varias execucoes boas.

## Relatorio diario

Cada execucao deve salvar um artifact JSON:

```json
{
  "date": "2026-06-30",
  "mode": "draft_only",
  "topics_found": 24,
  "topics_selected": 1,
  "selected_topic": "como analisar comentarios negativos no Instagram",
  "score": 86,
  "sources": [
    { "title": "Fonte", "url": "https://..." }
  ],
  "post": {
    "id": "uuid",
    "slug": "como-analisar-comentarios-negativos-instagram",
    "status": "draft",
    "admin_url": "https://sentimenta.com.br/dashboard/admin/blog"
  },
  "qa": {
    "content": "passed",
    "playwright": "passed"
  }
}
```

Tambem deve atualizar uma issue fixa chamada `Blog Automation Inbox` com:

- pauta escolhida;
- motivo da escolha;
- fontes usadas;
- link do rascunho;
- imagem gerada;
- pendencias;
- metricas da execucao.

## Metricas de sucesso

Medir semanalmente:

- novos artigos publicados;
- impressoes no Search Console;
- cliques organicos;
- consultas que geraram impressao;
- posicao media;
- CTR;
- visitas ao CTA;
- cadastros completos vindos do blog;
- artigos que aparecem em respostas/AI Overviews, quando observavel;
- termos que geram conversao ou lead qualificado.

O objetivo nao e publicar muito. O objetivo e publicar paginas que respondem
perguntas reais e aproximam a pessoa de testar o Sentimenta.

## Plano de implementacao

Fase 0: consolidar base atual

- manter `scripts/generate-blog-brief.mjs`;
- manter `scripts/create-blog-draft.mjs`;
- documentar secrets;
- garantir que admin API cria rascunho em producao;
- adicionar script de QA Playwright para admin/blog.

Fase 1: pesquisa diaria

- criar `scripts/research-blog-topics.mjs`;
- integrar Search Console;
- integrar uma fonte de SERP/Trends;
- gerar backlog de pautas com nota;
- nao escrever artigo ainda.

Fase 2: rascunho automatico

- criar `scripts/generate-blog-article.mjs`;
- gerar artigo em Markdown;
- gerar metadados SEO/GEO/AEO;
- criar rascunho via API admin;
- salvar artifact com fontes e justificativa.

Fase 3: imagem

- criar `scripts/generate-blog-cover.mjs`;
- chamar OpenRouter;
- salvar imagem em storage;
- anexar `cover_image_url` ao post;
- validar proporcao e carregamento.

Fase 4: QA e aprovacao

- criar `scripts/qa-blog-draft.mjs`;
- rodar Playwright;
- atualizar issue `Blog Automation Inbox`;
- manter modo `draft_only` ate 5 execucoes boas.

Fase 5: publicacao controlada

- liberar `publish_with_approval`;
- depois liberar `auto_publish` apenas para pautas evergreen;
- manter bloqueio automatico para temas sensiveis, noticias ou claims fortes.

## Decisoes pendentes

Antes de codar, decidir:

1. Frequencia: 1 rascunho por dia ou 3 por semana?
2. Modo inicial: recomendo `draft_only`.
3. Fonte paga de pesquisa: SerpAPI, DataForSEO ou outra.
4. Onde armazenar imagens: storage do backend, S3/R2 ou pasta publica com upload.
5. Quais temas bloquear: Ads, politica, saude, juridico, concorrentes diretos etc.
6. Quem aprova publicacao no inicio.

## Minha recomendacao

Comecar simples:

1. Rodar diario em GitHub Actions.
2. Usar `draft_only`.
3. Criar no maximo 1 rascunho por dia.
4. Usar Search Console + SERP API + Reddit como fontes iniciais.
5. Gerar imagem automaticamente, mas revisar antes de publicar.
6. Exigir 5 execucoes boas antes de qualquer auto-publicacao.

Assim o Sentimenta ganha cadencia de conteudo sem transformar o blog em uma
maquina de publicar texto generico.
