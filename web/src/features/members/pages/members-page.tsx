/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreateInvitationRoleEnum,
  OrganizationInvitation,
  OrganizationInvitationStatusEnum,
  OrganizationUser,
  OrganizationUserRoleEnum,
  UpdateInvitationRoleEnum,
  UpdateMemberRoleRoleEnum,
} from "@snapflow/api-client";
import { Edit, Mail, MoreVertical, Shield, Trash2, UserMinus, Users } from "lucide-react";
import { CancelOrganizationInvitationModal } from "@/components/modals/cancel-organization-invitation-modal";
import { CreateOrganizationInvitationModal } from "@/components/modals/create-organization-invitation-modal";
import { RemoveOrganizationMemberModal } from "@/components/modals/remove-organization-member-modal";
import { UpdateAssignedOrganizationRolesModal } from "@/components/modals/update-assigned-organization-roles-modal";
import { UpdateOrganizationInvitationModal } from "@/components/modals/update-organization-invitation-modal";
import { UpdateOrganizationMemberRolesModal } from "@/components/modals/update-organization-member-roles-modal";
import { Resource } from "@/components/resource/resource";
import type { ResourceColumn, ResourceRow } from "@/components/resource/resource-table";
import { timeCell } from "@/components/resource/time-cell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from "@/components/ui";
import { handleApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/api-client";
import { useOrganizationRoles } from "@/hooks/use-organization-roles";
import { useOrganizations } from "@/hooks/use-organizations";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

function RoleBadge({ role }: { role?: string }) {
  const config: Record<string, { label: string; className: string }> = {
    owner: { label: "Owner", className: "text-amber-400 bg-amber-400/10" },
    member: { label: "Member", className: "text-blue-400 bg-blue-400/10" },
  };
  const c = config[role ?? ""] ?? {
    label: role ?? "Unknown",
    className: "text-text-muted bg-surface-active",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-season text-[11px]",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

function InvitationStatusBadge({ status }: { status?: string }) {
  const config: Record<string, { label: string; className: string }> = {
    [OrganizationInvitationStatusEnum.PENDING]: {
      label: "Pending",
      className: "text-amber-400 bg-amber-400/10",
    },
    [OrganizationInvitationStatusEnum.ACCEPTED]: {
      label: "Accepted",
      className: "text-emerald-400 bg-emerald-400/10",
    },
    [OrganizationInvitationStatusEnum.DECLINED]: {
      label: "Declined",
      className: "text-red-400 bg-red-400/10",
    },
    [OrganizationInvitationStatusEnum.CANCELLED]: {
      label: "Cancelled",
      className: "text-text-muted bg-surface-active",
    },
  };
  const c = config[status ?? ""] ?? {
    label: status ?? "Unknown",
    className: "text-text-muted bg-surface-active",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-season text-[11px]",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

const MEMBER_COLUMNS: ResourceColumn[] = [
  { id: "email", header: "Email", widthMultiplier: 1.3 },
  { id: "name", header: "Name", widthMultiplier: 1.3 },
  { id: "role", header: "Role", widthMultiplier: 0.6 },
];

const INVITATION_COLUMNS: ResourceColumn[] = [
  { id: "email", header: "Email", widthMultiplier: 1.3 },
  { id: "invitedBy", header: "Invited By" },
  { id: "expires", header: "Expires", widthMultiplier: 0.8 },
  { id: "status", header: "Status", widthMultiplier: 0.6 },
];

export default function MembersPage() {
  const organizationsApi = apiClient.organizationsApi;

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

  // Dialog state for members
  const [memberToRemove, setMemberToRemove] = useState<OrganizationUser | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<OrganizationUser | null>(null);
  const [memberToChangeAssignedRoles, setMemberToChangeAssignedRoles] =
    useState<OrganizationUser | null>(null);

  // Dialog state for invitations
  const [invitationToCancel, setInvitationToCancel] = useState<OrganizationInvitation | null>(null);
  const [invitationToEdit, setInvitationToEdit] = useState<OrganizationInvitation | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

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

  const handleUpdateMemberRole = useCallback(
    async (userId: string, role: OrganizationUserRoleEnum): Promise<boolean> => {
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
    },
    [organizationsApi, selectedOrganization, refreshOrganizationMembers]
  );

  const handleUpdateAssignedOrganizationRoles = useCallback(
    async (userId: string, roleIds: string[]): Promise<boolean> => {
      if (!selectedOrganization) return false;
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
    },
    [organizationsApi, selectedOrganization, refreshOrganizationMembers]
  );

  const handleRemoveMember = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!selectedOrganization) return false;
      setLoadingMemberAction((prev) => ({ ...prev, [userId]: true }));
      try {
        await organizationsApi.deleteOrganizationMember(selectedOrganization.id, userId);
        toast.success("Member removed successfully");
        if (userId === authenticatedUserOrganizationMember?.userId) {
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
    },
    [
      organizationsApi,
      selectedOrganization,
      authenticatedUserOrganizationMember,
      refreshOrganizations,
      refreshOrganizationMembers,
    ]
  );

  const handleCreateInvitation = useCallback(
    async (
      email: string,
      role: CreateInvitationRoleEnum,
      assignedRoleIds: string[]
    ): Promise<boolean> => {
      if (!selectedOrganization) return false;
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
    },
    [organizationsApi, selectedOrganization, fetchInvitations]
  );

  const handleUpdateInvitation = useCallback(
    async (
      invitationId: string,
      role: UpdateInvitationRoleEnum,
      assignedRoleIds: string[]
    ): Promise<boolean> => {
      if (!selectedOrganization) return false;
      setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: true }));
      try {
        await organizationsApi.updateOrganizationInvitation(invitationId, selectedOrganization.id, {
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
    },
    [organizationsApi, selectedOrganization, fetchInvitations]
  );

  const handleCancelInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      if (!selectedOrganization) return false;
      setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: true }));
      try {
        await organizationsApi.cancelOrganizationInvitation(invitationId, selectedOrganization.id);
        toast.success("Invitation cancelled successfully");
        await fetchInvitations(false);
        return true;
      } catch (error) {
        handleApiError(error, "Failed to cancel invitation");
        return false;
      } finally {
        setLoadingInvitationAction((prev) => ({ ...prev, [invitationId]: false }));
      }
    },
    [organizationsApi, selectedOrganization, fetchInvitations]
  );

  const authenticatedUserIsOwner = useMemo(() => {
    return authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER;
  }, [authenticatedUserOrganizationMember]);

  // Members table
  const memberRows: ResourceRow[] = useMemo(
    () =>
      organizationMembers.map((m) => ({
        id: m.userId,
        cells: {
          email: {
            icon: <Users className="h-3.5 w-3.5" />,
            label: m.email,
          },
          name: { label: m.name },
          role: { content: <RoleBadge role={m.role} /> },
        },
        sortValues: {
          email: 0,
        },
      })),
    [organizationMembers]
  );

  const memberRowActions = useCallback(
    (id: string) => {
      if (!authenticatedUserIsOwner) return null;
      const member = organizationMembers.find((m) => m.userId === id);
      if (!member) return null;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-text-icon transition-colors hover:bg-surface-active"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              onClick={() => setMemberToChangeRole(member)}
              disabled={loadingMemberAction[id]}
            >
              <Shield className="mr-2 h-3.5 w-3.5" /> Change Role
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setMemberToChangeAssignedRoles(member)}
              disabled={loadingMemberAction[id]}
            >
              <Edit className="mr-2 h-3.5 w-3.5" /> Assigned Roles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setMemberToRemove(member)}
              disabled={loadingMemberAction[id]}
            >
              <UserMinus className="mr-2 h-3.5 w-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [authenticatedUserIsOwner, organizationMembers, loadingMemberAction]
  );

  const memberRowsWithActions: ResourceRow[] = useMemo(
    () =>
      memberRows.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          actions: { content: memberRowActions(row.id) },
        },
      })),
    [memberRows, memberRowActions]
  );

  const memberColumnsWithActions: ResourceColumn[] = authenticatedUserIsOwner
    ? [...MEMBER_COLUMNS, { id: "actions", header: "", widthMultiplier: 0.3 }]
    : MEMBER_COLUMNS;

  // Invitations table
  const invitationRows: ResourceRow[] = useMemo(
    () =>
      invitations.map((inv) => ({
        id: inv.id,
        cells: {
          email: {
            icon: <Mail className="h-3.5 w-3.5" />,
            label: inv.email,
          },
          invitedBy: { label: inv.invitedBy },
          expires: timeCell(inv.expiresAt),
          status: { content: <InvitationStatusBadge status={inv.status} /> },
        },
        sortValues: {
          expires: -new Date(inv.expiresAt ?? 0).getTime(),
        },
      })),
    [invitations]
  );

  const invitationRowActions = useCallback(
    (id: string) => {
      const inv = invitations.find((i) => i.id === id);
      if (!inv) return null;
      const isPending = inv.status === OrganizationInvitationStatusEnum.PENDING;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-text-icon transition-colors hover:bg-surface-active"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            {isPending && (
              <DropdownMenuItem
                onClick={() => setInvitationToEdit(inv)}
                disabled={loadingInvitationAction[id]}
              >
                <Edit className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
            )}
            {isPending && <DropdownMenuSeparator />}
            {isPending && (
              <DropdownMenuItem
                onClick={() => setInvitationToCancel(inv)}
                disabled={loadingInvitationAction[id]}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [invitations, loadingInvitationAction]
  );

  const invitationRowsWithActions: ResourceRow[] = useMemo(
    () =>
      invitationRows.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          actions: { content: invitationRowActions(row.id) },
        },
      })),
    [invitationRows, invitationRowActions]
  );

  const invitationColumnsWithActions: ResourceColumn[] = [
    ...INVITATION_COLUMNS,
    { id: "actions", header: "", widthMultiplier: 0.3 },
  ];

  return (
    <div className="flex h-full flex-col gap-0 overflow-y-auto">
      {authenticatedUserIsOwner && (
        <>
          <Resource
            icon={Mail}
            title="Invitations"
            columns={invitationColumnsWithActions}
            rows={invitationRowsWithActions}
            isLoading={loadingInvitations}
            emptyMessage="No invitations"
            create={{ label: "Invite member", onClick: () => setShowInviteDialog(true) }}
          />

          <CreateOrganizationInvitationModal
            open={showInviteDialog}
            onOpenChange={setShowInviteDialog}
            availableRoles={roles}
            loadingAvailableRoles={loadingRoles}
            onCreateInvitation={handleCreateInvitation}
          />
        </>
      )}

      <div className="border-border border-t" />
      <Resource
        icon={Users}
        title="Members"
        columns={memberColumnsWithActions}
        rows={memberRowsWithActions}
        isLoading={loadingRoles}
        emptyMessage="No members found"
      />

      {/* Member dialogs */}
      {memberToRemove && (
        <RemoveOrganizationMemberModal
          open={!!memberToRemove}
          onOpenChange={(open) => {
            if (!open) setMemberToRemove(null);
          }}
          onRemoveMember={() => handleRemoveMember(memberToRemove.userId)}
          loading={loadingMemberAction[memberToRemove.userId] ?? false}
        />
      )}

      {memberToChangeRole && (
        <UpdateOrganizationMemberRolesModal
          open={!!memberToChangeRole}
          onOpenChange={(open) => {
            if (!open) setMemberToChangeRole(null);
          }}
          initialRole={memberToChangeRole.role}
          onUpdateMemberRole={(role: UpdateMemberRoleRoleEnum) =>
            handleUpdateMemberRole(
              memberToChangeRole.userId,
              role as unknown as OrganizationUserRoleEnum
            )
          }
          loading={loadingMemberAction[memberToChangeRole.userId] ?? false}
        />
      )}

      {memberToChangeAssignedRoles && (
        <UpdateAssignedOrganizationRolesModal
          open={!!memberToChangeAssignedRoles}
          onOpenChange={(open) => {
            if (!open) setMemberToChangeAssignedRoles(null);
          }}
          initialData={memberToChangeAssignedRoles.assignedRoles}
          availableRoles={roles}
          loadingAvailableRoles={loadingRoles}
          onUpdateAssignedRoles={(roleIds: string[]) =>
            handleUpdateAssignedOrganizationRoles(memberToChangeAssignedRoles.userId, roleIds)
          }
          loading={loadingMemberAction[memberToChangeAssignedRoles.userId] ?? false}
        />
      )}

      {/* Invitation dialogs */}
      {invitationToCancel && (
        <CancelOrganizationInvitationModal
          open={!!invitationToCancel}
          onOpenChange={(open) => {
            if (!open) setInvitationToCancel(null);
          }}
          onCancelInvitation={() => handleCancelInvitation(invitationToCancel.id)}
          loading={loadingInvitationAction[invitationToCancel.id] ?? false}
        />
      )}

      {invitationToEdit && (
        <UpdateOrganizationInvitationModal
          open={!!invitationToEdit}
          onOpenChange={(open) => {
            if (!open) setInvitationToEdit(null);
          }}
          invitation={invitationToEdit}
          availableRoles={roles}
          loadingAvailableRoles={loadingRoles}
          onUpdateInvitation={(role: UpdateInvitationRoleEnum, assignedRoleIds: string[]) =>
            handleUpdateInvitation(invitationToEdit.id, role, assignedRoleIds)
          }
        />
      )}
    </div>
  );
}
