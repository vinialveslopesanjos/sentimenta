# Runbook: blog semanal do Sentimenta

Data: 2026-06-28

Objetivo: manter um fluxo semanal de conteudo que alimente SEO, Instagram, Google Ads e Meta Ads sem depender de improviso.

## Resposta direta: precisa de commit para postar?

Hoje, sim, se o post mora no repositorio.

O blog agora usa dados estruturados em:

```text
frontend/lib/blog.ts
frontend/app/blog/page.tsx
frontend/app/blog/[slug]/page.tsx
```

Adicionar um artigo em `frontend/lib/blog.ts` exige commit e deploy/build.

## Como postar sem mexer no repositorio

Para publicar sem commit, o conteudo precisa morar fora do build do Next.js. Opcoes:

1. CMS headless
   - Exemplos: Sanity, Contentful, Strapi, Directus.
   - Melhor quando voce quer editor visual, rascunho e publicacao sem Git.

2. Banco de dados do proprio Sentimenta
   - Criar tabela `blog_posts`.
   - Criar tela admin para cadastrar artigo.
   - Melhor quando voce quer controlar tudo no produto.

3. Markdown em storage
   - Exemplo: arquivos em S3/R2 lidos em runtime.
   - Mais simples que CMS, menos confortavel para editar.

Recomendacao atual: comecar com arquivo no repo por 2 a 4 semanas. Quando ficar claro que o blog sera recorrente, migrar para CMS ou tabela.

## Fluxo semanal recomendado

Existe um agendamento inicial em:

```text
.github/workflows/weekly-blog-brief.yml
```

Ele roda toda segunda-feira ao meio-dia UTC e tambem pode ser disparado manualmente no GitHub Actions. O workflow gera um brief em JSON como artefato revisavel. Ele nao publica artigo, nao chama API paga e nao faz commit automatico.

### Segunda

Escolher pauta com base em uma dor:

- "Como saber se comentarios viraram crise?"
- "Como provar para cliente que a campanha foi bem recebida?"
- "Como ler comentarios de Instagram sem perder horas?"
- "Como encontrar temas de conteudo nos comentarios?"

### Terca

Gerar pesquisa e rascunho:

```powershell
node scripts/generate-blog-brief.mjs --topic "comentarios negativos no Instagram" --persona "social-media"
```

O script nao publica. Ele cria um brief para revisao humana.

### Quarta

Escrever artigo curto:

- 700 a 1200 palavras.
- Sem jargao de IA.
- Um problema por artigo.
- Um CTA unico.
- Nenhum dado inventado.

### Quinta

Gerar imagem:

Prompt base:

```text
Pastel vector editorial illustration for a SaaS blog article about [topic].
Show [main visual metaphor].
No readable text, no logos, no fake UI brand names.
Soft teal, rose, and warm amber palette.
Clean modern B2B SaaS style.
```

As capas publicadas no site ficam em:

```text
frontend/public/blog/
```

O campo `heroImage` em `frontend/lib/blog.ts` aponta para esses assets.

### Sexta

Publicar e distribuir:

- Blog.
- LinkedIn pessoal.
- Instagram carrossel.
- 5 mensagens manuais para agencias.
- 1 criativo para testar em Meta Ads.

## Checklist de publicacao

- Titulo fala a dor.
- URL contem termo buscavel.
- Excerpt explica ganho real.
- CTA tem UTM.
- Post tem `date` e `updatedAt`.
- Artigo tem schema `BlogPosting`.
- Sitemap inclui a URL.
- Imagem nao contem texto pequeno ilegivel.
- Nenhuma metrica foi inventada.

## Pautas das proximas 4 semanas

1. Como saber se os comentarios do Instagram estao virando risco.
2. Relatorio para cliente alem de curtidas e alcance.
3. Como uma agencia pode vender analise de sentimento como upsell.
4. O que responder quando um post recebe criticas repetidas.

## Quando ligar Ads em cima do blog

Somente depois de:

- Clarity instalado.
- Sitemap publicado.
- Pelo menos 3 artigos no ar.
- CTA funcionando.
- UTM padronizada.

Ads antes disso tende a gerar clique sem aprendizado.
