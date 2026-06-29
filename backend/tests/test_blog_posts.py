import uuid

from app.core.security import create_access_token, hash_password
from app.models.blog_post import BlogPost
from app.models.user import User


def _admin_headers(db):
    user = User(
        id=uuid.uuid4(),
        email="admin-blog@example.com",
        password_hash=hash_password("AdminPass123"),
        name="Admin Blog",
        plan="admin",
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "token_version": user.token_version})
    return {"Authorization": f"Bearer {token}"}


def _payload(slug="post-de-teste"):
    return {
        "slug": slug,
        "title": "Post de teste para o blog",
        "excerpt": "Um resumo claro com tamanho suficiente para validar a criacao do post.",
        "body_markdown": "## Um titulo\n\nEste texto tem corpo suficiente para validar o markdown do artigo no blog.",
        "category": "Analise de Sentimento",
        "persona": "agencias",
        "tags": ["Agencias", "relatorios", "agencias"],
        "cover_image_url": "/blog/relatorio-cliente-sentimento.png",
        "cover_image_alt": "Capa ilustrada do post de teste",
        "seo_title": "SEO do post de teste",
        "seo_description": "Descricao SEO do post de teste.",
        "cta_label": "Fazer diagnostico",
        "cta_href": "/diagnostico?utm_source=blog",
        "read_time_minutes": 4,
    }


def test_admin_can_create_publish_and_public_can_read(client, db):
    headers = _admin_headers(db)

    created = client.post("/api/v1/admin/blog/posts", json=_payload(), headers=headers)
    assert created.status_code == 201
    draft = created.json()
    assert draft["status"] == "draft"
    assert draft["tags"] == ["agencias", "relatorios"]

    hidden = client.get("/api/v1/blog/posts/post-de-teste")
    assert hidden.status_code == 404

    published = client.post(f"/api/v1/admin/blog/posts/{draft['id']}/publish", headers=headers)
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["published_at"] is not None

    public_detail = client.get("/api/v1/blog/posts/post-de-teste")
    assert public_detail.status_code == 200
    assert public_detail.json()["title"] == "Post de teste para o blog"

    public_list = client.get("/api/v1/blog/posts")
    assert public_list.status_code == 200
    assert [post["slug"] for post in public_list.json()["posts"]] == ["post-de-teste"]


def test_non_admin_cannot_create_blog_post(client, auth_headers):
    res = client.post("/api/v1/admin/blog/posts", json=_payload(), headers=auth_headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "admin_required"


def test_duplicate_slug_is_rejected(client, db):
    headers = _admin_headers(db)
    first = client.post("/api/v1/admin/blog/posts", json=_payload("slug-repetido"), headers=headers)
    assert first.status_code == 201

    second = client.post("/api/v1/admin/blog/posts", json=_payload("slug-repetido"), headers=headers)
    assert second.status_code == 409


def test_unpublish_hides_post_from_public_api(client, db):
    headers = _admin_headers(db)
    created = client.post("/api/v1/admin/blog/posts", json=_payload("post-para-despublicar"), headers=headers).json()
    client.post(f"/api/v1/admin/blog/posts/{created['id']}/publish", headers=headers)

    assert client.get("/api/v1/blog/posts/post-para-despublicar").status_code == 200
    unpublished = client.post(f"/api/v1/admin/blog/posts/{created['id']}/unpublish", headers=headers)
    assert unpublished.status_code == 200
    assert unpublished.json()["status"] == "draft"
    assert client.get("/api/v1/blog/posts/post-para-despublicar").status_code == 404
    assert db.query(BlogPost).filter(BlogPost.slug == "post-para-despublicar").one().status == "draft"
