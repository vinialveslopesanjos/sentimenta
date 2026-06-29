import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, Clock } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Logo } from "@/components/ds/Logo";
import { blogPosts, getBlogPost } from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Sentimenta`,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updatedAt,
      tags: post.tags,
      images: [post.heroImage],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.updatedAt,
    author: {
      "@type": "Organization",
      name: "Sentimenta",
    },
    publisher: {
      "@type": "Organization",
      name: "Sentimenta",
    },
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        className="sticky top-0 z-50 backdrop-blur-xl shadow-sm"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 82%, transparent)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-4 md:px-8">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="hidden text-sm md:inline" style={{ color: "var(--text-muted)" }}>
              Blog
            </Link>
            <Link href="/login">
              <Button size="sm">Comece gratis</Button>
            </Link>
          </div>
        </div>
      </nav>

      <article className="mx-auto max-w-[860px] px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para o blog
        </Link>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}
          >
            {post.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <Calendar className="h-3.5 w-3.5" />
            {new Date(`${post.date}T00:00:00`).toLocaleDateString("pt-BR")}
          </span>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <Clock className="h-3.5 w-3.5" />
            {post.readTime}
          </span>
        </div>

        <h1
          className="max-w-[780px]"
          style={{
            color: "var(--text-primary)",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "clamp(2rem, 5vw, 3.4rem)",
            fontWeight: 800,
            letterSpacing: "0",
            lineHeight: 1.05,
          }}
        >
          {post.title}
        </h1>
        <p className="mt-5 max-w-[720px] text-lg leading-8" style={{ color: "var(--text-muted)" }}>
          {post.excerpt}
        </p>

        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <Image
            src={post.heroImage}
            alt={post.heroAlt}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 860px) 860px, 100vw"
          />
        </div>

        <div className="mt-10 space-y-6 text-base leading-8 md:text-lg" style={{ color: "var(--text-secondary)" }}>
          {post.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <aside
          className="mt-10 rounded-lg border p-6"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
        >
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Quer ver isso com comentarios reais?
          </h2>
          <p className="mt-2 leading-7" style={{ color: "var(--text-muted)" }}>
            O caminho mais rapido e analisar um perfil ou post publico e transformar os comentarios em score,
            temas, emocoes e riscos claros.
          </p>
          <Link href={post.cta.href} className="mt-5 inline-flex">
            <Button>{post.cta.label}</Button>
          </Link>
        </aside>
      </article>
    </main>
  );
}
