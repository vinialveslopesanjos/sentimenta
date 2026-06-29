# Relatorio de backfill de analises na VPS - 2026-06-28

## Resumo leigo

Rodamos uma recuperacao em producao para transformar comentarios que estavam sem analise util em comentarios com analise real.

Na primeira rodada, o processo parou porque o OpenRouter voltou erro `402 Payment Required`. Depois que foi colocado credito, trocamos o modelo da VPS para `google/gemma-4-26b-a4b-it` e retomamos o backfill.

Esse erro significa que o provedor de LLM recusou novas chamadas por billing/credito/chave. Quando isso aconteceu, a execucao foi parada para evitar gravar milhares de falhas novas no banco.

Atualizacao de 2026-06-29: a nova rodada com Gemma terminou com 9.033 analises validas novas e apenas 1 comentario processavel ainda sem analise valida.

## O que foi feito na VPS

- Confirmamos que o modelo de producao estava usando `google/gemini-2.5-flash`.
- Confirmamos que a chave OpenRouter existe na VPS, mas depois voltou `402 Payment Required`.
- Depois do credito ser colocado, alteramos o modelo em producao para `google/gemma-4-26b-a4b-it`.
- Recriamos `api`, `worker` e `beat` para carregarem o novo `.env`.
- Copiamos a persona do Jones Instagram para as conexoes Jones YouTube, TikTok e Twitter do mesmo usuario.
- Rodamos backfill com `prompt_version=v2-backfill-20260628`, preservando historico antigo.
- Reprocessamos comentarios sem score valido, sem apagar analises antigas quebradas.
- Recalculamos resumos de 94 posts com base na ultima analise valida por comentario.
- Paramos todos os processos temporarios de backfill ao final.

Observacao de infraestrutura: o `docker-compose.yml` atual da VPS esta desalinhado dos containers reais de producao. Ele tenta buildar a imagem localmente e referencia uma pasta `src/` que nao existe na VPS. Para nao quebrar producao, os containers foram recriados manualmente usando a imagem existente `sentimenta-api:prod`. Isso precisa ser corrigido em um PR/rotina de deploy propria.

## Resultado medido

Antes da rodada, o Jones YouTube tinha 9.080 comentarios com analise valida e 14.074 sem analise valida.

Depois da rodada:

- Jones YouTube passou para 19.137 comentarios com analise valida.
- Foram criadas 10.057 analises validas novas com `prompt_version=v2-backfill-20260628`.
- Foram registradas 10.212 linhas v2 no total; 10.057 validas e 155 invalidas/intermediarias.
- Custo gravado nas linhas v2: cerca de US$ 0,711909.
- Os `pipeline_runs` temporarios ficaram como `partial`, porque a execucao foi interrompida de forma controlada ao detectar erro 402.

Depois da rodada de 2026-06-29 com `google/gemma-4-26b-a4b-it`:

| Perfil | Plataforma | Analises validas Gemma | Erros restantes na rodada | Custo estimado |
|---|---:|---:|---:|---:|
| jonesmanoel | YouTube | 3.795 | 1 | US$ 0,482703 |
| editoramartinclaret | Instagram | 2.799 | 0 | US$ 0,382537 |
| jones.manoel | Instagram | 1.320 | 0 | US$ 0,203755 |
| jonesmanoel | TikTok | 1.076 | 0 | US$ 0,141126 |
| leandrotwin | Instagram | 35 | 0 | US$ 0,004764 |
| sandrofilhoba | Instagram | 3 | 0 | US$ 0,000448 |

Total da rodada Gemma:

- 9.033 analises validas novas.
- 1 comentario processavel ainda sem analise valida.
- Custo estimado total: US$ 1,215434.
- Modelo confirmado dentro do container: `google/gemma-4-26b-a4b-it`.

## O que ainda falta analisar

Antes da rodada Gemma, ainda faltavam estes volumes:

| Perfil | Plataforma | Sem analise valida antes do Gemma |
|---|---:|---:|
| jonesmanoel | YouTube | 4.017 |
| editoramartinclaret | Instagram | 3.299 |
| jonesmanoel | TikTok | 1.502 |
| jones.manoel | Instagram | 1.326 |
| carnelos.lucas | Instagram | 131 |
| leandrotwin | Instagram | 96 |
| vini_alveees | Instagram | 21 |
| sandrofilhoba | Instagram | 10 |
| mazylabs | Instagram | 9 |

Observacoes:

- `vini_alveees` e `mazylabs` ainda estao sem persona, entao nao devem ser analisados automaticamente ate terem contexto.
- `carnelos.lucas` tem 131 comentarios em status `skipped`, principalmente por regra de ignorar comentario do proprio autor.
- Jones TikTok tem 6 posts/comentarios bloqueados por falta de contexto minimo em alguns casos.

Depois da rodada Gemma, o que ainda aparece sem analise valida se divide em dois grupos:

| Tipo | Perfil | Plataforma | Quantidade |
|---|---|---:|---:|
| Ainda processavel, mas falhou no Gemma | jonesmanoel | YouTube | 1 |
| Ignorado por regra de comentario do proprio autor | leandrotwin | Instagram | 61 |
| Ignorado por regra de comentario do proprio autor | vini_alveees | Instagram | 17 |
| Ignorado por regra de comentario do proprio autor | sandrofilhoba | Instagram | 7 |
| Ignorado por regra de comentario do proprio autor | jones.manoel | Instagram | 6 |

Na pratica, para os perfis elegiveis e com contexto, ficou 1 comentario real pendente de analise.

## Causa do bloqueio

O preflight na VPS ainda retorna:

```text
has_score=False
error=402 Payment Required
```

Ou seja: a API do OpenRouter esta recusando chamadas. Enquanto isso nao for resolvido, qualquer backfill real com LLM vai falhar.

Atualizacao de 2026-06-29: depois do credito, o preflight passou com `google/gemma-4-26b-a4b-it`. A chamada minima retornou score valido, modelo correto e custo aproximado de US$ 0,000123.

## Riscos encontrados

- O codigo atual pode considerar uma linha de `comment_analysis` como "ja analisada" mesmo quando `score_0_10` esta nulo.
- Isso deixa comentarios presos: existe linha de analise, mas nao existe analise util para o usuario.
- Logs antigos usam `comments_analyzed` para tentativas, nao apenas para sucessos reais.
- Resumos de posts precisam ser baseados em analises validas, nao em erros.

## Proximo passo

1. Corrigir o deploy/compose da VPS para refletir a producao real.
2. Decidir se queremos manter `google/gemma-4-26b-a4b-it` como modelo padrao; ele funcionou, mas foi bem mais lento em lotes grandes.
3. Investigar o 1 comentario do YouTube que ainda falhou com Gemma.
4. Decidir se comentarios do proprio autor devem continuar ignorados ou se devem receber outro status mais claro, como `ignored_author`.
5. Versionar a rotina de backfill/normalizacao em vez de depender de scripts temporarios em `/tmp`.

## Correcao aplicada na branch local

A branch local foi ajustada para reduzir a chance desse problema voltar:

- `analysis_service` agora considera "ja analisado" apenas quando existe `score_0_10` real.
- Erros de LLM continuam salvos para auditoria, mas nao bloqueiam reprocessamento futuro.
- `analyze_post_comments` agora separa `attempted`, `analyzed` e `errors`.
- Resumos de post ignoram linhas de `comment_analysis` sem score.
- O helper compartilhado `latest_analysis_subquery` agora retorna a ultima analise valida, nao a ultima linha qualquer.
- O dashboard principal passa a contar analisados por analise valida, nao apenas por `comment.status = processed`.

Testes rodados localmente:

```text
uv run --with-requirements requirements.txt python -m pytest -q
53 passed
```
