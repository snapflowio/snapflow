import { useCallback, useEffect, useState } from "react";
import { OrganizationRole } from "@snapflow/api-client";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function useOrganizationRoles() {
  const { organizationsApi } = useApi();
  const { selectedOrganization } = useSelectedOrganization();

  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const fetchRoles = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoadingRoles(true);

      try {
        const response = await organizationsApi.listOrganizationRoles(selectedOrganization.id);
        setRoles(response.data);
      } catch (error) {
        handleApiError(error, "Failed to fetch organization roles");
      } finally {
        setLoadingRoles(false);
      }
    },
    [organizationsApi, selectedOrganization]
  );

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    loadingRoles,
    refreshRoles: fetchRoles,
  };
}
