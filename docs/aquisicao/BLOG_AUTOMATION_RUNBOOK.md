# Runbook: blog semanal do Sentimenta

Data: 2026-06-28

Objetivo: manter um fluxo semanal de conteudo que alimente SEO, Instagram, Google Ads e Meta Ads sem depender de improviso.

## Resposta direta: precisa de commit para postar?

Nao para posts novos.

O blog agora le posts publicados da API:

```text
GET /api/v1/blog/posts
GET /api/v1/blog/posts/{slug}
```

O conteudo editavel mora na tabela `blog_posts`. A tela admin em
`/dashboard/admin/blog` permite criar rascunho, editar, publicar e despublicar
sem commit. O arquivo `frontend/lib/blog.ts` permanece apenas como fallback caso
a API esteja fora do ar.

## Como postar sem mexer no repositorio

Fluxo recomendado:

1. Acessar `/dashboard/admin/blog` com uma conta `admin`.
2. Criar um novo rascunho.
3. Preencher titulo, slug, resumo, categoria, persona, tags, capa, CTA e corpo em Markdown.
4. Salvar.
5. Revisar o preview.
6. Publicar.

O post publicado aparece em `/blog` e `/blog/{slug}` em runtime.

## Criar rascunho a partir do brief

O workflow semanal gera um JSON com `adminPayload`. Para criar rascunho via API:

```powershell
node scripts/generate-blog-brief.mjs --weekly --out output/blog-briefs/weekly-blog-brief.json
$env:SENTIMENTA_ADMIN_TOKEN="token-admin"
node scripts/create-blog-draft.mjs --input output/blog-briefs/weekly-blog-brief.json --api http://127.0.0.1:8000
```

Esse script cria rascunho. Ele nao publica.

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

- Blog via `/dashboard/admin/blog`.
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
