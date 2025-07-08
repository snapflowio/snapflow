import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Organization,
  OrganizationRolePermissionsEnum,
  OrganizationUserRoleEnum,
} from "@snapflow/api-client";
import { toast } from "sonner";
import { suspend } from "suspend-react";
import { handleApiError } from "@/lib/errors";
import {
  ISelectedOrganizationContext,
  SelectedOrganizationContext,
} from "@/context/selected-organization-context";
import { LocalStorageKey } from "@/enums/local-storage-key";
import { useApi } from "@/hooks/use-api";
import { useOrganizations } from "@/hooks/use-organizations";

type Props = {
  children: ReactNode;
};

export function SelectedOrganizationProvider(props: Props) {
  const { user } = useAuth0();
  const { organizationsApi } = useApi();
  const { organizations } = useOrganizations();

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(() => {
    const storedId = localStorage.getItem(LocalStorageKey.selectedOrganization);
    if (storedId && organizations.find((org) => org.id === storedId)) return storedId;

    if (organizations.length > 0) {
      const defaultOrg = organizations.find((org) => org.personal) || organizations[0];
      localStorage.setItem(LocalStorageKey.selectedOrganization, defaultOrg.id);
      return defaultOrg.id;
    }

    localStorage.removeItem(LocalStorageKey.selectedOrganization);
    return null;
  });

  useEffect(() => {
    if (!organizations.length) setSelectedOrganizationId(null);

    if (
      !selectedOrganizationId ||
      !organizations.some((org) => org.id === selectedOrganizationId)
    ) {
      const defaultOrg = organizations.find((org) => org.personal) || organizations[0];
      localStorage.setItem(LocalStorageKey.selectedOrganization, defaultOrg.id);
      setSelectedOrganizationId(defaultOrg.id);
    }
  }, [organizations, selectedOrganizationId]);

  const selectedOrganization = useMemo<Organization | null>(() => {
    if (!selectedOrganizationId) return null;
    return organizations.find((org) => org.id === selectedOrganizationId) || null;
  }, [organizations, selectedOrganizationId]);

  const getOrganizationMembers = useCallback(
    async (selectedOrganizationId: string | null) => {
      if (!selectedOrganizationId) return [];

      try {
        return (await organizationsApi.listOrganizationMembers(selectedOrganizationId)).data;
      } catch (error) {
        handleApiError(error, "Failed to fetch organization members");
        throw error;
      }
    },
    [organizationsApi]
  );

  const [organizationMembers, setOrganizationMembers] = useState(
    suspend(
      () => getOrganizationMembers(selectedOrganizationId),
      [organizationsApi, "organizationMembers"]
    )
  );

  const refreshOrganizationMembers = useCallback(
    async (organizationId?: string) => {
      const organizationMembers = await getOrganizationMembers(
        organizationId || selectedOrganizationId
      );
      setOrganizationMembers(organizationMembers);
      return organizationMembers;
    },
    [getOrganizationMembers, selectedOrganizationId]
  );

  const authenticatedUserOrganizationMember = useMemo(() => {
    return organizationMembers.find((member) => member.userId === user?.sub) || null;
  }, [organizationMembers, user]);

  const authenticatedUserAssignedPermissions = useMemo(() => {
    if (!authenticatedUserOrganizationMember) return null;
    return new Set(
      authenticatedUserOrganizationMember.assignedRoles.flatMap((role) => role.permissions)
    );
  }, [authenticatedUserOrganizationMember]);

  const authenticatedUserHasPermission = useCallback(
    (permission: OrganizationRolePermissionsEnum) => {
      if (!authenticatedUserOrganizationMember || !authenticatedUserAssignedPermissions)
        return false;

      if (authenticatedUserOrganizationMember.role === OrganizationUserRoleEnum.OWNER) return true;
      return authenticatedUserAssignedPermissions.has(permission);
    },
    [authenticatedUserOrganizationMember, authenticatedUserAssignedPermissions]
  );

  const handleSelectOrganization = useCallback(
    async (organizationId: string): Promise<boolean> => {
      const organizationMembers = await refreshOrganizationMembers(organizationId);

      if (organizationMembers.some((member) => member.userId === user?.sub)) {
        localStorage.setItem(LocalStorageKey.selectedOrganization, organizationId);
        setSelectedOrganizationId(organizationId);
        return true;
      }

      toast.error("Failed to switch organization", { closeButton: true });
      return false;
    },
    [refreshOrganizationMembers, user]
  );

  const contextValue: ISelectedOrganizationContext = useMemo(() => {
    return {
      selectedOrganization,
      organizationMembers,
      refreshOrganizationMembers,
      authenticatedUserOrganizationMember,
      authenticatedUserHasPermission,
      onSelectOrganization: handleSelectOrganization,
    };
  }, [
    selectedOrganization,
    organizationMembers,
    authenticatedUserOrganizationMember,
    authenticatedUserHasPermission,
    handleSelectOrganization,
    refreshOrganizationMembers,
  ]);

  return (
    <SelectedOrganizationContext.Provider value={contextValue}>
      {props.children}
    </SelectedOrganizationContext.Provider>
  );
}
