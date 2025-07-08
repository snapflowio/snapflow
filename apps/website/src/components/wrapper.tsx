import type React from "react";
import { cn } from "@/lib/util";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export function Wrapper({ children, className }: Props) {
  return (
    <div className={cn("mx-auto size-full max-w-6xl px-4 md:px-12", className)}>
      {children}
    </div>
  );
}
