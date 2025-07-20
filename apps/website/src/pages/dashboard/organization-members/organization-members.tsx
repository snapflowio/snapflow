import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  CreateOrganizationInvitationRoleEnum,
  OrganizationInvitation,
  OrganizationUserRoleEnum,
  UpdateOrganizationInvitationRoleEnum,
} from "@snapflow/api-client";
import { toast } from "sonner";
import { CreateOrganizationInvitationDialog } from "@/components/dialogs/create-organization-invitation-dialog";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useOrganizationRoles } from "@/hooks/use-organization-roles";
import { useOrganizations } from "@/hooks/use-organizations";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { OrganizationInvitationTable } from "./components/organization-invitation-table";
import { OrganizationMemberTable } from "./components/organization-member-table";

export function OrganizationMembers() {
  const { user } = useAuth0();
  const { organizationsApi } = useApi();

  const { refreshOrganizations } = useOrganizations();
  const {
    selectedOrganization,
    organizationMembers,
    refreshOrganizationMembers,
    authenticatedUserOrganizationMember,
  } = useSelectedOrganization();
  const { roles, loadingRoles } = useOrganizationRoles();

  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  const [loadingMemberAction, setLoadingMemberAction] = useState<Record<string, boolean>>({});
  const [loadingInvitationAction, setLoadingInvitationAction] = useState<Record<string, boolean>>(
    {}
  );

  const fetchInvitations = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoadingInvitations(true);

      try {
        const response = await organizationsApi.listOrganizationInvitations(
          selectedOrganization.id
        );
        setInvitations(response.data);
      } catch (error) {
        handleApiError(error, "Failed to fetch invitations");
      } finally {
        setLoadingInvitations(false);
      }
    },
    [organizationsApi, selectedOrganization]
  );

  useEffect(() => {
    refreshOrganizationMembers();
    fetchInvitations();
  }, [fetchInvitations, refreshOrganizationMembers]);

  const handleUpdateMemberRole = async (
    userId: string,
    role: OrganizationUserRoleEnum
  ): Promise<boolean> => {
    if (!selectedOrganization) return false;

    setLoadingMemberAction((prev) => ({ ...prev, [userId]: true }));
    try {
      await organizationsApi.updateRoleForOrganizationMember(selectedOrganization.id, userId, {
        role,
      });
      toast.success("Role updated successfully");
      await refreshOrganizationMembers();
      return true;
    } catch (error) {
      handleApiError(error, "Failed to update member role");
      return false;
    } finally {
      setLoadingMemberAction((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleUpdateAssignedOrganizationRoles = async (
    userId: string,
    roleIds: string[]
  ): Promise<boolean> => {
    if (!selectedOrganization) {
      return false;
    }
    setLoadingMemberAction((prev) => ({ ...prev, [userId]: true }));
    try {
      await organizationsApi.updateAssignedOrganizationRoles(selectedOrganization.id, userId, {
        roleIds,
      });
      toast.success("Assignments updated successfully");
      await refreshOrganizationMembers();
      return true;
    } catch (error) {
      handleApiError(error, "Failed to update assignments");
      return false;
    } finally {
      setLoadingMemberAction((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemoveMember = async (userId: string): Promise<boolean> => {
    if (!selectedOrganization) {
      return false;
    }
    setLoadingMemberAction((prev) => ({ ...prev, [userId]: true }));
    try {
      await organizationsApi.deleteOrganizationMember(selectedOrganization.id, userId);
      toast.success("Member removed successfully");
      if (userId === user?.sub) {
        await refreshOrganizations();
      } else {
        await refreshOrganizationMembers();
      }
      return true;
    } catch (error) {
      handleApiError(error, "Failed to remove member");
      return false;
    } finally {
      setLoadingMemberAction((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleCreateInvitation = async (
    email: string,
    role: CreateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ): Promise<boolean> => {
    if (!selectedOrganization) {
      return false;
    }
    try {
      await organizationsApi.createOrganizationInvitation(selectedOrganization.id, {
        email,
        role,
        assignedRoleIds,
      });
      toast.success("Invitation created successfully");
      await fetchInvitations(false);
      return true;
    } catch (error) {
      handleApiError(error, "Failed to create invitation");
      return false;
    }
  };

  const handleUpdateInvitation = async (
    invitationId: string,
    role: UpdateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ): Promise<boolean> => {
    if (!selectedOrganization) return false;

    setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: true }));
    try {
      await organizationsApi.updateOrganizationInvitation(selectedOrganization.id, invitationId, {
        role,
        assignedRoleIds,
      });
      toast.success("Invitation updated successfully");
      await fetchInvitations(false);
      return true;
    } catch (error) {
      handleApiError(error, "Failed to update invitation");
      return false;
    } finally {
      setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: false }));
    }
  };

  const handleCancelInvitation = async (invitationId: string): Promise<boolean> => {
    if (!selectedOrganization) return false;

    setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: true }));
    try {
      await organizationsApi.cancelOrganizationInvitation(selectedOrganization.id, invitationId);
      toast.success("Invitation cancelled successfully");
      await fetchInvitations(false);
      return true;
    } catch (error) {
      handleApiError(error, "Failed to cancel invitation");
      return false;
    } finally {
      setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: false }));
    }
  };

  const authenticatedUserIsOwner = useMemo(() => {
    return authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER;
  }, [authenticatedUserOrganizationMember]);

  return (
    <div className="px-6 py-2">
      <div className="mb-2 flex h-12 items-center justify-between">
        <h1 className="font-medium text-2xl">Members</h1>
        {authenticatedUserIsOwner && (
          <CreateOrganizationInvitationDialog
            availableRoles={roles}
            loadingAvailableRoles={loadingRoles}
            onCreateInvitation={handleCreateInvitation}
          />
        )}
      </div>

      <OrganizationMemberTable
        data={organizationMembers}
        loadingData={loadingRoles}
        availableOrganizationRoles={roles}
        loadingAvailableOrganizationRoles={loadingRoles}
        onUpdateMemberRole={handleUpdateMemberRole}
        onUpdateAssignedOrganizationRoles={handleUpdateAssignedOrganizationRoles}
        onRemoveMember={handleRemoveMember}
        loadingMemberAction={loadingMemberAction}
        ownerMode={authenticatedUserIsOwner}
      />

      {authenticatedUserIsOwner && (
        <>
          <div className="mt-12 mb-2 flex h-12 items-center justify-between">
            <h1 className="font-medium text-2xl">Invitations</h1>
          </div>

          <OrganizationInvitationTable
            data={invitations}
            loadingData={loadingInvitations}
            availableRoles={roles}
            loadingAvailableRoles={loadingRoles}
            onCancelInvitation={handleCancelInvitation}
            onUpdateInvitation={handleUpdateInvitation}
            loadingInvitationAction={loadingInvitationAction}
          />
        </>
      )}
    </div>
  );
}
