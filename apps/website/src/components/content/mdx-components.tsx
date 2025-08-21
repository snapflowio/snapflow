import Link from "next/link";
import { useMDXComponent } from "next-contentlayer2/hooks";
import { MdxCard } from "@/components/content/mdx-card";
import { Callout } from "@/components/ui/callout";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/util";
import { BlurImage } from "./blur-image";

const components = {
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn("mt-2 scroll-m-20 font-bold text-4xl tracking-tight", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        "mt-10 scroll-m-20 border-b pb-1 font-semibold text-2xl tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn("mt-8 scroll-m-20 font-semibold text-xl tracking-tight", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className={cn("mt-8 scroll-m-20 font-semibold text-lg tracking-tight", className)}
      {...props}
    />
  ),
  h5: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5
      className={cn("mt-8 scroll-m-20 font-semibold text-lg tracking-tight", className)}
      {...props}
    />
  ),
  h6: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6
      className={cn("mt-8 scroll-m-20 font-semibold text-base tracking-tight", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className={cn("font-medium underline underline-offset-4", className)} {...props} />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("leading-7 [&:not(:first-child)]:mt-6", className)} {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn("my-6 ml-6 list-disc", className)} {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className={cn("my-6 ml-6 list-decimal", className)} {...props} />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn("mt-2", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn("mt-6 border-l-2 pl-6 italic [&>*]:text-muted-foreground", className)}
      {...props}
    />
  ),
  img: ({ className, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/performance/noImgElement: keep this
    <img className={cn("rounded-md border", className)} alt={alt} {...props} />
  ),
  hr: ({ ...props }) => <hr className="my-4 md:my-8" {...props} />,
  table: ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className={cn("w-full", className)} {...props} />
    </div>
  ),
  tr: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={cn("m-0 border-t p-0 even:bg-muted", className)} {...props} />
  ),
  th: ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className={cn(
        "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      className={cn(
        "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  pre: ({
    className,
    __rawString__,
    ...props
  }: React.HTMLAttributes<HTMLPreElement> & { __rawString__?: string }) => (
    <div className="group relative w-full overflow-hidden">
      <pre
        className={cn(
          "max-h-[650px] overflow-x-auto rounded-lg border bg-zinc-900 py-4 dark:bg-zinc-900",
          className
        )}
        {...props}
      />
      {__rawString__ && (
        <CopyButton
          value={__rawString__}
          className={cn(
            "absolute top-4 right-4 z-20",
            "opacity-0 transition-all duration-250 group-hover:opacity-100"
          )}
        />
      )}
    </div>
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        "relative rounded-md border bg-muted px-[0.4rem] py-1 font-mono text-foreground text-sm",
        className
      )}
      {...props}
    />
  ),
  Callout,
  Card: MdxCard,
  Step: ({ className, ...props }: React.ComponentProps<"h3">) => (
    <h3
      className={cn(
        "mt-8 scroll-m-20 font-heading font-semibold text-xl tracking-tight",
        className
      )}
      {...props}
    />
  ),
  Steps: ({ ...props }) => (
    <div className="[&>h3]:step steps mb-12 ml-4 border-l pl-8 [counter-reset:step]" {...props} />
  ),
  Link: ({ className, ...props }: React.ComponentProps<typeof Link>) => (
    <Link className={cn("font-medium underline underline-offset-4", className)} {...props} />
  ),
  LinkedCard: ({ className, ...props }: React.ComponentProps<typeof Link>) => (
    <Link
      className={cn(
        "flex w-full flex-col items-center rounded-xl border bg-card p-6 text-card-foreground shadow transition-colors hover:bg-muted/50 sm:p-10",
        className
      )}
      {...props}
    />
  ),
};

interface MdxProps {
  code: string;
  images?: { alt: string; src: string; blurDataURL: string }[];
}

export function Mdx({ code, images }: MdxProps) {
  const Component = useMDXComponent(code);

  const MDXImage = (props: any) => {
    if (!images) return null;
    const blurDataURL = images.find((image) => image.src === props.src)?.blurDataURL;

    return (
      <div className="mt-5 w-full overflow-hidden rounded-lg border">
        <BlurImage
          {...props}
          blurDataURL={blurDataURL}
          className="size-full object-cover object-center"
        />
      </div>
    );
  };

  return (
    <div className="mdx">
      <Component
        components={{
          ...components,
          Image: MDXImage,
        }}
      />
    </div>
  );
}
