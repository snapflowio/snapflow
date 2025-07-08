import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter } from "react-router";
import App from "./app";
import { Path } from "./enums/paths";
import { ErrorBoundaryProvider } from "./providers/error-boundary";
import { PosthogProvider } from "./providers/posthog-provider";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
      <PosthogProvider>
        <Auth0Provider
          domain={import.meta.env.VITE_OIDC_DOMAIN}
          clientId={import.meta.env.VITE_OIDC_CLIENT_ID}
          authorizationParams={{
            audience: import.meta.env.VITE_OIDC_AUDIENCE,
            redirect_uri: window.location.origin + Path.DASHBOARD,
          }}
          cacheLocation="memory"
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Auth0Provider>
      </PosthogProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
