import { allPosts } from "contentlayer/generated";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/content/blog-card";
import { getBlurDataURL } from "@/lib/util";
import { BLOG_CATEGORIES } from "@/constants/blog";

export async function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({
    slug: category.slug,
  }));
}

export default async function BlogCategory({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  const category = BLOG_CATEGORIES.find((ctg) => ctg.slug === slug);

  if (!category) notFound();

  const articles = await Promise.all(
    allPosts
      .filter((post) => post.categories.includes(category.slug))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(async (post) => ({
        ...post,
        blurDataURL: await getBlurDataURL(post.image),
      }))
  );

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, idx) => (
        <BlogCard key={article._id} data={article} priority={idx <= 2} />
      ))}
    </div>
  );
}
