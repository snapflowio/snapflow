/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center text-(--text-secondary) hover:text-(--text-primary) justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-70 outline-none focus:outline-none focus-visible:outline-none rounded-[5px]",
  {
    variants: {
      variant: {
        default:
          "bg-(--surface-4) hover:bg-(--surface-6) border border-(--border) hover:border-(--border-1) dark:hover:bg-(--surface-5)",
        active:
          "bg-(--surface-5) hover:bg-(--surface-7) text-(--text-primary) border border-(--border-1) dark:hover:bg-(--border-1)",
        "3d": "text-(--text-tertiary) border-t border-l border-r border-(--border-1) shadow-[0_2px_0_0_var(--border-1)] hover:shadow-[0_4px_0_0_var(--border-1)] transition-all hover:-translate-y-0.5 hover:text-(--text-primary)",
        outline: "border border-(--text-muted) bg-transparent hover:border-(--text-secondary)",
        primary:
          "bg-[#1D1D1D] text-(--text-inverse) hover:text-(--text-inverse) hover:bg-[#2A2A2A] dark:bg-white dark:hover:bg-[#E0E0E0]",
        destructive: "bg-(--text-error) text-white hover:text-white hover:brightness-106",
        secondary: "bg-(--brand-secondary) text-(--text-primary)",
        tertiary:
          "bg-(--brand-tertiary-2)! text-(--text-inverse)! hover:text-(--text-inverse)! hover:bg-[#2DAC72]! dark:bg-(--brand-tertiary-2)! dark:hover:bg-[#2DAC72]! dark:text-(--text-inverse)! dark:hover:text-(--text-inverse)!",
        ghost: "",
        subtle: "text-(--text-body) hover:text-(--text-body) hover:bg-(--surface-4)",
        "ghost-secondary": "text-(--text-muted)",
        /** Branded button - requires branded-button-gradient or branded-button-custom class for colors */
        branded:
          "rounded-[10px] border text-white hover:text-white text-[15px] transition-all duration-200",
      },
      size: {
        sm: "px-[6px] py-[4px] text-[11px]",
        md: "px-[8px] py-[6px] text-[12px]",
        /** Branded size - matches login form button padding */
        branded: "py-[6px] pr-[10px] pl-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
