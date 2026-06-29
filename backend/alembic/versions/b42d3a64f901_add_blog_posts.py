"""add blog posts

Revision ID: b42d3a64f901
Revises: 8b8d7b8a3f21
Create Date: 2026-06-29 00:00:00.000000

"""

from datetime import datetime, timezone
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b42d3a64f901"
down_revision: Union[str, None] = "8b8d7b8a3f21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


blog_posts_table = sa.table(
    "blog_posts",
    sa.column("id", sa.Uuid()),
    sa.column("slug", sa.String()),
    sa.column("title", sa.String()),
    sa.column("excerpt", sa.Text()),
    sa.column("body_markdown", sa.Text()),
    sa.column("status", sa.String()),
    sa.column("category", sa.String()),
    sa.column("persona", sa.String()),
    sa.column("tags", postgresql.JSONB()),
    sa.column("cover_image_url", sa.Text()),
    sa.column("cover_image_alt", sa.Text()),
    sa.column("seo_title", sa.String()),
    sa.column("seo_description", sa.Text()),
    sa.column("cta_label", sa.String()),
    sa.column("cta_href", sa.Text()),
    sa.column("read_time_minutes", sa.Integer()),
    sa.column("author_name", sa.String()),
    sa.column("created_by", sa.Uuid()),
    sa.column("published_at", sa.DateTime(timezone=True)),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=220), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("body_markdown", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("persona", sa.String(length=80), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cover_image_url", sa.Text(), nullable=False),
        sa.Column("cover_image_alt", sa.Text(), nullable=False),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("cta_label", sa.String(length=120), nullable=False),
        sa.Column("cta_href", sa.Text(), nullable=False),
        sa.Column("read_time_minutes", sa.Integer(), nullable=False),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_blog_posts_category", "blog_posts", ["category"])
    op.create_index("ix_blog_posts_persona", "blog_posts", ["persona"])
    op.create_index("ix_blog_posts_published_at", "blog_posts", ["published_at"])
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"])
    op.create_index("ix_blog_posts_status", "blog_posts", ["status"])

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        blog_posts_table,
        [
            {
                "id": uuid.uuid4(),
                "slug": "como-saber-se-os-comentarios-do-instagram-estao-virando-risco",
                "title": "Como saber se os comentarios do Instagram estao virando risco",
                "excerpt": "Um guia direto para social medias e agencias identificarem sinais de crise antes de depender apenas de curtidas, alcance ou intuicao.",
                "body_markdown": "\n\n".join(
                    [
                        "Curtidas e alcance dizem se um post circulou. Comentarios dizem como ele foi recebido. O problema e que a maioria das equipes so percebe uma crise quando os comentarios negativos ja viraram print, DM ou reuniao urgente.",
                        "O primeiro sinal costuma ser mudanca de tom, nao volume. Um post pode ter poucas respostas e mesmo assim carregar irritacao, ironia ou duvida publica. Por isso, olhar apenas quantidade de comentarios e insuficiente.",
                        "Na pratica, vale acompanhar tres coisas: queda no score medio de sentimento, crescimento de emocoes como raiva ou medo, e repeticao de temas de critica. Quando os tres aparecem juntos, o post merece resposta rapida.",
                        "Para agencias, esse tipo de leitura vira uma entrega clara para o cliente: nao e so dizer que o post performou, mas explicar se a audiencia ficou mais confiante, confusa, irritada ou engajada.",
                        "O Sentimenta foi pensado para esse trabalho: conectar um perfil, coletar comentarios, analisar sentimento e mostrar onde esta o risco sem a equipe precisar ler centenas de mensagens manualmente.",
                    ]
                ),
                "status": "published",
                "category": "Gestao de Reputacao",
                "persona": "social-media",
                "tags": ["instagram", "crise", "reputacao", "comentarios"],
                "cover_image_url": "/blog/risco-comentarios-instagram.png",
                "cover_image_alt": "Ilustracao editorial de um painel de comentarios com sinais de alerta e sentimento",
                "seo_title": None,
                "seo_description": None,
                "cta_label": "Fazer um diagnostico gratuito",
                "cta_href": "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=risk-comments",
                "read_time_minutes": 5,
                "author_name": "Sentimenta",
                "created_by": None,
                "published_at": datetime(2026, 6, 28, tzinfo=timezone.utc),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "slug": "relatorio-para-cliente-alem-de-curtidas-e-alcance",
                "title": "Relatorio para cliente alem de curtidas e alcance",
                "excerpt": "Como transformar comentarios em uma camada nova de relatorio para social media, atendimento e reputacao.",
                "body_markdown": "\n\n".join(
                    [
                        "Muitos relatorios de social media param em alcance, impressoes, curtidas e seguidores. Esses numeros sao uteis, mas nao respondem uma pergunta que clientes fazem cada vez mais: as pessoas gostaram mesmo?",
                        "Comentarios permitem mostrar percepcao. Uma campanha pode ter alto alcance e ainda gerar desconfianca. Outra pode ter menos volume, mas revelar desejo de compra, elogios especificos e temas que merecem virar conteudo.",
                        "Um bom relatorio de sentimento deve trazer poucos blocos: score geral, principais emocoes, temas positivos, temas negativos, comentarios que merecem resposta e recomendacao de proxima acao.",
                        "A entrega fica mais forte quando a agencia mostra exemplos rastreaveis. O cliente precisa conseguir clicar ou reconhecer de onde saiu cada insight. Isso evita o risco de parecer texto inventado por IA.",
                        "A oportunidade comercial para agencias e simples: vender inteligencia de audiencia como uma camada premium de relatorio, sem transformar a equipe em analista manual de comentarios.",
                    ]
                ),
                "status": "published",
                "category": "Analise de Sentimento",
                "persona": "agencias",
                "tags": ["agencias", "relatorios", "social-media", "clientes"],
                "cover_image_url": "/blog/relatorio-cliente-sentimento.png",
                "cover_image_alt": "Ilustracao editorial de relatorio de social media com comentarios classificados por sentimento",
                "seo_title": None,
                "seo_description": None,
                "cta_label": "Ver como ficaria para um cliente",
                "cta_href": "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=agency-report",
                "read_time_minutes": 6,
                "author_name": "Sentimenta",
                "created_by": None,
                "published_at": datetime(2026, 6, 21, tzinfo=timezone.utc),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "slug": "google-ads-meta-ads-e-conteudo-para-um-saas-pequeno",
                "title": "Google Ads, Meta Ads e conteudo para um SaaS pequeno",
                "excerpt": "Um plano enxuto para validar demanda antes de gastar pesado com trafego pago.",
                "body_markdown": "\n\n".join(
                    [
                        "Para um SaaS pequeno, o erro comum e comecar pelo Ads Manager antes de clarear oferta, publico e evento de conversao. Trafego pago acelera aprendizado, mas tambem acelera desperdicio quando a pagina nao convence.",
                        "A ordem mais segura e: criar uma oferta especifica, publicar uma pagina que explica essa oferta, medir cliques e cadastros, e so depois ligar campanhas com orcamento pequeno.",
                        "Google Ads funciona melhor para demanda existente: pessoas procurando analise de sentimento, monitoramento de reputacao ou relatorio de comentarios. Meta Ads funciona melhor para provocar a dor com criativos visuais.",
                        "Conteudo semanal ajuda porque cria paginas que podem rankear, abastece anuncios com argumentos reais e reduz dependencia de uma unica landing page. Mas o conteudo precisa ser util, nao enchimento para SEO.",
                        "O fluxo ideal combina os tres: blog para educar, Google para capturar intencao e Meta para testar criativos e dores. Tudo com UTM e eventos de conversao desde o primeiro dia.",
                    ]
                ),
                "status": "published",
                "category": "Aquisicao e Ads",
                "persona": "fundadores",
                "tags": ["google-ads", "meta-ads", "saas", "aquisicao"],
                "cover_image_url": "/blog/aquisicao-google-meta-saas.png",
                "cover_image_alt": "Ilustracao editorial de funil de aquisicao com blog, anuncios e landing page",
                "seo_title": None,
                "seo_description": None,
                "cta_label": "Comecar pelo diagnostico",
                "cta_href": "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=ads-saas",
                "read_time_minutes": 7,
                "author_name": "Sentimenta",
                "created_by": None,
                "published_at": datetime(2026, 6, 14, tzinfo=timezone.utc),
                "created_at": now,
                "updated_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_blog_posts_status", table_name="blog_posts")
    op.drop_index("ix_blog_posts_slug", table_name="blog_posts")
    op.drop_index("ix_blog_posts_published_at", table_name="blog_posts")
    op.drop_index("ix_blog_posts_persona", table_name="blog_posts")
    op.drop_index("ix_blog_posts_category", table_name="blog_posts")
    op.drop_table("blog_posts")
