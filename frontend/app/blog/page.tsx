import { BlogIndexClient } from "@/components/blog/BlogIndexClient";
import { fetchBlogSettings, fetchPublishedBlogPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const [posts, settings] = await Promise.all([fetchPublishedBlogPosts(), fetchBlogSettings()]);
  return <BlogIndexClient posts={posts} settings={settings} />;
}
