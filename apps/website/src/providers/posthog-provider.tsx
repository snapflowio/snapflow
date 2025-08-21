"use client";

import { ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";
import { env } from "@/env";

interface PostHogProviderProps {
  children: ReactNode;
}

export function PosthogProvider({ children }: PostHogProviderProps) {
  return (
    <PostHogProvider
      apiKey={env.NEXT_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "always",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
