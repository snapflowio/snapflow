/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type * as React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb navigation component following emcn design patterns
 */
function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-[6px]", className)}
      {...props}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-[6px]">
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="block max-w-[200px] truncate font-medium text-(--text-tertiary) text-[14px] transition-colors hover:text-(--text-primary)"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "block max-w-[200px] truncate font-medium text-[14px]",
                  isLast ? "text-(--text-primary)" : "text-(--text-tertiary)"
                )}
              >
                {item.label}
              </span>
            )}

            {!isLast && <ChevronRight className="h-[14px] w-[14px] text-(--text-muted)" />}
          </div>
        );
      })}
    </nav>
  );
}

export { Breadcrumb };
