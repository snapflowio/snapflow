import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App";
import { ErrorBoundaryProvider } from "./providers/error-boundary";
import { PosthogProvider } from "./providers/posthog-provider";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
      <PosthogProvider>
        <App />
      </PosthogProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
