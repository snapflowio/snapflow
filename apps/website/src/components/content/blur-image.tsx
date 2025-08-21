"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/util";

export function BlurImage(props: ComponentProps<typeof Image>) {
  const [isLoading, setLoading] = useState(true);

  return (
    <Image
      {...props}
      alt={props.alt}
      className={cn(props.className, "duration-500 ease-in-out", isLoading ? "blur-sm" : "blur-0")}
      onLoad={() => setLoading(false)}
    />
  );
}
