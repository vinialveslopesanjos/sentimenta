"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { AlertCircle, CheckCircle2, Eye, FileText, Globe2, Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { authApi, blogAdminApi, type BlogPostInput } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatBlogDate, type BlogPost } from "@/lib/blog";

const emptyForm: BlogPostInput = {
  slug: "",
  title: "",
  excerpt: "",
  body_markdown: "",
  category: "Analise de Sentimento",
  persona: "agencias",
  tags: [],
  cover_image_url: "/blog/relatorio-cliente-sentimento.png",
  cover_image_alt: "Capa editorial do artigo do Sentimenta",
  seo_title: "",
  seo_description: "",
  cta_label: "Fazer diagnostico gratuito",
  cta_href: "/diagnostico?utm_source=blog&utm_medium=organic",
  read_time_minutes: 5,
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220);
}

function postToForm(post: BlogPost): BlogPostInput {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body_markdown: post.bodyMarkdown,
    category: post.category,
    persona: post.persona,
    tags: post.tags,
    cover_image_url: post.coverImageUrl,
    cover_image_alt: post.coverImageAlt,
    seo_title: post.seoTitle || "",
    seo_description: post.seoDescription || "",
    cta_label: post.cta.label,
    cta_href: post.cta.href,
    read_time_minutes: post.readTimeMinutes,
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index)
    .slice(0, 12);
}

export default function AdminBlogPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogPostInput>(emptyForm);
  const [tagsText, setTagsText] = useState("");

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) || null,
    [posts, selectedId],
  );

  useEffect(() => {
    const currentToken = getToken();
    if (!currentToken) {
      setLoading(false);
      return;
    }

    setToken(currentToken);
    Promise.all([authApi.me(currentToken), blogAdminApi.list(currentToken)])
      .then(([user, loadedPosts]) => {
        setIsAdmin(user.plan === "admin");
        setPosts(loadedPosts);
        const first = loadedPosts[0];
        if (first) {
          setSelectedId(first.id || null);
          setForm(postToForm(first));
          setTagsText(first.tags.join(", "));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar o editor.");
      })
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof BlogPostInput>(field: K, value: BlogPostInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectPost = (post: BlogPost) => {
    setSelectedId(post.id || null);
    setForm(postToForm(post));
    setTagsText(post.tags.join(", "));
    setMessage(null);
    setError(null);
  };

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setTagsText("");
    setMessage("Novo rascunho iniciado.");
    setError(null);
  };

  const upsertPostInList = (post: BlogPost) => {
    setPosts((current) => {
      const exists = current.some((item) => item.id === post.id);
      if (exists) return current.map((item) => (item.id === post.id ? post : item));
      return [post, ...current];
    });
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = { ...form, tags: parseTags(tagsText) };
    try {
      const saved = selectedId
        ? await blogAdminApi.update(token, selectedId, payload)
        : await blogAdminApi.create(token, payload);
      upsertPostInList(saved);
      setSelectedId(saved.id || null);
      setForm(postToForm(saved));
      setTagsText(saved.tags.join(", "));
      setMessage("Rascunho salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!token || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const published = await blogAdminApi.publish(token, selectedId);
      upsertPostInList(published);
      setForm(postToForm(published));
      setMessage("Post publicado. Ele ja pode aparecer no blog publico.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel publicar.");
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!token || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const draft = await blogAdminApi.unpublish(token, selectedId);
      upsertPostInList(draft);
      setForm(postToForm(draft));
      setMessage("Post voltou para rascunho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel despublicar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border p-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <AlertCircle className="mb-4 h-6 w-6" style={{ color: "var(--sentiment-negative)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Acesso restrito
        </h1>
        <p className="mt-2 max-w-[620px]" style={{ color: "var(--text-muted)" }}>
          O editor do blog esta disponivel apenas para contas admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            Conteudo e aquisicao
          </span>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Editor do blog
          </h1>
          <p className="mt-2 max-w-[760px]" style={{ color: "var(--text-muted)" }}>
            Crie rascunhos, revise a copy e publique artigos sem commit. Use este fluxo para testar
            pautas de SEO, ads e diagnostico gratuito com velocidade.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/blog" target="_blank">
            <Button variant="secondary" icon={<Globe2 className="h-4 w-4" />}>Ver blog</Button>
          </Link>
          <Button onClick={startNew} icon={<Plus className="h-4 w-4" />}>Novo rascunho</Button>
        </div>
      </div>

      {(message || error) && (
        <div
          className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: error ? "var(--sentiment-negative)" : "var(--border)",
            backgroundColor: error ? "var(--sentiment-negative-bg)" : "var(--primary-bg)",
            color: error ? "var(--sentiment-negative)" : "var(--text-secondary)",
          }}
        >
          {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Posts
            </h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {posts.length} itens
            </span>
          </div>
          <div className="space-y-2">
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => selectPost(post)}
                className="w-full rounded-lg border p-3 text-left transition-colors"
                style={{
                  borderColor: selectedId === post.id ? "var(--primary)" : "var(--border)",
                  backgroundColor: selectedId === post.id ? "var(--primary-bg)" : "var(--bg-subtle)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold"
                    style={{
                      backgroundColor: post.status === "published" ? "var(--sentiment-positive-bg)" : "var(--accent-bg)",
                      color: post.status === "published" ? "var(--sentiment-positive)" : "var(--accent)",
                    }}
                  >
                    {post.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {formatBlogDate(post.publishedAt || post.updatedAt)}
                  </span>
                </div>
                <p className="font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                  {post.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  {post.excerpt}
                </p>
              </button>
            ))}
            {posts.length === 0 && (
              <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Nenhum post cadastrado ainda.
              </div>
            )}
          </div>
        </aside>

        <section className="grid gap-6 2xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="mb-5 flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Estrutura do artigo
              </h2>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Titulo</span>
                <input
                  value={form.title}
                  onChange={(event) => {
                    update("title", event.target.value);
                    if (!selectedId && !form.slug) update("slug", slugify(event.target.value));
                  }}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => update("slug", slugify(event.target.value))}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Resumo</span>
                <textarea
                  value={form.excerpt}
                  onChange={(event) => update("excerpt", event.target.value)}
                  rows={3}
                  className="resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Categoria</span>
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value as BlogPostInput["category"])}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option>Analise de Sentimento</option>
                    <option>Gestao de Reputacao</option>
                    <option>Aquisicao e Ads</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Persona</span>
                  <select
                    value={form.persona}
                    onChange={(event) => update("persona", event.target.value as BlogPostInput["persona"])}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="agencias">agencias</option>
                    <option value="social-media">social-media</option>
                    <option value="criadores">criadores</option>
                    <option value="fundadores">fundadores</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Leitura</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.read_time_minutes}
                    onChange={(event) => update("read_time_minutes", Number(event.target.value))}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tags, separadas por virgula</span>
                <input
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>URL da capa</span>
                  <input
                    value={form.cover_image_url}
                    onChange={(event) => update("cover_image_url", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Alt da capa</span>
                  <input
                    value={form.cover_image_alt}
                    onChange={(event) => update("cover_image_alt", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>CTA</span>
                  <input
                    value={form.cta_label}
                    onChange={(event) => update("cta_label", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link do CTA</span>
                  <input
                    value={form.cta_href}
                    onChange={(event) => update("cta_href", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>SEO title</span>
                  <input
                    value={form.seo_title || ""}
                    onChange={(event) => update("seo_title", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>SEO description</span>
                  <input
                    value={form.seo_description || ""}
                    onChange={(event) => update("seo_description", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Corpo em Markdown</span>
                <textarea
                  value={form.body_markdown}
                  onChange={(event) => update("body_markdown", event.target.value)}
                  rows={18}
                  className="resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm leading-6 outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={saving} icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
                  Salvar
                </Button>
                <Button variant="secondary" onClick={publish} disabled={saving || !selectedId} icon={<Globe2 className="h-4 w-4" />}>
                  Publicar
                </Button>
                <Button variant="outline" onClick={unpublish} disabled={saving || !selectedId}>
                  Voltar para rascunho
                </Button>
                {selectedPost?.status === "published" && (
                  <Link href={`/blog/${selectedPost.slug}`} target="_blank">
                    <Button variant="ghost" icon={<Eye className="h-4 w-4" />}>Abrir publicado</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="mb-5 flex items-center gap-2">
              <Eye className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Preview
              </h2>
            </div>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
              {form.cover_image_url ? (
                <img src={form.cover_image_url} alt={form.cover_image_alt} className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="aspect-[16/9] w-full" style={{ backgroundColor: "var(--bg-subtle)" }} />
              )}
            </div>
            <div className="mt-5">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}
              >
                {form.category}
              </span>
              <h3 className="mt-4 text-2xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {form.title || "Titulo do artigo"}
              </h3>
              <p className="mt-3 leading-7" style={{ color: "var(--text-muted)" }}>
                {form.excerpt || "Resumo do artigo aparece aqui antes de publicar."}
              </p>
              <div
                className="prose prose-sm mt-6 max-w-none"
                style={{
                  color: "var(--text-secondary)",
                  ["--tw-prose-headings" as string]: "var(--text-primary)",
                  ["--tw-prose-body" as string]: "var(--text-secondary)",
                  ["--tw-prose-links" as string]: "var(--primary)",
                  ["--tw-prose-bold" as string]: "var(--text-primary)",
                }}
              >
                <ReactMarkdown>{form.body_markdown || "Escreva o corpo em Markdown para visualizar."}</ReactMarkdown>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
