import { useApi } from "@/hooks/use-api";
import type { CreateWorkspace, Workspace } from "@snapflow/api-client";
import {
    type UseMutationOptions,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "./keys";

export function useCreateWorkspace(
  options?: UseMutationOptions<Workspace, AxiosError, CreateWorkspace>
) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceData: CreateWorkspace) => {
      const response = await api.workspaceApi.createWorkspace(workspaceData);
      return response.data;
    },
    onSuccess: (newWorkspace) => {
      // Invalidate and refetch workspace queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });

      // Set the new workspace data in cache
      queryClient.setQueryData(queryKeys.workspaces.byId(newWorkspace.id), newWorkspace);
    },
    ...options,
  });
}

export function useListWorkspaces() {
  const api = useApi();

  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: async () => {
      const response = await api.workspaceApi.listWorkspaces();
      return response.data;
    },
  });
}
