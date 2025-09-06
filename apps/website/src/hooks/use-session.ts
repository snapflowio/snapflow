import { authClient } from "@/lib/auth-client";

export function useSession() {
  const { data: session, isPending, error, refetch } = authClient.useSession();

  return {
    user: session?.user ?? null,
    session: session ?? null,
    isLoading: isPending,
    error,
    refetch,
  };
}
