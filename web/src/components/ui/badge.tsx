/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Shared base styles for status color badge variants */
const STATUS_BASE = "gap-[6px] rounded-[6px]";

const badgeVariants = cva(
  "inline-flex items-center font-medium focus:outline-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "gap-[4px] rounded-[40px] border border-(--border) text-(--text-secondary) bg-(--surface-4) hover:text-(--text-primary) hover:border-(--border-1) hover:bg-(--surface-5)",
        outline:
          "gap-[4px] rounded-[40px] border border-(--border-1) bg-transparent text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-5)",
        type: "gap-[4px] rounded-[40px] border border-(--border) text-(--text-secondary) bg-(--surface-6)",
        green: `${STATUS_BASE} bg-[rgba(34,197,94,0.2)] text-[#86efac]`,
        red: `${STATUS_BASE} bg-[#551a1a] text-(--text-error)`,
        gray: `${STATUS_BASE} bg-(--surface-4) text-(--text-secondary)`,
        blue: `${STATUS_BASE} bg-[rgba(59,130,246,0.2)] text-[#93c5fd]`,
        "blue-secondary": `${STATUS_BASE} bg-[rgba(51,180,255,0.2)] text-(--brand-secondary)`,
        purple: `${STATUS_BASE} bg-[rgba(168,85,247,0.2)] text-[#d8b4fe]`,
        orange: `${STATUS_BASE} bg-[rgba(249,115,22,0.2)] text-[#fdba74]`,
        amber: `${STATUS_BASE} bg-[rgba(245,158,11,0.2)] text-[#fcd34d]`,
        teal: `${STATUS_BASE} bg-[rgba(20,184,166,0.2)] text-[#5eead4]`,
        cyan: `${STATUS_BASE} bg-[rgba(14,165,233,0.2)] text-[#7dd3fc]`,
        pink: `${STATUS_BASE} bg-[rgba(236,72,153,0.2)] text-[#f9a8d4]`,
        "gray-secondary": `${STATUS_BASE} bg-(--surface-4) text-(--text-secondary)`,
      },
      size: {
        sm: "px-[7px] py-px text-[11px]",
        md: "px-[9px] py-[2px] text-[12px]",
        lg: "px-[9px] py-[2.25px] text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

/** Color variants that support dot indicators */
const STATUS_VARIANTS = [
  "green",
  "red",
  "gray",
  "blue",
  "blue-secondary",
  "purple",
  "orange",
  "amber",
  "teal",
  "cyan",
  "pink",
  "gray-secondary",
] as const;

/** Dot sizes corresponding to badge size variants */
const DOT_SIZES: Record<string, string> = {
  sm: "h-[5px] w-[5px]",
  md: "h-[6px] w-[6px]",
  lg: "h-[6px] w-[6px]",
};

/** Icon sizes corresponding to badge size variants */
const ICON_SIZES: Record<string, string> = {
  sm: "h-[10px] w-[10px]",
  md: "h-[12px] w-[12px]",
  lg: "h-[12px] w-[12px]",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Displays a dot indicator before content (only for color variants) */
  dot?: boolean;
  /** Icon component to render before content */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Displays a badge with configurable variant, size, and optional indicators.
 *
 * @remarks
 * Supports two categories of variants:
 * - **Bordered**: `default`, `outline`, `type` - traditional badges with borders
 * - **Status colors**: `green`, `red`, `gray`, `blue`, `blue-secondary`, `purple`,
 *   `orange`, `amber`, `teal`, `cyan`, `pink`, `gray-secondary` - borderless colored badges
 *
 * Status color variants can display a dot indicator via the `dot` prop.
 * All variants support an optional `icon` prop for leading icons.
 */
function Badge({
  className,
  variant,
  size,
  dot = false,
  icon: Icon,
  children,
  ...props
}: BadgeProps) {
  const isStatusVariant = STATUS_VARIANTS.includes(variant as (typeof STATUS_VARIANTS)[number]);
  const effectiveSize = size ?? "md";

  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {isStatusVariant && dot && (
        <div className={cn("rounded-[2px] bg-current", DOT_SIZES[effectiveSize])} />
      )}
      {Icon && <Icon className={ICON_SIZES[effectiveSize]} />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
