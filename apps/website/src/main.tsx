/** biome-ignore-all  assist/source/organizeImports: need this to be first https://github.com/aidenybai/react-scan/blob/main/docs/installation/vite.md */
import { scan } from "react-scan";

import React from "react";
import { LogtoConfig, LogtoProvider, UserScope } from "@logto/react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter } from "react-router";
import { ErrorBoundaryProvider } from "./providers/error-boundary";
import { PosthogProvider } from "./providers/posthog-provider";
import { Routes } from "./routes/routes";

scan({
  enabled: true,
});

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const config: LogtoConfig = {
  appId: import.meta.env.VITE_OIDC_CLIENT_ID,
  endpoint: import.meta.env.VITE_OIDC_DOMAIN,
  scopes: [UserScope.Email, UserScope.Profile],
};

root.render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
      <PosthogProvider>
        <LogtoProvider config={config}>
          <BrowserRouter>
            <Routes />
          </BrowserRouter>
        </LogtoProvider>
      </PosthogProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
