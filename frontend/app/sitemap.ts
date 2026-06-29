import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog";
import { campaignPages } from "@/lib/campaigns";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sentimenta.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/blog", "/diagnostico", "/privacidade", "/termos", "/suporte"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "/blog" ? "weekly" : "monthly",
      priority: path === "" ? 1 : 0.7,
    }),
  );

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(`${post.updatedAt}T00:00:00`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  const campaignRoutes: MetadataRoute.Sitemap = Object.values(campaignPages).map((page) => ({
    url: `${siteUrl}/campanhas/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticRoutes, ...blogRoutes, ...campaignRoutes];
}
