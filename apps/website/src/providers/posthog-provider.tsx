"use client";

import { ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";
import { env } from "@/env";

const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = env.NEXT_PUBLIC_POSTHOG_HOST;

interface PostHogProviderProps {
  children: ReactNode;
}

export function PosthogProvider({ children }: PostHogProviderProps) {
  if (!posthogKey || !posthogHost) {
    console.error("Invalid PostHog configuration");
    return children;
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: posthogHost,
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
