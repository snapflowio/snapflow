import { Logo } from "@snapflow/ui";
import { Link } from "@tanstack/react-router";

const footerLinkSections = [
  {
    section: "GENERAL",
    links: [
      {
        title: "Blog",
        url: "/blog",
      },
      {
        title: "Contribute",
        url: "",
      },
    ],
  },
  {
    section: "SOCIAL",
    links: [
      {
        title: "Twitter",
        url: "",
      },
      {
        title: "Discord",
        url: "",
      },
    ],
  },
  {
    section: "LEGAL",
    links: [
      {
        title: "Terms of Service",
        url: "/tos",
      },
      {
        title: "Privacy Policy",
        url: "/privacy",
      },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-gray-element border-t py-12 lg:py-16">
      <div className="container flex flex-col justify-between md:flex-row">
        <div className="order-2 space-y-4 md:order-1">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-black text-lg tracking-wide">Snapflow</span>
          </div>
          <p className="text-foreground-muted text-sm">
            &copy; {new Date().getFullYear()} Snapflow. All Rights Reserved.
          </p>
        </div>
        <div className="order-1 mb-10 grid grid-cols-3 gap-0 md:order-2 md:mb-0 md:gap-12">
          {footerLinkSections.map(({ section, links }) => (
            <div className="text-sm" key={section}>
              <h3 className="pb-4 text-foreground-muted">{section}</h3>
              <ul className="flex flex-col gap-2">
                {links.map(({ title, url }) => (
                  <li key={title}>
                    {url.startsWith("/") ? (
                      <Link to={url}>{title}</Link>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer noopener">
                        {title}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
