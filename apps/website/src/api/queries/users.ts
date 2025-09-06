import { useApi } from "@/hooks/use-api";
import type { User } from "@snapflow/api-client";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "./keys";

export function useMe(options?: UseQueryOptions<User, AxiosError>) {
  const api = useApi();

  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: async () => {
      const response = await api.userApi.getAuthenticatedUser();
      return response.data;
    },
    ...options,
  });
}
