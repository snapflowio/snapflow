import Link from "next/link";
import { getBlurDataURL } from "@/lib/util";
import { BLOG_AUTHORS, type BlogAuthorKey } from "@/constants/blog";
import { BlurImage } from "./blur-image";

export default async function Author({
  username,
  imageOnly,
}: {
  username: string;
  imageOnly?: boolean;
}) {
  const authors = BLOG_AUTHORS;

  if (!(username in authors)) return null;

  const authorKey = username as BlogAuthorKey;

  return imageOnly ? (
    <BlurImage
      src={authors[authorKey].image}
      alt={authors[authorKey].name}
      width={32}
      height={32}
      priority
      placeholder="blur"
      blurDataURL={await getBlurDataURL(authors[authorKey].image!)}
      className="size-8 rounded-full transition-all group-hover:brightness-90"
    />
  ) : (
    <Link
      href={`https://twitter.com/${authors[authorKey].twitter}`}
      className="group flex w-max items-center space-x-2.5"
      target="_blank"
      rel="noopener noreferrer"
    >
      <BlurImage
        src={authors[authorKey].image}
        alt={authors[authorKey].name}
        width={40}
        height={40}
        priority
        placeholder="blur"
        blurDataURL={await getBlurDataURL(authors[authorKey].image!)}
        className="size-8 rounded-full transition-all group-hover:brightness-90 md:size-10"
      />
      <div className="-space-y-0.5 flex flex-col">
        <p className="font-semibold text-foreground max-md:text-sm">{authors[authorKey].name}</p>
        <p className="text-muted-foreground text-sm">@{authors[authorKey].twitter}</p>
      </div>
    </Link>
  );
}
