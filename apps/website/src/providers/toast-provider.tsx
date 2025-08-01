"use client";

import { Toaster } from "@/components/ui/sonner";

export type ToastProviderProps = {
  richColors: boolean;
};

export function ToastProvider({ richColors }: ToastProviderProps) {
  return (
    <Toaster
      richColors={richColors}
      toastOptions={{
        classNames: {
          toast: richColors
            ? "group-[.toaster]:border group-[.toaster]:shadow-lg"
            : "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toaster]:bg-muted group-[.toaster]:border",
          icon: "pr-6",
        },
      }}
    />
  );
}
