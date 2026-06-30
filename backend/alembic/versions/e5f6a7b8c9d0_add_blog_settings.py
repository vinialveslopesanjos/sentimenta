"""add blog settings

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-06-30 00:10:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


blog_settings_table = sa.table(
    "blog_settings",
    sa.column("id", sa.Integer()),
    sa.column("nav_pricing_label", sa.String()),
    sa.column("nav_cta_label", sa.String()),
    sa.column("nav_cta_href", sa.Text()),
    sa.column("hero_eyebrow", sa.String()),
    sa.column("hero_title", sa.String()),
    sa.column("hero_description", sa.Text()),
    sa.column("search_placeholder", sa.String()),
    sa.column("hero_cta_label", sa.String()),
    sa.column("hero_cta_href", sa.Text()),
    sa.column("sidebar_title", sa.String()),
    sa.column("sidebar_description", sa.Text()),
    sa.column("sidebar_cta_label", sa.String()),
    sa.column("sidebar_cta_href", sa.Text()),
    sa.column("all_category_label", sa.String()),
    sa.column("categories", postgresql.JSONB()),
    sa.column("empty_state_text", sa.String()),
    sa.column("article_nav_cta_label", sa.String()),
    sa.column("article_nav_cta_href", sa.Text()),
    sa.column("article_cta_title", sa.String()),
    sa.column("article_cta_description", sa.Text()),
    sa.column("updated_by", sa.Uuid()),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)

blog_posts_table = sa.table(
    "blog_posts",
    sa.column("slug", sa.String()),
    sa.column("title", sa.String()),
    sa.column("excerpt", sa.Text()),
    sa.column("body_markdown", sa.Text()),
    sa.column("status", sa.String()),
    sa.column("category", sa.String()),
    sa.column("tags", postgresql.JSONB()),
    sa.column("cover_image_alt", sa.Text()),
    sa.column("cta_label", sa.String()),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    op.create_table(
        "blog_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nav_pricing_label", sa.String(length=80), nullable=False),
        sa.Column("nav_cta_label", sa.String(length=120), nullable=False),
        sa.Column("nav_cta_href", sa.Text(), nullable=False),
        sa.Column("hero_eyebrow", sa.String(length=180), nullable=False),
        sa.Column("hero_title", sa.String(length=255), nullable=False),
        sa.Column("hero_description", sa.Text(), nullable=False),
        sa.Column("search_placeholder", sa.String(length=180), nullable=False),
        sa.Column("hero_cta_label", sa.String(length=120), nullable=False),
        sa.Column("hero_cta_href", sa.Text(), nullable=False),
        sa.Column("sidebar_title", sa.String(length=180), nullable=False),
        sa.Column("sidebar_description", sa.Text(), nullable=False),
        sa.Column("sidebar_cta_label", sa.String(length=120), nullable=False),
        sa.Column("sidebar_cta_href", sa.Text(), nullable=False),
        sa.Column("all_category_label", sa.String(length=80), nullable=False),
        sa.Column("categories", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("empty_state_text", sa.String(length=255), nullable=False),
        sa.Column("article_nav_cta_label", sa.String(length=120), nullable=False),
        sa.Column("article_nav_cta_href", sa.Text(), nullable=False),
        sa.Column("article_cta_title", sa.String(length=180), nullable=False),
        sa.Column("article_cta_description", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_blog_settings_singleton"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        blog_settings_table,
        [
            {
                "id": 1,
                "nav_pricing_label": "Preços",
                "nav_cta_label": "Comece grátis",
                "nav_cta_href": "/login?utm_source=blog&utm_medium=nav&utm_campaign=start-free",
                "hero_eyebrow": "Conteúdo para transformar comentários em decisão",
                "hero_title": "Reputação digital sem ler comentário por comentário",
                "hero_description": "Guias curtos para social medias, agências e fundadores entenderem sentimento, temas e sinais de crise antes que a conversa vire ruído.",
                "search_placeholder": "Buscar por dor, canal ou assunto",
                "hero_cta_label": "Diagnóstico gratuito",
                "hero_cta_href": "/diagnostico?utm_source=blog&utm_medium=hero&utm_campaign=diagnostico",
                "sidebar_title": "Veja isso com comentários reais",
                "sidebar_description": "Conecte um perfil público e veja sentimento, emoções, temas e sinais de crise em poucos minutos.",
                "sidebar_cta_label": "Testar com um perfil",
                "sidebar_cta_href": "/diagnostico?utm_source=blog&utm_medium=sidebar&utm_campaign=diagnostico",
                "all_category_label": "Todos",
                "categories": ["Análise de Sentimento", "Gestão de Reputação"],
                "empty_state_text": "Nenhum artigo encontrado para essa busca.",
                "article_nav_cta_label": "Comece grátis",
                "article_nav_cta_href": "/login?utm_source=blog&utm_medium=article_nav&utm_campaign=start-free",
                "article_cta_title": "Quer ver isso com comentários reais?",
                "article_cta_description": "O caminho mais rápido é analisar um perfil ou post público e transformar comentários em score, temas, emoções e riscos claros.",
                "updated_by": None,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    op.execute(
        blog_posts_table.update()
        .where(blog_posts_table.c.slug == "como-saber-se-os-comentarios-do-instagram-estao-virando-risco")
        .values(
            title="Como saber se os comentários do Instagram estão virando risco",
            excerpt="Um guia direto para social medias e agências identificarem sinais de crise antes de depender apenas de curtidas, alcance ou intuição.",
            body_markdown="\n\n".join(
                [
                    "Curtidas e alcance mostram se um post circulou. **Os comentários mostram como ele foi recebido.** É ali que aparecem dúvidas, ironias, críticas recorrentes e sinais de desgaste.",
                    "O primeiro sinal de risco costuma ser **mudança de tom**, não volume. Um post pode ter poucos comentários e ainda assim carregar irritação, desconfiança ou medo.",
                    "Na prática, vale acompanhar três sinais: **queda no score médio de sentimento**, crescimento de emoções como raiva ou medo e repetição de temas de crítica.",
                    "Para agências e social medias, essa leitura vira uma entrega clara: explicar **se a audiência ficou mais confiante, confusa, irritada ou engajada**.",
                    "O Sentimenta foi pensado para mostrar onde está o risco **sem a equipe precisar ler centenas de mensagens manualmente**.",
                ]
            ),
            category="Gestão de Reputação",
            tags=["instagram", "crise", "reputação", "comentários"],
            cover_image_alt="Ilustração editorial de um painel de comentários com sinais de alerta e sentimento",
            cta_label="Fazer um diagnóstico gratuito",
            updated_at=now,
        )
    )

    op.execute(
        blog_posts_table.update()
        .where(blog_posts_table.c.slug == "relatorio-para-cliente-alem-de-curtidas-e-alcance")
        .values(
            title="Relatório para cliente além de curtidas e alcance",
            excerpt="Como transformar comentários em uma camada nova de relatório para social media, atendimento e reputação.",
            body_markdown="\n\n".join(
                [
                    "Muitos relatórios de social media param em alcance, impressões, curtidas e seguidores. Esses números são úteis, mas não respondem à pergunta: **as pessoas gostaram mesmo?**",
                    "Comentários mostram percepção. Uma campanha pode ter alto alcance e ainda gerar desconfiança; outra pode revelar desejo de compra e temas que merecem virar conteúdo.",
                    "Um bom relatório de sentimento deve trazer **score geral, principais emoções, temas positivos, temas negativos e comentários que merecem resposta**.",
                    "A entrega fica mais forte quando a agência mostra exemplos rastreáveis. Isso evita o risco de parecer texto inventado por IA.",
                    "A oportunidade comercial é vender **inteligência de audiência** como uma camada premium de relatório.",
                ]
            ),
            category="Análise de Sentimento",
            tags=["agências", "relatórios", "social-media", "clientes"],
            cover_image_alt="Ilustração editorial de relatório de social media com comentários classificados por sentimento",
            updated_at=now,
        )
    )

    op.execute(
        blog_posts_table.update()
        .where(blog_posts_table.c.slug == "google-ads-meta-ads-e-conteudo-para-um-saas-pequeno")
        .values(status="draft", updated_at=now)
    )


def downgrade() -> None:
    op.drop_table("blog_settings")
