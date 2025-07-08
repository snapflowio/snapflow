/// <reference types="vite/client" />

declare module "*.png" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BILLING_API_URL: string | undefined;
  readonly VITE_POSTHOG_KEY: string | undefined;
  readonly VITE_POSTHOG_HOST: string | undefined;
  readonly VITE_PROXY_TEMPLATE_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
