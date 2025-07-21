import React from "react";
import { LogtoConfig, LogtoProvider, UserScope } from "@logto/react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter } from "react-router";
import { ErrorBoundaryProvider } from "./providers/error-boundary";
import { PosthogProvider } from "./providers/posthog-provider";
import { Routes } from "./routes/routes";

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
