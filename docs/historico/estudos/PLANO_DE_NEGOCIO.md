# Sentimenta — Plano de Negocio

## 1. O Problema

Pessoas publicas (influenciadores, politicos, profissionais liberais) recebem centenas ou milhares de comentarios por dia nas redes sociais. Elas nao conseguem:

- Ler e processar todos os comentarios manualmente
- Identificar crises de reputacao antes que explodam
- Entender o sentimento geral do publico de forma objetiva
- Medir o impacto de acoes (posts, discursos, campanhas) na percepcao publica

Ferramentas de social listening existentes (Brandwatch, Sprinklr, Buzzmonitor) sao **B2B enterprise**, custam milhares de reais por mes, e nao sao pensadas para pessoa fisica.

## 2. A Solucao

**Sentimenta** e uma plataforma SaaS que permite ao dono de um perfil conectar suas redes sociais via OAuth e receber analises automaticas de sentimento dos comentarios que recebe.

### Proposta de Valor

> O unico sistema que permite que voce, dono do seu perfil, acesse e analise 100% dos comentarios que recebe, transformando feedback em insights acionaveis para proteger e melhorar sua reputacao digital.

### Diferenciais

| Sentimenta | Concorrentes (Brandwatch, Sprinklr) |
|-----------|--------------------------------------|
| Focado em **pessoa fisica** | Focado em marcas/empresas |
| OAuth — acessa dados do proprio usuario | Scraping ou APIs pagas |
| Preco acessivel (a partir de R$ 79/mes) | R$ 3.000+ /mes |
| Analise profunda por comentario (LLM) | Analise superficial por keywords |
| Setup em 2 minutos (conecta e pronto) | Semanas de onboarding |

### Como Funciona

```
1. Usuario cria conta (email ou Google)
2. Conecta Instagram (OAuth) e/ou YouTube (nome do canal)
3. Sistema coleta posts e comentarios automaticamente
4. IA (Gemini) analisa cada comentario:
   - Score de sentimento (0-10)
   - Emocoes (alegria, raiva, medo, etc)
   - Topicos mencionados
   - Deteccao de sarcasmo
5. Dashboard mostra resumo, tendencias e alertas
```

## 3. Publico-Alvo

### Persona 1: Politico Local

- **Exemplo**: Deputado Carlos, 45 anos
- **Dor**: Nao sabe o que eleitores pensam dele; crises de reputacao repentinas; dificuldade de medir impacto de discursos
- **Necessidade**: Alertas de sentimento negativo, analise por tema, comparacao temporal
- **Disposicao a pagar**: R$ 500 - 2.000/mes
- **Volume estimado**: ~10.000 politicos no Brasil (vereadores, deputados, prefeitos)

### Persona 2: Influenciador Digital

- **Exemplo**: Ana, blogueira fitness, 28 anos, 500K seguidores
- **Dor**: Perda de contratos por crises de reputacao; haters organizados; nao entende por que perde seguidores
- **Necessidade**: Score de reputacao, alertas de hate massivo, identificacao de padroes
- **Disposicao a pagar**: R$ 100 - 500/mes
- **Volume estimado**: ~500.000 criadores de conteudo monetizaveis no Brasil

### Persona 3: Profissional Liberal

- **Exemplo**: Dr. Joao, nutricionista, 35 anos, 50K seguidores
- **Dor**: Reviews negativos afetam consultorio; dificuldade de acompanhar o que pacientes dizem online
- **Necessidade**: Monitoramento de mencoes, analise de satisfacao, relatorios para marketing
- **Disposicao a pagar**: R$ 80 - 200/mes
- **Volume estimado**: ~2M profissionais liberais (medicos, advogados, coaches)

### Segmentacao Secundaria (B2B)

- Assessorias de imprensa (gestao de crises para clientes)
- Agencias de marketing (relatorios de reputacao)
- Partidos politicos (monitoramento de base de deputados)

## 4. Mercado e Concorrencia

### Players Globais (Enterprise)

| Empresa | Foco | Preco | Publico |
|---------|------|-------|---------|
| Brandwatch | Social listening | $800+/mes | Empresas |
| Sprinklr | CXM enterprise | Custom ($$$) | Grandes marcas |
| Hootsuite | Gestao de redes | R$ 150-800/mes | Empresas |
| Sprout Social | Analytics | $250+/mes | Empresas |
| Meltwater | Media monitoring | $400+/mes | Empresas |

### Players no Brasil

| Empresa | Preco | Avaliacao |
|---------|-------|-----------|
| Buzzmonitor | R$ 1.500+/mes | Boa, mas B2B enterprise |
| STILINGUE | Custom | Enterprise, foco em marcas |
| Seekr | R$ 200+/mes | Foco em marcas, nao pessoa fisica |

**Gap identificado**: Nenhum player foca em **reputacao pessoal (B2C)** com preco acessivel.

### Tamanho do Mercado

```
TAM (Total Addressable Market):
  Creators monetizaveis: 500.000
  Profissionais liberais digitais: 2.000.000
  Politicos + assessores: 15.000
  Total: ~2,5M pessoas
  Ticket medio: R$ 150/mes
  TAM: R$ 4,5B/ano

SAM (Serviceable Addressable Market):
  Early adopters (5%): 125.000 pessoas
  Ticket medio: R$ 200/mes
  SAM: R$ 300M/ano

SOM (Serviceable Obtainable Market) - Ano 1:
  Meta realista: 500 clientes
  Ticket medio: R$ 180/mes
  MRR: R$ 90.000
  ARR: R$ 1,08M
```

### Indicadores de Demanda

- 73% dos influencers brasileiros ja sofreram cancelamento (2023)
- 89% dos politicos brasileiros usam redes sociais para campanha
- Mercado de creator economy no Brasil: R$ 8,7B (2023), crescimento de 25% ao ano

## 5. Modelo de Negocio

### Pricing

| Plano | Preco | Inclui |
|-------|-------|--------|
| **Starter** | R$ 79/mes | 1 rede social, analise diaria, 1.000 comentarios/mes, dashboard basico |
| **Pro** | R$ 199/mes | 3 redes sociais, analise em tempo real, alertas de crise, 10.000 comentarios/mes, API access |
| **Enterprise** | R$ 599/mes | Redes ilimitadas, historico 2 anos, white-label, webhooks, 100.000 comentarios/mes |
| **Politico** | R$ 1.500+/mes | Monitoramento de mencoes, analise de concorrentes, relatorios para imprensa, suporte 24/7 |

### Projecao Financeira (3 anos)

| Metrica | Ano 1 | Ano 2 | Ano 3 |
|---------|-------|-------|-------|
| Clientes pagantes | 150 | 800 | 2.500 |
| MRR | R$ 25K | R$ 140K | R$ 450K |
| ARR | R$ 300K | R$ 1,68M | R$ 5,4M |
| Churn mensal | 8% | 5% | 4% |
| CAC | R$ 150 | R$ 100 | R$ 80 |
| LTV | R$ 1.200 | R$ 2.000 | R$ 3.500 |
| Time | 3 pessoas | 8 pessoas | 15 pessoas |
| Burn rate | R$ 40K/mes | R$ 120K/mes | R$ 300K/mes |

**Break-even estimado**: Mes 14 (Ano 2).

### Custos de Infraestrutura

| Item | MVP | Escala |
|------|-----|--------|
| Servidores (AWS/GCP) | R$ 500/mes | R$ 5.000/mes |
| Banco de dados | R$ 200/mes | R$ 1.500/mes |
| APIs (Twitter, etc) | R$ 2.000/mes | R$ 10.000/mes |
| LLM (Gemini) | R$ 1.000/mes | R$ 8.000/mes |
| Monitoramento | R$ 100/mes | R$ 500/mes |
| **Total** | **R$ 3.800/mes** | **R$ 25.000/mes** |

## 6. Viabilidade Tecnica

### APIs Oficiais Disponiveis

| Plataforma | Metodo | Dados Acessiveis | Status |
|------------|--------|-------------------|--------|
| Instagram | Graph API (OAuth) | Posts, comentarios, insights, stories | Implementado |
| YouTube | yt-dlp (scraping) | Videos, comentarios, metadados | Implementado |
| Twitter/X | API v2 | Tweets, replies, mencoes | Planejado |
| TikTok | TikTok API | Perfil, videos, comentarios | Planejado |

### Viabilidade Legal (LGPD)

O modelo e **100% legal** porque:

- O usuario e o **dono dos dados** (titular)
- Consentimento explicito via OAuth
- Dados nao sao compartilhados com terceiros
- Usuario pode solicitar exclusao a qualquer momento
- Tokens criptografados com AES-256

## 7. Estrategia Go-to-Market

### Fase 1: Beta fechado (Mes 1-3)

- 20 influenciadores pequenos (gratis)
- 5 politicos (gratis em troca de feedback)
- Coleta de depoimentos e case studies

### Fase 2: Crescimento (Mes 4-12)

1. **Parcerias com agencias de marketing** (comissao 20%)
2. **Cold outreach** para politicos via assessores
3. **Content marketing**: Blog sobre gestao de reputacao
4. **Indicacao**: Creditos para quem indicar
5. **Eventos**: Palestras em congressos de marketing politico

### Posicionamento

- **Nao e**: "Mais uma ferramenta de social media"
- **E**: "Seu guarda-costas digital contra crises de reputacao"

> Voce nao pode controlar o que as pessoas dizem, mas pode controlar como reage. Sentimenta alerta voce sobre crises antes que elas explodam.

## 8. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| APIs mudarem ToS | Media | Alto | Diversificar fontes de dados |
| Concorrencia big tech | Baixa | Alto | Foco nicho (pessoa fisica), agilidade |
| Dificuldade OAuth Instagram | Media | Medio | YouTube como alternativa inicial |
| Baixa adocao inicial | Media | Alto | Beta gratuito, case studies |
| Custos de API altos | Media | Medio | Cache, batching, modelos baratos |
| Privacidade/LGPD | Baixa | Alto | Compliance desde o inicio |

## 9. Roadmap do Produto

### MVP (implementado)

- [x] Auth (email+senha + Google OAuth)
- [x] Instagram OAuth + Graph API
- [x] YouTube scraping (yt-dlp)
- [x] Pipeline de analise com Gemini
- [x] Dashboard basico com score, emocoes, topicos
- [x] Docker Compose (PostgreSQL + Redis + Celery)

### Fase 2 (proximo trimestre)

- [ ] Twitter/X integration
- [ ] Alertas de crise em tempo real
- [ ] Analise temporal (historico de reputacao)
- [ ] Stripe/Pagar.me (pagamentos)
- [ ] Deploy producao (AWS/GCP)

### Fase 3 (6 meses)

- [ ] TikTok integration
- [ ] White-label para assessorias
- [ ] API publica
- [ ] Mobile app (React Native)
- [ ] Fine-tuning de modelo para portugues

## 10. Validacao

### Testes Rapidos

1. **Landing page** com lista de espera — meta: 100 emails em 2 semanas
2. **MVP manual** — oferecer servico para 5 clientes, cobrar R$ 500-1.000/mes
3. **Pesquisa** — forms para 100 creators/politicos sobre disposicao a pagar

### KPIs de Sucesso

| KPI | Mes 3 | Mes 6 | Mes 12 |
|-----|-------|-------|--------|
| Usuarios cadastrados | 50 | 300 | 1.000 |
| Conversao para pago | 10% | 15% | 20% |
| NPS | > 40 | > 50 | > 60 |
| Churn mensal | < 10% | < 7% | < 5% |

---

**Versao**: 2.0
**Data**: Fevereiro 2026
**Status**: MVP implementado, validacao em andamento
