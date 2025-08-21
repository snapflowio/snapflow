import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "src/app/blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  image: string;
  authors: string[];
  categories: string[];
  related?: string[];
}

export function getAllBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BLOG_DIR);
  const posts = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const filePath = path.join(BLOG_DIR, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const { data } = matter(fileContent);

      return {
        slug: file.replace(".mdx", ""),
        title: data.title,
        description: data.description,
        date: data.date,
        published: data.published !== false,
        image: data.image,
        authors: data.authors || [],
        categories: data.categories || [],
        related: data.related,
      } as BlogPost;
    });

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPost(slug: string): BlogPost | null {
  const posts = getAllBlogPosts();
  return posts.find((post) => post.slug === slug) || null;
}
