# Runbook: automacao de blog via admin

Data: 2026-07-01

Objetivo: orientar um agente autonomo a publicar artigos novos no blog do
Sentimenta usando o navegador e a tela admin, sem commit, sem PR, sem GitHub
Actions e sem deploy.

Documento principal do agente:

```text
docs/aquisicao/AUTONOMOUS_BLOG_SEO_AGENT.md
```

Para evoluir este fluxo para um agente diario com pesquisa de tendencias,
geracao de imagem, QA e publicacao controlada, veja
`docs/aquisicao/AUTONOMOUS_BLOG_SEO_AGENT.md`.

## Resposta direta: precisa de commit para postar?

Nao.

Posts novos do blog sao criados pelo admin e salvos no banco. O codigo do site
so precisa mudar quando formos alterar layout, componente, regra de negocio ou
funcionalidade.

Para artigo novo, o fluxo correto e:

```text
pesquisar -> escrever -> revisar formatacao -> gerar imagem nova -> entrar no admin -> publicar -> validar
```

## Como o blog funciona

O blog publico le posts publicados da API:

```text
GET /api/v1/blog/posts
GET /api/v1/blog/posts/{slug}
```

O conteudo editavel mora no banco, na tabela de posts do blog.

A tela admin fica em:

```text
https://sentimenta.com.br/dashboard/admin/blog
```

Ela permite:

- criar rascunho;
- editar artigo;
- preencher imagem, titulo, resumo, categoria, persona, tags e corpo;
- publicar;
- voltar para rascunho;
- abrir o artigo publicado.

Ela nao deve ser usada para editar textos estruturais da pagina do blog. A
estrategia agora e: admin mexe em artigos, nao na pagina.

## Links fixos

```text
Site: https://sentimenta.com.br
Blog: https://sentimenta.com.br/blog
Login: https://sentimenta.com.br/login
Admin blog: https://sentimenta.com.br/dashboard/admin/blog
```

## Credenciais

Nao colocar senha neste arquivo.

O agente precisa receber:

```text
SENTIMENTA_ADMIN_EMAIL
SENTIMENTA_ADMIN_PASSWORD
OPENROUTER_API_KEY
```

A conta precisa ter permissao `admin`.

## Ordem de automacao

O agente deve tentar:

1. Computer Use
2. Chrome controlado pelo Codex
3. Playwright

Se uma ferramenta falhar, tentar a proxima.

Se todas falharem, parar e relatar:

- ferramenta usada;
- pagina onde travou;
- botao/campo que nao funcionou;
- evidencia ou screenshot;
- acao manual necessaria.

## Fluxo diario recomendado

### 1. Ler o blog antes de criar

Abrir:

```text
https://sentimenta.com.br/blog
```

Objetivo:

- ver artigos ja publicados;
- evitar repeticao;
- entender tom e estilo;
- encontrar lacunas.

Tambem pode consultar:

```text
https://sentimenta.com.br/api/v1/blog/posts
```

### 2. Pesquisar pauta

Pesquisar no Google, Reddit, YouTube e fontes confiaveis.

Temas prioritarios:

- analise de sentimento;
- reputacao digital;
- comentarios negativos;
- crise de imagem;
- social listening;
- relatorio para cliente;
- agencias de social media;
- comentarios de Instagram, YouTube, TikTok e X/Twitter;
- como transformar comentarios em decisao;
- como medir percepcao de campanha.

Evitar:

- artigo generico sobre Google Ads;
- artigo generico sobre Meta Ads;
- noticia politica;
- assunto juridico;
- promessa exagerada de resultado;
- tema que nao conecte com comentarios, reputacao ou sentimento.

### 3. Escolher a pauta

So seguir se a pauta tiver:

- dor clara;
- busca provavel;
- conexao direta com Sentimenta;
- angulo diferente dos posts existentes;
- fontes confiaveis.

Se o tema parecer fraco, escolher outro.

### 4. Escrever o artigo

Padrao:

- 800 a 1400 palavras;
- portugues brasileiro;
- titulo direto;
- resposta curta no inicio;
- subtitulos claros;
- exemplo pratico;
- FAQ;
- CTA unico;
- sem dado inventado;
- sem copiar fontes.
- sem tabelas em pipe Markdown.

Importante sobre tabelas:

- o blog publico hoje renderiza Markdown basico;
- tabelas em pipe Markdown (`| coluna | coluna |`) podem aparecer quebradas como
  texto literal;
- se precisar comparar informacoes, usar subtitulos e bullets;
- se o preview mostrar `|`, `---` ou tabela sem formatacao, reescrever antes de
  publicar;
- se uma tabela for indispensavel, salvar como rascunho e registrar que o blog
  precisa de suporte a tabelas/GFM.

CTA padrao:

```text
Fazer diagnostico gratuito
```

Link do CTA:

```text
/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign={slug}
```

### 5. Gerar a imagem

Usar OpenRouter com `OPENROUTER_API_KEY`.

A imagem deve ser a ultima etapa criativa: primeiro escrever e revisar o artigo,
depois gerar a capa com base no conteudo final.

Estilo:

- editorial SaaS;
- limpo;
- premium;
- cores do Sentimenta;
- dashboard discreto;
- comentarios;
- sinais de sentimento;
- sem texto legivel;
- sem logo falso.
- sempre nova, sem repetir capa de outro post;
- especifica para a dor e o exemplo do artigo.

Prompt base:

```text
Clean editorial SaaS blog cover for Sentimenta, a digital reputation analytics
product. Article title: [title]. Core reader pain: [pain]. Main idea: [one-line
thesis]. Show [specific visual scene from the article], subtle dashboard
elements, public comment bubbles, sentiment signals, reputation score, and a calm
strategic decision-making environment. Premium modern B2B SaaS style. Refined
palette with teal, off-white, soft rose, warm amber, and dark text accents. New
composition distinct from existing Sentimenta blog covers. No readable text, no
fake logos, no brand names, no watermark.
```

Se nao conseguir gerar/subir imagem:

- nao publicar usando capa antiga repetida;
- salvar como rascunho;
- registrar no relatorio que falta hospedar/subir a imagem nova.

### 6. Postar no admin

Abrir:

```text
https://sentimenta.com.br/dashboard/admin/blog
```

Passos:

1. fazer login se necessario;
2. clicar em `Novo rascunho`;
3. preencher os campos;
4. conferir preview;
5. clicar em `Criar e publicar` ou `Salvar e publicar`;
6. esperar mensagem de sucesso.

Campos:

- Titulo;
- Slug;
- Resumo;
- Categoria;
- Persona;
- Tags;
- URL da capa;
- Alt da capa;
- CTA;
- Link do CTA;
- SEO title;
- SEO description;
- Corpo em Markdown.

Observacao: o corpo em Markdown precisa ter pelo menos 80 caracteres.

### 7. Validar publicacao

Depois de publicar:

1. abrir o artigo publicado;
2. confirmar que o titulo esta correto;
3. confirmar que a imagem carregou;
4. confirmar que o corpo apareceu;
5. clicar no CTA;
6. voltar para `/blog`;
7. confirmar que o artigo aparece na listagem.

## Checklist antes de publicar

```text
[ ] li os artigos ja publicados
[ ] a pauta nao esta repetida
[ ] o titulo fala uma dor real
[ ] o slug esta limpo
[ ] o resumo explica o ganho
[ ] o corpo tem pelo menos 80 caracteres
[ ] o artigo tem resposta curta no inicio
[ ] o artigo tem exemplo pratico
[ ] o artigo tem FAQ
[ ] o preview nao mostra tabela quebrada, pipes `|` ou linhas `---` soltas
[ ] o CTA esta correto
[ ] a imagem e nova, contextual e diferente das capas existentes
[ ] a imagem carrega
[ ] nao ha dado inventado
[ ] fontes foram consultadas
```

## Checklist depois de publicar

```text
[ ] URL publica abriu
[ ] titulo correto
[ ] imagem carregou
[ ] corpo renderizou
[ ] CTA funciona
[ ] artigo aparece em /blog
[ ] agente registrou fontes usadas
[ ] agente registrou proxima pauta sugerida
```

## Quando salvar como rascunho em vez de publicar

Salvar como rascunho se:

- o assunto for sensivel;
- houver duvida sobre fontes;
- a imagem ficar ruim;
- a imagem nova nao puder ser hospedada e a unica alternativa for repetir capa
  antiga;
- a tabela ou comparativo aparecer quebrado no preview;
- o conteudo parecer repetido;
- o admin der erro;
- o CTA nao funcionar;
- a pagina publicada nao abrir;
- o artigo depender de revisao humana.

## Relatorio esperado

Ao terminar, o agente deve responder:

```text
Publicado: sim/nao
Titulo:
Slug:
URL:
Pauta:
Por que essa pauta:
Fontes:
Imagem:
Validacao:
Problemas:
Proxima pauta sugerida:
```

## Exemplo de tarefa para o agente

```text
Rode o fluxo do Autonomous Blog CEO Agent.

Use Computer Use. Se falhar, use Chrome. Se falhar, use Playwright.

Pesquise uma pauta nova sobre reputacao digital, analise de sentimento ou
comentarios em redes sociais. Antes de escrever, confira o que ja existe em
https://sentimenta.com.br/blog para nao repetir assunto.

Escreva um artigo de 800 a 1400 palavras em portugues brasileiro, gere uma capa
com OpenRouter no estilo do Sentimenta depois do texto final, publique pelo admin em
https://sentimenta.com.br/dashboard/admin/blog e valide a URL publicada.

Nao abra PR. Nao faça deploy. Nao mexa no repositorio.

Nao use tabelas em pipe Markdown. Se precisar comparar informacoes, use blocos
com subtitulos e bullets. Nao publique capa repetida de outro post; se a capa
nova nao tiver URL publica, salve como rascunho e explique.

No final, me entregue o link publicado, fontes usadas e a validacao.
```

## Melhorias futuras

Depois que esse fluxo estiver confiavel, podemos automatizar partes por API:

- consultar posts existentes pela API;
- criar rascunho pela API;
- publicar pela API;
- usar Playwright apenas para validar visualmente.

Por enquanto, a estrategia e propositalmente simples: agir como um editor humano
usando o admin.
