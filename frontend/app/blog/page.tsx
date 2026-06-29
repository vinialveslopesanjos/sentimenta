import { BlogIndexClient } from "@/components/blog/BlogIndexClient";
import { fetchPublishedBlogPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await fetchPublishedBlogPosts();
  return <BlogIndexClient posts={posts} />;
}
