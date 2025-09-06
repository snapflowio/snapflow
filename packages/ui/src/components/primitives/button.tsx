import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "ring-offset-background focus-visible:ring-gray-subtle-border inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "from-cyan-300 to-indigo bg-linear-to-br text-white hover:opacity-90 dark:text-black",
        destructive: "bg-destructive hover:opacity-90 text-destructive-foreground",
        outline:
          "border-gray-subtle-border bg-gray-element text-foreground-muted hover:bg-gray-element-hover hover:text-foreground border",
        ghost: "text-foreground-muted hover:bg-gray-element hover:text-foreground",
        link: "from-salmon to-pink before:from-salmon before:to-pink relative bg-linear-to-br bg-clip-text text-transparent before:absolute before:bottom-0 before:h-px before:w-[calc(100%-24px)] before:rounded-full before:bg-linear-to-br hover:opacity-90",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 py-1.5",
        lg: "px-3 py-1.5 lg:px-4 lg:py-2 lg:text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
