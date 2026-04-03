/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Link } from "react-router";
import { Path } from "@/constants/paths";

const LINK_CLASS = "text-[14px] text-text-icon transition-colors hover:text-text-primary";

interface FooterItem {
  label: string;
  href: string;
  external?: boolean;
}

const PRODUCT_LINKS: FooterItem[] = [
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "https://docs.snapflow.io", external: true },
];

const RESOURCES_LINKS: FooterItem[] = [
  { label: "GitHub", href: "https://github.com/snapflowio/snapflow", external: true },
  { label: "Discord", href: "https://discord.gg/snapflow", external: true },
];

const SOCIAL_LINKS: FooterItem[] = [
  { label: "X (Twitter)", href: "https://twitter.com/snapflow", external: true },
  { label: "Discord", href: "https://discord.gg/snapflow", external: true },
  { label: "GitHub", href: "https://github.com/snapflowio/snapflow", external: true },
];

const LEGAL_LINKS: FooterItem[] = [
  { label: "Terms of Service", href: Path.TERMS },
  { label: "Privacy Policy", href: Path.PRIVACY },
];

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div>
      <h3 className="mb-4 font-medium text-[14px] text-text-primary">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {items.map(({ label, href, external }) =>
          external ? (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {label}
            </a>
          ) : (
            <Link key={label} to={href} className={LINK_CLASS}>
              {label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="bg-[#F6F6F6] pt-10 pb-10 font-[430] font-season text-[14px]"
    >
      <div className="px-4 sm:px-8 md:px-20">
        <div className="relative overflow-hidden rounded-lg bg-bg px-6 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
          <nav
            aria-label="Footer navigation"
            className="relative z-1 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5"
          >
            <div className="col-span-2 flex flex-col gap-6 sm:col-span-1">
              <Link to="/" aria-label="Snapflow home">
                <img
                  src="/branding/logo.png"
                  alt="Snapflow"
                  width={85}
                  height={26}
                  className="h-[26.4px] w-auto"
                />
              </Link>
            </div>

            <FooterColumn title="Product" items={PRODUCT_LINKS} />
            <FooterColumn title="Resources" items={RESOURCES_LINKS} />
            <FooterColumn title="Socials" items={SOCIAL_LINKS} />
            <FooterColumn title="Legal" items={LEGAL_LINKS} />
          </nav>
        </div>
      </div>
    </footer>
  );
}
