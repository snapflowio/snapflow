/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useState } from "react";
import { CreateInvitationRoleEnum, OrganizationRole } from "@snapflow/api-client";
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

interface CreateOrganizationInvitationModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  availableRoles: OrganizationRole[];
  loadingAvailableRoles: boolean;
  onCreateInvitation: (
    email: string,
    role: CreateInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
}

export function CreateOrganizationInvitationModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  availableRoles,
  loadingAvailableRoles,
  onCreateInvitation,
}: CreateOrganizationInvitationModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CreateInvitationRoleEnum>(CreateInvitationRoleEnum.MEMBER);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [developerRole, setDeveloperRole] = useState<OrganizationRole | null>(null);

  useEffect(() => {
    if (!loadingAvailableRoles) {
      const devRole = availableRoles.find((r) => r.name === "Developer");
      if (devRole) {
        setDeveloperRole(devRole);
        setAssignedRoleIds([devRole.id]);
      }
    }
  }, [loadingAvailableRoles, availableRoles]);

  const handleRoleAssignmentToggle = useCallback((roleId: string) => {
    setAssignedRoleIds((current) => {
      if (current.includes(roleId)) return current.filter((p) => p !== roleId);
      return [...current, roleId];
    });
  }, []);

  const handleCreateInvitation = useCallback(async () => {
    setLoading(true);
    const success = await onCreateInvitation(
      email,
      role,
      role === CreateInvitationRoleEnum.OWNER ? [] : assignedRoleIds
    );
    if (success) {
      setOpen(false);
    }
    setLoading(false);
  }, [email, role, assignedRoleIds, onCreateInvitation, setOpen]);

  const handleModalOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        setEmail("");
        setRole(CreateInvitationRoleEnum.MEMBER);
        if (developerRole) {
          setAssignedRoleIds([developerRole.id]);
        } else {
          setAssignedRoleIds([]);
        }
      }
    },
    [developerRole, setOpen]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await handleCreateInvitation();
    },
    [handleCreateInvitation]
  );

  return (
    <Modal open={open} onOpenChange={handleModalOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Invite Member</ModalHeader>

        <ModalBody>
          <form id="invitation-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                type="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@example.com"
              />
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <ButtonGroup
                value={role}
                onValueChange={(v) => setRole(v as CreateInvitationRoleEnum)}
              >
                <ButtonGroupItem value={CreateInvitationRoleEnum.OWNER}>Owner</ButtonGroupItem>
                <ButtonGroupItem value={CreateInvitationRoleEnum.MEMBER}>Member</ButtonGroupItem>
              </ButtonGroup>
            </div>

            {role === CreateInvitationRoleEnum.MEMBER && !loadingAvailableRoles && (
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
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="default" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="invitation-form"
            disabled={loading || !email.trim()}
          >
            {loading ? "Inviting..." : "Invite"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
