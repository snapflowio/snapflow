import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import "./global.css";
import { ErrorBoundary } from "react-error-boundary";
import { SITE_CONFIG } from "@/constants/site";
import { Auth0ProviderWrapper } from "@/providers/auth0-provider";
import { ErrorBoundaryProvider } from "@/providers/error-boundary";
import { PosthogProvider } from "@/providers/posthog-provider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.URL),
  title: {
    default: SITE_CONFIG.NAME,
    template: `%s - ${SITE_CONFIG.NAME}`,
  },
  description: SITE_CONFIG.DESCIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="dark">
        <ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
          <Auth0ProviderWrapper>
            <PosthogProvider>{children}</PosthogProvider>
          </Auth0ProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
