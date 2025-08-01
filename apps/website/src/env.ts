import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_WEBSITE_URL: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string(),
    NEXT_PUBLIC_API_URL: z.string(),
    NEXT_PUBLIC_OIDC_DOMAIN: z.string(),
    NEXT_PUBLIC_OIDC_CLIENT_ID: z.string(),
    NEXT_PUBLIC_OIDC_AUDIENCE: z.string(),
    NEXT_PUBLIC_PROXY_TEMPLATE_URL: z.string(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_WEBSITE_URL: process.env.NEXT_PUBLIC_WEBSITE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_OIDC_DOMAIN: process.env.NEXT_PUBLIC_OIDC_DOMAIN,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
    NEXT_PUBLIC_OIDC_AUDIENCE: process.env.NEXT_PUBLIC_OIDC_AUDIENCE,
    NEXT_PUBLIC_PROXY_TEMPLATE_URL: process.env.NEXT_PUBLIC_PROXY_TEMPLATE_URL,
  },
});
