# Auditoria de confiabilidade do pipeline e experiencia SaaS

Data: 2026-06-28
Escopo: logs de pipeline, analise de comentarios, sincronizacao automatica, custo, estados de erro e fluidez do SaaS.
Evidencias usadas: consultas read-only em producao, codigo local e capturas da conta Jones em `artifacts/prod-audit-2026-06-28/`.

## Resposta curta

Nao, um SaaS multi-cliente nao deveria deixar esse tipo de erro passar silenciosamente.

Falhas de coleta, analise, LLM, credito, provider externo ou limite de plano vao acontecer. O erro grave e outro: o produto hoje consegue puxar comentarios, falhar ou pular a analise, e ainda mostrar sinais de sucesso, progresso ou custo como se a promessa principal tivesse sido entregue.

A promessa central da Sentimenta e: dados reais, traceaveis e nao inventados quando ingestao ou analise falham. A auditoria mostra que essa promessa ainda nao esta protegida por contrato tecnico nem por UX.

## Evidencias principais dos ultimos 30 dias

Janela observada em producao: `2026-05-29 02:00:55 UTC` ate `2026-06-28 02:00:55 UTC`.

| Metrica | Valor |
|---|---:|
| Runs em `pipeline_runs` | 213 |
| Runs completed / partial / failed | 127 / 24 / 62 |
| Comentarios puxados reportados pelas runs | 9.647 |
| Comentarios criados em `comments` no periodo | 10.474 |
| `comments_analyzed` reportado pelas runs | 4.692 |
| Analises reais com `score_0_10` | 3.144 |
| Linhas de analise com erro / sem score | 2.374 |
| Custo em `pipeline_runs.total_cost_usd` | US$ 2,196151 |
| Custo em `usage_log.estimated_cost_usd` | US$ 2,040160 |
| Custo em `comment_analysis.cost_estimate_usd` | US$ 0,212260 |

Casos que motivaram a auditoria:

| Perfil | Sintoma |
|---|---|
| `editoramartinclaret` | 1.057 comentarios puxados, 1.057 tentativas de analise, 1.057 erros, 0 analises reais com score. |
| YouTube `jonesmanoel` | 6.523 comentarios puxados nos ultimos 30 dias, 0 analises nas runs, 0 analises reais com score. |
| Instagram `jones.manoel` | Logs exibem `90/90 (100%)` e ao mesmo tempo `90 erros`, o que contradiz a leitura de sucesso. |

## Causas tecnicas provaveis

### 1. "Analisado" significa tentativa, nao analise valida

Em `backend/app/services/analysis_service.py`, a funcao marca comentario como `error` quando o LLM retorna resultado sem score, mas ainda incrementa `stats["analyzed"]`.

Evidencia de codigo:

- `comment.status = "error" if is_error else "processed"` em `analysis_service.py`.
- `stats["analyzed"] += 1` acontece mesmo quando `is_error` e verdadeiro.
- `stats["errors"] += 1` vem depois.

Impacto: a run pode dizer que analisou 1.057 comentarios quando, para o cliente, analisou zero de verdade. O nome correto desse contador seria algo como `analysis_attempted` ou `comments_processed_by_worker`, nao `comments_analyzed`.

### 2. Status `completed` pode significar "nao houve erro", mesmo sem analise

Em `task_daily_sync`, o status final vira:

```py
run.status = "partial" if total_errors > 0 else "completed"
```

Se a pipeline puxar comentarios, mas nao analisar nenhum e nao registrar erro, o status pode virar `completed`.

Impacto: YouTube do Jones pode aparecer como concluido mesmo com milhares de comentarios sem analise real. Isso e pessimo para confianca do cliente, porque o usuario entende "concluido" como "a reputacao foi processada".

### 3. Skips nao viram eventos operacionais visiveis

O scheduler pula conexoes por `auto_sync=false`, frequencia de plano, limite mensal e run concorrente. Muitos desses skips ficam apenas no retorno/log do worker, sem registro auditavel de run para o cliente.

Impacto: o cliente nao sabe se a automacao rodou, pulou, foi pausada, bateu limite ou ficou sem credito. Para um SaaS, isso deveria ser um estado visivel e explicavel.

### 4. `daily_limit` do LLM pode retornar skip sem erro

`analyze_post_comments` retorna:

```py
{"analyzed": 0, "errors": 0, "llm_calls": 0, "skipped_reason": "daily_limit"}
```

Mas os chamadores somam `analyzed`, `errors` e `llm_calls`; o `skipped_reason` nao e promovido para `PipelineRun`.

Impacto: limite de custo pode deixar comentarios pendentes e a run ainda nao parece falha. Isso e bom para proteger custo, mas ruim se nao fica claro para o cliente.

### 5. O frontend usa o campo errado para comunicar sucesso

Em `frontend/app/dashboard/logs/page.tsx`, o card calcula:

```ts
run.comments_analyzed / run.comments_fetched
```

E mostra isso como percentual de "ANALISADOS". Como `comments_analyzed` pode incluir erro e backlog antigo, o frontend consegue mostrar:

- `90/90 (100%)` junto com `90 erros`.
- `2.238/121 (1850%)`.

Impacto: a interface cria uma narrativa de sucesso que contradiz os erros exibidos na mesma tela.

### 6. A tela de logs limita a 50 runs e chama isso de total

`GET /pipeline/runs` usa `.limit(50)`. O frontend soma `runs.length`, `completed` e custo a partir desse retorno.

Impacto: "Execucoes 50", "Concluidas 35" e "Custo total" sao totais da pagina, nao totais do periodo, nem totais da conta. Isso e aceitavel como lista recente, mas nao como auditoria ou uso financeiro.

### 7. Custo tem tres definicoes diferentes

Ha pelo menos tres fontes:

- `pipeline_runs.total_cost_usd`: custo acumulado a partir da analise/LLM em algumas rotas.
- `usage_log.estimated_cost_usd`: estimativa por plataforma e operacao.
- frontend: se `total_cost_usd` vem zero, estima `0.50 / 1000` por comentario.

Impacto: cliente e operador podem ver custo diferente dependendo da tela ou query. Para SaaS pago, custo precisa ter semantica unica: "custo estimado de coleta", "custo LLM", "creditos consumidos", "custo interno total".

## Problemas de UX e fluidez que prejudicam o cliente

### 1. Logs parecem tecnicos, mas nao explicam o que o cliente deve concluir

O cliente ve `PARCIAL`, `ANALISADOS`, `ERROS`, `CUSTO`, mas nao ve uma frase clara:

- "Coletamos comentarios, mas a IA falhou. Seus dashboards nao foram atualizados."
- "Coletamos comentarios do YouTube, mas eles ainda estao aguardando analise."
- "A automacao pulou este perfil porque esta pausado."
- "A automacao pulou por limite de plano/credito."

Sem essa camada, a pessoa precisa interpretar infraestrutura.

### 2. Estados contraditorios aparecem lado a lado

Exemplo observado na conta Jones:

- Card `@jones.manoel`.
- Status `PARCIAL`.
- `ANALISADOS 90/90 (100%)`.
- `90 erros`.

Isso passa uma mensagem ambigua: "deu certo e deu errado". Para usuario, o correto seria "0 analises validas, 90 falharam".

### 3. A pausa automatica existe, mas esta escondida demais

Estado atual:

- Coluna `SYNC AUTOMATICA`.
- Toggle sem texto visivel.
- Sem tooltip, sem `aria-label`, sem confirmacao clara, sem proxima execucao.
- Badge global no topo: "Sincronizacao automatica ativa", mesmo que alguns perfis possam estar pausados.

Impacto: usuario pode pausar sem entender, ou nao encontrar como pausar. Em SaaS pago, isso vira suporte e churn: "por que voces pararam de coletar?".

### 4. "Ativo" e "rodando automaticamente" sao conceitos misturados

Na tabela de perfis, `status=active` aparece como "Ativo". Mas um perfil pode estar ativo e com `auto_sync=false`.

Impacto: "Ativo" pode dar a impressao de que tudo esta rodando, mesmo quando a automacao esta pausada.

### 5. Icones de acao nao dizem o que fazem

Na tabela de perfis e logs ha botoes pequenos de icone para editar, sincronizar, apagar e deletar run. Alguns nao tem nome acessivel claro.

Impacto: risco de apagar historico sem querer, baixa acessibilidade e baixa confianca para usuarios nao tecnicos.

### 6. Delete de log parece facil demais

Na tela de logs ha um botao de lixeira por run. Pelo codigo, ele chama `deleteRun` direto.

Impacto: logs sao auditoria. Deixar cliente apagar run sem confirmacao forte pode remover trilha de diagnostico. Se existir delete, deve ter confirmacao e talvez distinguir "ocultar da minha tela" de "apagar registro".

### 7. Twitter aparece ativo, mas a sync retorna zero

No backend, `_do_ingest` para Twitter retorna `{"skipped": "twitter_disabled"}`. Mesmo assim conexoes Twitter podem aparecer ativas e elegiveis.

Impacto: usuario acha que Twitter esta operando, mas o pipeline nao coleta. Isso precisa aparecer como "indisponivel" ou "pausado pelo sistema".

### 8. Mensagens misturam diario e semanal

O `daily_sync` escreve "Sync semanal iniciado" mesmo para a rotina diaria. O Celery tem `daily-sync` e `weekly-sync`, ambos chamam `task_daily_sync` com filtros diferentes.

Impacto: logs ficam confusos para suporte e cliente. Parece pequeno, mas em incidentes esses detalhes importam.

### 9. Creditos e custo nao fecham narrativamente

Sidebar mostra `955.184 cred.` para Jones. Logs mostram custo em R$. Billing mostra creditos. Pipeline usa custo em USD.

Impacto: cliente nao entende se esta pagando por comentarios puxados, analisados, tentativas, perfis demograficos ou custo interno.

## Recomendacao de contrato de dados

Separar os contadores em nomes que nao mentem:

| Campo recomendado | Significado |
|---|---|
| `comments_fetched` | Comentarios novos/coletados pela run. |
| `analysis_attempted` | Comentarios enviados/processados pelo worker de analise, incluindo erro. |
| `analysis_succeeded` | Comentarios com `score_0_10 is not null` e status `processed`. |
| `analysis_failed` | Comentarios que chegaram na etapa de analise mas terminaram em erro. |
| `analysis_skipped` | Comentarios nao analisados por limite, pausa, sem credito, provider indisponivel ou regra de filtro. |
| `pending_after_run` | Comentarios ainda pendentes ao final. |
| `run_health` | `success`, `warning`, `failed`, `blocked`, `paused`, `skipped`. |
| `customer_message` | Frase curta que explica o estado em linguagem humana. |

Regra de ouro:

Uma run so deveria ser `completed` quando todos os estagios obrigatorios para aquela promessa foram concluidos ou explicitamente nao eram aplicaveis. Se puxou comentario e nao analisou, no minimo e `warning/partial`, com motivo.

## Recomendacao para status do pipeline

Criar estados mais expressivos:

- `completed`: coleta e analise validas terminaram dentro do esperado.
- `completed_no_new_data`: rodou, mas nao havia comentarios novos.
- `partial_analysis_failed`: coletou, mas parte da analise falhou.
- `analysis_blocked`: coletou, mas analise nao rodou por limite/credito/provider.
- `skipped_paused`: automacao pausada pelo usuario.
- `skipped_plan_frequency`: nao era o dia/frequencia do plano.
- `failed_ingest`: coleta falhou.
- `failed_analysis`: analise falhou de modo sistemico.

Isso permite que o frontend seja simples e honesto.

## Como deixar a pausa automatica explicita

### Onde fica hoje

Hoje a pausa fica como toggle na coluna `SYNC AUTOMATICA`, sem texto no controle.

### Proposta de UX

Trocar a coluna por um bloco textual:

**Automacao**

Estado ligado:

```text
Rodando automaticamente
Proxima coleta: hoje, 00:15
Botao: Pausar automacao
```

Estado pausado:

```text
Pausado
Este perfil nao sera coletado automaticamente.
Botao: Retomar automacao
```

Ao clicar em pausar:

```text
Pausar automacao de @perfil?

A Sentimenta deixara de buscar novos comentarios automaticamente.
Os dados existentes continuam visiveis. Voce ainda pode rodar uma coleta manual.

[Cancelar] [Pausar automacao]
```

Ao clicar em retomar:

```text
Automacao retomada
A proxima coleta seguira a frequencia do seu plano.
```

### Detalhes importantes

- O toggle deve ter `aria-label`: `Pausar automacao de @perfil` ou `Retomar automacao de @perfil`.
- A tabela deve mostrar "Ativo" separado de "Automacao".
- O badge global deve virar resumo real: `8 rodando automaticamente, 3 pausados`.
- O dashboard deve mostrar aviso discreto se um perfil selecionado estiver pausado.
- Logs devem incluir eventos de pausa/retomada, mesmo que nao sejam runs de coleta.

## Recomendacoes priorizadas

### P0 - Proteger a verdade do produto

1. Renomear/reestruturar contadores para separar tentativa, sucesso real e erro.
2. Mudar status final de runs: comentarios puxados + zero analises validas nao pode ser `completed` sem explicacao.
3. Fazer `skipped_reason` virar campo persistido em `pipeline_runs` ou tabela de eventos.
4. Corrigir logs para mostrar "analises validas" e "falhas", nao `comments_analyzed/comments_fetched`.
5. Criar alerta interno quando `comments_fetched > 0` e `analysis_succeeded = 0`.

### P1 - Tornar o sistema operavel

1. Adicionar endpoint agregado de runs com `from`, `to`, `connection_id`, `status`, `run_type`.
2. Expor totals de 30 dias/mes no backend, em vez de somar os 50 itens recentes no frontend.
3. Padronizar custo: coleta, LLM, creditos e total interno.
4. Persistir eventos de skip: pausa, plano, limite, sem credito, provider indisponivel.
5. Mostrar pendencias por perfil: `X comentarios aguardando analise`.

### P1 - Corrigir fluidez do cliente

1. Redesenhar coluna de automacao com texto, proxima execucao e acao clara.
2. Adicionar confirmacao para apagar logs ou remover a acao de delete para usuarios comuns.
3. Nomear todos os botoes de icone com `aria-label` e tooltip.
4. Mostrar estados de erro com proxima acao: "tentar novamente", "ver detalhes", "falar com suporte".
5. Corrigir copy `Sync semanal iniciado` quando for rotina diaria.

### P2 - Melhorar confianca e suporte

1. Criar tela "Saude das fontes" por perfil: ultima coleta, ultima analise valida, pendentes, erros, proxima automacao.
2. Criar relatorio exportavel para suporte/admin: runs, comentarios, analises reais, custos, creditos.
3. Criar testes deterministas para casos:
   - LLM retorna score nulo.
   - Comentarios coletados mas analise pula por limite.
   - Comments fetched > 0 e analysis succeeded = 0.
   - Auto-sync pausado.
   - API de logs nao deve chamar 50 itens de "total".

## Perguntas que ainda precisam de investigacao

1. Por que exatamente o YouTube do Jones nao entrou na analise apesar de criar comentarios pendentes?
   - Hipoteses: skip silencioso por limite, query de posts pendentes nao enxergando dados no momento certo, estado pendente antigo nao reprocessado no daily, ou regra/filtro da analise.
   - O confirmado e: a UI/backend permitiram concluir run com comentarios coletados e zero analises.

2. Por que Martin Claret teve 100% de erro na analise?
   - Hipoteses: retorno invalido do LLM, problema de prompt/payload, limite, excecao batch-level ou formato de comentario.
   - O confirmado e: os comentarios passaram pela etapa de analise, mas nenhum virou analise valida com score.

3. O sistema cobra creditos por tentativas com erro?
   - O codigo consome creditos usando `total_analyzed`, que hoje inclui tentativas com erro.
   - Isso precisa ser confirmado e corrigido para cobrar apenas sucesso real ou ter uma regra comercial explicita.

## Definicao de pronto recomendada

Para uma run aparecer como sucesso para cliente:

1. A coleta terminou sem erro critico.
2. Comentarios novos foram persistidos ou foi registrado que nao havia novos comentarios.
3. Se havia comentarios pendentes, a analise gerou `score_0_10` para eles ou registrou motivo explicito de skip/falha.
4. O dashboard foi atualizado apenas com analises validas.
5. O log mostra contadores consistentes:
   - coletados,
   - analises validas,
   - falhas,
   - pendentes,
   - custo/creditos.

## Capturas relacionadas

- `artifacts/prod-audit-2026-06-28/jones-connect-auto-sync.png`
- `artifacts/prod-audit-2026-06-28/jones-logs-page.png`
