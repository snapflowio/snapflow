import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiKeyList,
  ApiKeyResponse,
  CreateApiKeyPermissionsEnum,
  OrganizationUserRoleEnum,
} from "@snapflow/api-client";
import { toast } from "sonner";
import { CreateApiKeyDialog } from "@/components/dialogs/create-api-key-dialog";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { ApiKeyTable } from "./components/api-key-table";

export function ApiKeys() {
  const { apiKeyApi } = useApi();
  const [keys, setKeys] = useState<ApiKeyList[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  const { selectedOrganization, authenticatedUserOrganizationMember } = useSelectedOrganization();

  const availablePermissions = useMemo<CreateApiKeyPermissionsEnum[]>(() => {
    if (!authenticatedUserOrganizationMember) return [];

    if (authenticatedUserOrganizationMember.role === OrganizationUserRoleEnum.OWNER)
      return Object.values(CreateApiKeyPermissionsEnum);

    return Array.from(
      new Set(authenticatedUserOrganizationMember.assignedRoles.flatMap((role) => role.permissions))
    );
  }, [authenticatedUserOrganizationMember]);

  const fetchKeys = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;

      if (showTableLoadingState) setLoading(true);
      try {
        const response = await apiKeyApi.listApiKeys(selectedOrganization.id);
        setKeys(response.data);
      } catch (error) {
        handleApiError(error, "Failed to fetch API keys");
      } finally {
        setLoading(false);
      }
    },
    [apiKeyApi, selectedOrganization]
  );

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleRevoke = async (keyName: string) => {
    setLoadingKeys((prev) => ({ ...prev, [keyName]: true }));
    try {
      await apiKeyApi.deleteApiKey(keyName, selectedOrganization?.id);
      toast.success("API key revoked successfully");
      await fetchKeys(false);
    } catch (error) {
      handleApiError(error, "Failed to revoke API key");
    } finally {
      setLoadingKeys((prev) => ({ ...prev, [keyName]: false }));
    }
  };

  const handleCreateKey = async (
    name: string,
    permissions: CreateApiKeyPermissionsEnum[],
    expiresAt: Date | null
  ): Promise<ApiKeyResponse | null> => {
    try {
      const key = (
        await apiKeyApi.createApiKey({ name, permissions, expiresAt }, selectedOrganization?.id)
      ).data;
      toast.success("API key created successfully");
      await fetchKeys(false);
      return key;
    } catch (error) {
      handleApiError(error, "Failed to create API key");
      return null;
    }
  };

  return (
    <div className="px-2">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-bold text-2xl">API Keys</h1>
        <CreateApiKeyDialog
          availablePermissions={availablePermissions}
          onCreateApiKey={handleCreateKey}
        />
      </div>

      <ApiKeyTable
        data={keys}
        loading={loading}
        loadingKeys={loadingKeys}
        onRevoke={handleRevoke}
      />
    </div>
  );
}
