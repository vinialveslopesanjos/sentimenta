"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, FileText, Globe2, ImagePlus, Loader2, Plus, Save, Settings2 } from "lucide-react";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { Button } from "@/components/ds/Button";
import { authApi, blogAdminApi, type BlogPostInput, type BlogSettingsInput } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fallbackBlogSettings, formatBlogDate, type BlogPost, type BlogSettings } from "@/lib/blog";

const emptyForm: BlogPostInput = {
  slug: "",
  title: "",
  excerpt: "",
  body_markdown: "",
  category: "Análise de Sentimento",
  persona: "agencias",
  tags: [],
  cover_image_url: "/blog/relatorio-cliente-sentimento.png",
  cover_image_alt: "Capa editorial do artigo do Sentimenta",
  seo_title: "",
  seo_description: "",
  cta_label: "Fazer diagnóstico gratuito",
  cta_href: "/diagnostico?utm_source=blog&utm_medium=organic",
  read_time_minutes: 5,
};

type BlogSettingsForm = {
  nav_pricing_label: string;
  nav_cta_label: string;
  nav_cta_href: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  search_placeholder: string;
  hero_cta_label: string;
  hero_cta_href: string;
  sidebar_title: string;
  sidebar_description: string;
  sidebar_cta_label: string;
  sidebar_cta_href: string;
  all_category_label: string;
  categories_text: string;
  empty_state_text: string;
  article_nav_cta_label: string;
  article_nav_cta_href: string;
  article_cta_title: string;
  article_cta_description: string;
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

function parseCategories(value: string) {
  return value
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean)
    .filter((category, index, categories) => categories.indexOf(category) === index)
    .slice(0, 12);
}

function settingsToForm(settings: BlogSettings): BlogSettingsForm {
  return {
    nav_pricing_label: settings.navPricingLabel,
    nav_cta_label: settings.navCtaLabel,
    nav_cta_href: settings.navCtaHref,
    hero_eyebrow: settings.heroEyebrow,
    hero_title: settings.heroTitle,
    hero_description: settings.heroDescription,
    search_placeholder: settings.searchPlaceholder,
    hero_cta_label: settings.heroCtaLabel,
    hero_cta_href: settings.heroCtaHref,
    sidebar_title: settings.sidebarTitle,
    sidebar_description: settings.sidebarDescription,
    sidebar_cta_label: settings.sidebarCtaLabel,
    sidebar_cta_href: settings.sidebarCtaHref,
    all_category_label: settings.allCategoryLabel,
    categories_text: settings.categories.join(", "),
    empty_state_text: settings.emptyStateText,
    article_nav_cta_label: settings.articleNavCtaLabel,
    article_nav_cta_href: settings.articleNavCtaHref,
    article_cta_title: settings.articleCtaTitle,
    article_cta_description: settings.articleCtaDescription,
  };
}

function settingsFormToPayload(form: BlogSettingsForm): BlogSettingsInput {
  return {
    nav_pricing_label: form.nav_pricing_label,
    nav_cta_label: form.nav_cta_label,
    nav_cta_href: form.nav_cta_href,
    hero_eyebrow: form.hero_eyebrow,
    hero_title: form.hero_title,
    hero_description: form.hero_description,
    search_placeholder: form.search_placeholder,
    hero_cta_label: form.hero_cta_label,
    hero_cta_href: form.hero_cta_href,
    sidebar_title: form.sidebar_title,
    sidebar_description: form.sidebar_description,
    sidebar_cta_label: form.sidebar_cta_label,
    sidebar_cta_href: form.sidebar_cta_href,
    all_category_label: form.all_category_label,
    categories: parseCategories(form.categories_text),
    empty_state_text: form.empty_state_text,
    article_nav_cta_label: form.article_nav_cta_label,
    article_nav_cta_href: form.article_nav_cta_href,
    article_cta_title: form.article_cta_title,
    article_cta_description: form.article_cta_description,
  };
}

export default function AdminBlogPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogPostInput>(emptyForm);
  const [settingsForm, setSettingsForm] = useState<BlogSettingsForm>(() => settingsToForm(fallbackBlogSettings));
  const [tagsText, setTagsText] = useState("");

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) || null,
    [posts, selectedId],
  );
  const blogCategoryOptions = useMemo(() => parseCategories(settingsForm.categories_text), [settingsForm.categories_text]);
  const bodyLength = form.body_markdown.trim().length;
  const canPublish =
    form.slug.trim().length >= 3 &&
    form.title.trim().length >= 3 &&
    form.excerpt.trim().length >= 20 &&
    bodyLength >= 80 &&
    form.category.trim().length >= 2 &&
    form.cover_image_url.trim().length >= 1 &&
    form.cover_image_alt.trim().length >= 5 &&
    form.cta_label.trim().length >= 2 &&
    form.cta_href.trim().length >= 1;

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
        setError(err instanceof Error ? err.message : "Não foi possível carregar o editor.");
      })
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof BlogPostInput>(field: K, value: BlogPostInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSettings = <K extends keyof BlogSettingsForm>(field: K, value: BlogSettingsForm[K]) => {
    setSettingsForm((current) => ({ ...current, [field]: value }));
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
    setForm({ ...emptyForm, category: blogCategoryOptions[0] || emptyForm.category });
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

  const savePost = async () => {
    if (!token) return;
    const payload = { ...form, tags: parseTags(tagsText) };
    const saved = selectedId
      ? await blogAdminApi.update(token, selectedId, payload)
      : await blogAdminApi.create(token, payload);
    upsertPostInList(saved);
    setSelectedId(saved.id || null);
    setForm(postToForm(saved));
    setTagsText(saved.tags.join(", "));
    return saved;
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await savePost();
      setMessage("Rascunho salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!token) return;
    setSavingSettings(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await blogAdminApi.updateSettings(token, settingsFormToPayload(settingsForm));
      setSettingsForm(settingsToForm(saved));
      setMessage("Textos e categorias do blog salvos. A página pública já lê essas configurações.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as configurações do blog.");
    } finally {
      setSavingSettings(false);
    }
  };

  const uploadCover = async (file: File | null) => {
    if (!token || !file) return;
    setUploadingCover(true);
    setMessage(null);
    setError(null);
    try {
      const uploaded = await blogAdminApi.uploadMedia(token, file);
      update("cover_image_url", uploaded.url);
      if (!form.cover_image_alt.trim()) {
        update("cover_image_alt", `Capa editorial para ${form.title || "artigo do Sentimenta"}`);
      }
      setMessage("Capa enviada. A URL publica ja foi preenchida no artigo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar a capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const publish = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await savePost();
      if (!saved?.id) throw new Error("Salve o rascunho antes de publicar.");
      const published = await blogAdminApi.publish(token, saved.id);
      upsertPostInList(published);
      setSelectedId(published.id || null);
      setForm(postToForm(published));
      setTagsText(published.tags.join(", "));
      setMessage("Post salvo e publicado. Ele já pode aparecer no blog público.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível publicar.");
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
      setError(err instanceof Error ? err.message : "Não foi possível despublicar.");
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
          O editor do blog está disponível apenas para contas admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            Conteúdo e aquisição
          </span>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Editor do blog
          </h1>
          <p className="mt-2 max-w-[760px]" style={{ color: "var(--text-muted)" }}>
            Crie rascunhos, revise o conteúdo e publique artigos sem commit. Esta tela é só para
            gerenciar matérias do blog.
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

      <section className="hidden rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-1 h-5 w-5" style={{ color: "var(--primary)" }} />
            <div>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Textos da página
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Hero, busca, categorias, navegação e CTA final do artigo.
              </p>
            </div>
          </div>
          <Button
            onClick={saveSettings}
            disabled={savingSettings}
            icon={savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          >
            Salvar textos
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Chamada acima do título</span>
            <input
              value={settingsForm.hero_eyebrow}
              onChange={(event) => updateSettings("hero_eyebrow", event.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Título principal</span>
            <input
              value={settingsForm.hero_title}
              onChange={(event) => updateSettings("hero_title", event.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Subtítulo</span>
            <textarea
              value={settingsForm.hero_description}
              onChange={(event) => updateSettings("hero_description", event.target.value)}
              rows={3}
              className="resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>CTA do hero</span>
              <input
                value={settingsForm.hero_cta_label}
                onChange={(event) => updateSettings("hero_cta_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link do CTA do hero</span>
              <input
                value={settingsForm.hero_cta_href}
                onChange={(event) => updateSettings("hero_cta_href", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Placeholder da busca</span>
              <input
                value={settingsForm.search_placeholder}
                onChange={(event) => updateSettings("search_placeholder", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Filtro geral</span>
              <input
                value={settingsForm.all_category_label}
                onChange={(event) => updateSettings("all_category_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Categorias</span>
              <input
                value={settingsForm.categories_text}
                onChange={(event) => updateSettings("categories_text", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Título da lateral</span>
              <input
                value={settingsForm.sidebar_title}
                onChange={(event) => updateSettings("sidebar_title", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Texto quando não há resultado</span>
              <input
                value={settingsForm.empty_state_text}
                onChange={(event) => updateSettings("empty_state_text", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <label className="grid gap-1.5 lg:col-span-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Descrição da lateral</span>
            <textarea
              value={settingsForm.sidebar_description}
              onChange={(event) => updateSettings("sidebar_description", event.target.value)}
              rows={3}
              className="resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>CTA da lateral</span>
              <input
                value={settingsForm.sidebar_cta_label}
                onChange={(event) => updateSettings("sidebar_cta_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link do CTA da lateral</span>
              <input
                value={settingsForm.sidebar_cta_href}
                onChange={(event) => updateSettings("sidebar_cta_href", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link de preços</span>
              <input
                value={settingsForm.nav_pricing_label}
                onChange={(event) => updateSettings("nav_pricing_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>CTA da navegação</span>
              <input
                value={settingsForm.nav_cta_label}
                onChange={(event) => updateSettings("nav_cta_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link do CTA da navegação</span>
              <input
                value={settingsForm.nav_cta_href}
                onChange={(event) => updateSettings("nav_cta_href", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>CTA do topo do artigo</span>
              <input
                value={settingsForm.article_nav_cta_label}
                onChange={(event) => updateSettings("article_nav_cta_label", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Link do CTA do topo do artigo</span>
              <input
                value={settingsForm.article_nav_cta_href}
                onChange={(event) => updateSettings("article_nav_cta_href", event.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Título do CTA final</span>
            <input
              value={settingsForm.article_cta_title}
              onChange={(event) => updateSettings("article_cta_title", event.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Descrição do CTA final</span>
            <textarea
              value={settingsForm.article_cta_description}
              onChange={(event) => updateSettings("article_cta_description", event.target.value)}
              rows={3}
              className="resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
        </div>
      </section>

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
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Título</span>
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
                  <input
                    list="blog-category-options"
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                  <datalist id="blog-category-options">
                    {blogCategoryOptions.map((categoryOption) => (
                      <option key={categoryOption} value={categoryOption} />
                    ))}
                  </datalist>
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
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tags, separadas por vírgula</span>
                <input
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>URL da capa</span>
                  <input
                    value={form.cover_image_url}
                    onChange={(event) => update("cover_image_url", event.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="grid content-end gap-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Upload</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploadingCover}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      void uploadCover(file);
                      event.target.value = "";
                    }}
                  />
                  <span
                    className="inline-flex h-[42px] cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--primary)", backgroundColor: "var(--bg-subtle)" }}
                  >
                    {uploadingCover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    Enviar capa
                  </span>
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
                <span className="text-xs" style={{ color: bodyLength < 80 ? "var(--sentiment-negative)" : "var(--text-muted)" }}>
                  {bodyLength}/80 caracteres mínimos para salvar e publicar.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={saving} icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
                  Salvar
                </Button>
                <Button variant="secondary" onClick={publish} disabled={saving || !canPublish || selectedPost?.status === "published"} icon={<Globe2 className="h-4 w-4" />}>
                  {selectedId ? "Salvar e publicar" : "Criar e publicar"}
                </Button>
                <Button variant="outline" onClick={unpublish} disabled={saving || !selectedId || selectedPost?.status !== "published"}>
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
                {form.title || "Título do artigo"}
              </h3>
              <p className="mt-3 leading-7" style={{ color: "var(--text-muted)" }}>
                {form.excerpt || "Resumo do artigo aparece aqui antes de publicar."}
              </p>
              <BlogMarkdown className="mt-6" size="sm">
                {form.body_markdown || "Escreva o corpo em Markdown para visualizar."}
              </BlogMarkdown>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
