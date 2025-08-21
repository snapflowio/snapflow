import { allPosts } from "contentlayer/generated";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Author from "@/components/content/author";
import { BlurImage } from "@/components/content/blur-image";
import { Mdx } from "@/components/content/mdx-components";
import { DashboardTableOfContents } from "@/components/content/toc";
import { Button } from "@/components/ui/button";
import { MaxWidthWrapper } from "@/components/wrappers/max-width-wrapper";
import { getTableOfContents } from "@/lib/toc";
import { constructMetadata, formatDate, getBlurDataURL, placeholderBlurhash } from "@/lib/util";
import { BLOG_CATEGORIES } from "@/constants/blog";
import { SITE_CONFIG } from "@/constants/site";

export async function generateStaticParams() {
  return allPosts.map((post) => ({
    slug: post.slugAsParams,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = allPosts.find((post) => post.slugAsParams === slug);
  if (!post) return;

  const { title, description, image } = post;

  return constructMetadata({
    title: `${title} - ${SITE_CONFIG.NAME}`,
    description: description,
    image,
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  const post = allPosts.find((post) => post.slugAsParams === slug);

  if (!post) notFound();

  const category = BLOG_CATEGORIES.find((category) => category.slug === post.categories[0])!;

  const relatedArticles =
    post.related
      ?.map((slug) => allPosts.find((post) => post.slugAsParams === slug))
      .filter((post): post is NonNullable<typeof post> => post !== undefined) || [];

  const toc = await getTableOfContents(post.body.raw);

  const [thumbnailBlurhash, images] = await Promise.all([
    getBlurDataURL(post.image),
    await Promise.all(
      post.images.map(async (src: string) => ({
        src,
        blurDataURL: await getBlurDataURL(src),
      }))
    ),
  ]);

  return (
    <>
      <MaxWidthWrapper className="pt-22">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <Button size={"sm"} variant={"outline"} className="h-8" asChild>
              <Link href={`/blog/category/${category.slug}`} className={"h-8"}>
                {category.title}
              </Link>
            </Button>
            <time dateTime={post.date} className="font-medium text-muted-foreground text-sm">
              {formatDate(post.date)}
            </time>
          </div>
          <h1 className="font-bold font-heading text-3xl text-foreground sm:text-4xl">
            {post.title}
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">{post.description}</p>
          <div className="flex flex-nowrap items-center space-x-5 pt-1 md:space-x-8">
            {post.authors.map((author) => (
              <Author username={author} key={post._id + author} />
            ))}
          </div>
        </div>
      </MaxWidthWrapper>

      <div className="relative">
        <div className="absolute top-52 w-full border-t" />
        <MaxWidthWrapper className="grid grid-cols-4 gap-10 pt-8 max-md:px-0">
          <div className="relative col-span-4 mb-10 flex flex-col space-y-8 border-y bg-background md:rounded-xl md:border lg:col-span-3">
            <BlurImage
              alt={post.title}
              blurDataURL={thumbnailBlurhash ?? placeholderBlurhash}
              className="aspect-[1200/630] border-b object-cover md:rounded-t-xl"
              width={1200}
              height={630}
              priority
              placeholder="blur"
              src={post.image}
              sizes="(max-width: 768px) 770px, 1000px"
            />
            <div className="px-[.8rem] pb-10 md:px-8">
              <Mdx code={post.body.code} images={images} />
            </div>
          </div>

          <div className="sticky top-20 col-span-1 mt-52 hidden flex-col divide-y divide-muted self-start pb-24 lg:flex">
            <DashboardTableOfContents toc={toc} />
          </div>
        </MaxWidthWrapper>
      </div>

      <MaxWidthWrapper>
        {relatedArticles.length > 0 && (
          <div className="flex flex-col space-y-4 pb-16">
            <p className="font-heading text-2xl text-foreground">More Articles</p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6">
              {relatedArticles.map((post) => (
                <Link
                  key={post.slug}
                  href={post.slug}
                  className="flex flex-col space-y-2 rounded-xl border p-5 transition-colors duration-300 hover:bg-muted/80"
                >
                  <h3 className="font-heading text-foreground text-xl">{post.title}</h3>
                  <p className="line-clamp-2 text-[15px] text-muted-foreground">
                    {post.description}
                  </p>
                  <p className="text-muted-foreground text-sm">{formatDate(post.date)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </MaxWidthWrapper>
    </>
  );
}
