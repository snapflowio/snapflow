/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useState } from "react";
import {
  OrganizationInvitation,
  OrganizationInvitationRoleEnum,
  OrganizationRole,
  UpdateInvitationRoleEnum,
} from "@snapflow/api-client";
import {
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Checkbox,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui";
import { ViewerCheckbox } from "@/features/members/components/view-checkbox";

interface UpdateOrganizationInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: OrganizationInvitation;
  availableRoles: OrganizationRole[];
  loadingAvailableRoles: boolean;
  onUpdateInvitation: (
    role: UpdateInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
}

export function UpdateOrganizationInvitationModal({
  open,
  onOpenChange,
  invitation,
  availableRoles,
  loadingAvailableRoles,
  onUpdateInvitation,
}: UpdateOrganizationInvitationModalProps) {
  const [role, setRole] = useState<OrganizationInvitationRoleEnum>(invitation.role);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>(
    invitation.assignedRoles.map((role) => role.id)
  );
  const [loading, setLoading] = useState(false);

  const handleRoleAssignmentToggle = useCallback((roleId: string) => {
    setAssignedRoleIds((current) => {
      if (current.includes(roleId)) return current.filter((p) => p !== roleId);
      return [...current, roleId];
    });
  }, []);

  const handleUpdateInvitation = useCallback(async () => {
    setLoading(true);
    const success = await onUpdateInvitation(
      role,
      role === OrganizationInvitationRoleEnum.OWNER ? [] : assignedRoleIds
    );
    if (success) {
      onOpenChange(false);
      setRole(invitation.role);
      setAssignedRoleIds(invitation.assignedRoles.map((role) => role.id));
    }
    setLoading(false);
  }, [role, assignedRoleIds, onUpdateInvitation, onOpenChange, invitation]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setRole(invitation.role);
        setAssignedRoleIds(invitation.assignedRoles.map((role) => role.id));
      }
    },
    [onOpenChange, invitation]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Update Invitation</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input value={invitation.email} type="email" disabled readOnly />
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <ButtonGroup
                value={role}
                onValueChange={(v) => setRole(v as OrganizationInvitationRoleEnum)}
              >
                <ButtonGroupItem value={OrganizationInvitationRoleEnum.OWNER}>
                  Owner
                </ButtonGroupItem>
                <ButtonGroupItem value={OrganizationInvitationRoleEnum.MEMBER}>
                  Member
                </ButtonGroupItem>
              </ButtonGroup>
            </div>

            {role === OrganizationInvitationRoleEnum.MEMBER && !loadingAvailableRoles && (
              <>
                <div className="border-border border-t" />
                <div className="flex flex-col gap-2">
                  <Label>Assignments</Label>
                </div>
                <div className="space-y-4">
                  <ViewerCheckbox />
                  {availableRoles.map((availableRole) => (
                    <div key={availableRole.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`role-${availableRole.id}`}
                        checked={assignedRoleIds.includes(availableRole.id)}
                        onCheckedChange={() => handleRoleAssignmentToggle(availableRole.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`role-${availableRole.id}`} className="font-medium text-sm">
                          {availableRole.name}
                        </Label>
                        {availableRole.description && (
                          <p className="text-text-muted text-xs">{availableRole.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="default" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateInvitation} disabled={loading}>
            {loading ? "Updating..." : "Update"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
