import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, Clock } from "lucide-react";
import { BlogCover } from "@/components/blog/BlogCover";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { Button } from "@/components/ds/Button";
import { Logo } from "@/components/ds/Logo";
import { fetchBlogSettings, fetchPublishedBlogPost, formatBlogDate } from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublishedBlogPost(slug);
  if (!post) return {};

  return {
    title: `${post.seoTitle || post.title} | Sentimenta`,
    description: post.seoDescription || post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      type: "article",
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt,
      tags: post.tags,
      images: [post.coverImageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([fetchPublishedBlogPost(slug), fetchBlogSettings()]);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Organization",
      name: post.authorName || "Sentimenta",
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
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 86%, transparent)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-4 md:px-8">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="hidden text-sm md:inline" style={{ color: "var(--text-muted)" }}>
              Blog
            </Link>
            <Link href={settings.articleNavCtaHref}>
              <Button size="sm">{settings.articleNavCtaLabel}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <article className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-14">
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
            {formatBlogDate(post.publishedAt || post.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <Clock className="h-3.5 w-3.5" />
            {post.readTimeMinutes} min
          </span>
        </div>

        <h1
          className="max-w-[820px] text-4xl font-extrabold leading-[1.05] md:text-6xl"
          style={{
            color: "var(--text-primary)",
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "0",
          }}
        >
          {post.title}
        </h1>
        <p className="mt-5 max-w-[760px] text-lg leading-8" style={{ color: "var(--text-muted)" }}>
          {post.excerpt}
        </p>

        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <BlogCover
            src={post.coverImageUrl}
            alt={post.coverImageAlt}
            priority
            sizes="(min-width: 900px) 900px, 100vw"
          />
        </div>

        <BlogMarkdown className="mt-10">{post.bodyMarkdown}</BlogMarkdown>

        <aside
          className="mt-10 rounded-lg border p-6"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
        >
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {settings.articleCtaTitle}
          </h2>
          <p className="mt-2 leading-7" style={{ color: "var(--text-muted)" }}>
            {settings.articleCtaDescription}
          </p>
          <Link href={post.cta.href} className="mt-5 inline-flex">
            <Button>{post.cta.label}</Button>
          </Link>
        </aside>
      </article>
    </main>
  );
}
