import "./global.css";
import { Inter } from "next/font/google";
import { ErrorBoundary } from "react-error-boundary";
import { constructMetadata } from "@/lib/util";
import { Auth0ProviderWrapper } from "@/providers/auth0-provider";
import { ErrorBoundaryProvider } from "@/providers/error-boundary";
import { PosthogProvider } from "@/providers/posthog-provider";

export const metadata = constructMetadata();

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`dark ${inter.variable}`}>
        <ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
          <Auth0ProviderWrapper>
            <PosthogProvider>{children}</PosthogProvider>
          </Auth0ProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
