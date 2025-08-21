"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/util";

interface CopyButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function CopyButton({ value, className, ...props }: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  const handleCopyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    setHasCopied(true);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        "z-10 size-[30px] border border-white/25 bg-zinc-900 p-1.5 text-primary-foreground hover:text-foreground dark:text-foreground",
        className
      )}
      onClick={() => handleCopyValue(value)}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </Button>
  );
}
