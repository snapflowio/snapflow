import { ApiClient } from "@/api/api-client";
import { ApiContext } from "@/context/api-context";
import { authClient } from "@/lib/auth-client";
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { AuthUIProviderTanstack } from "@snapflow/auth/tanstack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Create a single instance of the API client
const apiClient = new ApiClient();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={apiClient}>
        <AuthQueryProvider>
          <AuthUIProviderTanstack
            authClient={authClient}
            navigate={(href) => router.navigate({ href })}
            replace={(href) => router.navigate({ href, replace: true })}
            Link={({ href, ...props }) => <Link to={href} {...props} />}
          >
            {children}
          </AuthUIProviderTanstack>
        </AuthQueryProvider>
      </ApiContext.Provider>
    </QueryClientProvider>
  );
}
