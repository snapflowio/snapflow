export const BLOG_CATEGORIES: {
  title: string;
  slug: "news";
  description: string;
}[] = [
  {
    title: "News",
    slug: "news",
    description: "Updates and announcements from Next SaaS Starter.",
  },
];

export const BLOG_AUTHORS = {
  bryanlawless: {
    name: "Bryan Lawless",
    image: "/avatars/avatar1.jpg",
    twitter: "bryanlawless_",
  },
  jackhouchin: {
    name: "Jack Houchin",
    image: "/avatars/jack.jpg",
    twitter: "RealJackHouchin",
  },
} as const;

export type BlogAuthorKey = keyof typeof BLOG_AUTHORS;
