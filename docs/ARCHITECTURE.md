# Sentimenta - Arquitetura de Fluxo e Banco de Dados (Atualizado)

## 1. Diagrama de Fluxo Mermaid (Macro e Funcional)
*Copie e cole no [Mermaid Live](https://mermaid.live/) ou em plugins do Figma para visualização.*

```mermaid
flowchart TD
    %% Define as cores e estilos base
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff
    classDef backend fill:#10b981,stroke:#047857,color:#fff
    classDef infra fill:#f59e0b,stroke:#b45309,color:#fff
    classDef database fill:#6366f1,stroke:#4338ca,color:#fff
    classDef ai fill:#ec4899,stroke:#be185d,color:#fff

    subgraph UserFlow ["Jornada do Usuário (UI - Next.js)"]
        direction TB
        UF1(Acessa Plataforma) --> UF2{Já possui conta?}
        UF2 -- Não --> UF3(Registrar\nOAuth Google ou Email/Senha)
        UF2 -- Sim --> UF4(Login JWT)
        UF3 --> UF5(Dashboard Principal)
        UF4 --> UF5
        UF5 --> UF6(Conectar Instagram ou YouTube\nvia OAuth / Link API)
        UF6 --> UF7(Adicionar Persona do Perfil\ne Ajustar Filtro de Autor)
        UF7 --> UF8(Clicar em Sincronizar)
        UF8 --> UF9(Acompanha Progressão em Tempo Real\nvia SSE)
        UF9 --> UF10(Visualiza KPIs, Trends e Análises)
    end
    class UserFlow frontend

    subgraph API ["Backend Core (FastAPI)"]
        A1[Recepção do Request POST /sync]
        A2[Validação de Auth via JWT e AES-256]
        A3[Delega background task pro Celery]
    end
    class API backend

    subgraph Workers ["Filas e Tarefas Assíncronas (Celery + Redis)"]
        direction TB
        W1[Broker: Recebe Task\nvia Redis] --> W2[Worker: Inicia Etapa de Ingestão\nScraping e Graph API]
        W2 --> W3[Worker: Inicia Etapa de Análise\nTripé Contextual]
    end
    class Workers infra

    subgraph AI ["Agentes de Inteligência Artificial (Gemini 2.0 Flash)"]
        AI1[Módulo Vison: Extração de\nContexto da Imagem do Post]
        AI2[Módulo NLP: Prompt em Batch\npara Sentimento, Emoções e Tópicos]
    end
    class AI ai

    subgraph DB ["Banco de Dados (PostgreSQL)"]
        DB1[(Users)]
        DB2[(SocialConnections\npersona, ignore_author)]
        DB3[(Posts\nimage_context, caption)]
        DB4[(Comments)]
        DB5[(CommentAnalysis)]
        DB6[(PostAnalysisSummary)]
        DB7[(PipelineRuns)]
    end
    class DB database

    %% Conexões entre Módulos
    UF8 -. Envia Trigger .-> A1
    A1 --> A2 --> A3
    A3 --> W1

    %% Relacionamento com Dados (Escrita)
    W2 -- "Baixa e salva" --> DB3
    W2 -- "Baixa e salva" --> DB4
    
    %% Relacionamento com IA e Contexto
    W3 -- "1. Lê Legenda" --> DB3
    W3 -- "2. Se não tem imagem, gera context" --> AI1
    AI1 -- "Salva context" --> DB3
    W3 -- "3. Lê Persona" --> DB2
    
    W3 -- "4. Envia Batches de Comments \n+ Contexto Total" --> AI2
    AI2 -- "Salva Análises e Scores" --> DB5
    DB5 -- "Worker Consolida Resultados" --> DB6
    
    DB6 -. "Serve Dados via API (Cache)" .-> UF5
```

## 2. Mega Prompt Detalhado para o Miro AI (Criação de Arquitetura de Nuvem e Banco)

Copie o texto abaixo exatamente como está e cole na IA do Miro (Miro Assist) ou ferramentas semelhantes para que ele desenhe tanto sua arquitetura de infraestrutura quanto as cardinalidades do banco e o fluxo lógico do seu negócio.

***

**[Copie a partir daqui até o fim do documento]**

Atue como o Arquiteto Soluções Chefe da plataforma "Sentimenta". Quero que você desenhe um framework visual hiper-detalhado (Flowchart e Entity-Relationship Diagram). 

Abaixo está o descritivo de negócios, tecnológico e de infraestrutura do sistema. Com base nele, quero os seguintes diagramas desenhados na minha lousa:
1. Um mapa mental do **Fluxo do Usuário e API (Service Blueprint)**.
2. O desenho do nosso **Modelo de Entidade-Relacionamento do Banco de Dados (Tabelas e Lógicas)**.

### CONTEXTO DA PLATAFORMA (SENTIMENTA)
**Conceito de Negócio:**
Foco em pessoa física (influenciadores, políticos, profissionais). Entrega visibilidade de reputação digital e insights acionáveis a partir de comentários, sem complexidade de ferramentas enterprise.

**Arquitetura e Stack:**
- **Frontend:** Next.js 14, TailwindCSS (Dark/Light mode), Recharts para Dashboards.
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic.
- **Autorização:** JWT (email+senha e access 30 min / refresh 7 dias), Google OAuth Login. Tokens externos de redes sociais são armazenados e criptografados localmente com Fernet (AES-256).
- **Infraestrutura Local/Produção:** PostgreSQL 16, Redis 7 (broker), Worker Celery. Roda no Docker Compose.
- **Integração de Extração:** Instagram Graph API, YouTube (via yt-dlp).
- **Inteligência Artificial (LLM):** Google Gemini 2.0 Flash (usando Visão Computacional de imagem e NLP para textos).

### O MODELO DO BANCO DE DADOS (PostgreSQL)
A relação de cardinalidade tem as seguintes entidades principais:
- **users:** Dados de autenticação, senha criptografada via bcrypt.
- **social_connections:** Perfis monitorados. *Importante:* Possui campos `persona` (texto para dar contexto de nicho para a IA) e `ignore_author_comments` (boolean para evitar inflar o score do dono do canal).
- **posts:** As publicações. *Importante:* Armazena a legenda (`content_text`) e o contexto gerado por IA da imagem da publicação em texto (`image_context`).
- **comments:** Comentários raw (`text_clean`, dados do autor).
- **comment_analysis:** A entidade gerada pelo Gemini, engavetando: `score_0_10`, `polarity`, `intensity`, listas de `emotions`, listas de `topics`, `sarcasm` (booleano) e proxy de `summary_pt`. 
- **post_analysis_summary:** Visão sumarizada/agregada pré-calculada por Post.
- **pipeline_runs:** Histórico da esteira de Celery e log de erros.

### O FLUXO DE COMPUTAÇÃO ASSÍNCRONA (A Mágica)
Quando o usuário pede uma sincronização no Front, a esteira entra na Fila (Redis/Celery) no Backend e segue dois caminhos sequenciais:
1. **Etapa de Ingestão:** Extrai do Youtube ou Insta (de acordo com os filtros de Max Posts) e grava os raw comments no Banco.
2. **Etapa Visão (LLM Visual):** O worker investiga o Post. Se for imagem e não tiver `image_context` gerado no sistema, ele puxa o JPG e manda pro Gemini Vision "descrever a intenção da foto" em 2 linhas. E salva.
3. **Etapa Semântica (LLM NLP - O Tripé Contextual):** O Worker constrói um mega prompt. Ele junta: (1) O texto da `persona`, (2) O texto final gerado do `image_context` e (3) A própria legenda do Post. Baseado no tripé, ele quebra os comentários pendentes em Batches de 30 mensagens soltas e a IA NLP devolve notas, tópicos e sentimentos num array JSON puro. E Grava na tabela analysis.

Use todas essas informações de tabelas, integrações, ferramentas (Docker, Next, FastAPI, Gemini, Celery, Redis) e endpoints de segurança para pintar um diagrama de sistema extremamente moderno, completo, visual e interligado, perfeito para apresentação C-Level e Dev Docs.

**[Fim da Cópia]**
