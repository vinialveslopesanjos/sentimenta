"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, Clock, Search, Sparkles, Tags } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Logo } from "@/components/ds/Logo";
import { BlogCover } from "@/components/blog/BlogCover";
import { blogCategories, formatBlogDate, getFeaturedPost, type BlogPost } from "@/lib/blog";

type BlogIndexClientProps = {
  posts: BlogPost[];
};

export function BlogIndexClient({ posts }: BlogIndexClientProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof blogCategories)[number]>("Todos");
  const featuredPost = getFeaturedPost(posts);

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory = category === "Todos" || post.category === category;
      const matchesSearch =
        !term ||
        post.title.toLowerCase().includes(term) ||
        post.excerpt.toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [category, posts, search]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", fontFamily: "'Inter', sans-serif" }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 86%, transparent)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Logo size="md" />
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              <Link href="/#demo" className="text-sm" style={{ color: "var(--text-muted)" }}>
                Teste ao vivo
              </Link>
              <Link href="/#como" className="text-sm" style={{ color: "var(--text-muted)" }}>
                Como funciona
              </Link>
              <Link href="/#preco" className="text-sm" style={{ color: "var(--text-muted)" }}>
                Precos
              </Link>
              <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                Blog
              </span>
            </div>
          </div>
          <Link href="/login?utm_source=blog&utm_medium=nav&utm_campaign=start-free">
            <Button size="sm">Comece gratis</Button>
          </Link>
        </div>
      </nav>

      <section className="px-4 pb-10 pt-12 md:px-8 md:pt-16" style={{ backgroundColor: "var(--bg-card)" }}>
        <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Conteudo para transformar comentarios em decisao
            </span>
            <h1
              className="max-w-[760px]"
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "clamp(2.1rem, 5vw, 4.2rem)",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "0",
                lineHeight: 1.02,
              }}
            >
              Reputacao digital sem ler comentario por comentario
            </h1>
            <p className="mt-5 max-w-[640px] leading-7" style={{ color: "var(--text-muted)" }}>
              Guias curtos para social medias, agencias e fundadores entenderem sentimento,
              temas e sinais de crise antes que a conversa vire ruído.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              <Tags className="h-4 w-4" style={{ color: "var(--primary)" }} />
              Encontre o melhor ponto de entrada
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div
                className="flex flex-1 items-center gap-2 rounded-lg px-4 py-3"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <Search className="h-4 w-4" style={{ color: "var(--text-faint)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por dor, canal ou assunto"
                  className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <Link href="/diagnostico?utm_source=blog&utm_medium=hero&utm_campaign=diagnostico">
                <Button>Diagnostico gratuito</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
        {featuredPost && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="group overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <div className="relative aspect-[16/8] overflow-hidden">
                <BlogCover
                  src={featuredPost.coverImageUrl}
                  alt={featuredPost.coverImageAlt}
                  priority
                  className="transition-transform duration-500 group-hover:scale-[1.02]"
                  sizes="(min-width: 1024px) 760px, 100vw"
                />
              </div>
              <div className="p-6 md:p-7">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{featuredPost.category}</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatBlogDate(featuredPost.publishedAt || featuredPost.updatedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {featuredPost.readTimeMinutes} min
                  </span>
                </div>
                <h2 className="max-w-[720px] text-2xl font-bold leading-tight md:text-3xl" style={{ color: "var(--text-primary)" }}>
                  {featuredPost.title}
                </h2>
                <p className="mt-3 max-w-[720px] leading-7" style={{ color: "var(--text-muted)" }}>
                  {featuredPost.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }}>
                  Ler artigo
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>

            <aside
              className="rounded-lg border p-6"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
            >
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                O blog agora e vivo
              </h2>
              <p className="mt-3 leading-7" style={{ color: "var(--text-muted)" }}>
                Novos artigos podem entrar pelo painel admin, sem commit. A ideia e testar dores,
                CTAs e angulos de campanha com rapidez, mantendo rastreabilidade.
              </p>
              <Link href="/diagnostico?utm_source=blog&utm_medium=sidebar&utm_campaign=diagnostico" className="mt-5 inline-flex">
                <Button>Testar com um perfil</Button>
              </Link>
            </aside>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap gap-2">
            {blogCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: category === item ? "var(--primary-foreground)" : "var(--primary)",
                  backgroundColor: category === item ? "var(--primary)" : "var(--primary-bg)",
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex min-h-[300px] flex-col rounded-lg border p-5 transition-transform hover:-translate-y-0.5"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-md">
                  <BlogCover
                    src={post.coverImageUrl}
                    alt={post.coverImageAlt}
                    className="transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(min-width: 1024px) 360px, (min-width: 768px) 50vw, 100vw"
                  />
                </div>
                <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Calendar className="h-3.5 w-3.5" />
                  {formatBlogDate(post.publishedAt || post.updatedAt)}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readTimeMinutes} min
                  </span>
                </div>
                <span
                  className="mb-4 self-start rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}
                >
                  {post.category}
                </span>
                <h3 className="text-lg font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                  {post.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  {post.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }}>
                  Abrir
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div
              className="rounded-lg border p-8 text-center"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
            >
              Nenhum artigo encontrado para essa busca.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
