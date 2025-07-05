import { FC, ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

interface PostHogProviderProps {
  children: ReactNode;
}

export const PosthogProvider: FC<PostHogProviderProps> = ({ children }) => {
  if (!import.meta.env.PROD) return children;

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
};
