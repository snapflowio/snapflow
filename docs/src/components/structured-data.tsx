interface StructuredDataProps {
  title: string;
  description: string;
  url: string;
  lang: string;
  dateModified?: string;
  breadcrumb?: Array<{ name: string; url: string }>;
}

export function StructuredData({
  title,
  description,
  url,
  lang,
  dateModified,
  breadcrumb,
}: StructuredDataProps) {
  const baseUrl = "https://snapflow.io";

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description: description,
    url: url,
    ...(dateModified && { datePublished: dateModified }),
    ...(dateModified && { dateModified }),
    author: {
      "@type": "Organization",
      name: "Snapflow",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Snapflow",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/branding/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    inLanguage: lang,
  };

  const breadcrumbStructuredData = breadcrumb
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData),
        }}
      />
      {breadcrumbStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbStructuredData),
          }}
        />
      )}
    </>
  );
}
