"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { Path } from "@/constants/paths";
import { env } from "@/env";

interface Auth0ProviderWrapperProps {
  children: React.ReactNode;
}

export function Auth0ProviderWrapper({ children }: Auth0ProviderWrapperProps) {
  return (
    <Auth0Provider
      domain={env.NEXT_PUBLIC_OIDC_DOMAIN}
      clientId={env.NEXT_PUBLIC_OIDC_CLIENT_ID}
      authorizationParams={{
        audience: env.NEXT_PUBLIC_OIDC_AUDIENCE,
        redirect_uri: env.NEXT_PUBLIC_WEBSITE_URL + Path.DASHBOARD,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      useRefreshTokensFallback={false}
    >
      {children}
    </Auth0Provider>
  );
}
